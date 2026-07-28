# -*- coding: utf-8 -*-
"""
merged.csv の住所から、緯度経度が空いている行を国土地理院APIでジオコーディングして補完する
（キッチンバトン用）

使い方（Mac）:
    source kb-env/bin/activate     # 前回作った仮想環境を再利用
    pip install requests pandas
    python geocode_merged.py

入力: merged.csv（同じフォルダに置く。前回スクリプトの出力をコピーしてください）
出力: merged_geocoded.csv         … 緯度経度を補完した全件データ
      merged_geocoded.geojson    … 地図表示用GeoJSON（欠損以外の全件）
      geocode_failed.csv         … ジオコーディングに失敗した行（住所が不完全 等）
"""

import csv
import io
import json
import time
from pathlib import Path

import pandas as pd
import requests

GSI_API = "https://msearch.gsi.go.jp/address-search/AddressSearch"
HEADERS = {"User-Agent": "Mozilla/5.0 (KitchenBaton geocoder; contact: your-email@example.com)"}

IN_FILE = Path("merged.csv")
OUT_CSV = Path("merged_geocoded.csv")
OUT_GEOJSON = Path("merged_geocoded.geojson")
OUT_FAILED = Path("geocode_failed.csv")

# 列名ゆれ対応
LAT_COLS = ["緯度"]
LON_COLS = ["経度"]
ADDR_COLS = ["住所"]
NAME_COLS = ["名称"]


def pick_col(df, candidates):
    for c in candidates:
        for col in df.columns:
            if c == str(col) or (c in str(col) and "." not in str(col)):
                return col
    return None


def geocode(address: str):
    """国土地理院の住所検索APIで緯度経度を取得。失敗時はNone。"""
    if not address or not isinstance(address, str) or len(address.strip()) < 3:
        return None
    try:
        r = requests.get(GSI_API, params={"q": address}, headers=HEADERS, timeout=15)
        r.raise_for_status()
        results = r.json()
        if not results:
            return None
        # 一番信頼度の高そうな最初の結果を採用（[経度, 緯度]の順で返る）
        lon, lat = results[0]["geometry"]["coordinates"]
        return float(lat), float(lon)
    except Exception:
        return None


def main():
    if not IN_FILE.exists():
        print(f"エラー: {IN_FILE} が見つかりません。前回のスクリプトが出力した"
              f"tokyo_kodomoshokudo/merged.csv をこのフォルダにコピーしてください。")
        return

    df = pd.read_csv(IN_FILE, dtype=str)
    lat_c = pick_col(df, LAT_COLS)
    lon_c = pick_col(df, LON_COLS)
    addr_c = pick_col(df, ADDR_COLS)
    name_c = pick_col(df, NAME_COLS)

    if not (lat_c and lon_c and addr_c):
        print("エラー: 緯度・経度・住所の列が見つかりませんでした。列名を確認してください。")
        print("列一覧:", list(df.columns))
        return

    print(f"対象: {len(df)} 行 / 緯度列={lat_c} 経度列={lon_c} 住所列={addr_c}")

    need_geocode = df[lat_c].isna() | (df[lat_c].astype(str).str.strip() == "")
    print(f"緯度経度が空の行: {need_geocode.sum()} 件 → ジオコーディングします")

    failed_rows = []
    success_count = 0

    for idx in df[need_geocode].index:
        addr = df.at[idx, addr_c]
        name = df.at[idx, name_c] if name_c else ""
        result = geocode(addr)
        if result:
            df.at[idx, lat_c] = result[0]
            df.at[idx, lon_c] = result[1]
            success_count += 1
        else:
            failed_rows.append({"名称": name, "住所": addr})
        time.sleep(0.5)  # APIに優しく（国土地理院は連続アクセスに注意）

        if (success_count + len(failed_rows)) % 50 == 0:
            print(f"  進捗: {success_count + len(failed_rows)} / {need_geocode.sum()}"
                  f"（成功 {success_count} / 失敗 {len(failed_rows)}）")

    print(f"\nジオコーディング完了: 成功 {success_count} 件 / 失敗 {len(failed_rows)} 件")

    df.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
    print(f"補完済みCSVを出力: {OUT_CSV}")

    if failed_rows:
        pd.DataFrame(failed_rows).to_csv(OUT_FAILED, index=False, encoding="utf-8-sig")
        print(f"失敗した行を出力: {OUT_FAILED}（住所の表記ゆれや欠損が原因。手動確認推奨）")

    # GeoJSON出力
    features = []
    for _, row in df.iterrows():
        try:
            lat, lon = float(row[lat_c]), float(row[lon_c])
        except (TypeError, ValueError):
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "name": row.get(name_c, "") if name_c else "",
                "address": row.get(addr_c, ""),
                "municipality": row.get("_自治体名", ""),
            },
        })
    geojson = {"type": "FeatureCollection", "features": features}
    OUT_GEOJSON.write_text(json.dumps(geojson, ensure_ascii=False), encoding="utf-8")
    print(f"GeoJSON出力: {len(features)} 地点 → {OUT_GEOJSON}")


if __name__ == "__main__":
    main()
