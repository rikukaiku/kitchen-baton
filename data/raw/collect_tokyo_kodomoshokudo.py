# -*- coding: utf-8 -*-
"""
東京都オープンデータカタログから「子ども食堂一覧」を全自治体分ダウンロードして統合するスクリプト
（キッチンバトン用）

使い方:
    pip install requests pandas
    python collect_tokyo_kodomoshokudo.py

出力:
    tokyo_kodomoshokudo/raw/*.csv      … 自治体ごとの元データ（そのまま保存）
    tokyo_kodomoshokudo/merged.csv     … 全自治体を統合したCSV（UTF-8 BOM付き・Excelで開ける）
    tokyo_kodomoshokudo/merged.geojson … 緯度経度があるレコードのGeoJSON（地図表示用）
    tokyo_kodomoshokudo/sources.csv    … 取得元データセットの一覧（出典明記・ライセンス確認用）
"""

import csv
import io
import json
import re
import time
from pathlib import Path

import pandas as pd
import requests

CKAN_API = "https://catalog.data.metro.tokyo.lg.jp/api/3/action/package_search"
HEADERS = {"User-Agent": "Mozilla/5.0 (KitchenBaton data collector; contact: your-email@example.com)"}
OUT = Path("tokyo_kodomoshokudo")
RAW = OUT / "raw"

# 表記ゆれ対応：タイトルにこれらを含むデータセットを対象にする
KEYWORDS = ["子ども食堂", "こども食堂", "子供食堂"]

# 緯度・経度・名称・住所の列名ゆれ（共通フォーマット改訂前後の差異を吸収）
LAT_COLS = ["緯度", "lat", "latitude"]
LON_COLS = ["経度", "lon", "lng", "longitude"]
NAME_COLS = ["名称", "施設名", "子ども食堂名", "こども食堂名"]
ADDR_COLS = ["住所", "所在地", "住所（連結表記）", "所在地_連結表記"]


def search_datasets():
    """CKAN APIで子ども食堂関連データセットを検索する"""
    datasets = {}
    for kw in KEYWORDS:
        start = 0
        while True:
            r = requests.get(
                CKAN_API,
                params={"q": f'title:"{kw}"', "rows": 100, "start": start},
                headers=HEADERS,
                timeout=30,
            )
            r.raise_for_status()
            result = r.json()["result"]
            for pkg in result["results"]:
                title = pkg.get("title", "")
                if any(k in title for k in KEYWORDS):
                    datasets[pkg["id"]] = pkg
            start += 100
            if start >= result["count"]:
                break
            time.sleep(1)
    return list(datasets.values())


def read_csv_bytes(content: bytes) -> pd.DataFrame:
    """エンコーディング自動判定（自治体によりCP932/UTF-8混在）"""
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            return pd.read_csv(io.BytesIO(content), encoding=enc, dtype=str)
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    raise ValueError("エンコーディングを判定できませんでした")


def pick(df: pd.DataFrame, candidates):
    """列名候補から最初に見つかった列を返す"""
    for c in candidates:
        for col in df.columns:
            if c in str(col):
                return col
    return None


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    print("データセットを検索中...")
    datasets = search_datasets()
    print(f"{len(datasets)} 件のデータセットが見つかりました")

    frames, sources = [], []
    for pkg in datasets:
        org = pkg.get("organization", {}).get("title", "不明")
        title = pkg.get("title", "")
        license_title = pkg.get("license_title", "")
        for res in pkg.get("resources", []):
            fmt = (res.get("format") or "").upper()
            url = res.get("url", "")
            if fmt != "CSV" or not url:
                continue
            print(f"  取得: [{org}] {title} - {res.get('name','')}")
            try:
                r = requests.get(url, headers=HEADERS, timeout=60)
                r.raise_for_status()
                df = read_csv_bytes(r.content)
            except Exception as e:
                print(f"    !! 失敗: {e}")
                continue

            # 元データを保存（出典保全）
            safe = re.sub(r"[^\w\-]", "_", f"{org}_{res.get('name','data')}")[:80]
            (RAW / f"{safe}.csv").write_bytes(r.content)

            # 出所情報を付与
            df["_自治体名"] = org
            df["_データセット名"] = title
            df["_ライセンス"] = license_title
            df["_取得元URL"] = url
            frames.append(df)
            sources.append({"自治体": org, "データセット": title,
                            "ライセンス": license_title, "URL": url})
            time.sleep(1)  # サーバーに優しく

    if not frames:
        print("データが取得できませんでした。")
        return

    merged = pd.concat(frames, ignore_index=True, sort=False)
    merged.to_csv(OUT / "merged.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(sources).to_csv(OUT / "sources.csv", index=False, encoding="utf-8-sig")
    print(f"\n統合完了: {len(merged)} 行 → {OUT/'merged.csv'}")

    # GeoJSON出力（緯度経度がある行のみ）
    lat_c, lon_c = pick(merged, LAT_COLS), pick(merged, LON_COLS)
    name_c, addr_c = pick(merged, NAME_COLS), pick(merged, ADDR_COLS)
    features = []
    if lat_c and lon_c:
        for _, row in merged.iterrows():
            try:
                lat, lon = float(row[lat_c]), float(row[lon_c])
            except (TypeError, ValueError):
                continue
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "name": row.get(name_c, "") if name_c else "",
                    "address": row.get(addr_c, "") if addr_c else "",
                    "municipality": row["_自治体名"],
                },
            })
    geojson = {"type": "FeatureCollection", "features": features}
    (OUT / "merged.geojson").write_text(
        json.dumps(geojson, ensure_ascii=False), encoding="utf-8")
    print(f"GeoJSON出力: {len(features)} 地点 → {OUT/'merged.geojson'}")
    print("\n※ 緯度経度がない行は merged.csv に残っています。"
          "国土地理院APIでのジオコーディングは別途実行してください。")


if __name__ == "__main__":
    main()
