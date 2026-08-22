# -*- coding: utf-8 -*-
"""
gap_analysis_by_municipality.csv（区市町村ごとの子ども人口×食堂数のギャップスコア、
優先タスク2で作成済み）に、地図表示用の緯度経度を付与して
public/data/gap_analysis.json を生成する（ニーズアラート機能を実データに接続するため）

使い方:
    python build_gap_analysis_geo.py

入力:
    gap_analysis_by_municipality.csv （東京都62市区町村、子ども人口・食堂数・ギャップスコア）
出力:
    public/data/gap_analysis.json （緯度経度・ニーズレベル付き）
"""

import json
import time
from pathlib import Path

import pandas as pd
import requests

GSI_API = "https://msearch.gsi.go.jp/address-search/AddressSearch"
HEADERS = {"User-Agent": "Mozilla/5.0 (KitchenBaton gap-analysis geocoder; contact: your-email@example.com)"}

IN_CSV = Path("gap_analysis_by_municipality.csv")
OUT_JSON = Path("../../public/data/gap_analysis.json")

# ギャップスコア（子ども人口 ÷ 食堂数。食堂ゼロは人口そのまま）に基づくニーズレベルの閾値
HIGH_THRESHOLD = 3000
MID_THRESHOLD = 1000


def need_level(gap_score: int) -> str:
    if gap_score >= HIGH_THRESHOLD:
        return "高"
    if gap_score >= MID_THRESHOLD:
        return "中"
    return "低"


def geocode_municipality(name: str):
    query = f"東京都{name}"
    try:
        r = requests.get(GSI_API, params={"q": query}, headers=HEADERS, timeout=15)
        r.raise_for_status()
        results = r.json()
        if not results:
            return None
        lon, lat = results[0]["geometry"]["coordinates"]
        return float(lat), float(lon)
    except Exception:
        return None


def main():
    df = pd.read_csv(IN_CSV, dtype=str)
    df["子ども人口0_14歳"] = df["子ども人口0_14歳"].astype(int)
    df["食堂数"] = df["食堂数"].astype(int)
    df["ギャップスコア"] = df["ギャップスコア"].astype(int)

    features = []
    failed = []
    for _, row in df.iterrows():
        name = row["市区町村名"]
        result = geocode_municipality(name)
        if not result:
            failed.append(name)
            time.sleep(0.5)
            continue
        lat, lon = result
        features.append({
            "id": row["団体コード"],
            "name": name,
            "lat": lat,
            "lng": lon,
            "children": row["子ども人口0_14歳"],
            "facilities": row["食堂数"],
            "gapScore": row["ギャップスコア"],
            "need": need_level(row["ギャップスコア"]),
        })
        time.sleep(0.5)

    print(f"ジオコーディング完了: 成功 {len(features)} / {len(df)}")
    if failed:
        print(f"失敗: {', '.join(failed)}")

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(features, ensure_ascii=False), encoding="utf-8")
    print(f"出力: {len(features)} 件 → {OUT_JSON}")


if __name__ == "__main__":
    main()
