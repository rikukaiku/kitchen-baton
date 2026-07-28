# -*- coding: utf-8 -*-
"""
東京都福祉局「子供食堂推進事業」データ（R4jisseki.xlsx）を取得し、
区市町村オープンデータの統合済み最終データ（tokyo_kodomoshokudo_final.csv）と
名称＋住所の正規化で名寄せしたうえで、新規分のみをジオコーディングして追加する
（キッチンバトン用・優先タスク1）

使い方:
    source ../../kb-env/bin/activate  # または pip install requests pandas openpyxl
    python merge_tofukushikyoku.py

入力:
    R4jisseki.xlsx               … 都福祉局データ（同フォルダに用意済み。なければ自動DL）
    tokyo_kodomoshokudo_final.csv … 区市町村統合済み最終データ（629件）
    tokyo_lg_codes.csv            … 全国地方公共団体コード マスタ（東京都63件）
出力:
    tofukushikyoku_normalized.csv … 都データを共通フォーマット相当に整形したもの（294件）
    tofukushikyoku_new_only.csv   … 区市町村データと重複しない新規分（ジオコーディング前）
    tofukushikyoku_new_geocoded.csv … 新規分にジオコーディングを付与したもの
    tokyo_kodomoshokudo_combined.csv … 629件 + 新規分をマージした結合データ
    dedup_report.csv              … 都データ294件それぞれの名寄せ結果（重複/新規の判定理由）
"""

import re
import time
import unicodedata
from pathlib import Path
from typing import Optional

import pandas as pd
import requests

XLSX_URL = "https://www.opendata.metro.tokyo.lg.jp/fukushi/R4jisseki.xlsx"
XLSX_FILE = Path("R4jisseki.xlsx")
FINAL_CSV = Path("tokyo_kodomoshokudo_final.csv")
LG_CODES_CSV = Path("tokyo_lg_codes.csv")

GSI_API = "https://msearch.gsi.go.jp/address-search/AddressSearch"
HEADERS = {"User-Agent": "Mozilla/5.0 (KitchenBaton data collector; contact: your-email@example.com)"}


def normalize(s) -> str:
    """全角半角統一・空白除去・カッコ類除去による緩い正規化（名寄せ用）"""
    if not isinstance(s, str):
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[\s　]", "", s)
    s = re.sub(r"[「」『』（）()【】\-ー－―‐]", "", s)
    return s


def load_lg_codes() -> pd.DataFrame:
    if not LG_CODES_CSV.exists():
        raise FileNotFoundError(f"{LG_CODES_CSV} が見つかりません。先に団体コードマスタを用意してください。")
    return pd.read_csv(LG_CODES_CSV, dtype=str)


def guess_municipality(address: str, municipalities: list) -> Optional[str]:
    """住所文字列の先頭付近から市区町村名を推定する（長い名称から優先マッチ）"""
    if not isinstance(address, str):
        return None
    addr = unicodedata.normalize("NFKC", address)
    # 「東京都」を除去してから探す
    addr = addr.replace("東京都", "")
    for name in sorted(municipalities, key=len, reverse=True):
        if name in addr:
            return name
    return None


