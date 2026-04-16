import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leafletアイコンの修正
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- PDF 6ページのデータを反映した地域統計 ---
const regionStats = [
  { id: 'n1', name: "練馬区・石神井", children: 15600, facilities: 2, lat: 35.742, lng: 139.605, need: "高" },
  { id: 'n2', name: "練馬区・光が丘", children: 12000, facilities: 3, lat: 35.758, lng: 139.627, need: "中" },
  { id: 's1', name: "渋谷区・本町/笹塚", children: 4200, facilities: 1, lat: 35.676, lng: 139.667, need: "高" },
  { id: 's2', name: "渋谷区・上原/富ヶ谷", children: 3100, facilities: 2, lat: 35.668, lng: 139.684, need: "低" },
];

const locations = [
  { id: 1, name: "子ども交流食堂たまっこ", type: "子ども食堂", address: "豊玉中3-3-12", lat: 35.735, lng: 139.665 },
  { id: 2, name: "幡ヶ谷の空き家", type: "空き家", address: "幡ヶ谷2-10-5", lat: 35.676, lng: 139.676 },
];

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

const App = () => {
  const [mapConfig, setMapConfig] = useState<{center: [number, number], zoom: number}>({ center: [35.7, 139.65], zoom: 12 });
  const [showNeeds, setShowNeeds] = useState(true);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      {/* ヘッダー */}
      <header style={{ padding: '10px 20px', background: '#2c3e50', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1000 }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Kitchen Baton - 地域ニーズ分析</h1>
        <label style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showNeeds} onChange={() => setShowNeeds(!showNeeds)} /> ニーズアラートを表示
        </label>
      </header>

      {/* メインコンテンツ（サイドバー + 地図） */}
      <div style={{ flex: 1, display: 'flex' }}>
        
        {/* 左側：地域別ニーズ分析サイドバー */}
        <aside style={{ width: '320px', background: '#f8f9fa', borderRight: '1px solid #ddd', overflowY: 'auto', padding: '15px' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '15px', color: '#34495e' }}>📍 地域別ニーズ一覧 (2026.2)</h2>
          {regionStats.map(region => (
            <div 
              key={region.id} 
              onClick={() => setMapConfig({ center: [region.lat, region.lng], zoom: 14 })}
              style={{ 
                padding: '12px', background: '#fff', borderRadius: '6px', marginBottom: '10px', 
                cursor: 'pointer', border: '1px solid #eee', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                transition: 'transform 0.1s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3498db'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#eee'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{region.name}</span>
                <span style={{ 
                  fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', 
                  background: region.need === '高' ? '#e74c3c' : (region.need === '中' ? '#f39c12' : '#2ecc71'),
                  color: '#fff'
                }}>ニーズ:{region.need}</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666' }}>
                <div>対象児童数: {region.children.toLocaleString()}人</div>
                <div>既存施設数: {region.facilities}箇所</div>
              </div>
            </div>
          ))}
          <p style={{ fontSize: '0.7rem', color: '#999', marginTop: '20px' }}>※ 練馬区オープンデータ・住民基本台帳より算出</p>
        </aside>

        {/* 右側：地図表示 */}
        <main style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={mapConfig.center} zoom={mapConfig.zoom} style={{ height: '100%', width: '100%' }}>
            <ChangeView center={mapConfig.center} zoom={mapConfig.zoom} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {showNeeds && regionStats.map(region => (
              <Circle 
                key={region.id} 
                center={[region.lat, region.lng]} 
                radius={800}
                pathOptions={{ 
                  fillColor: region.need === '高' ? '#e74c3c' : '#f39c12', 
                  color: 'transparent', 
                  fillOpacity: 0.4 
                }} 
              />
            ))}

            {locations.map(loc => (
              <Marker key={loc.id} position={[loc.lat, loc.lng]}>
                <Popup><strong>{loc.name}</strong><br />{loc.address}</Popup>
              </Marker>
            ))}
          </MapContainer>
        </main>
      </div>
    </div>
  );
};

export default App;