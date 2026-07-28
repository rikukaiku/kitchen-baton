# -*- coding: utf-8 -*-
"""
東京都の「公民館・区民館・地区センター・コミュニティセンター」等、
市民が予約・利用できる公共施設のデータを収集する（キッチンバトン用）

対象の考え方：
    ユーザー定義「公民館の定義は市民が借りられる公共の場所」に基づき、
    社会教育法上の「公民館」だけでなく、東京都特別区で同じ役割を担う
    「区民館」「区民センター」「地区センター」「コミュニティセンター」
    「文化センター」「集会所」等も同じ枠として収集する。

データソース：
    1. 東京都教育庁「施設関連情報_公民館」（都内の公民館そのもの・81件）
    2. 各区市町村の「公共施設一覧」（自治体標準オープンデータセット形式が中心）
       → 施設名 or 大区分/小区分/カテゴリ列を、コミュニティ施設系のキーワードで絞り込む
    3. 品川区「公共施設」（カテゴリ列あり・緯度経度なし→ジオコーディング）
    4. 港区「区民センター・区民協働施設」一覧（緯度経度あり）

出力:
    koumin_facilities_raw.csv      … 収集直後の全件（自治体別・出典付き）
    koumin_facilities_final.csv    … ジオコーディング後の最終データ
"""

import io
import re
import time
import unicodedata
from pathlib import Path
from typing import Optional

import pandas as pd
import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (KitchenBaton facility collector; contact: your-email@example.com)"}
GSI_API = "https://msearch.gsi.go.jp/address-search/AddressSearch"

# 名称・カテゴリのどちらかがこれに一致すれば「市民が借りられる公共施設」とみなす
# （カテゴリ名そのもの＝「〇〇施設」のような包括的すぎる語は入れない。
#   施設一覧全体を素通りさせてしまうため、必ず個別施設名にも現れる語だけを使う）
KEYWORD_PATTERN = re.compile(
    "公民館|区民館|区民センター|地区センター|コミュニティセンター|文化センター|地域センター|"
    "集会所|交流館|交流センター|自治会館|市民センター|区民集会所|区民会館"
)
# キーワードに一致しても除外する（葬祭・火葬場等、紛らわしい「会館」表記）
EXCLUDE_PATTERN = re.compile("斎場|葬祭|火葬")

# (自治体名, CSV URL) — 自治体標準オープンデータセット「公共施設一覧」形式
STANDARD_SOURCES = [
    ("利島村", "https://www.opendata.metro.tokyo.lg.jp/toshimamura/133621_public_facility.csv"),
    ("あきる野市", "https://www.city.akiruno.tokyo.jp/cmsfiles/contents/0000015/15465/132284_public_facility2022-2.csv"),
    ("東久留米市", "https://www.opendata.metro.tokyo.lg.jp/higashikurume/132225_public_facility.csv"),
    ("東大和市", "https://www.opendata.metro.tokyo.lg.jp/higashiyamato/ods/132209_public_facility.csv"),
    ("狛江市", "https://www.opendata.metro.tokyo.jp/suisyoudataset/132195_public_facility.csv"),
    ("国立市", "https://www.opendata.metro.tokyo.lg.jp/kunitachi/132152_public_facility.csv"),
    ("国分寺市", "https://www.opendata.metro.tokyo.lg.jp/kokubunji/132144_public_facility.csv"),
    ("小平市", "https://www.opendata.metro.tokyo.lg.jp/kodaira/132110_public_facility.csv"),
    ("小金井市", "https://www.opendata.metro.tokyo.lg.jp/koganei/01_koukyoushisetsu.csv"),
    ("町田市", "https://www.city.machida.tokyo.jp/shisei/opendata/shisetsu/public_facility.files/132098_public_facility.csv"),
    ("武蔵野市", "https://www.opendata.metro.tokyo.lg.jp/musashino/132039_public_facility.csv"),
    ("八王子市", "https://www.city.hachioji.tokyo.jp/contents/open/002/p005882_d/fil/132012_public_facility.csv"),
    ("葛飾区", "https://www.opendata.metro.tokyo.lg.jp/katsushika/131229_public_facility.csv"),
    ("練馬区", "https://www.city.nerima.tokyo.jp/kusei/tokei/opendata/opendatasite/sisetsujyouhou/index.files/131202_public_facility.csv"),
    ("板橋区", "https://www.opendata.metro.tokyo.lg.jp/itabashi/131199_public_facility.csv"),
    ("荒川区", "https://www.city.arakawa.tokyo.jp/documents/23112/131181_public_facility.csv"),
    ("豊島区", "https://www.opendata.metro.tokyo.lg.jp/toyoshima/R4_public_facility.csv"),
    ("杉並区", "https://www.city.suginami.tokyo.jp/documents/1345/131156_public_facility_1.csv"),
    ("世田谷区", "https://www.city.setagaya.lg.jp/documents/22308/01_131121_public_facility.csv"),
    ("墨田区", "https://www.opendata.metro.tokyo.lg.jp/sumida/131075_public_facility.csv"),
    ("中央区", "https://www.city.chuo.lg.jp/documents/984/koukyoushisetu.csv"),
    ("千代田区", "https://www.opendata.metro.tokyo.lg.jp/chiyoda/131016_01public_facility.csv"),
    ("羽村市", "https://www.opendata.metro.tokyo.lg.jp/hamura/132276_public_facility.csv"),
    ("調布市", "https://www.city.chofu.lg.jp/documents/13850/132080_public_facility.csv"),
    ("東村山市", "https://www.opendata.metro.tokyo.lg.jp/higashimurayama/20240619_public_facility.csv"),
    ("江東区", "https://www.opendata.metro.tokyo.lg.jp/koto/131083_001_public_facility.csv"),
]