def fetch_xlsx():
    if XLSX_FILE.exists():
        print(f"{XLSX_FILE} は既に存在するため再取得をスキップします")
        return
    print(f"都福祉局データを取得中: {XLSX_URL}")
    r = requests.get(XLSX_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    XLSX_FILE.write_bytes(r.content)
    print(f"取得完了: {XLSX_FILE}")


def load_tofukushikyoku(lg_codes: pd.DataFrame) -> pd.DataFrame:
    df = pd.read_excel(XLSX_FILE, sheet_name="R4統合版", header=4)
    df = df.iloc[:, :7]
    df.columns = ["No", "名称", "郵便番号", "住所", "開催頻度", "開催規模", "URL"]
    df = df.dropna(subset=["名称"]).reset_index(drop=True)

    muni_list = lg_codes["市区町村名"].dropna().tolist()
    df["市区町村名"] = df["住所"].apply(lambda a: guess_municipality(a, muni_list))

    # 住所が「非公開」の連続ブロックのうち、施設名に含まれる地名（例：南千住＝荒川区）から
    # 元シートの並び順（区市町村ごとにまとまっている）と突き合わせて確度高く判定できたもののみ補完する。
    # 判定不能なブロックは市区町村名なしのまま残す（無理な推測はしない）。
    MANUAL_BLOCKS = [
        (53, 86, "世田谷区"),   # 「世田谷こども食堂 上馬」「桜新町」「砧」「烏山」等の地名で確認
        (100, 111, "豊島区"),  # 「池袋」「要町」の地名で確認
        (127, 133, "荒川区"),  # 「南千住」の地名で確認
        (162, 182, "江戸川区"),  # 「えどがわ」「南葛西」「かさい」の地名で確認
    ]
    for start, end, muni in MANUAL_BLOCKS:
        df.loc[start:end, "市区町村名"] = df.loc[start:end, "市区町村名"].fillna(muni)

    code_map = dict(zip(lg_codes["市区町村名"], lg_codes["団体コード"]))
    df["全国地方公共団体コード"] = df["市区町村名"].map(code_map)
    df["都道府県"] = "東京都"

    df["_名称正規化"] = df["名称"].apply(normalize)
    df["_住所正規化"] = df["住所"].apply(normalize)
    return df


def dedup_against_final(tofuku: pd.DataFrame, final: pd.DataFrame):
    """名称＋住所の正規化一致で重複判定。表記ゆれ（子供食堂/子ども食堂）は normalize() で吸収済み"""
    final = final.copy()
    final["_名称正規化"] = final["名称"].apply(normalize)
    final["_住所正規化"] = final["住所"].apply(normalize)

    report_rows = []
    new_rows = []
    for _, row in tofuku.iterrows():
        name_n, addr_n = row["_名称正規化"], row["_住所正規化"]

        # 1) 同一市区町村内で名称が完全一致 → 重複
        same_city = final[final["市区町村名"] == row["市区町村名"]] if row["市区町村名"] else final
        name_match = same_city[same_city["_名称正規化"] == name_n]

        # 2) 名称は完全一致しないが、住所の主要部分（市区町村名除いた先頭15文字）が
        #    互いに包含関係にあり、かつ名称の一部が共通する場合も重複とみなす
        addr_key = addr_n[:15]
        addr_match = same_city[
            same_city["_住所正規化"].str.contains(re.escape(addr_key), na=False, regex=True)
            & (addr_key != "")
        ] if addr_key else pd.DataFrame()

        if not name_match.empty:
            report_rows.append({"名称": row["名称"], "住所": row["住所"], "判定": "重複(名称完全一致)",
                                 "一致先": name_match.iloc[0]["名称"]})
        elif not addr_match.empty and any(
            name_n in a or a in name_n for a in addr_match["_名称正規化"] if a and name_n
        ):
            report_rows.append({"名称": row["名称"], "住所": row["住所"], "判定": "重複(住所近接+名称部分一致)",
                                 "一致先": addr_match.iloc[0]["名称"]})
        else:
            report_rows.append({"名称": row["名称"], "住所": row["住所"], "判定": "新規"})
            new_rows.append(row)

    report = pd.DataFrame(report_rows)
    new_df = pd.DataFrame(new_rows).drop(columns=["_名称正規化", "_住所正規化"], errors="ignore")
    return new_df, report


def geocode(address: str):
    if not address or not isinstance(address, str) or len(address.strip()) < 3:
        return None
    try:
        r = requests.get(GSI_API, params={"q": f"東京都{address}" if not address.startswith("東京都") else address},
                          headers=HEADERS, timeout=15)
        r.raise_for_status()
        results = r.json()
        if not results:
            return None
        lon, lat = results[0]["geometry"]["coordinates"]
        return float(lat), float(lon)
    except Exception:
        return None


def geocode_new(new_df: pd.DataFrame) -> pd.DataFrame:
    new_df = new_df.copy()
    new_df["緯度"] = None
    new_df["経度"] = None
    print(f"新規 {len(new_df)} 件をジオコーディング中...")
    ok = 0
    for idx, row in new_df.iterrows():
        result = geocode(row["住所"])
        if result:
            new_df.at[idx, "緯度"], new_df.at[idx, "経度"] = result
            ok += 1
        time.sleep(0.5)
    print(f"ジオコーディング完了: 成功 {ok} / {len(new_df)}")
    return new_df


def build_combined(final: pd.DataFrame, new_geocoded: pd.DataFrame) -> pd.DataFrame:
    add = pd.DataFrame({
        "全国地方公共団体コード": new_geocoded["全国地方公共団体コード"],
        "都道府県": new_geocoded["都道府県"],
        "市区町村名": new_geocoded["市区町村名"],
        "名称": new_geocoded["名称"],
        "住所": new_geocoded["住所"],
        "緯度": new_geocoded["緯度"],
        "経度": new_geocoded["経度"],
        "開催頻度": new_geocoded["開催頻度"],
        "URL": new_geocoded["URL"],
        "_自治体名": "東京都福祉局",
        "_データセット名": "子供食堂推進事業(R4実績)",
        "_ライセンス": "クリエイティブ・コモンズ 表示（CC BY）",
        "_取得元URL": XLSX_URL,
    })
    return pd.concat([final, add], ignore_index=True, sort=False)


def main():
    lg_codes = load_lg_codes()
    fetch_xlsx()
    tofuku = load_tofukushikyoku(lg_codes)
    print(f"都福祉局データ: {len(tofuku)} 件（うち市区町村名を推定できなかったもの: {tofuku['市区町村名'].isna().sum()} 件）")
    tofuku.drop(columns=["_名称正規化", "_住所正規化"]).to_csv(
        "tofukushikyoku_normalized.csv", index=False, encoding="utf-8-sig")

    final = pd.read_csv(FINAL_CSV, dtype=str)
    new_df, report = dedup_against_final(tofuku, final)
    report.to_csv("dedup_report.csv", index=False, encoding="utf-8-sig")
    print(f"名寄せ結果: 重複 {len(report) - len(new_df)} 件 / 新規 {len(new_df)} 件")
    new_df.to_csv("tofukushikyoku_new_only.csv", index=False, encoding="utf-8-sig")

    new_geocoded = geocode_new(new_df)
    new_geocoded.to_csv("tofukushikyoku_new_geocoded.csv", index=False, encoding="utf-8-sig")

    combined = build_combined(final, new_geocoded)
    combined.to_csv("tokyo_kodomoshokudo_combined.csv", index=False, encoding="utf-8-sig")
    print(f"\n結合完了: {len(final)} 件（区市町村） + {len(new_geocoded)} 件（都・新規） "
          f"= {len(combined)} 件 → tokyo_kodomoshokudo_combined.csv")


if __name__ == "__main__":
    main()
