import { useState } from 'react';

const PLACE_TYPES = ['社員食堂', '空き家', '公民館', 'お寺・教会', '保育園・児童館', '老人ホーム', 'コンビニ', 'レストラン', 'その他'];
const DAYS = ['月', '火', '水', '木', '金', '土', '日'];
const SIZES = ['〜10人', '10〜30人', '30〜50人', '50人以上'];
const EQUIPMENT_OPTIONS = ['コンロ', '冷蔵庫', '給湯設備', '換気扇', '駐車場', 'エレベーター', 'バリアフリートイレ'];
const TOOL_OPTIONS = ['鍋・フライパン', '食器・カトラリー', 'テーブル・椅子', 'まな板・包丁', '保存容器'];

export const REGISTERED_PLACES_STORAGE_KEY = 'kitchenbaton_registered_places';

// Googleフォーム側の準備ができ次第、以下2つと GOOGLE_FORM_READY を実際の値に差し替える。
// フォームの回答画面右上「⋮」→「事前入力リンクを取得」で、各質問にダミー値を入れて生成される
// URLの ...formResponse?entry.123456789=... という部分から entry.ID を控える。
// URLは通常のフォームURL（/viewform）の末尾を /formResponse に変えたもの。
const GOOGLE_FORM_ACTION_URL = 'https://docs.google.com/forms/d/e/DUMMY_FORM_ID/formResponse';
const GOOGLE_FORM_ENTRY_IDS: Record<string, string> = {
  placeType: 'entry.1000000001',
  days: 'entry.1000000002',
  startTime: 'entry.1000000003',
  endTime: 'entry.1000000004',
  timeNote: 'entry.1000000005',
  size: 'entry.1000000006',
  areaNote: 'entry.1000000007',
  equipment: 'entry.1000000008',
  tools: 'entry.1000000009',
  name: 'entry.1000000010',
  company: 'entry.1000000011',
  email: 'entry.1000000012',
  phone: 'entry.1000000013',
  canStore: 'entry.1000000014',
  preferredBorrower: 'entry.1000000015',
  messageToShokudo: 'entry.1000000016',
};
// 上記が実際のGoogleフォームの値に差し替わるまではfalseのままにする。
// falseの間はGoogleフォームへの送信自体を行わず、ローカル保存のみで完了する。
const GOOGLE_FORM_READY = false;

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: '18px', padding: '18px', boxShadow: '0 6px 18px rgba(0,0,0,0.05)' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', color: '#333', fontWeight: 700, marginBottom: '10px' };
const subLabelStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#777', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #ccd6e8', background: '#fff', fontSize: '0.85rem', color: '#333' };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'none' as const, whiteSpace: 'pre-wrap' as const };

function chipStyle(selected: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: '999px',
    border: selected ? '1px solid #1976d2' : '1px solid #ccd6e8',
    background: selected ? '#e3eaf7' : '#fff',
    color: selected ? '#1976d2' : '#555',
    fontSize: '0.8rem',
    fontWeight: selected ? 700 : 400,
    cursor: 'pointer',
  };
}

