import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
// import { useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import Papa from 'papaparse';

// Leafletアイコンの修正（デフォルトだと表示されないことがあるため）
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// 公民館等（施設種別が「公民館」）は緑ピンで区別する
const KouminIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// 地図の視点を切り替える補助コンポーネント
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: false });
  }, [center[0], center[1], zoom, map]);
  return null;
}

// 地図サイズ再計算用コンポーネント
function MapResizeFixer() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

// 地域ニーズの統計データ（サイドバー用）
const regionData = [
  { id: 'n1', name: "練馬区・石神井", children: 15600, facilities: 2, lat: 35.742, lng: 139.605 },
  { id: 'n2', name: "練馬区・光が丘", children: 12000, facilities: 3, lat: 35.758, lng: 139.627 },
  { id: 's1', name: "渋谷区・本町/笹塚", children: 4200, facilities: 1, lat: 35.676, lng: 139.667 },
  { id: 's2', name: "渋谷区・上原/富ヶ谷", children: 3100, facilities: 2, lat: 35.668, lng: 139.684 },
  // さいたま市の小学校データ（PDFより、緯度経度を実際の位置に修正）
  { id: 'sa-takasago', name: "さいたま市・高砂小学校", children: 1042, facilities: 1, lat: 35.8714, lng: 139.6522 },
  { id: 'sa-tokiwa', name: "さいたま市・常盤小学校", children: 1111, facilities: 1, lat: 35.8542, lng: 139.6411 },
  { id: 'sa-kizaki', name: "さいたま市・木崎小学校", children: 1027, facilities: 1, lat: 35.8644, lng: 139.6322 },
  { id: 'sa-yatada', name: "さいたま市・谷田小学校", children: 598, facilities: 1, lat: 35.8811, lng: 139.6611 },
  { id: 'sa-nakamoto', name: "さいたま市・仲本小学校", children: 871, facilities: 1, lat: 35.8444, lng: 139.6222 },
  { id: 'sa-honto', name: "さいたま市・本太小学校", children: 908, facilities: 1, lat: 35.8711, lng: 139.6722 },
  { id: 'sa-mimuro', name: "さいたま市・三室小学校", children: 899, facilities: 1, lat: 35.8511, lng: 139.6111 },
  { id: 'sa-omagi', name: "さいたま市・尾間木小学校", children: 1000, facilities: 1, lat: 35.8611, lng: 139.6811 },
  { id: 'sa-minamiura', name: "さいたま市・南浦和小学校", children: 847, facilities: 1, lat: 35.8311, lng: 139.6311 },
  { id: 'sa-urawa-bessho', name: "さいたま市・浦和別所小学校", children: 1203, facilities: 1, lat: 35.8411, lng: 139.6911 },
  // 他の小学校も追加可能（ここでは一部のみ）
];

// 子どもの人口データ（2026年2月 住民基本台帳）に基づく分析ロジック
const calculateNeed = (children: number, facilities: number): string => {
  const needScore = children / facilities;
  if (needScore > 1500) return "高";
  if (needScore > 1000) return "中";
  return "低";
};

