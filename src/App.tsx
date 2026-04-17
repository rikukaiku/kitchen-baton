import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
// import { useRef, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
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

// 地図の視点を切り替える補助コンポーネント
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
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

// ダミーの子ども食堂データ（CSVがない場合のフォールバック）
const dummyLocations = [
  { id: 1, name: "子ども交流食堂たまっこ", lat: 35.735, lng: 139.665, address: "豊玉中3-3-12", needs: ["学習支援", "食事提供"] },
  { id: 2, name: "子ども食堂 ひまわり", lat: 35.676, lng: 139.676, address: "幡ヶ谷2-10-5", needs: ["食事提供"] },
  { id: 3, name: "地域子ども食堂 あかり", lat: 35.742, lng: 139.605, address: "石神井公園内", needs: ["学習支援", "遊び場提供"] },
];

const App = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [mapConfig, setMapConfig] = useState<{center: [number, number], zoom: number}>({ center: [35.765, 139.645], zoom: 11 });
  const [showNeeds, setShowNeeds] = useState(true);
  const [activeTab, setActiveTab] = useState<'alert' | 'search'>('alert');
  const [placeType, setPlaceType] = useState('すべて');
  const [equipment, setEquipment] = useState('すべて');
  const [filterCity, setFilterCity] = useState('すべて');
  const [filterNeed, setFilterNeed] = useState('すべて');
  const [searchKeyword, setSearchKeyword] = useState('');


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
    const typeMatch = placeType === 'すべて' || loc.name.includes(placeType) || loc.needs.some((need: string) => need.includes(placeType));
    const equipmentMatch = equipment === 'すべて' || loc.needs.some((need: string) => need.includes(equipment));
    const keywordMatch = searchKeyword === '' || loc.needs.some((need: string) => need.toLowerCase().includes(searchKeyword.toLowerCase())) || loc.name.toLowerCase().includes(searchKeyword.toLowerCase()) || loc.address.toLowerCase().includes(searchKeyword.toLowerCase());
    return typeMatch && equipmentMatch && keywordMatch;
  });

  // CSVの読み込み
  useEffect(() => {
    console.log("CSV読み込み開始");
    Papa.parse('/saitama.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("CSV読み込み完了:", results.data.length, "行");
        const formattedData = results.data
          .map((row: any, index: number) => {
            const lat = parseFloat(row.緯度 ?? row['緯度']);
            const lng = parseFloat(row.経度 ?? row['経 度'] ?? row['経度']);
            return {
              id: `csv-${index}`,
              name: row.名称 || row['名称'] || "名称不明",
              lat,
              lng,
              address: row.住所 || row['住所'] || "",
              needs: (row.実施支援の主な区分 ?? row['実施支援の主な区分'] ?? "").split(',').map((n: string) => n.trim()).filter(Boolean)
            };
          })
          .filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
        console.log("フィルタ後データ:", formattedData.length, "件");
        if (formattedData.length > 0) {
          setLocations(formattedData);
        } else {
          setLocations(dummyLocations);
        }
      },
      error: (error) => {
        console.error("CSV読み込みエラー:", error);
        setLocations(dummyLocations);
      }
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
    ? { flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', height: '400px' }
    : { flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' };
  const sidebarStyle: React.CSSProperties = isMobile
    ? { width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', height: 'auto', overflow: 'visible', marginBottom: '12px' }
    : { width: '320px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'hidden' };
  const cardListStyle: React.CSSProperties = isMobile
    ? { height: '320px', overflow: 'auto' }
    : { height: '800px', overflow: 'scroll' };
  const searchListStyle: React.CSSProperties = isMobile
    ? { height: '220px', overflow: 'auto' }
    : { height: '800px', overflow: 'scroll' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', overflow: 'auto', background: '#f4f6fb' }}>
      {/* ヘッダー */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: '#1976d2', color: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.05em', fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.1)', color: '#fff' }}>🍳 キッチン・バトン</h1>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '4px' }}>子ども食堂・支援拠点の可視化デモ</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setShowNeeds(!showNeeds)} style={{ border: 'none', borderRadius: '24px', padding: '10px 18px', background: showNeeds ? '#fff' : '#4dabf5', color: showNeeds ? '#1976d2' : '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>{showNeeds ? 'ニーズ表示中' : 'ニーズ非表示'}</button>
          <button style={{ border: 'none', borderRadius: '24px', padding: '10px 18px', background: '#fff', color: '#1976d2', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>+ 場所を登録</button>
        </div>
      </header>

      <div style={mainLayoutStyle}>
        <section style={sidebarStyle}>
          <div style={{ background: '#fff', borderRadius: '18px', padding: '18px', boxShadow: '0 6px 18px rgba(0,0,0,0.05)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              <button onClick={() => setActiveTab('alert')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', background: activeTab === 'alert' ? '#1976d2' : '#edf2fb', color: activeTab === 'alert' ? '#fff' : '#333', cursor: 'pointer' }}>ニーズアラート</button>
              <button onClick={() => setActiveTab('search')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', background: activeTab === 'search' ? '#1976d2' : '#edf2fb', color: activeTab === 'search' ? '#fff' : '#333', cursor: 'pointer' }}>場所を探す</button>
            </div>

            {activeTab === 'alert' ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>キーワード検索</label>
                  <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="支援内容、施設名、住所で検索" style={{ width: '95%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ccd6e8', background: '#fff' }} />
                </div>
                <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>場所の種類</label>
                  <select value={placeType} onChange={(e) => setPlaceType(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ccd6e8', background: '#fff' }}>
                    <option>すべて</option>
                    <option>子ども食堂</option>
                    <option>フードパントリー</option>
                    <option>空き家活用</option>
                  </select>
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
          <div style={{ flex: 1, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' }}>
            <MapContainer center={mapConfig.center} zoom={mapConfig.zoom} style={{ height: '100%', width: '100%' }}>
              <ChangeView center={mapConfig.center} zoom={mapConfig.zoom} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {showNeeds && regionStats.map(region => (
                <Circle 
                  key={region.id} 
                  center={[region.lat, region.lng]} 
                  radius={1500}
                  pathOptions={{ fillColor: region.need === '高' ? '#e74c3c' : '#f39c12', color: 'transparent', fillOpacity: 0.25 }}
                />
              ))}
              {locations.map(loc => (
                <Marker key={loc.id} position={[loc.lat, loc.lng]}>
                  <Popup>
                    <strong>{loc.name}</strong><br />
                    <span style={{ fontSize: '0.8rem' }}>{loc.address}</span><br />
                    {loc.needs.map((n: string) => (
                      <span key={n} style={{ fontSize: '0.7rem', background: '#edf2fb', padding: '2px 5px', marginRight: '4px', borderRadius: '4px' }}>{n}</span>
                    ))}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

        </main>

      </div>
    </div>
  );
};

export default App;