export default function RegisterPlaceModal({ onClose }: { onClose: () => void }) {
  const [placeType, setPlaceType] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('21:00');
  const [timeNote, setTimeNote] = useState('');
  const [size, setSize] = useState('');
  const [areaNote, setAreaNote] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [canStore, setCanStore] = useState<boolean | null>(null);
  const [preferredBorrower, setPreferredBorrower] = useState('');
  const [messageToShokudo, setMessageToShokudo] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  const handleSubmit = async () => {
    if (!placeType || !name.trim() || !email.trim()) {
      setError('貸す場所の種類・名前・メールアドレスは必須です');
      return;
    }
    if (!agreedToTerms) {
      setError('利用規約への同意が必要です');
      return;
    }
    setError('');
    setSubmitting(true);
    const record = {
      id: `place-${Date.now()}`,
      registeredAt: new Date().toISOString(),
      placeType, days, startTime, endTime, timeNote,
      size, areaNote, equipment, tools,
      name, company, email, phone,
      canStore, preferredBorrower, messageToShokudo,
    };
    try {
      const existing = JSON.parse(localStorage.getItem(REGISTERED_PLACES_STORAGE_KEY) || '[]');
      existing.push(record);
      localStorage.setItem(REGISTERED_PLACES_STORAGE_KEY, JSON.stringify(existing));
    } catch {
      // localStorageが使えない環境ではデータは保存されないが、フォーム自体は完了扱いにする
    }
    if (GOOGLE_FORM_READY) {
      const formData = new FormData();
      formData.append(GOOGLE_FORM_ENTRY_IDS.placeType, placeType);
      formData.append(GOOGLE_FORM_ENTRY_IDS.days, days.join('、'));
      formData.append(GOOGLE_FORM_ENTRY_IDS.startTime, startTime);
      formData.append(GOOGLE_FORM_ENTRY_IDS.endTime, endTime);
      formData.append(GOOGLE_FORM_ENTRY_IDS.timeNote, timeNote);
      formData.append(GOOGLE_FORM_ENTRY_IDS.size, size);
      formData.append(GOOGLE_FORM_ENTRY_IDS.areaNote, areaNote);
      formData.append(GOOGLE_FORM_ENTRY_IDS.equipment, equipment.join('、'));
      formData.append(GOOGLE_FORM_ENTRY_IDS.tools, tools.join('、'));
      formData.append(GOOGLE_FORM_ENTRY_IDS.name, name);
      formData.append(GOOGLE_FORM_ENTRY_IDS.company, company);
      formData.append(GOOGLE_FORM_ENTRY_IDS.email, email);
      formData.append(GOOGLE_FORM_ENTRY_IDS.phone, phone);
      formData.append(GOOGLE_FORM_ENTRY_IDS.canStore, canStore === true ? '置いておける' : canStore === false ? '難しい' : '');
      formData.append(GOOGLE_FORM_ENTRY_IDS.preferredBorrower, preferredBorrower);
      formData.append(GOOGLE_FORM_ENTRY_IDS.messageToShokudo, messageToShokudo);
      try {
        // Googleフォームはno-cors制約でレスポンス内容を読めないため、送信できたかは検証できない
        await fetch(GOOGLE_FORM_ACTION_URL, { method: 'POST', mode: 'no-cors', body: formData });
      } catch {
        // ネットワークエラー時もローカル保存は残っているため完了扱いにする
      }
    }
    setSubmitting(false);
    setDone(true);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '24px 12px' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '460px', background: '#f4f6fb', borderRadius: '20px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#1976d2', color: '#fff' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold' }}>場所を登録する</h2>
            <div style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: '2px' }}>🍳 キッチン・バトン</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </header>

        {done ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#333', marginBottom: '8px' }}>登録ありがとうございます！</div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '20px' }}>{GOOGLE_FORM_READY ? '内容を運営チームに送信しました' : '内容はこの端末に保存されました（試作版のため、まだ運営には送信されません）'}</div>
            <button onClick={onClose} style={{ border: 'none', borderRadius: '24px', padding: '10px 24px', background: '#1976d2', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>閉じる</button>
          </div>
        ) : (
          <div style={{ padding: '18px 16px 24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '75vh', overflowY: 'auto' }}>

            <div style={cardStyle}>
              <label style={labelStyle}>貸す場所を選択する</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PLACE_TYPES.map(t => (
                  <div key={t} style={chipStyle(placeType === t)} onClick={() => setPlaceType(t)}>{t}</div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>貸し出し時間帯</label>
              <div style={subLabelStyle}>貸せる曜日を選んでください</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                {DAYS.map(d => (
                  <div key={d} onClick={() => toggle(days, setDays, d)} style={{ width: '36px', height: '36px', borderRadius: '999px', border: days.includes(d) ? '1px solid #1976d2' : '1px solid #ccd6e8', background: days.includes(d) ? '#1976d2' : '#fff', color: days.includes(d) ? '#fff' : '#555', fontSize: '0.78rem', fontWeight: days.includes(d) ? 700 : 400, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{d}</div>
                ))}
              </div>
              <div style={subLabelStyle}>利用可能な時間帯</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <span style={{ color: '#9aa4b6' }}>〜</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              </div>
              <div style={subLabelStyle}>補足（曜日によって時間帯が異なる場合など）</div>
              <textarea value={timeNote} onChange={(e) => setTimeNote(e.target.value)} placeholder="例：土曜は10:00〜13:00、水・金は18:00〜21:00です" style={{ ...textareaStyle, height: '48px' }} />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>大きさ</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '12px' }}>
                {SIZES.map(s => (
                  <div key={s} onClick={() => setSize(s)} style={{ padding: '10px 0', textAlign: 'center', borderRadius: '12px', border: size === s ? '1px solid #1976d2' : '1px solid #ccd6e8', background: size === s ? '#e3eaf7' : '#fff', color: size === s ? '#1976d2' : '#555', fontSize: '0.8rem', fontWeight: size === s ? 700 : 400, cursor: 'pointer' }}>{s}</div>
                ))}
              </div>
              <input type="text" value={areaNote} onChange={(e) => setAreaNote(e.target.value)} placeholder="広さの目安（例：約40㎡）" style={inputStyle} />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>設備</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 8px' }}>
                {EQUIPMENT_OPTIONS.map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#555', cursor: 'pointer' }}>
                    <input type="checkbox" checked={equipment.includes(opt)} onChange={() => toggle(equipment, setEquipment, opt)} />{opt}
                  </label>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>機材</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 8px' }}>
                {TOOL_OPTIONS.map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#555', cursor: 'pointer' }}>
                    <input type="checkbox" checked={tools.includes(opt)} onChange={() => toggle(tools, setTools, opt)} />{opt}
                  </label>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>プロフィール</label>
              <div style={{ marginBottom: '12px' }}>
                <div style={subLabelStyle}>名前</div>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 花子" style={inputStyle} />
              </div>
              <div>
                <div style={subLabelStyle}>企業名（任意）</div>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="株式会社〇〇" style={inputStyle} />
              </div>
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>連絡先</label>
              <div style={subLabelStyle}>使いたいと思った方から連絡が取れるように入力してください</div>
              <div style={{ marginBottom: '12px' }}>
                <div style={subLabelStyle}>メールアドレス</div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@kitchen-baton.jp" style={inputStyle} />
              </div>
              <div>
                <div style={subLabelStyle}>電話番号（任意）</div>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-1234-5678" style={inputStyle} />
              </div>
            </div>

            <div style={cardStyle}>
              <label style={{ ...labelStyle, marginBottom: '4px' }}>余った機材、食材を置いておけますか？</label>
              <div style={subLabelStyle}>次回利用に向けて保管できる場合はこちらを選んでください</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div onClick={() => setCanStore(true)} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: '12px', border: canStore === true ? '1px solid #1976d2' : '1px solid #ccd6e8', background: canStore === true ? '#e3eaf7' : '#fff', color: canStore === true ? '#1976d2' : '#555', fontSize: '0.85rem', fontWeight: canStore === true ? 700 : 400, cursor: 'pointer' }}>置いておける</div>
                <div onClick={() => setCanStore(false)} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: '12px', border: canStore === false ? '1px solid #1976d2' : '1px solid #ccd6e8', background: canStore === false ? '#e3eaf7' : '#fff', color: canStore === false ? '#1976d2' : '#555', fontSize: '0.85rem', fontWeight: canStore === false ? 700 : 400, cursor: 'pointer' }}>難しい</div>
              </div>
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>こんな人に貸したい</label>
              <textarea value={preferredBorrower} onChange={(e) => setPreferredBorrower(e.target.value)} placeholder="例：地域に根ざした活動を続けている団体さんに使ってほしいです" style={{ ...textareaStyle, height: '64px' }} />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>子ども食堂に一言</label>
              <textarea value={messageToShokudo} onChange={(e) => setMessageToShokudo(e.target.value)} placeholder="子ども食堂を運営されているみなさまへメッセージをどうぞ" style={{ ...textareaStyle, height: '88px' }} />
            </div>

            <div style={cardStyle}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', color: '#555', cursor: 'pointer' }}>
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} style={{ marginTop: '2px' }} />
                <span>入力内容を「キッチンバトン」上での場所紹介・子ども食堂運営者とのマッチングに利用することに同意します</span>
              </label>
            </div>

            {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem', textAlign: 'center' }}>{error}</div>}

            <button onClick={handleSubmit} disabled={submitting} style={{ marginTop: '4px', width: '100%', border: 'none', borderRadius: '24px', padding: '14px 0', background: '#1976d2', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>{submitting ? '送信中...' : '登録する'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