NAME_COLS = ["名称", "列1", "施設名"]
LAT_COLS = ["緯度"]
LON_COLS = ["経度"]
ADDR_COLS = ["所在地_連結表記", "住所", "所在地"]
CATEGORY_COLS = ["大区分", "小区分", "カテゴリ", "分類", "第1分類", "第2分類"]
PREF_COLS = ["都道府県名", "所在地_都道府県"]
CITY_COLS = ["市区町村名", "地方公共団体名", "所在地_市区町村"]


def read_csv_any_encoding(content: bytes) -> Optional[pd.DataFrame]:
    for enc in ("utf-8-sig", "cp932", "shift_jis"):
        try:
            return pd.read_csv(io.BytesIO(content), encoding=enc, dtype=str, on_bad_lines="skip")
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    return None


def pick(df: pd.DataFrame, candidates) -> Optional[str]:
    for c in candidates:
        if c in df.columns:
            return c
    return None


def matches_keyword(series: pd.Series) -> pd.Series:
    text = series.fillna("")
    return text.str.contains(KEYWORD_PATTERN, na=False) & ~text.str.contains(EXCLUDE_PATTERN, na=False)


def load_standard(org: str, url: str) -> pd.DataFrame:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  !! {org}: 取得失敗 {e}")
        return pd.DataFrame()
    df = read_csv_any_encoding(r.content)
    if df is None:
        print(f"  !! {org}: エンコーディング判定失敗")
        return pd.DataFrame()

    name_c = pick(df, NAME_COLS)
    lat_c = pick(df, LAT_COLS)
    lon_c = pick(df, LON_COLS)
    addr_c = pick(df, ADDR_COLS)
    if not name_c:
        print(f"  !! {org}: 名称列が見つかりません（列: {list(df.columns)[:10]}）")
        return pd.DataFrame()

    # カテゴリ列があればカテゴリ優先、無ければ名称でキーワード判定
    cat_cols = [c for c in CATEGORY_COLS if c in df.columns]
    if cat_cols:
        cat_combined = df[cat_cols].fillna("").agg(" ".join, axis=1)
        mask = matches_keyword(cat_combined) | matches_keyword(df[name_c])
    else:
        mask = matches_keyword(df[name_c])

    filtered = df[mask].copy()
    if filtered.empty:
        return pd.DataFrame()

    out = pd.DataFrame({
        "名称": filtered[name_c],
        "住所": filtered[addr_c] if addr_c else None,
        "緯度": filtered[lat_c] if lat_c else None,
        "経度": filtered[lon_c] if lon_c else None,
    })
    out["市区町村名"] = org
    out["都道府県"] = "東京都"
    out["_自治体名"] = org
    out["_データセット名"] = "公共施設一覧"
    out["_取得元URL"] = url
    out["_ライセンス"] = "クリエイティブ・コモンズ 表示（CC BY）"
    return out


def load_shinagawa() -> pd.DataFrame:
    url = "https://www.opendata.metro.tokyo.lg.jp/shinagawa/kokyoshisetsu.csv"
    r = requests.get(url, headers=HEADERS, timeout=30)
    df = read_csv_any_encoding(r.content)
    # カテゴリには本庁舎・防災センター・駐輪場・郵便局等も混在するため、
    # カテゴリに関わらず施設名がキーワードに一致するものだけを拾う
    filtered = df[matches_keyword(df["名称"])].copy()
    out = pd.DataFrame({
        "名称": filtered["名称"],
        "住所": "東京都" + filtered["所在地"].str.replace("東京都", "", regex=False),
        "緯度": None,
        "経度": None,
    })
    out["市区町村名"] = "品川区"
    out["都道府県"] = "東京都"
    out["_自治体名"] = "品川区"
    out["_データセット名"] = "公共施設（カテゴリ別）"
    out["_取得元URL"] = url
    out["_ライセンス"] = "クリエイティブ・コモンズ 表示（CC BY）"
    return out