// 市区町村名→読み仮名（総務省 全国地方公共団体コードのカナ表記）。
// 市区町村フィルタを五十音順に並べるために使う（漢字の文字コード順だとバラバラになるため）
const MUNICIPALITY_KANA: Record<string, string> = {
  "さいたま市": "ｻｲﾀﾏｼ",
  "川越市": "ｶﾜｺﾞｴｼ",
  "熊谷市": "ｸﾏｶﾞﾔｼ",
  "川口市": "ｶﾜｸﾞﾁｼ",
  "行田市": "ｷﾞﾖｳﾀﾞｼ",
  "秩父市": "ﾁﾁﾌﾞｼ",
  "所沢市": "ﾄｺﾛｻﾞﾜｼ",
  "飯能市": "ﾊﾝﾉｳｼ",
  "加須市": "ｶｿﾞｼ",
  "本庄市": "ﾎﾝｼﾞﾖｳｼ",
  "東松山市": "ﾋｶﾞｼﾏﾂﾔﾏｼ",
  "春日部市": "ｶｽｶﾍﾞｼ",
  "狭山市": "ｻﾔﾏｼ",
  "羽生市": "ﾊﾆﾕｳｼ",
  "鴻巣市": "ｺｳﾉｽｼ",
  "深谷市": "ﾌｶﾔｼ",
  "上尾市": "ｱｹﾞｵｼ",
  "草加市": "ｿｳｶｼ",
  "越谷市": "ｺｼｶﾞﾔｼ",
  "蕨市": "ﾜﾗﾋﾞｼ",
  "戸田市": "ﾄﾀﾞｼ",
  "入間市": "ｲﾙﾏｼ",
  "朝霞市": "ｱｻｶｼ",
  "志木市": "ｼｷｼ",
  "和光市": "ﾜｺｳｼ",
  "新座市": "ﾆｲｻﾞｼ",
  "桶川市": "ｵｹｶﾞﾜｼ",
  "久喜市": "ｸｷｼ",
  "北本市": "ｷﾀﾓﾄｼ",
  "八潮市": "ﾔｼｵｼ",
  "富士見市": "ﾌｼﾞﾐｼ",
  "三郷市": "ﾐｻﾄｼ",
  "蓮田市": "ﾊｽﾀﾞｼ",
  "坂戸市": "ｻｶﾄﾞｼ",
  "幸手市": "ｻｯﾃｼ",
  "鶴ヶ島市": "ﾂﾙｶﾞｼﾏｼ",
  "日高市": "ﾋﾀﾞｶｼ",
  "吉川市": "ﾖｼｶﾜｼ",
  "ふじみ野市": "ﾌｼﾞﾐﾉｼ",
  "白岡市": "ｼﾗｵｶｼ",
  "伊奈町": "ｲﾅﾏﾁ",
  "三芳町": "ﾐﾖｼﾏﾁ",
  "毛呂山町": "ﾓﾛﾔﾏﾏﾁ",
  "越生町": "ｵｺﾞｾﾏﾁ",
  "滑川町": "ﾅﾒｶﾞﾜﾏﾁ",
  "嵐山町": "ﾗﾝｻﾞﾝﾏﾁ",
  "小川町": "ｵｶﾞﾜﾏﾁ",
  "川島町": "ｶﾜｼﾞﾏﾏﾁ",
  "吉見町": "ﾖｼﾐﾏﾁ",
  "鳩山町": "ﾊﾄﾔﾏﾏﾁ",
  "ときがわ町": "ﾄｷｶﾞﾜﾏﾁ",
  "横瀬町": "ﾖｺｾﾞﾏﾁ",
  "皆野町": "ﾐﾅﾉﾏﾁ",
  "長瀞町": "ﾅｶﾞﾄﾛﾏﾁ",
  "小鹿野町": "ｵｶﾞﾉﾏﾁ",
  "東秩父村": "ﾋｶﾞｼﾁﾁﾌﾞﾑﾗ",
  "美里町": "ﾐｻﾄﾏﾁ",
  "神川町": "ｶﾐｶﾜﾏﾁ",
  "上里町": "ｶﾐｻﾄﾏﾁ",
  "寄居町": "ﾖﾘｲﾏﾁ",
  "宮代町": "ﾐﾔｼﾛﾏﾁ",
  "杉戸町": "ｽｷﾞﾄﾏﾁ",
  "松伏町": "ﾏﾂﾌﾞｼﾏﾁ",
  "千代田区": "ﾁﾖﾀﾞｸ",
  "中央区": "ﾁｭｳｵｳｸ",
  "港区": "ﾐﾅﾄｸ",
  "新宿区": "ｼﾝｼﾞｭｸｸ",
  "文京区": "ﾌﾞﾝｷｮｳｸ",
  "台東区": "ﾀｲﾄｳｸ",
  "墨田区": "ｽﾐﾀﾞｸ",
  "江東区": "ｺｳﾄｳｸ",
  "品川区": "ｼﾅｶﾞﾜｸ",
  "目黒区": "ﾒｸﾞﾛｸ",
  "大田区": "ｵｵﾀｸ",
  "世田谷区": "ｾﾀｶﾞﾔｸ",
  "渋谷区": "ｼﾌﾞﾔｸ",
  "中野区": "ﾅｶﾉｸ",
  "杉並区": "ｽｷﾞﾅﾐｸ",
  "豊島区": "ﾄｼﾏｸ",
  "北区": "ｷﾀｸ",
  "荒川区": "ｱﾗｶﾜｸ",
  "板橋区": "ｲﾀﾊﾞｼｸ",
  "練馬区": "ﾈﾘﾏｸ",
  "足立区": "ｱﾀﾞﾁｸ",
  "葛飾区": "ｶﾂｼｶｸ",
  "江戸川区": "ｴﾄﾞｶﾞﾜｸ",
  "八王子市": "ﾊﾁｵｳｼﾞｼ",
  "立川市": "ﾀﾁｶﾜｼ",
  "武蔵野市": "ﾑｻｼﾉｼ",
  "三鷹市": "ﾐﾀｶｼ",
  "青梅市": "ｵｳﾒｼ",
  "府中市": "ﾌﾁｭｳｼ",
  "昭島市": "ｱｷｼﾏｼ",
  "調布市": "ﾁｮｳﾌｼ",
  "町田市": "ﾏﾁﾀﾞｼ",
  "小金井市": "ｺｶﾞﾈｲｼ",
  "小平市": "ｺﾀﾞｲﾗｼ",
  "日野市": "ﾋﾉｼ",
  "東村山市": "ﾋｶﾞｼﾑﾗﾔﾏｼ",
  "国分寺市": "ｺｸﾌﾞﾝｼﾞｼ",
  "国立市": "ｸﾆﾀﾁｼ",
  "福生市": "ﾌｯｻｼ",
  "狛江市": "ｺﾏｴｼ",
  "東大和市": "ﾋｶﾞｼﾔﾏﾄｼ",
  "清瀬市": "ｷﾖｾｼ",
  "東久留米市": "ﾋｶﾞｼｸﾙﾒｼ",
  "武蔵村山市": "ﾑｻｼﾑﾗﾔﾏｼ",
  "多摩市": "ﾀﾏｼ",
  "稲城市": "ｲﾅｷﾞｼ",
  "羽村市": "ﾊﾑﾗｼ",
  "あきる野市": "ｱｷﾙﾉｼ",
  "西東京市": "ﾆｼﾄｳｷｮｳｼ",
  "瑞穂町": "ﾐｽﾞﾎﾏﾁ",
  "日の出町": "ﾋﾉﾃﾞﾏﾁ",
  "檜原村": "ﾋﾉﾊﾗﾑﾗ",
  "奥多摩町": "ｵｸﾀﾏﾏﾁ",
  "大島町": "ｵｵｼﾏﾏﾁ",
  "利島村": "ﾄｼﾏﾑﾗ",
  "新島村": "ﾆｲｼﾞﾏﾑﾗ",
  "神津島村": "ｺｳﾂﾞｼﾏﾑﾗ",
  "三宅村": "ﾐﾔｹﾑﾗ",
  "御蔵島村": "ﾐｸﾗｼﾞﾏﾑﾗ",
  "八丈町": "ﾊﾁｼﾞｮｳﾏﾁ",
  "青ヶ島村": "ｱｵｶﾞｼﾏﾑﾗ",
  "小笠原村": "ｵｶﾞｻﾜﾗﾑﾗ",
};

