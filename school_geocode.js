// Node.jsスクリプト: school_geocode.js
// 小学校名リストをNominatimでジオコーディングし、regionData.jsonに保存

const fetch = require('node-fetch');
const fs = require('fs');

const schools = [
  'さいたま市立高砂小学校',
  'さいたま市立常盤小学校',
  'さいたま市立木崎小学校',
  'さいたま市立谷田小学校',
  'さいたま市立仲本小学校',
  'さいたま市立本太小学校',
  'さいたま市立三室小学校',
  'さいたま市立尾間木小学校',
  'さいたま市立南浦和小学校',
  'さいたま市立浦和別所小学校'
];

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'kitchen-baton' } });
  const data = await res.json();
  if (data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

(async () => {
  const results = [];
  for (const name of schools) {
    console.log(`Geocoding: ${name}`);
    const coord = await geocode(name);
    if (coord) {
      results.push({ name, ...coord });
      console.log(`  => ${coord.lat}, ${coord.lng}`);
    } else {
      results.push({ name, lat: null, lng: null });
      console.log('  => Not found');
    }
    await new Promise(r => setTimeout(r, 1200)); // レート制限対策
  }
  fs.writeFileSync('regionData.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('regionData.jsonを書き出しました');
})();
