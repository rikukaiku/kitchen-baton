const pptxgen = require("pptxgenjs");
const path = require("path");

const ASSETS = path.join(__dirname, "..", "slides-assets");

const COLOR = {
  primary: "C15A2C",
  primaryLight: "DD8A4E",
  darkBg: "2B1D12",
  darkBg2: "3A2717",
  cream: "FFF8EE",
  cardTint: "FBE6D3",
  ink: "2B221A",
  inkSoft: "6B5238",
  white: "FFFFFF",
  sage: "6B8F71",
  blue: "4F8FA8",
  violet: "9C7BB0",
};

const FONT_HEAD = "Cambria";
const FONT_BODY = "Calibri";

function newPres() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5 in
  return pres;
}

function darkSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: COLOR.darkBg };
  return s;
}

function lightSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: COLOR.white };
  return s;
}

function pageNum(s, n) {
  s.addText(String(n), {
    x: 12.6, y: 7.05, w: 0.5, h: 0.3,
    fontFace: FONT_BODY, fontSize: 10, color: "999999", align: "right",
  });
}

function kicker(s, text, opts = {}) {
  s.addText(text.toUpperCase(), {
    x: opts.x ?? 0.6, y: opts.y ?? 0.45, w: opts.w ?? 8, h: 0.35,
    fontFace: FONT_BODY, fontSize: 12, color: opts.color ?? COLOR.primary,
    bold: true, charSpacing: 2,
  });
}

function title(s, text, opts = {}) {
  s.addText(text, {
    x: opts.x ?? 0.6, y: opts.y ?? 0.75, w: opts.w ?? 11.8, h: opts.h ?? 0.9,
    fontFace: FONT_HEAD, fontSize: opts.size ?? 32, bold: true,
    color: opts.color ?? COLOR.ink,
  });
}