// 読み仮名が分かっていればそれで、無ければ名前そのもので五十音順に並べる
const sortByKana = (a: string, b: string): number => {
  const kanaA = MUNICIPALITY_KANA[a] || a;
  const kanaB = MUNICIPALITY_KANA[b] || b;
  return kanaA.localeCompare(kanaB, 'ja');
};

// ダミーの子ども食堂データ（CSVがない場合のフォールバック）
const dummyLocations = [
  { id: 1, name: "子ども交流食堂たまっこ", lat: 35.735, lng: 139.665, address: "豊玉中3-3-12", needs: ["学習支援", "食事提供"] },
  { id: 2, name: "子ども食堂 ひまわり", lat: 35.676, lng: 139.676, address: "幡ヶ谷2-10-5", needs: ["食事提供"] },
  { id: 3, name: "地域子ども食堂 あかり", lat: 35.742, lng: 139.605, address: "石神井公園内", needs: ["学習支援", "遊び場提供"] },
];

// 初期表示は東京都庁（新宿区）付近。23区のほぼ中心にあたる
const DEFAULT_MAP_CONFIG: { center: [number, number], zoom: number } = { center: [35.6895, 139.6917], zoom: 11 };

const App = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [mapConfig, setMapConfig] = useState<{center: [number, number], zoom: number}>(DEFAULT_MAP_CONFIG);
  const [showNeeds, setShowNeeds] = useState(true);
  const [activeTab, setActiveTab] = useState<'alert' | 'search'>('search');
  const [placeTypes, setPlaceTypes] = useState<string[]>([]);
  const [equipment, setEquipment] = useState('すべて');
  const [filterCity, setFilterCity] = useState('すべて');
  const [filterNeed, setFilterNeed] = useState('すべて');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterPrefecture, setFilterPrefecture] = useState('すべて');
  const [filterMunicipality, setFilterMunicipality] = useState('すべて');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  // カード選択時に対応するピンの吹き出しを開く
  useEffect(() => {
    if (!selectedLocationId) return;
    const marker = markerRefs.current[selectedLocationId];
    marker?.openPopup();
  }, [selectedLocationId]);

  // 地図の表示位置・検索条件をすべて初期状態に戻す
  const resetAll = () => {
    setMapConfig(DEFAULT_MAP_CONFIG);
    setPlaceTypes([]);
    setEquipment('すべて');
    setFilterCity('すべて');
    setFilterNeed('すべて');
    setSearchKeyword('');
    setFilterPrefecture('すべて');
    setFilterMunicipality('すべて');
    setSelectedLocationId(null);
  };


  const regionStatsRaw = regionData.map(region => ({
    ...region,
    need: calculateNeed(region.children, region.facilities)
  }));

  // 「ニーズ高」かつ人口多い、かつ近隣に子ども食堂がない地域を抽出
  const HIGH_NEED_POP_THRESHOLD = 10000; // 人口多い基準
  const NO_FACILITY_RADIUS_KM = 2.0; // 2km以内に施設がなければ「周りにない」
  // regionごとに近隣施設があるか判定
  function hasNearbyFacility(region: any, locations: any[], radiusKm: number) {
    return locations.some(loc => {
      const R = 6371; // 地球半径km
      const dLat = (loc.lat - region.lat) * Math.PI / 180;
      const dLng = (loc.lng - region.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(region.lat * Math.PI / 180) * Math.cos(loc.lat * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = R * c;
      return dist < radiusKm;
    });
  }

  const highNeedSpecialRegions = regionStatsRaw.filter(region =>
    region.need === '高' &&
    region.children >= HIGH_NEED_POP_THRESHOLD &&
    !hasNearbyFacility(region, locations, NO_FACILITY_RADIUS_KM)
  );

  const regionStats = regionStatsRaw
    .sort((a, b) => {
      const order: Record<string, number> = { '高': 3, '中': 2, '低': 1 };
      return order[b.need] - order[a.need];
    })
    .filter(region => (filterCity === 'すべて' || region.name.includes(filterCity)) && (filterNeed === 'すべて' || region.need === filterNeed));

  const filteredLocations = locations.filter(loc => {
    const typeMatch = placeTypes.length === 0 || placeTypes.some(pt => loc.type === pt || loc.name.includes(pt) || loc.needs.some((need: string) => need.includes(pt)));
    const equipmentMatch = equipment === 'すべて' || loc.needs.some((need: string) => need.includes(equipment));
    const keywordMatch = searchKeyword === '' || loc.needs.some((need: string) => need.toLowerCase().includes(searchKeyword.toLowerCase())) || loc.name.toLowerCase().includes(searchKeyword.toLowerCase()) || loc.address.toLowerCase().includes(searchKeyword.toLowerCase());
    const prefectureMatch = filterPrefecture === 'すべて' || loc.prefecture === filterPrefecture;
    const municipalityMatch = filterMunicipality === 'すべて' || loc.municipality === filterMunicipality;
    return typeMatch && equipmentMatch && keywordMatch && prefectureMatch && municipalityMatch;
  });

  // 都道府県・市区町村の絞り込み選択肢は実際に読み込んだ地点データから動的に作る
  const prefectureOptions = Array.from(new Set(locations.map(loc => loc.prefecture).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
  const municipalityOptions = Array.from(
    new Set(
      locations
        .filter(loc => filterPrefecture === 'すべて' || loc.prefecture === filterPrefecture)
        .map(loc => loc.municipality)
        .filter(Boolean)
    )
  ).sort(sortByKana);

  // 埼玉県CSV・東京都子ども食堂GeoJSON・東京都公民館等GeoJSONの読み込み（すべて統合してlocationsに反映）
  useEffect(() => {
    let saitamaData: any[] = [];
    let tokyoData: any[] = [];
    let kouminData: any[] = [];
    let saitamaDone = false;
    let tokyoDone = false;
    let kouminDone = false;

    const commit = () => {
      if (!saitamaDone || !tokyoDone || !kouminDone) return;
      const merged = [...tokyoData, ...saitamaData, ...kouminData];
      setLocations(merged.length > 0 ? merged : dummyLocations);
    };

    Papa.parse('/saitama.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        saitamaData = results.data
          .map((row: any, index: number) => {
            const lat = parseFloat(row.緯度 ?? row['緯度']);
            const lng = parseFloat(row.経度 ?? row['経 度'] ?? row['経度']);
            return {
              id: `saitama-${index}`,
              name: row.名称 || row['名称'] || "名称不明",
              lat,
              lng,
              address: row.住所 || row['住所'] || "",
              prefecture: row.都道府県 || row['都道府県'] || "",
              municipality: row.市区町村名 || row['市区町村名'] || "",
              type: '子ども食堂',
              needs: (row.実施支援の主な区分 ?? row['実施支援の主な区分'] ?? "").split(',').map((n: string) => n.trim()).filter(Boolean)
            };
          })
          .filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
        saitamaDone = true;
        commit();
      },
      error: (error) => {
        console.error("埼玉CSV読み込みエラー:", error);
        saitamaDone = true;
        commit();
      }
    });

    fetch('/data/tokyo_kodomoshokudo.geojson')
      .then((res) => res.json())
      .then((geojson: any) => {
        tokyoData = (geojson.features || [])
          .map((f: any, index: number) => ({
            id: `tokyo-${index}`,
            name: f.properties?.name || "名称不明",
            lat: f.geometry?.coordinates?.[1],
            lng: f.geometry?.coordinates?.[0],
            address: f.properties?.address || "",
            prefecture: "東京都",
            municipality: f.properties?.municipality || "",
            type: '子ども食堂',
            needs: f.properties?.needs || []
          }))
          .filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
      })
      .catch((error) => {
        console.error("東京都GeoJSON読み込みエラー:", error);
      })
      .finally(() => {
        tokyoDone = true;
        commit();
      });

    fetch('/data/koumin_facilities.geojson')
      .then((res) => res.json())
      .then((geojson: any) => {
        kouminData = (geojson.features || [])
          .map((f: any, index: number) => ({
            id: `koumin-${index}`,
            name: f.properties?.name || "名称不明",
            lat: f.geometry?.coordinates?.[1],
            lng: f.geometry?.coordinates?.[0],
            address: f.properties?.address || "",
            prefecture: "東京都",
            municipality: f.properties?.municipality || "",
            type: f.properties?.type || '公民館',
            needs: []
          }))
          .filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
      })
      .catch((error) => {
        console.error("公民館GeoJSON読み込みエラー:", error);
      })
      .finally(() => {
        kouminDone = true;
        commit();
      });
  }, []);

  // SSR/ビルド時 window未定義対策: isMobileをuseState+useEffectで判定
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 600);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const mainLayoutStyle: React.CSSProperties = isMobile
    ? { flex: 1, display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: 'auto', overflow: 'visible' }
    : { flex: 1, display: 'flex', gap: '16px', padding: '16px', height: 'calc(100vh - 80px)', overflow: 'hidden' };

  // モバイル時のmainの高さを明示的に指定
  const mainStyle: React.CSSProperties = isMobile
    ? { display: 'flex', flexDirection: 'column', gap: '16px', height: '400px' }
    : { flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' };
  const sidebarStyle: React.CSSProperties = isMobile
    ? { width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', height: 'auto', overflow: 'visible', marginBottom: '12px' }
    : { width: '320px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'hidden' };
  const cardListStyle: React.CSSProperties = isMobile
    ? { maxHeight: '320px', overflow: 'auto' }
    : { maxHeight: '50vh', overflow: 'auto' };
  const searchListStyle: React.CSSProperties = isMobile
    ? { maxHeight: '220px', overflow: 'auto' }
    : { maxHeight: '50vh', overflow: 'auto' };
  // サイドバー全体（フィルタ＋一覧）が縦に収まりきらない場合は、この要素自体がスクロールする
  // （一覧のmaxHeightだけでは、フィルタ項目が多い/画面が低いときに一覧が0pxまで潰れてしまうため）
  const sidebarCardStyle: React.CSSProperties = isMobile
    ? { background: '#fff', borderRadius: '18px', padding: '18px', boxShadow: '0 6px 18px rgba(0,0,0,0.05)', flexShrink: 0 }
    : { background: '#fff', borderRadius: '18px', padding: '18px', boxShadow: '0 6px 18px rgba(0,0,0,0.05)', flex: 1, minHeight: 0, overflow: 'auto' };
  const tabContentStyle: React.CSSProperties = isMobile
    ? { display: 'flex', flexDirection: 'column', height: '100%' }
    : { display: 'flex', flexDirection: 'column' };

  return (
    <div style={{ height: isMobile ? 'auto' : '100vh', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', overflow: isMobile ? 'auto' : 'hidden', background: '#f4f6fb' }}>
      {/* ヘッダー */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: '#1976d2', color: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.05em', fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.1)', color: '#fff' }}>🍳 キッチン・バトン</h1>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '4px' }}>子ども食堂・支援拠点の可視化デモ</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={resetAll} title="表示位置・検索条件を初期状態に戻す" style={{ border: 'none', borderRadius: '24px', padding: '10px 18px', background: '#fff', color: '#1976d2', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>↺ リセット</button>
          <button onClick={() => setShowNeeds(!showNeeds)} style={{ border: 'none', borderRadius: '24px', padding: '10px 18px', background: showNeeds ? '#fff' : '#4dabf5', color: showNeeds ? '#1976d2' : '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>{showNeeds ? 'ニーズ表示中' : 'ニーズ非表示'}</button>
          <button style={{ border: 'none', borderRadius: '24px', padding: '10px 18px', background: '#fff', color: '#1976d2', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>+ 場所を登録</button>
        </div>
      </header>

      <div style={mainLayoutStyle}>
        <section style={sidebarStyle}>
          <div style={sidebarCardStyle}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              <button onClick={() => setActiveTab('alert')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', background: activeTab === 'alert' ? '#1976d2' : '#edf2fb', color: activeTab === 'alert' ? '#fff' : '#333', cursor: 'pointer' }}>ニーズアラート</button>
              <button onClick={() => setActiveTab('search')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', background: activeTab === 'search' ? '#1976d2' : '#edf2fb', color: activeTab === 'search' ? '#fff' : '#333', cursor: 'pointer' }}>場所を探す</button>
            </div>

            {activeTab === 'alert' ? (
              <div style={tabContentStyle}>
                <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>市町村フィルタ</label>
                  <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ccd6e8', background: '#fff' }}>
                    <option value="すべて">すべて</option>
                    <option value="練馬区">練馬区</option>
                    <option value="渋谷区">渋谷区</option>
                    <option value="さいたま市">さいたま市</option>
                  </select>
                </div>
                <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>ニーズレベルフィルタ</label>
                  <select value={filterNeed} onChange={(e) => setFilterNeed(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ccd6e8', background: '#fff' }}>
                    <option value="すべて">すべて</option>
                    <option value="高">高</option>
                    <option value="中">中</option>
                    <option value="低">低</option>
                  </select>
                </div>
                <div style={{ marginBottom: '12px', color: '#333', fontWeight: 700, flexShrink: 0 }}>高ニーズ地域を一覧表示</div>
                <div style={cardListStyle}>
                  {/* 特別警告エリア */}
                  {highNeedSpecialRegions.length > 0 && (
                    <div style={{ marginBottom: '18px', padding: '10px', background: '#fff0f0', border: '2px solid #e74c3c', borderRadius: '12px' }}>
                      <div style={{ color: '#e74c3c', fontWeight: 900, fontSize: '1.05rem', marginBottom: '6px' }}>⚠️ 特に支援が必要な地域</div>
                      {highNeedSpecialRegions.map(region => (
                        <div key={region.id} onClick={() => setMapConfig({ center: [region.lat, region.lng], zoom: 14 })} style={{ borderRadius: '10px', padding: '8px 10px', marginBottom: '6px', background: '#fdeaea', border: '1px solid #e3eaf7', cursor: 'pointer', fontWeight: 700 }}>
                          {region.name}
                          <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#e74c3c', background: '#fdeaea', borderRadius: '8px', padding: '2px 10px', fontWeight: 900 }}>ニーズ 高</span>
                          <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#e74c3c', fontWeight: 700 }}>[子ども食堂が近隣にありません]</span>
                          <div style={{ fontSize: '0.8rem', color: '#b94a48', marginTop: '2px' }}>人口: {region.children.toLocaleString()}人</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 通常リスト */}
                  {regionStats.map(region => {
                    const message = region.need === '高' ? '区内で最も子どもの数が多い地域' : region.need === '中' ? '中程度のニーズがある地域' : '比較的安定した地域';
                    // ニーズ色分け
                    const needColor = region.need === '高' ? '#e74c3c' : region.need === '中' ? '#f39c12' : '#1976d2';
                    const needBg = region.need === '高' ? '#fdeaea' : region.need === '中' ? '#fff6e3' : '#e3eaf7';
                    return (
                      <div key={region.id} onClick={() => setMapConfig({ center: [region.lat, region.lng], zoom: 14 })} style={{ borderRadius: '14px', padding: '12px 14px', marginBottom: '10px', background: '#f8fbff', border: '1px solid #e3eaf7', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 700 }}>
                          {region.name}
                          <span style={{ fontSize: '0.8rem', color: needColor, background: needBg, borderRadius: '8px', padding: '2px 10px', fontWeight: 900, letterSpacing: '0.05em', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                            ニーズ {region.need}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '4px' }}>{message}</div>
                        <div style={{ fontSize: '0.82rem', color: '#555' }}>対象児童数: {region.children.toLocaleString()}人</div>
                        <div style={{ fontSize: '0.82rem', color: '#555' }}>子ども食堂数: {region.facilities} 箇所</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={tabContentStyle}>
                <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>キーワード検索</label>
                  <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="支援内容、施設名、住所で検索" style={{ width: '95%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ccd6e8', background: '#fff' }} />
                </div>
                <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>都道府県</label>
                  <select value={filterPrefecture} onChange={(e) => { setFilterPrefecture(e.target.value); setFilterMunicipality('すべて'); }} style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ccd6e8', background: '#fff' }}>
                    <option value="すべて">すべて</option>
                    {prefectureOptions.map(pref => <option key={pref} value={pref}>{pref}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>市区町村</label>
                  <select value={filterMunicipality} onChange={(e) => setFilterMunicipality(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ccd6e8', background: '#fff' }}>
                    <option value="すべて">すべて</option>
                    {municipalityOptions.map(muni => <option key={muni} value={muni}>{muni}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>場所の種類（複数選択可）</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['子ども食堂', 'フードパントリー', '空き家活用', '社員食堂', '公民館'].map(t => {
                      const checked = placeTypes.includes(t);
                      return (
                        <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '999px', border: checked ? '1px solid #1976d2' : '1px solid #ccd6e8', background: checked ? '#e3eaf7' : '#fff', color: checked ? '#1976d2' : '#555', fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setPlaceTypes(prev => checked ? prev.filter(x => x !== t) : [...prev, t])}
                            style={{ margin: 0 }}
                          />
                          {t}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>設備</label>
                  <select value={equipment} onChange={(e) => setEquipment(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ccd6e8', background: '#fff' }}>
                    <option>すべて</option>
                    <option>キッチン</option>
                    <option>冷蔵庫</option>
                    <option>学習スペース</option>
                  </select>
                </div>
                <div style={{ marginBottom: '12px', color: '#333', fontWeight: 700, flexShrink: 0 }}>検索結果 ({filteredLocations.length}件)</div>
                <div style={searchListStyle}>
                  {filteredLocations.map(loc => (
                    <div key={loc.id} onClick={() => {
                      if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
                        setMapConfig({ center: [loc.lat, loc.lng], zoom: 15 });
                        setSelectedLocationId(loc.id);
                      }
                    }} style={{ borderRadius: '14px', padding: '12px 14px', marginBottom: '10px', background: '#f8fbff', border: '1px solid #e3eaf7', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 700 }}>{loc.name}</div>
                      <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '4px' }}>{loc.address}</div>
                      <div style={{ fontSize: '0.82rem', color: '#555' }}>支援内容: {loc.needs.join(', ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </section>

        <main style={mainStyle}>
          <div style={isMobile ? { height: '400px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' } : { flex: 1, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' }}>
            <MapContainer center={mapConfig.center} zoom={mapConfig.zoom} style={isMobile ? { height: '400px', width: '100%' } : { height: '100%', width: '100%' }}>
              <ChangeView center={mapConfig.center} zoom={mapConfig.zoom} />
              <MapResizeFixer />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {showNeeds && regionStats.map(region => (
                <Circle 
                  key={region.id} 
                  center={[region.lat, region.lng]} 
                  radius={1500}
                  pathOptions={{ fillColor: region.need === '高' ? '#e74c3c' : '#f39c12', color: 'transparent', fillOpacity: 0.25 }}
                />
              ))}
              <MarkerClusterGroup chunkedLoading disableClusteringAtZoom={16}>
                {locations.map(loc => (
                  <Marker
                    key={loc.id}
                    position={[loc.lat, loc.lng]}
                    icon={loc.type === '公民館' ? KouminIcon : DefaultIcon}
                    ref={(el) => { markerRefs.current[loc.id] = el; }}
                  >
                    <Popup>
                      <strong>{loc.name}</strong><br />
                      <span style={{ fontSize: '0.8rem' }}>{loc.address}</span><br />
                      {loc.type && (
                        <span style={{ fontSize: '0.7rem', background: '#e3f5e6', color: '#2e7d32', padding: '2px 5px', marginRight: '4px', borderRadius: '4px' }}>{loc.type}</span>
                      )}
                      {loc.needs.map((n: string) => (
                        <span key={n} style={{ fontSize: '0.7rem', background: '#edf2fb', padding: '2px 5px', marginRight: '4px', borderRadius: '4px' }}>{n}</span>
                      ))}
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>

        </main>

      </div>

      <footer style={{ padding: '10px 24px', fontSize: '0.72rem', color: '#8a94a6', textAlign: 'center' }}>
        子ども食堂データ出典：東京都オープンデータカタログ（区市町村各データセット）／東京都福祉局「子供食堂推進事業」（いずれも
        <a href="https://creativecommons.org/licenses/by/4.0/deed.ja" target="_blank" rel="noreferrer" style={{ color: '#8a94a6' }}> CC BY 4.0</a>
        ）。詳細は <code>data/SOURCES.md</code> を参照。
      </footer>
    </div>
  );
};

export default App;