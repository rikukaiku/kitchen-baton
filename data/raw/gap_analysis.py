# -*- coding: utf-8 -*-
"""
子どもの人口データ（住民基本台帳・区市町村別年齢3区分人口）と子ども食堂データを掛け合わせて
空白地域（子ども人口の割に食堂が少ない区市町村）を分析する（キッチンバトン用・優先タスク2）

注意：
    東京都オープンデータカタログの「住民基本台帳による東京都の世帯と人口（町丁別・年齢別）」
    データセットには、実際には町丁別×年齢別のクロス集計表は含まれておらず、
    町丁別の人口総数（年齢区分なし・第５表）と、区市町村別の年齢３区分人口（第３－１表）が
    別々に収録されている。真の町丁・字単位や地域メッシュ単位での0～14歳人口を使うには
    e-Stat（政府統計の総合窓口）の国勢調査 小地域集計を別途取得する必要がある
    （kitchen-baton.skill 2-2参照）。
    そのため本スクリプトはまず区市町村単位でのギャップ分析を行う。町丁・メッシュ単位への
    精緻化は e-Stat 小地域データ取得後のフォローアップタスクとする。

使い方:
    python gap_analysis.py

入力:
    population_3-1.csv            … 東京都 区市町村・年齢3区分別人口（第3-1表、令和3年）
    tokyo_lg_codes.csv            … 全国地方公共団体コード マスタ（5桁→6桁変換に使用）
    tokyo_kodomoshokudo_combined.csv … 優先タスク1で作成した食堂統合データ（797件）
出力:
    gap_analysis_by_municipality.csv … 区市町村ごとの「0〜14歳人口 / 食堂数」ギャップスコア
"""

from pathlib import Path

import pandas as pd

POP_CSV = Path("population_3-1.csv")
LG_CODES_CSV = Path("tokyo_lg_codes.csv")
COMBINED_CSV = Path("tokyo_kodomoshokudo_combined.csv")
OUT_CSV = Path("gap_analysis_by_municipality.csv")


def load_population() -> pd.DataFrame:
    df = pd.read_csv(POP_CSV, encoding="utf-8-sig", dtype=str)
    df = df[df["地域階層"] == "4"].copy()
    df = df.rename(columns={"地域コード": "団体コード5桁", "地域": "市区町村名",
                             "年少人口(0～14歳)／総数(人)": "子ども人口0_14歳"})
    df["子ども人口0_14歳"] = df["子ども人口0_14歳"].astype(int)
    return df[["団体コード5桁", "市区町村名", "子ども人口0_14歳"]]


def load_lg_codes() -> pd.DataFrame:
    df = pd.read_csv(LG_CODES_CSV, dtype=str)
    df["団体コード5桁"] = df["団体コード"].str[:5]
    return df[["団体コード", "団体コード5桁", "市区町村名"]]


def load_facility_counts() -> pd.DataFrame:
    df = pd.read_csv(COMBINED_CSV, dtype=str)
    df["全国地方公共団体コード"] = df["全国地方公共団体コード"].fillna("").astype(str).str.replace(r"\.0$", "", regex=True)
    counts = df[df["全国地方公共団体コード"] != ""].groupby("全国地方公共団体コード").size()
    counts.name = "食堂数"
    return counts.reset_index().rename(columns={"全国地方公共団体コード": "団体コード"})


def main():
    pop = load_population()
    lg = load_lg_codes()
    facilities = load_facility_counts()

    merged = pop.merge(lg, on="団体コード5桁", how="left", suffixes=("", "_master"))
    merged = merged.merge(facilities, on="団体コード", how="left")
    merged["食堂数"] = merged["食堂数"].fillna(0).astype(int)

    # ギャップスコア = 子ども人口 / 食堂数（食堂ゼロは人口をそのままスコアにする＝最優先地域）
    merged["ギャップスコア"] = merged.apply(
        lambda r: r["子ども人口0_14歳"] if r["食堂数"] == 0 else round(r["子ども人口0_14歳"] / r["食堂数"]),
        axis=1,
    )

    result = merged[["団体コード", "市区町村名", "子ども人口0_14歳", "食堂数", "ギャップスコア"]].sort_values(
        "ギャップスコア", ascending=False)
    result.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")

    print(f"分析対象: {len(result)} 区市町村 → {OUT_CSV}")
    print("\n=== ギャップスコア上位10（子ども人口の割に食堂が少ない地域） ===")
    print(result.head(10).to_string(index=False))
    print(f"\n食堂が1件もない区市町村: {(result['食堂数'] == 0).sum()} 件")


if __name__ == "__main__":
    main()
