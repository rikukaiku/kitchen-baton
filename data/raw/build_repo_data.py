# -*- coding: utf-8 -*-
"""
data/raw/tokyo_kodomoshokudo_combined.csv（優先タスク1で作成した629件＋都追加169件）を
リポジトリの実装データとして整形し、public/ と data/ に配置する（キッチンバトン用・優先タスク3）

出力:
    public/data/tokyo_kodomoshokudo.geojson … 地図表示用（緯度経度判明分のみ・軽量）
    data/tokyo_kodomoshokudo_final.csv       … 元データ（重複列・空列・電話/メール等の連絡先列を除去）
    data/SOURCES.md                          … 出典・ライセンス表記
"""

import json
from pathlib import Path

import pandas as pd

COMBINED_CSV = Path("tokyo_kodomoshokudo_combined.csv")
REPO_ROOT = Path("../..")
GEOJSON_OUT = REPO_ROOT / "public" / "data" / "tokyo_kodomoshokudo.geojson"
CSV_OUT = REPO_ROOT / "data" / "tokyo_kodomoshokudo_final.csv"
SOURCES_OUT = REPO_ROOT / "data" / "SOURCES.md"

# 出力CSVから除く列（数値のみ・全件空・他自治体データ由来の重複列などノイズ）
DROP_COLS = [
    "Unnamed: 50", "Unnamed: 51", "Unnamed: 52", "Unnamed: 53",
    "Unnamed: 54", "Unnamed: 55", "Unnamed: 56",
    "?全国地方公共団体コード", "GIS搭載用住所", "経度.1", "緯度.1", "分類", "URL_2",
]

# 電話・メールなどの直接連絡先列（元データでは公開情報だが、リポジトリに載せるCSVからは
# 念のため除外する。data/raw/tokyo_kodomoshokudo_combined.csv には残っているので必要な
# 場合はそちらを参照する）
CONTACT_COLS = [
    "電話番号1", "電話番号1_連絡先備考", "電話番号2", "電話番号2_連絡先備考",
    "内線番号", "FAX番号", "メールアドレス1", "メールアドレス1_連絡先備考",
    "メールアドレス2", "メールアドレス2_連絡先備考",
]


def main():
    df = pd.read_csv(COMBINED_CSV, dtype=str)
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])

    CSV_OUT.parent.mkdir(parents=True, exist_ok=True)
    csv_export = df.drop(columns=[c for c in CONTACT_COLS if c in df.columns])
    csv_export.to_csv(CSV_OUT, index=False, encoding="utf-8-sig")
    print(f"CSV出力: {len(csv_export)} 行（連絡先列は除外） → {CSV_OUT}")

    def s(value) -> str:
        """NaN/None を空文字列に統一する（json.dumpsが不正なNaNトークンを出さないようにするため）"""
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return ""
        return str(value)

    geo_df = df.dropna(subset=["緯度", "経度"]).copy()
    features = []
    for _, row in geo_df.iterrows():
        try:
            lat, lon = float(row["緯度"]), float(row["経度"])
        except (TypeError, ValueError):
            continue
        needs = row.get("実施支援の主な区分")
        needs_list = [n.strip() for n in needs.split(";")] if isinstance(needs, str) else []
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "name": s(row.get("名称")),
                "address": s(row.get("住所")),
                "municipality": s(row.get("市区町村名")) or s(row.get("_自治体名")),
                "needs": needs_list,
                "frequency": s(row.get("開催頻度")),
                "url": s(row.get("URL")),
                "lgCode": s(row.get("全国地方公共団体コード")),
                "source": s(row.get("_自治体名")),
                "license": s(row.get("_ライセンス")),
            },
        })
    geojson = {"type": "FeatureCollection", "features": features}
    GEOJSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    GEOJSON_OUT.write_text(json.dumps(geojson, ensure_ascii=False), encoding="utf-8")
    print(f"GeoJSON出力: {len(features)} 地点 → {GEOJSON_OUT}")

    sources = df[["_自治体名", "_データセット名", "_ライセンス", "_取得元URL"]].drop_duplicates().sort_values("_自治体名")
    lines = [
        "# データ出典",
        "",
        f"`tokyo_kodomoshokudo_final.csv` / `public/data/tokyo_kodomoshokudo.geojson` は",
        f"東京都オープンデータカタログで公開されている区市町村ごとの子ども食堂一覧と、",
        f"東京都福祉局「子供食堂推進事業」データを統合したものです（全{len(df)}件）。",
        "",
        "ライセンスはいずれも **CC BY 4.0**（クリエイティブ・コモンズ 表示）です。",
        "画面に表示する際は各データセットの出典を明記してください。",
        "",
        "| 自治体 | データセット名 | ライセンス | 取得元URL |",
        "|---|---|---|---|",
    ]
    for _, r in sources.iterrows():
        if pd.isna(r["_自治体名"]):
            continue
        lines.append(f"| {r['_自治体名']} | {r['_データセット名']} | {r['_ライセンス']} | {r['_取得元URL']} |")
    SOURCES_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"出典一覧出力: {len(sources)} 件 → {SOURCES_OUT}")


if __name__ == "__main__":
    main()
