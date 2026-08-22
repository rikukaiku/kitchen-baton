# -*- coding: utf-8 -*-
"""
Google Driveでもらった子ども食堂データと、既存データ（tokyo_kodomoshokudo_combined.csv）
の重複状況を確認する（キッチンバトン用・一時スクリプト）

名称・住所を正規化して突き合わせ、自治体ごとに
「両方にある」「Driveのみ」「既存のみ」の件数を出す。
"""

import re
import unicodedata
from pathlib import Path

import pandas as pd

DRIVE_DIR = Path("/Users/tomoaki/Downloads/drive-download-20260822T052501Z-1-001")
EXISTING_CSV = Path("tokyo_kodomoshokudo_combined.csv")

# 子ども食堂データではないもの・そのままでは使えない特殊フォーマットは対象外
SKIP_FILES = {
    "202602191314LIFULL講演アンケート（回答）.xlsx",  # 講演アンケートで無関係
    "131091_shinagawaku_kodomosyokudo.xlsx",  # 年度比較形式で要別途整形
}
# 新規性のある自治体（既存データに無い）は重複チェックの対象外。別途追加検討
NEW_MUNICIPALITY_FILES = {
    "112291_SaitamaWakoushi_kodomonoibasho.xlsx",  # 和光市（埼玉県）
    "140007_kodomosyokudo_20260204 (3).xlsx",  # 神奈川県
}


def normalize(s) -> str:
    if not isinstance(s, str):
        return ""
    s = unicodedata.normalize("NFKC", s)
    return re.sub(r"[\s　「」『』（）()\-ー－―‐]", "", s)


def read_any(path: Path):
    if path.suffix == ".csv":
        for enc in ("utf-8-sig", "cp932", "shift_jis"):
            try:
                return pd.read_csv(path, encoding=enc, dtype=str)
            except (UnicodeDecodeError, pd.errors.ParserError):
                continue
        return None
    if path.suffix == ".xlsx":
        try:
            return pd.read_excel(path, dtype=str)
        except Exception:
            return None
    return None


def main():
    existing = pd.read_csv(EXISTING_CSV, dtype=str)
    existing["_key"] = existing["名称"].apply(normalize) + "|" + existing["住所"].apply(normalize).str[:20]
    existing_by_muni = {muni: set(g["_key"]) for muni, g in existing.groupby("市区町村名")}

    files = sorted(DRIVE_DIR.glob("*.csv")) + sorted(DRIVE_DIR.glob("*.xlsx"))
    print(f"{'ファイル':50s} {'自治体':8s} {'Drive件数':>8s} {'一致':>6s} {'Driveのみ':>10s}")
    print("-" * 90)

    for path in files:
        if path.name in SKIP_FILES:
            print(f"{path.name:50s} スキップ（対象外フォーマット）")
            continue
        if path.name in NEW_MUNICIPALITY_FILES:
            print(f"{path.name:50s} 新規自治体（既存データなし、別途追加検討）")
            continue

        df = read_any(path)
        if df is None or "名称" not in df.columns or "住所" not in df.columns:
            print(f"{path.name:50s} 読み込み失敗 or 列不一致")
            continue

        muni_col = "市区町村名" if "市区町村名" in df.columns else None
        muni = df[muni_col].dropna().mode()[0] if muni_col and not df[muni_col].dropna().empty else "?"

        df["_key"] = df["名称"].apply(normalize) + "|" + df["住所"].apply(normalize).str[:20]
        drive_keys = set(df["_key"]) - {"|"}

        existing_keys = existing_by_muni.get(muni, set())
        matched = drive_keys & existing_keys
        drive_only = drive_keys - existing_keys

        print(f"{path.name:50s} {muni:8s} {len(drive_keys):8d} {len(matched):6d} {len(drive_only):10d}")
        if drive_only and len(drive_only) <= 5:
            for k in drive_only:
                print(f"    → Driveのみ: {k}")


if __name__ == "__main__":
    main()