def load_minato_kumincenter() -> pd.DataFrame:
    url = ("https://opendata.city.minato.tokyo.jp/dataset/3502c088-e6a2-4eee-9a3a-b4ea40459d4e/"
           "resource/41a97db9-f48a-40f1-b1f1-0dbd203e5ac1/download/minatokushisetsujoho_kumincenter.csv")
    r = requests.get(url, headers=HEADERS, timeout=30)
    df = read_csv_any_encoding(r.content)
    out = pd.DataFrame({
        "名称": df["ページタイトル"],
        "住所": "東京都" + df["所在地"].str.replace("東京都", "", regex=False),
        "緯度": df["緯度"],
        "経度": df["経度"],
    })
    out["市区町村名"] = "港区"
    out["都道府県"] = "東京都"
    out["_自治体名"] = "港区"
    out["_データセット名"] = "港区の公共施設情報（区民センター）"
    out["_取得元URL"] = url
    out["_ライセンス"] = "クリエイティブ・コモンズ 表示（CC BY）"
    return out


def load_kyoiku_koumin() -> pd.DataFrame:
    """東京都教育庁「施設関連情報_公民館」（既にdata/raw/koumin_R3.csvとして取得済み）"""
    path = Path("koumin_R3.csv")
    if not path.exists():
        return pd.DataFrame()
    df = pd.read_csv(path, encoding="cp932", dtype=str)
    out = pd.DataFrame({
        "名称": df["施設名"].str.replace(r"^＊\?", "", regex=True),
        "住所": "東京都" + df["所在地"],
        "緯度": df["緯度"],
        "経度": df["経度"],
    })
    out["市区町村名"] = df["区市町村名"]
    out["都道府県"] = "東京都"
    out["_自治体名"] = "東京都教育庁"
    out["_データセット名"] = "施設関連情報_公民館"
    out["_取得元URL"] = "https://www.opendata.metro.tokyo.lg.jp/kyouiku/R3/skshubetu_1.csv"
    out["_ライセンス"] = "クリエイティブ・コモンズ 表示（CC BY）"
    return out


def geocode(address: str):
    if not address or not isinstance(address, str) or len(address.strip()) < 3:
        return None
    try:
        r = requests.get(GSI_API, params={"q": address}, headers=HEADERS, timeout=15)
        r.raise_for_status()
        results = r.json()
        if not results:
            return None
        lon, lat = results[0]["geometry"]["coordinates"]
        return float(lat), float(lon)
    except Exception:
        return None


def dedup(df: pd.DataFrame) -> pd.DataFrame:
    def norm(s):
        if not isinstance(s, str):
            return ""
        s = unicodedata.normalize("NFKC", s)
        return re.sub(r"[\s　「」『』（）()]", "", s)
    df = df.copy()
    df["_key"] = df["名称"].apply(norm) + "|" + df["市区町村名"].apply(norm)
    df = df.drop_duplicates(subset="_key", keep="first").drop(columns="_key")
    return df


def main():
    frames = []

    print("東京都教育庁「公民館」データを読み込み中...")
    frames.append(load_kyoiku_koumin())

    print("品川区データを取得中...")
    frames.append(load_shinagawa())

    print("港区（区民センター）データを取得中...")
    frames.append(load_minato_kumincenter())

    print(f"標準形式の公共施設一覧を{len(STANDARD_SOURCES)}自治体分取得中...")
    for org, url in STANDARD_SOURCES:
        print(f"  取得: {org}")
        frames.append(load_standard(org, url))
        time.sleep(0.5)

    combined = pd.concat([f for f in frames if not f.empty], ignore_index=True, sort=False)
    # 元データの脚注行・末尾のバージョン表記など、施設ではない行を除く
    combined = combined[combined["名称"].notna()]
    combined = combined[~combined["名称"].str.match(r"^Ver\d+$", na=False)]
    combined = dedup(combined)
    combined.to_csv("koumin_facilities_raw.csv", index=False, encoding="utf-8-sig")
    print(f"\n収集完了: {len(combined)} 件 → koumin_facilities_raw.csv")
    print(combined["市区町村名"].value_counts())

    need_geocode = combined["緯度"].isna() | (combined["緯度"].astype(str).str.strip() == "")
    print(f"\n緯度経度が空の行: {need_geocode.sum()} 件 → ジオコーディングします")
    ok = 0
    for idx in combined[need_geocode].index:
        result = geocode(combined.at[idx, "住所"])
        if result:
            combined.at[idx, "緯度"], combined.at[idx, "経度"] = result
            ok += 1
        time.sleep(0.5)
    print(f"ジオコーディング完了: 成功 {ok} / {need_geocode.sum()}")

    combined.to_csv("koumin_facilities_final.csv", index=False, encoding="utf-8-sig")
    with_latlng = combined["緯度"].notna().sum()
    print(f"\n最終データ: {len(combined)} 件（緯度経度判明 {with_latlng} 件） → koumin_facilities_final.csv")


if __name__ == "__main__":
    main()