async function main() {
  const pres = newPres();

  // ---------- 1. Title ----------
  {
    const s = darkSlide(pres);
    s.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: COLOR.darkBg },
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: 9.6, y: -2.2, w: 6, h: 6, fill: { color: COLOR.darkBg2 }, line: { type: "none" },
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: -2.5, y: 5, w: 5, h: 5, fill: { color: COLOR.darkBg2 }, line: { type: "none" },
    });
    s.addText("KITCHEN BATON", {
      x: 0.9, y: 2.35, w: 10, h: 0.5, fontFace: FONT_BODY, fontSize: 16,
      color: COLOR.primaryLight, bold: true, charSpacing: 3,
    });
    s.addText("想いと場所を、データでつなぐ。", {
      x: 0.85, y: 2.85, w: 11.5, h: 1.3, fontFace: FONT_HEAD, fontSize: 44,
      bold: true, color: COLOR.white,
    });
    s.addText("子ども食堂を始めたい人と、使われていない場所を貸したい人をつなぐ地図マッチングアプリ", {
      x: 0.9, y: 4.15, w: 10.8, h: 0.6, fontFace: FONT_BODY, fontSize: 16,
      color: "E8D9C8",
    });
    s.addText("都知事杯オープンデータ・ハッカソン2026", {
      x: 0.9, y: 6.55, w: 8, h: 0.4, fontFace: FONT_BODY, fontSize: 13, color: "B99A7C",
    });
    pageNum(s, 1);
  }

  // ---------- 2. Social background (statement only) ----------
  {
    const s = pres.addSlide();
    s.background = { color: "FBF5E9" };
    s.addText("こども食堂は、\nもはや「社会インフラ」", {
      x: 0.8, y: 0, w: 11.73, h: 7.5, fontFace: FONT_HEAD, fontSize: 56,
      bold: true, color: COLOR.ink, align: "center", valign: "middle", lineSpacing: 68,
    });
    pageNum(s, 2);
  }

  // ---------- 3. Problem: information asymmetry (薬師寺さん構成をベースに再構成) ----------
  {
    const s = lightSlide(pres);
    kicker(s, "Problem");
    title(s, "「やりたい」と「貸したい」の間に横たわる、情報の非対称性", { size: 28 });

    // column headers
    s.addText("活動希望者（主催者）", {
      x: 0.6, y: 1.55, w: 5.85, h: 0.4, fontFace: FONT_HEAD, fontSize: 15,
      bold: true, color: COLOR.primary, align: "center",
    });
    s.addText("場所提供者（オーナー）", {
      x: 6.6, y: 1.55, w: 5.85, h: 0.4, fontFace: FONT_HEAD, fontSize: 15,
      bold: true, color: COLOR.sage, align: "center",
    });

    // 4 bubble cards
    const bubbles = [
      { head: "場所がない", body: "（公民館・空き家などを探せない）", color: COLOR.primary },
      { head: "どこに必要？", body: "（地域のニーズが見えない）", color: COLOR.primary },
      { head: "つながれない", body: "（誰に声をかける？）", color: COLOR.sage },
      { head: "資産の放置", body: "（空いている場所が眠る）", color: COLOR.sage },
    ];
    const bw = 2.85, gap = 0.15;
    bubbles.forEach((b, i) => {
      const x = 0.6 + i * (bw + gap);
      s.addShape(pres.ShapeType.roundRect, {
        x, y: 2.0, w: bw, h: 1.55, rectRadius: 0.1,
        fill: { color: COLOR.cardTint }, line: { type: "none" },
      });
      s.addText(b.head, {
        x: x + 0.15, y: 2.15, w: bw - 0.3, h: 0.5, fontFace: FONT_HEAD, fontSize: 15,
        bold: true, color: b.color, align: "center",
      });
      s.addText(b.body, {
        x: x + 0.15, y: 2.65, w: bw - 0.3, h: 0.8, fontFace: FONT_BODY, fontSize: 10.5,
        color: COLOR.inkSoft, align: "center", valign: "top",
      });
    });

    // person <-> lightning <-> house row
    s.addShape(pres.ShapeType.ellipse, {
      x: 1.55, y: 3.95, w: 0.9, h: 0.9, fill: { color: COLOR.primary }, line: { type: "none" },
    });
    s.addText("👤", { x: 1.55, y: 3.95, w: 0.9, h: 0.9, fontSize: 26, align: "center", valign: "middle", margin: 0 });
    s.addText("こども食堂を\n始めたい人", {
      x: 0.75, y: 4.9, w: 2.5, h: 0.7, fontFace: FONT_BODY, fontSize: 12, color: COLOR.ink,
      align: "center", valign: "top",
    });

    s.addText("情報の接続不全", {
      x: 4.9, y: 4.0, w: 3.5, h: 0.4, fontFace: FONT_HEAD, fontSize: 16, bold: true,
      color: COLOR.ink, align: "center",
    });
    s.addText("⚡", { x: 5.9, y: 4.35, w: 1.5, h: 0.6, fontSize: 26, align: "center" });

    s.addShape(pres.ShapeType.ellipse, {
      x: 10.9, y: 3.95, w: 0.9, h: 0.9, fill: { color: COLOR.sage }, line: { type: "none" },
    });
    s.addText("🏠", { x: 10.9, y: 3.95, w: 0.9, h: 0.9, fontSize: 26, align: "center", valign: "middle", margin: 0 });
    s.addText("社員食堂・空き家・\n公民館・飲食店など", {
      x: 9.9, y: 4.9, w: 2.9, h: 0.7, fontFace: FONT_BODY, fontSize: 12, color: COLOR.ink,
      align: "center", valign: "top",
    });

    s.addText("「必要な場所」と「使える場所」が同じ地域にあっても、つながっていない", {
      x: 0.6, y: 5.75, w: 12.15, h: 0.4, fontFace: FONT_BODY, fontSize: 13,
      italic: true, color: COLOR.inkSoft, align: "center",
    });

    s.addShape(pres.ShapeType.roundRect, {
      x: 0.6, y: 6.3, w: 12.15, h: 0.85, rectRadius: 0.1,
      fill: { color: COLOR.darkBg }, line: { type: "none" },
    });
    s.addText("さらに、地域によって「支援の空白地帯」が存在する。", {
      x: 0.9, y: 6.3, w: 11.5, h: 0.85, fontFace: FONT_HEAD, fontSize: 17,
      bold: true, color: COLOR.white, valign: "middle",
    });
    pageNum(s, 3);
  }

  // ---------- 4. Concept ----------
  {
    const s = lightSlide(pres);
    kicker(s, "Concept");
    title(s, "Kitchen Baton：見えない資産を可視化するマッチング地図");
    s.addText(
      "既存のキッチン資源を、次の世代（こどもたち）へバトンのように引き継ぐ。「活動希望者」と「場所提供者」を、位置情報と設備条件でつなぐ。",
      { x: 0.6, y: 1.55, w: 11.8, h: 0.8, fontFace: FONT_BODY, fontSize: 15, color: COLOR.inkSoft }
    );

    const steps = [
      { n: "1", head: "Search", body: "地図上で場所の種類・設備を条件に、視覚的に探す", color: COLOR.primary },
      { n: "2", head: "Connect", body: "空白地域分析で「本当に必要な地域」を発見する", color: COLOR.sage },
      { n: "3", head: "Start", body: "Googleフォームから登録・相談ひろばで質問し、すぐ活動を始める", color: COLOR.blue },
    ];
    steps.forEach((st, i) => {
      const x = 0.6 + i * 4.1;
      s.addShape(pres.ShapeType.roundRect, {
        x, y: 2.7, w: 3.75, h: 3.4, rectRadius: 0.12,
        fill: { color: COLOR.cream }, line: { type: "none" },
      });
      s.addShape(pres.ShapeType.ellipse, {
        x: x + 0.35, y: 3.05, w: 0.7, h: 0.7, fill: { color: st.color }, line: { type: "none" },
      });
      s.addText(st.n, {
        x: x + 0.35, y: 3.05, w: 0.7, h: 0.7, fontFace: FONT_HEAD, fontSize: 22,
        bold: true, color: COLOR.white, align: "center", valign: "middle", margin: 0,
      });
      s.addText(st.head, {
        x: x + 0.35, y: 3.9, w: 3.1, h: 0.5, fontFace: FONT_HEAD, fontSize: 19,
        bold: true, color: COLOR.ink,
      });
      s.addText(st.body, {
        x: x + 0.35, y: 4.45, w: 3.1, h: 1.4, fontFace: FONT_BODY, fontSize: 13,
        color: COLOR.inkSoft, valign: "top",
      });
      if (i < 2) {
        s.addText("→", {
          x: x + 3.78, y: 3.9, w: 0.5, h: 0.6, fontFace: FONT_HEAD, fontSize: 26,
          color: "CCBBA6", align: "center",
        });
      }
    });
    pageNum(s, 4);
  }

  // ---------- 5. Feature: gap analysis ----------
  {
    const s = lightSlide(pres);
    s.background = { color: "FBF5E9" };
    kicker(s, "Feature 01 — 実装済み");
    title(s, "空白地域分析：食堂が足りない地域を自動で可視化");
    s.addText(
      "区市町村ごとの0〜14歳人口と、本アプリが収集したオープンデータ上のこども食堂数を掛け合わせ、相対的な不足度を算出。特に不足度が高いと判定された地域が東京都だけで25件あった（新宿区・墨田区など人口の多い区も含む）。",
      { x: 0.6, y: 1.55, w: 5.5, h: 2.3, fontFace: FONT_BODY, fontSize: 14, color: COLOR.inkSoft, valign: "top" }
    );
    s.addText(
      "※本アプリが集約したオープンデータの範囲内での分析であり、掲載外の施設は反映されていない可能性があります。\n出典：東京都オープンデータカタログ／東京都「区市町村・年齢3区分別人口」",
      { x: 0.6, y: 3.15, w: 5.5, h: 0.7, fontFace: FONT_BODY, fontSize: 9, color: "AA9B8A", valign: "top" }
    );

    s.addShape(pres.ShapeType.roundRect, {
      x: 0.6, y: 4.2, w: 5.5, h: 1.4, rectRadius: 0.1,
      fill: { color: COLOR.cardTint }, line: { type: "none" },
    });
    s.addText("⚠️", {
      x: 0.9, y: 4.2, w: 1.0, h: 1.4, fontSize: 34, align: "center", valign: "middle", margin: 0,
    });
    s.addText("25件", {
      x: 1.9, y: 4.35, w: 1.9, h: 1.1, fontFace: FONT_HEAD, fontSize: 34, bold: true,
      color: COLOR.primary, valign: "middle", margin: 0,
    });
    s.addText("不足度が特に高いと判定された\n区市町村（東京都）", {
      x: 3.75, y: 4.2, w: 2.25, h: 1.4, fontFace: FONT_BODY, fontSize: 12.5,
      color: COLOR.ink, valign: "middle",
    });

    s.addImage({
      path: path.join(ASSETS, "shot-gap.png"),
      x: 6.6, y: 1.55, w: 6.15, h: 3.95,
      shadow: { type: "outer", color: "000000", opacity: 0.18, blur: 10, offset: 4, angle: 90 },
    });
    s.addText(
      "地図タイル出典：© OpenStreetMap contributors（ODbL）https://www.openstreetmap.org/copyright",
      { x: 6.6, y: 5.6, w: 6.15, h: 0.4, fontFace: FONT_BODY, fontSize: 9, color: "AA9B8A", valign: "top" }
    );
    pageNum(s, 5);
  }

  // ---------- 6. Feature: search & type-colored pins ----------
  {
    const s = lightSlide(pres);
    s.background = { color: "FBF5E9" };
    kicker(s, "Feature 02 — 実装済み");
    title(s, "地図検索：都道府県・種類・設備で絞り込み");
    s.addImage({
      path: path.join(ASSETS, "shot-map2.png"),
      x: 0.6, y: 1.55, w: 7.3, h: 4.7,
      shadow: { type: "outer", color: "000000", opacity: 0.18, blur: 10, offset: 4, angle: 90 },
    });

    const items = [
      ["🗺️", "約1,425件", "東京都の子ども食堂798件＋公民館等627件（本アプリが今回取り込んだオープンデータの件数）"],
      ["🎨", "種類ごとに色分け", "子ども食堂・公民館・フードパントリー等をピン色で判別"],
      ["🔍", "クラスタリング表示", "密集地域は件数バブルに集約、ズームで個別ピンに分解"],
      ["📋", "市区町村を自動抽出", "実データから選択肢を生成、五十音順に整理"],
    ];
    items.forEach((it, i) => {
      const y = 1.7 + i * 1.15;
      s.addShape(pres.ShapeType.ellipse, {
        x: 8.2, y: y + 0.03, w: 0.45, h: 0.45, fill: { color: COLOR.cardTint }, line: { type: "none" },
      });
      s.addText(it[0], { x: 8.2, y: y + 0.03, w: 0.45, h: 0.45, fontSize: 13, align: "center", valign: "middle", margin: 0 });
      s.addText(it[1], {
        x: 8.8, y, w: 4.05, h: 0.4, fontFace: FONT_HEAD, fontSize: 14.5, bold: true, color: COLOR.ink,
      });
      s.addText(it[2], {
        x: 8.8, y: y + 0.4, w: 4.05, h: 0.6, fontFace: FONT_BODY, fontSize: 11.5, color: COLOR.inkSoft,
      });
    });
    s.addText(
      "施設データ出典：東京都オープンデータカタログ／東京都福祉局／各区市町村公共施設一覧（詳細はdata/SOURCES.md）\n地図タイル出典：© OpenStreetMap contributors（ODbL）https://www.openstreetmap.org/copyright",
      { x: 0.6, y: 6.45, w: 7.3, h: 0.55, fontFace: FONT_BODY, fontSize: 8, color: "AA9B8A", valign: "top" }
    );
    pageNum(s, 6);
  }

  // ---------- 7. Feature: registration + consultation hub ----------
  {
    const s = lightSlide(pres);
    kicker(s, "Feature 03 — 実装済み");
    title(s, "場所の登録・相談ひろば：市民からの情報も蓄積");
    s.addImage({
      path: path.join(ASSETS, "shot-consultation.png"),
      x: 0.6, y: 1.55, w: 7.3, h: 4.7,
      shadow: { type: "outer", color: "000000", opacity: 0.18, blur: 10, offset: 4, angle: 90 },
    });
    s.addText(
      "地図タイル出典：© OpenStreetMap contributors（ODbL）https://www.openstreetmap.org/copyright",
      { x: 0.6, y: 6.35, w: 7.3, h: 0.4, fontFace: FONT_BODY, fontSize: 9, color: "AA9B8A", valign: "top" }
    );

    const items = [
      ["📝", "+ 場所を登録", "Googleフォームへ直接遷移。個人情報の保存・管理は行政データと分離"],
      ["💬", "相談ひろば", "資金・場所・衛生許可・ボランティア集め・運営継続などカテゴリ別に質問投稿"],
      ["❓", "FAQ", "よくある悩み（場所探し・ボランティア集め・運営継続）に事前回答"],
      ["👍", "役に立った機能", "回答への評価を端末に記憶し、有用な回答が見つけやすい"],
    ];
    items.forEach((it, i) => {
      const y = 1.7 + i * 1.15;
      s.addShape(pres.ShapeType.ellipse, {
        x: 8.2, y: y + 0.03, w: 0.45, h: 0.45, fill: { color: "E4EBE2" }, line: { type: "none" },
      });
      s.addText(it[0], { x: 8.2, y: y + 0.03, w: 0.45, h: 0.45, fontSize: 13, align: "center", valign: "middle", margin: 0 });
      s.addText(it[1], {
        x: 8.8, y, w: 4.05, h: 0.4, fontFace: FONT_HEAD, fontSize: 14.5, bold: true, color: COLOR.ink,
      });
      s.addText(it[2], {
        x: 8.8, y: y + 0.4, w: 4.05, h: 0.6, fontFace: FONT_BODY, fontSize: 11.5, color: COLOR.inkSoft,
      });
    });
    pageNum(s, 7);
  }

  // ---------- 8. Data sources (honest) ----------
  {
    const s = lightSlide(pres);
    kicker(s, "Open Data");
    title(s, "使用しているオープンデータ（すべてCC BY 4.0）");

    const rows = [
      ["🏙️", "東京都オープンデータカタログ", "区市町村ごとの子ども食堂一覧", "catalog.data.metro.tokyo.lg.jp（区市町村別に多数、詳細はdata/SOURCES.md）"],
      ["🍚", "東京都福祉局", "「子供食堂推進事業」実績データ", "opendata.metro.tokyo.lg.jp/fukushi/R4jisseki.xlsx"],
      ["🏛️", "各区市町村 公共施設一覧", "公民館・区民センター等を抽出（627件）", "自治体ごとに個別URL、詳細はdata/SOURCES.md"],
      ["🎓", "東京都教育庁", "「施設関連情報_公民館」", "opendata.metro.tokyo.lg.jp/kyouiku/R3/skshubetu_1.csv"],
      ["🛰️", "国土地理院 住所検索API", "住所→緯度経度のジオコーディングに使用", "msearch.gsi.go.jp/address-search/AddressSearch"],
    ];
    let y = 1.6;
    rows.forEach((r) => {
      s.addShape(pres.ShapeType.rect, { x: 0.6, y: y + 0.78, w: 8.4, h: 0.01, fill: { color: "EEE3D6" }, line: { type: "none" } });
      s.addText(r[0], { x: 0.6, y, w: 0.5, h: 0.78, fontSize: 15, valign: "middle" });
      s.addText(r[1], { x: 1.15, y, w: 2.85, h: 0.78, fontFace: FONT_BODY, fontSize: 13, bold: true, color: COLOR.ink, valign: "middle" });
      s.addText(r[2], { x: 4.1, y: y + 0.03, w: 4.9, h: 0.4, fontFace: FONT_BODY, fontSize: 12, color: COLOR.inkSoft, valign: "middle" });
      s.addText(r[3], { x: 4.1, y: y + 0.42, w: 4.9, h: 0.3, fontFace: FONT_BODY, fontSize: 9, color: "AA9B8A", valign: "middle" });
      y += 0.84;
    });

    s.addShape(pres.ShapeType.roundRect, {
      x: 9.3, y: 1.7, w: 3.45, h: 3.45, rectRadius: 0.12,
      fill: { color: COLOR.cardTint }, line: { type: "none" },
    });
    s.addText("プライバシーへの配慮", {
      x: 9.6, y: 1.95, w: 2.9, h: 0.45, fontFace: FONT_HEAD, fontSize: 15, bold: true, color: COLOR.primary,
    });
    s.addText(
      "電話番号・メールアドレス等の個人連絡先情報は、公開する地図データからすべて除外。出典・ライセンス一覧は data/SOURCES.md にリポジトリ内公開。",
      { x: 9.6, y: 2.5, w: 2.9, h: 2.5, fontFace: FONT_BODY, fontSize: 12, color: COLOR.ink, valign: "top" }
    );
    pageNum(s, 8);
  }

  // ---------- 9. Tech stack (honest) ----------
  {
    const s = lightSlide(pres);
    kicker(s, "Technology");
    title(s, "技術構成：静的サイト＋自動化データパイプライン");

    const cols = [
      { icon: "💻", head: "フロントエンド", color: COLOR.primary, items: ["React + TypeScript + Vite", "地図表示：Leaflet（react-leaflet）", "ホスティング：Vercel（main連動で自動デプロイ）"] },
      { icon: "🔄", head: "データパイプライン", color: COLOR.sage, items: ["Pythonスクリプトで収集・ジオコーディング・重複除去を自動化", "手順は再利用可能な「スキル」としてリポジトリに整備"] },
      { icon: "🤖", head: "生成AIの活用", color: COLOR.blue, items: ["Claude Codeを開発全体で活用", "データ収集・地図UI実装・バグ修正まで一貫して支援"] },
    ];
    cols.forEach((col, i) => {
      const x = 0.6 + i * 4.1;
      s.addShape(pres.ShapeType.roundRect, {
        x, y: 1.7, w: 3.8, h: 4.4, rectRadius: 0.12,
        fill: { color: COLOR.white }, line: { color: "EEE3D6", width: 1 },
        shadow: { type: "outer", color: "000000", opacity: 0.1, blur: 8, offset: 3, angle: 90 },
      });
      s.addShape(pres.ShapeType.rect, { x, y: 1.7, w: 3.8, h: 0.1, fill: { color: col.color }, line: { type: "none" } });
      s.addShape(pres.ShapeType.ellipse, {
        x: x + 0.3, y: 2.0, w: 0.55, h: 0.55, fill: { color: COLOR.cream }, line: { type: "none" },
      });
      s.addText(col.icon, { x: x + 0.3, y: 2.0, w: 0.55, h: 0.55, fontSize: 18, align: "center", valign: "middle", margin: 0 });
      s.addText(col.head, {
        x: x + 0.98, y: 2.0, w: 2.6, h: 0.55, fontFace: FONT_HEAD, fontSize: 15.5, bold: true, color: COLOR.ink, valign: "middle",
      });
      col.items.forEach((it, j) => {
        s.addText(it, {
          x: x + 0.3, y: 2.6 + j * 1.05, w: 3.2, h: 1.0, fontFace: FONT_BODY, fontSize: 12.5,
          color: COLOR.inkSoft, valign: "top", bullet: { code: "2022" },
        });
      });
    });
    s.addText("※現時点ではバックエンド・DBを持たない静的構成。登録データはGoogleフォーム経由でスプレッドシートに記録。", {
      x: 0.6, y: 6.35, w: 12.1, h: 0.5, fontFace: FONT_BODY, fontSize: 11, color: "998267",
    });
    pageNum(s, 9);
  }

  // ---------- 10. Use-case scenarios (labeled as illustrative) ----------
  {
    const s = lightSlide(pres);
    kicker(s, "Scenario — 想定シーン");
    title(s, "多様な「場所」が、こどもの居場所に変わる瞬間");

    const cases = [
      { tag: "Case A", head: "公共施設の再発見", color: COLOR.sage, body: "市民グループが、公民館の空き情報をアプリで見つけ、月1回の活動を実現。" },
      { tag: "Case B", head: "企業の地域貢献", color: COLOR.blue, body: "週末に閉鎖していた社員食堂を開放。企業と地域住民の新しい接点に。" },
      { tag: "Case C", head: "空き家の再生", color: COLOR.violet, body: "相続したまま放置されていた実家のキッチンを提供。地域の交流拠点として活用。" },
    ];
    cases.forEach((c, i) => {
      const x = 0.6 + i * 4.1;
      s.addShape(pres.ShapeType.roundRect, {
        x, y: 1.75, w: 3.75, h: 4.3, rectRadius: 0.12,
        fill: { color: COLOR.cream }, line: { type: "none" },
      });
      s.addShape(pres.ShapeType.roundRect, {
        x: x + 0.3, y: 2.05, w: 1.15, h: 0.4, rectRadius: 0.2, fill: { color: c.color }, line: { type: "none" },
      });
      s.addText(c.tag, {
        x: x + 0.3, y: 2.05, w: 1.15, h: 0.4, fontFace: FONT_BODY, fontSize: 11, bold: true,
        color: COLOR.white, align: "center", valign: "middle", margin: 0,
      });
      s.addText(c.head, {
        x: x + 0.3, y: 2.6, w: 3.15, h: 0.7, fontFace: FONT_HEAD, fontSize: 18, bold: true, color: COLOR.ink,
      });
      s.addText(c.body, {
        x: x + 0.3, y: 3.4, w: 3.15, h: 2.2, fontFace: FONT_BODY, fontSize: 13, color: COLOR.inkSoft, valign: "top",
      });
    });
    s.addText("※上記は今後実現を目指す活用イメージであり、現時点の実例ではありません。", {
      x: 0.6, y: 6.35, w: 12.1, h: 0.4, fontFace: FONT_BODY, fontSize: 11, italic: true, color: "998267",
    });
    pageNum(s, 10);
  }

  // ---------- 11. Mutual benefits ----------
  {
    const s = lightSlide(pres);
    s.background = { color: "FBF5E9" };
    kicker(s, "Benefits");
    title(s, "双方向のメリット：探す手間を省き、資産価値を高める");

    const cols = [
      {
        head: "活動者（主催者）のメリット", color: COLOR.primary, items: [
          ["⏱️", "時短と効率化", "候補地の洗い出しから問い合わせまでの時間を短縮"],
          ["📋", "安心の事前情報", "設備・利用条件が事前に分かり、現地確認の手間が省ける"],
          ["🎯", "活動への集中", "場所探しに疲弊せず、こどもとの関わりにリソースを割ける"],
        ],
      },
      {
        head: "場所提供者（オーナー）のメリット", color: COLOR.sage, items: [
          ["🏢", "資産の有効活用", "夜間営業のみの店舗・休日の社食など、空き時間を社会貢献に"],
          ["🤝", "地域とのつながり", "登録フォームへの入力だけで、地域支援の意思表示ができる"],
          ["📣", "社会貢献の可視化", "CSR活動として、地域とのつながりを対外的に示せる"],
        ],
      },
    ];
    cols.forEach((col, i) => {
      const x = 0.6 + i * 6.15;
      s.addShape(pres.ShapeType.roundRect, {
        x, y: 1.65, w: 5.7, h: 4.9, rectRadius: 0.12,
        fill: { color: COLOR.white }, line: { color: "EEE3D6", width: 1 },
        shadow: { type: "outer", color: "000000", opacity: 0.12, blur: 8, offset: 3, angle: 90 },
      });
      s.addShape(pres.ShapeType.rect, { x, y: 1.65, w: 5.7, h: 0.1, fill: { color: col.color }, line: { type: "none" } });
      s.addText(col.head, {
        x: x + 0.35, y: 1.95, w: 5.0, h: 0.5, fontFace: FONT_HEAD, fontSize: 17, bold: true, color: COLOR.ink,
      });
      col.items.forEach((it, j) => {
        const iy = 2.65 + j * 1.25;
        s.addShape(pres.ShapeType.ellipse, {
          x: x + 0.35, y: iy, w: 0.55, h: 0.55, fill: { color: col.color === COLOR.primary ? COLOR.cardTint : "E4EBE2" }, line: { type: "none" },
        });
        s.addText(it[0], { x: x + 0.35, y: iy, w: 0.55, h: 0.55, fontSize: 18, align: "center", valign: "middle", margin: 0 });
        s.addText(it[1], {
          x: x + 1.05, y: iy - 0.02, w: 4.3, h: 0.4, fontFace: FONT_HEAD, fontSize: 14.5, bold: true, color: COLOR.ink,
        });
        s.addText(it[2], {
          x: x + 1.05, y: iy + 0.38, w: 4.3, h: 0.7, fontFace: FONT_BODY, fontSize: 11.5, color: COLOR.inkSoft, valign: "top",
        });
      });
    });
    pageNum(s, 11);
  }

  // ---------- 12. Roadmap / closing ----------
  {
    const s = darkSlide(pres);
    kicker(s, "Next Steps", { color: COLOR.primaryLight });
    s.addText("今後の展望", {
      x: 0.6, y: 0.85, w: 8, h: 0.8, fontFace: FONT_HEAD, fontSize: 32, bold: true, color: COLOR.white,
    });

    const roadmap = [
      "埼玉県データの出典・ライセンス確認後、地図へ復活",
      "施設の設備情報（炊事場・冷蔵庫の有無等）を提供者自身が登録できる仕組みの拡充",
      "むすびえの二次利用可データを活用したデータ再投入",
      "現在地周辺のこども食堂を探す機能・PWA化",
      "ボランティア参加や食堂利用でポイントが貯まる仕組みの検討",
    ];
    roadmap.forEach((r, i) => {
      const y = 1.9 + i * 0.72;
      s.addShape(pres.ShapeType.ellipse, {
        x: 0.6, y: y + 0.05, w: 0.32, h: 0.32, fill: { color: COLOR.primaryLight }, line: { type: "none" },
      });
      s.addText(String(i + 1), {
        x: 0.6, y: y + 0.05, w: 0.32, h: 0.32, fontFace: FONT_BODY, fontSize: 12, bold: true,
        color: COLOR.darkBg, align: "center", valign: "middle", margin: 0,
      });
      s.addText(r, {
        x: 1.15, y, w: 11.4, h: 0.65, fontFace: FONT_BODY, fontSize: 15, color: "F0E4D6", valign: "middle",
      });
    });

    s.addText("キッチン・バトン　https://kitchen-baton.vercel.app", {
      x: 0.6, y: 6.85, w: 10, h: 0.4, fontFace: FONT_BODY, fontSize: 12, color: "B99A7C",
    });
    pageNum(s, 12);
  }

  const outPath = path.join(__dirname, "kitchen-baton-pitch.pptx");
  await pres.writeFile({ fileName: outPath });
  console.log("wrote", outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
