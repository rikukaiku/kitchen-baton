---
name: tokyo-opendata-collector
description: >
  How to collect, clean, geocode, and merge a new facility/location dataset from the
  Tokyo Metropolitan Government Open Data Catalog (catalog.data.metro.tokyo.lg.jp) into
  this repo's map. Use this whenever the task is "add [some facility type] data to the
  map" or "find open data for X in Tokyo" — even if the user doesn't say "open data"
  explicitly, e.g. "can we show 空き家/飲食店/社員食堂/キッチンカー on the map",
  "collect more locations", "add another data source". Also use it as a reference
  whenever debugging why a previously-collected dataset (子ども食堂, 公民館) has bad
  rows, wrong coordinates, or missing entries — it documents the known quirks of these
  sources. This is the HOW (technical collection pattern); for WHAT sources exist and
  domain rules (licensing, normalization, gap-analysis), see docs/kitchen-baton.skill.
compatibility: Python 3 with pandas and requests (see data/raw/*.py for working examples)
---

# 東京都オープンデータ収集パターン

このスキルは、東京都オープンデータカタログから新しい種類の施設・拠点データを収集して
このリポジトリの地図に追加するときの、再現可能な技術的手順をまとめたものです。
これまでに2回(子ども食堂データ・公民館等データ)、同じパターンで実際にうまくいきました。

**ドメイン知識(どんなデータソースがあるか、ライセンス・表記ゆれのルール、空白地域分析の
考え方)は `docs/kitchen-baton.skill` を参照してください。このスキルはそれを前提に、
「実際にどうやってClaude Codeで収集するか」に集中しています。**

## 実例スクリプト（まずこれを読む）

新しい収集タスクを始める前に、必ず `data/raw/` の既存スクリプトを読んで真似ること。
ゼロから書き直さない。

- `data/raw/collect_tokyo_kodomoshokudo.py` — CKAN APIでの複数キーワード検索、
  自治体ごとのCSV収集、エンコーディング自動判定の基本形
- `data/raw/collect_koumin_facilities.py` — 標準フォーマット・独自フォーマットが
  混在する場合の柔軟な列名解決、カテゴリ列 vs 名称キーワードでの絞り込み、
  ジオコーディング、直近で踏んだバグの修正例（後述）
- `data/raw/geocode_merged.py` — 国土地理院APIでの単体ジオコーディング処理
- `data/raw/merge_tofukushikyoku.py` — 既存データとの名寄せ・重複除去（正規化して
  比較する`normalize()`関数のパターン）
- `data/raw/build_repo_data.py` — 最終的に`public/data/*.geojson`と`data/*.csv`を
  書き出す仕上げ処理、連絡先列の除外

## 全体の流れ

1. **カタログをCKAN APIで探索する**
2. **各データセットのスキーマを判定して読み込む**（標準形式 or 独自形式）
3. **目的の施設だけに絞り込む**（カテゴリ列 or 名称キーワード）
4. **緯度経度が無い行をジオコーディングする**
5. **正規化して重複除去する**
6. **ノイズ行・個人情報列を除いて最終ファイルを書き出す**
7. **`data/SOURCES.md`に出典を追記する**
8. **`src/App.tsx`に配線する**

以下、各ステップの勘所。

---

### 1. カタログ探索（CKAN API）

```
GET https://catalog.data.metro.tokyo.lg.jp/api/3/action/package_search?q=title:<キーワード>&rows=60
```

自治体ごとに施設の呼び方がバラバラなので、**同義語を複数試す**こと。例えば「借りられる
公共施設」なら 公民館／区民館／区民センター／地区センター／コミュニティセンター／
文化センター、のように類義語を並列で検索する。1つのキーワードだけで打ち切らない。

`package_search`のレスポンスの`resources`配列から`format`が`CSV`のものを`url`ごと集める。
同じキーワードで複数のデータセットがヒットすることが多いので、URLの重複除去も忘れずに。

### 2. スキーマ判定

東京都の自治体オープンデータには大きく2系統ある：

- **自治体標準オープンデータセット形式**（デジタル庁の共通スキーマ、列数55〜59が目安）。
  `全国地方公共団体コード, ID, 名称, 緯度, 経度, 所在地_連結表記, ...` のような列を持つ。
  これが最も多い。ただし自治体によって列数が39・31・24など微妙に違うことがあるので、
  「列数がぴったり56」で判定せず、`名称`・`緯度`・`経度`列の**存在**で判定すること。
- **完全に独自の形式**（3列だけ、Excelの中間集計表、HTMLがそのまま返る等）。都度対応が
  必要。取得に失敗するURL（404/403、CSVのはずがHTMLが返る等）は珍しくないので、
  例外処理で握りつぶして次に進む設計にする（1つの自治体の失敗で全体を止めない）。

エンコーディングも自治体ごとにバラバラ。`utf-8-sig` → `cp932` → `shift_jis` の順で
順番に試して最初に成功したものを使う（`collect_koumin_facilities.py`の
`read_csv_any_encoding()`参照）。

列名の揺れは `pick(df, candidates)` のようなヘルパーで吸収する：

```python
NAME_COLS = ["名称", "列1", "施設名"]   # 「列1」は元Excelのヘッダー行ズレでこうなる自治体がある
LAT_COLS = ["緯度"]
LON_COLS = ["経度"]
ADDR_COLS = ["所在地_連結表記", "住所", "所在地"]
CATEGORY_COLS = ["大区分", "小区分", "カテゴリ", "分類", "第1分類", "第2分類"]

def pick(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    return None
```

### 3. 絞り込み（カテゴリ列 or 名称キーワード）

カテゴリ列がある場合は活用した方が精度は上がるが、**カテゴリの「ラベル名」自体を
キーワード判定に使い回さないこと**。実際に踏んだバグ：品川区のカテゴリ「区民生活関連施設」
という文字列自体がキーワード正規表現に一致してしまい、そのカテゴリに属する駐輪場や
公衆便所まで全部拾ってしまった（カテゴリという「箱」の名前と、中身の「個々の施設名」を
混同していた）。安全なやり方は、**カテゴリで大まかに絞ったうえで、さらに施設の個別名称が
キーワードに一致するかも確認する**（両方をANDで見る）。カテゴリが無い場合は名称だけで
判定する。

```python
KEYWORD_PATTERN = re.compile("公民館|区民館|区民センター|地区センター|コミュニティセンター|...")
EXCLUDE_PATTERN = re.compile("斎場|葬祭|火葬")  # キーワードに一致しても除外したいもの

def matches_keyword(series):
    text = series.fillna("")
    return text.str.contains(KEYWORD_PATTERN, na=False) & ~text.str.contains(EXCLUDE_PATTERN, na=False)
```

除外パターンも用意しておく。「会館」のような広めのキーワードは斎場・葬祭場のような
紛らわしい施設も拾ってしまうことがある。

### 4. ジオコーディング

緯度経度が空の行は国土地理院の住所検索APIで補完する：

```
GET https://msearch.gsi.go.jp/address-search/AddressSearch?q=<住所>
```

レスポンスは`[経度, 緯度]`の順（GeoJSON準拠）で返るので、取り違えないこと。1件ずつ
リクエストするので`time.sleep(0.5)`程度でレート制限に配慮する。失敗（住所が不完全、
非公開等）は普通に起きるので、Noneを返して呼び出し側でスキップできるようにする。

### 5. 正規化・重複除去

「こども食堂」「子ども食堂」「子供食堂」のような表記ゆれは、`unicodedata.normalize("NFKC", ...)`
で全角半角を揃え、空白や括弧類を除去してから比較する。既存データとの名寄せをする場合は
`merge_tofukushikyoku.py`の`normalize()`のパターンを踏襲する。同一自治体内で名称が完全
一致すれば重複とみなすのが基本だが、住所の先頭部分が一致し名称が部分一致する場合も拾える
ようにしておくと表記ゆれに強くなる。

### 6. 最終ファイルの書き出し（ノイズ行・個人情報の除去）

**元データにしばしば紛れ込むゴミ行**に注意する。実際に踏んだ例：
- 表の脚注・注釈がそのまま1行としてCSVに含まれている（名称列だけNaN、備考列だけ文字列）
- 末尾に`"Ver20260511"`のようなバージョン表記の行が混入している

出力前に`名称`がNaNの行や、明らかにバージョン文字列のパターン（`^Ver\d+$`等）に一致する
行は除外すること。緯度経度も日本国内のざっくりした範囲（緯度24〜46、経度122〜154）に
収まっているかチェックしておくと、ジオコーディングの誤爆や列の取り違えに早めに気づける。

**電話番号・メールアドレス等の連絡先情報は、地図で公開する`public/data/*.geojson`には
含めない。** 元の自治体データが公開情報として連絡先を含んでいても、地図UIには不要であり、
このリポジトリでは「公開ファイルには連絡先を載せない」方針が明示的に決まっている
（ユーザーからの明示的な指示）。`data/*.csv`（リポジトリ用の元データ）についても同様に
連絡先列は除いて出力する。必要ならジオコーディング前の中間ファイル（`data/raw/`配下、
`.gitignore`で除外）にだけ残す。

出力の型はこのリポジトリの慣習に合わせる：

```
data/raw/<name>_raw.csv     … 収集・絞り込み直後（自治体名・データセット名・ライセンス・
                                取得元URLの出典列付き）。.gitignoreで除外（再生成可能なため）
data/raw/<name>_final.csv   … ジオコーディング後。同じく.gitignoreで除外
public/data/<name>.geojson  … 地図表示用（緯度経度が判明した行のみ、連絡先情報なし）
data/<name>.csv             … リポジトリの正式データ（連絡先列を除いた全項目）
```

### 7. `data/SOURCES.md`への追記

収集した自治体・データセット名・ライセンス・取得元URLの一覧表を`data/SOURCES.md`に
追記する。東京都カタログのデータはほぼ全て **CC BY 4.0** だが、データセットごとに
実際のライセンス表記（`license_title`）を確認して転記すること。出典表記を欠かさない。

### 8. `src/App.tsx`への配線

`useEffect`内で他のデータソースと同様に`fetch('/data/<name>.geojson')`し、
`locations`配列にマージする（`tokyoData`/`saitamaData`/`kouminData`の並びを参考に）。
新しい施設種別を追加する場合は、各ロケーションオブジェクトに`type`フィールド
（例：`'公民館'`）を必ず持たせること。「場所の種類」フィルタは`loc.type === placeType`で
判定しているので、これが無いと絞り込みが効かない。地図上で種別を視覚的に区別したい
場合は、`KouminIcon`のように`L.icon`で別色のマーカーを用意し、`loc.type`で出し分ける。

---

## 新しい施設タイプを追加する時のチェックリスト

1. `docs/kitchen-baton.skill`でその施設タイプのデータソースが載っていないか確認
2. CKAN APIで類義語を複数試して候補データセットを洗い出す（`rows=60`くらいで）
3. 数自治体分サンプルを取得してスキーマの傾向を掴む（標準形式か独自形式か）
4. 収集スクリプトを`data/raw/collect_<name>.py`として書く（上記スクリプト群を土台にする）
5. 絞り込み結果をサンプリングして目視確認する（`df.sample(15)`程度で十分）。
   想定外の施設が混ざっていないか、カテゴリの罠（3節参照）を踏んでいないか確認
6. ジオコーディング成功率を確認する。極端に低ければ住所の整形（都道府県名の重複除去等）
   を見直す
7. `build_repo_data.py`と同様の仕上げ処理で最終ファイルを書き出す（連絡先列を除く）
8. `data/SOURCES.md`に出典を追記
9. `App.tsx`に配線し、ローカルでブラウザ確認（マーカー数・フィルタ・ポップアップ）してから
   コミットする
