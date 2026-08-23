#  キッチンバトン (kitchen-baton)

子ども食堂を「始めたい人」と、公民館・空き家・飲食店（営業時間外）・社員食堂・キッチンカーなど「場所を提供したい人」をつなぐマッチングアプリです。「キッチン（調理場所）のバトンを地域でつなぐ」というコンセプトで開発しています。

🔗 デモ: https://kitchen-baton.vercel.app

## できること

- **子ども食堂・公共施設マップ**：東京都の子ども食堂（798件）と、公民館・区民館・地区センター等の公共施設（627件）を地図上にクラスタ表示
- **ニーズアラート**：地域ごとの子どもの人口と既存の子ども食堂数から「ニーズ高・中・低」を算出し、特に子ども食堂が近隣にない高ニーズ地域を警告表示
- **場所を探す（検索・絞り込み）**：キーワード、都道府県／市区町村、場所の種類（子ども食堂／フードパントリー／空き家活用／社員食堂／公民館）、設備で絞り込み検索
- **埼玉県データの読み込み**：埼玉県の子ども食堂一覧CSVにも対応（`public/saitama.csv`）
- **相談ひろば**：子ども食堂を始めたい人が悩みを投稿し、経験者・専門家が回答するQ&A機能。よくある質問はGoogleスプレッドシートで管理

## 連絡先情報の取り扱いについて

「相談ひろば」「場所を登録する」機能では、個人の連絡先（メールアドレス・電話番号）を入力させる項目を設けていません。自由記述欄（相談内容・回答本文など）にメールアドレスや電話番号らしき文字列が含まれていた場合も、投稿時に自動的に伏せ字（［連絡先は削除されました］）に置き換えられます。これは、特定の個人へのやり取りが偏ったり、連絡先が意図せず公開されたりすることを防ぐための方針です。

## 使用技術

- React 19 + TypeScript + Vite
- [react-leaflet](https://react-leaflet.js.org/) / Leaflet（地図表示）、`react-leaflet-cluster`（マーカークラスタリング）
- MUI（`@mui/material`）
- PapaParse（CSV読み込み）
- データタイル：OpenStreetMap

## セットアップ

```bash
npm install
npm run dev
```

その他のコマンド：

```bash
npm run build    # 本番ビルド
npm run preview  # ビルド結果のプレビュー
npm run lint     # ESLint実行
```

## データについて

### データソース

地図データは東京都・自治体のオープンデータカタログおよび東京都福祉局「子供食堂推進事業」のデータを統合したものです。すべて **CC BY 4.0**（クリエイティブ・コモンズ 表示）ライセンスで、自治体別の取得元URLは [`data/SOURCES.md`](./data/SOURCES.md) にまとめています。

| データ | 件数 | 保存先 |
|---|---|---|
| 東京都 子ども食堂一覧 | 798件 | `public/data/tokyo_kodomoshokudo.geojson` |
| 公民館・区民館・地区センター等の公共施設 | 627件 | `public/data/koumin_facilities.geojson` |
| 埼玉県 子ども食堂一覧 | - | `public/saitama.csv` |

### データ変換スクリプト

自治体から配布されるExcel/CSVを取り込むための補助スクリプトです。

- `convert_excel.py`：こども食堂一覧のExcelを `public/saitama.csv` に変換
- `convert_excel_to_json.py`：名称・住所・緯度・経度の列を自動検出し、Excelを `public/saitama_kodomo_shokudo.json` に変換
- `school_geocode.js`：小学校名リストをNominatim APIでジオコーディングし `regionData.json` を生成

```bash
python convert_excel.py "こども食堂一覧.xlsx"
python convert_excel_to_json.py
node school_geocode.js
```

## ディレクトリ構成

```
├── src/
│   ├── main.tsx        # エントリーポイント
│   └── App.tsx          # 地図・検索・ニーズアラートを含むメインUI
├── public/
│   ├── data/             # 子ども食堂・公共施設のGeoJSON
│   └── saitama.csv       # 埼玉県子ども食堂データ
├── data/
│   └── SOURCES.md        # データ出典一覧
├── convert_excel.py
├── convert_excel_to_json.py
└── school_geocode.js
```

## 今後の展望

- 空白地域（需給ギャップ）分析の高度化：メッシュ単位での人口×距離ペナルティによる可視化
- 施設登録フォーム（設備情報・営業許可・空き時間帯の登録）の実装
- 行政の補助金・助成金情報データベースの追加
- 対象自治体の拡大（他都道府県のオープンデータ取り込み）

## コントリビュート

Issue・Pull Requestを歓迎します。データの追加や地域拡張についてもお気軽にご連絡ください。
