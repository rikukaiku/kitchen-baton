import { useState, useEffect } from 'react';
import Papa from 'papaparse';

const CATEGORIES = ['資金', '場所', '衛生・許可', 'ボランティア集め', '運営・継続', 'その他'];
const STORAGE_KEY = 'kitchenbaton_consultations';

// FAQはGoogleスプレッドシートで管理する（荒木さんがコード不要で編集できるように）。
// シートを「ファイル→共有→ウェブに公開」でCSV形式にし、そのURLをここに設定する。
// 列は「カテゴリ, Q, A」の3列。A列が空なら「回答準備中」として表示される。
// A列内で改行すると、回答が箇条書きとして表示される。
const FAQ_SHEET_CSV_URL = '';

type Answer = {
  id: string;
  name: string;
  credential: string;
  body: string;
  createdAt: string;
  helpful: number;
};

type Consultation = {
  id: string;
  title: string;
  categories: string[];
  body: string;
  area: string;
  posterName: string;
  anonymous: boolean;
  email: string;
  createdAt: string;
  answers: Answer[];
};

type FaqItem = {
  category: string;
  question: string;
  answer: string[] | null;
};

const FALLBACK_FAQ_ITEMS: FaqItem[] = [
  { category: '場所', question: '調理場所のある借りられる場所を探したい', answer: null },
  {
    category: 'ボランティア集め',
    question: '配膳や子どもと遊んでくれるボランティアを集めたい場合、どうしたら良いでしょうか',
    answer: [
      '高校生もボランティアに関心がある場合があります。',
      '高齢者と子どもが将棋などで遊ぶ光景もよく聞かれています。',
      '近隣に大学などがある場合、学生がボランティアで参加してくれることがあります。',
    ],
  },
  { category: '運営・継続', question: '今は助成金を得られているが、期限もあるのでその後の継続が不安。', answer: null },
];

const SEED_CONSULTATIONS: Consultation[] = [
  {
    id: 'seed-1',
    title: '社員食堂を借りたいが、企業への交渉の仕方が分からない',
    categories: ['資金', '場所'],
    body: '近所の企業の社員食堂を借りたいと考えていますが、どのように連絡・交渉すればよいか分からず困っています。同じような経験をされた方がいたら教えてください。',
    area: '世田谷区',
    posterName: '山田 花子',
    anonymous: false,
    email: '',
    createdAt: '2026-08-18T00:00:00.000Z',
    answers: [
      { id: 'seed-1-a1', name: '佐藤 健一', credential: 'みどり子ども食堂 運営5年', body: 'うちは企業の総務部に直接電話して、社会貢献活動の一環として説明したらすぐ話が進みました。CSR担当がいる企業だと特に通りやすいと思います。', createdAt: '2026-08-19T00:00:00.000Z', helpful: 12 },
      { id: 'seed-1-a2', name: '田中 美咲', credential: 'NPO法人こそだてひろば 理事', body: '自治体の子育て支援課経由で企業を紹介してもらえることもあります。一度窓口に相談してみるのもおすすめです。', createdAt: '2026-08-19T00:00:00.000Z', helpful: 7 },
    ],
  },
  {
    id: 'seed-2',
    title: '食品衛生責任者の資格が必要か知りたいです',
    categories: ['衛生・許可'],
    body: '子ども食堂を始めるにあたって、食品衛生責任者の資格が必須なのか、任意なのか知りたいです。',
    area: '練馬区',
    posterName: '匿名希望',
    anonymous: true,
    email: '',
    createdAt: '2026-08-21T00:00:00.000Z',
    answers: [],
  },
];

function loadConsultations(): Consultation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_CONSULTATIONS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_CONSULTATIONS;
  } catch {
    return SEED_CONSULTATIONS;
  }
}

function saveConsultations(list: Consultation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorageが使えない環境では保存されないが、画面上の表示は継続する
  }
}

const ANSWERER_PROFILE_KEY = 'kitchenbaton_answerer_profile';

function loadAnswererProfile(): { name: string; credential: string } {
  try {
    const raw = localStorage.getItem(ANSWERER_PROFILE_KEY);
    if (!raw) return { name: '', credential: '' };
    const parsed = JSON.parse(raw);
    return { name: parsed.name || '', credential: parsed.credential || '' };
  } catch {
    return { name: '', credential: '' };
  }
}

function saveAnswererProfile(name: string, credential: string) {
  try {
    localStorage.setItem(ANSWERER_PROFILE_KEY, JSON.stringify({ name, credential }));
  } catch {
    // 保存できなくても回答自体は続行できる
  }
}

function parseFaqCsv(csvText: string): FaqItem[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  return parsed.data
    .filter(row => row['Q']?.trim())
    .map(row => {
      const answerRaw = (row['A'] || '').trim();
      const answerLines = answerRaw.split('\n').map(l => l.trim()).filter(Boolean);
      return {
        category: (row['カテゴリ'] || 'その他').trim(),
        question: row['Q'].trim(),
        answer: answerLines.length > 0 ? answerLines : null,
      };
    });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: '18px', padding: '18px', boxShadow: '0 6px 18px rgba(0,0,0,0.05)' };
const labelStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 700, color: '#333', marginBottom: '10px' };
const subLabelStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#777', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e8c193', background: '#fff', fontSize: '0.85rem', color: '#333', boxSizing: 'border-box' };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'none' as const };
const listCardStyle: React.CSSProperties = { borderRadius: '14px', padding: '12px 14px', background: '#fffaf2', border: '1px solid #f0dcbc', cursor: 'pointer' };

function chipStyle(selected: boolean): React.CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: '999px',
    border: selected ? '1px solid #dd8a4e' : '1px solid #e8c193',
    background: selected ? '#fbe6d3' : '#fff',
    color: selected ? '#c15a2c' : '#a97a4f',
    fontSize: '0.78rem',
    fontWeight: selected ? 700 : 400,
    cursor: 'pointer',
  };
}

function categoryTag(cat: string, key?: string | number) {
  return (
    <span key={key} style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: '999px', background: '#fbe6d3', color: '#c15a2c', marginRight: '4px' }}>{cat}</span>
  );
}

export default function ConsultationHub({ onClose }: { onClose: () => void }) {
  const [consultations, setConsultations] = useState<Consultation[]>(loadConsultations);
  const [view, setView] = useState<'list' | 'post' | 'detail' | 'faq'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [faqItems, setFaqItems] = useState<FaqItem[]>(FALLBACK_FAQ_ITEMS);

  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'すべて' | '未回答' | '回答あり'>('すべて');
  const [filterArea, setFilterArea] = useState('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => { saveConsultations(consultations); }, [consultations]);

  useEffect(() => {
    if (!FAQ_SHEET_CSV_URL) return;
    fetch(FAQ_SHEET_CSV_URL)
      .then(res => res.text())
      .then(csvText => {
        const items = parseFaqCsv(csvText);
        if (items.length > 0) setFaqItems(items);
      })
      .catch(() => {
        // シートが未設定・取得失敗時はハードコードされたフォールバック内容を表示し続ける
      });
  }, []);

  const toggleFilterCategory = (cat: string) => {
    setFilterCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const filtered = consultations.filter(c => {
    if (filterCategories.length > 0 && !c.categories.some(cat => filterCategories.includes(cat))) return false;
    if (filterStatus === '未回答' && c.answers.length > 0) return false;
    if (filterStatus === '回答あり' && c.answers.length === 0) return false;
    if (filterArea.trim() && !c.area.includes(filterArea.trim())) return false;
    if (keyword.trim() && !(c.title.includes(keyword.trim()) || c.body.includes(keyword.trim()))) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const selected = consultations.find(c => c.id === selectedId) || null;

  // 投稿フォームの状態
  const [postTitle, setPostTitle] = useState('');
  const [postCategories, setPostCategories] = useState<string[]>([]);
  const [postBody, setPostBody] = useState('');
  const [postArea, setPostArea] = useState('');
  const [postName, setPostName] = useState('');
  const [postAnonymous, setPostAnonymous] = useState(false);
  const [postEmail, setPostEmail] = useState('');
  const [postError, setPostError] = useState('');

  const togglePostCategory = (cat: string) => {
    setPostCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const resetPostForm = () => {
    setPostTitle(''); setPostCategories([]); setPostBody(''); setPostArea('');
    setPostName(''); setPostAnonymous(false); setPostEmail(''); setPostError('');
  };

  const submitConsultation = () => {
    if (!postTitle.trim() || postCategories.length === 0 || !postBody.trim()) {
      setPostError('タイトル・カテゴリ・詳細は必須です');
      return;
    }
    const record: Consultation = {
      id: `c-${Date.now()}`,
      title: postTitle.trim(),
      categories: postCategories,
      body: postBody.trim(),
      area: postArea.trim(),
      posterName: postAnonymous ? '匿名希望' : (postName.trim() || '匿名希望'),
      anonymous: postAnonymous,
      email: postEmail.trim(),
      createdAt: new Date().toISOString(),
      answers: [],
    };
    setConsultations(prev => [record, ...prev]);
    resetPostForm();
    setSelectedId(record.id);
    setView('detail');
  };

  // 回答フォームの状態（名前・肩書きは端末に記憶し、連投時は自動入力する）
  const [answererProfile] = useState(loadAnswererProfile);
  const [answerName, setAnswerName] = useState(answererProfile.name);
  const [answerCredential, setAnswerCredential] = useState(answererProfile.credential);
  const [answerBody, setAnswerBody] = useState('');
  const [answerError, setAnswerError] = useState('');

  const submitAnswer = () => {
    if (!selected) return;
    if (!answerName.trim() || !answerBody.trim()) {
      setAnswerError('名前・回答本文は必須です');
      return;
    }
    const answer: Answer = {
      id: `a-${Date.now()}`,
      name: answerName.trim(),
      credential: answerCredential.trim(),
      body: answerBody.trim(),
      createdAt: new Date().toISOString(),
      helpful: 0,
    };
    setConsultations(prev => prev.map(c => c.id === selected.id ? { ...c, answers: [...c.answers, answer] } : c));
    saveAnswererProfile(answerName.trim(), answerCredential.trim());
    setAnswerBody(''); setAnswerError('');
  };

  const markHelpful = (answerId: string) => {
    if (!selected) return;
    setConsultations(prev => prev.map(c => c.id !== selected.id ? c : {
      ...c,
      answers: c.answers.map(a => a.id === answerId ? { ...a, helpful: a.helpful + 1 } : a),
    }));
  };

  const headerTitle = view === 'post' ? '相談を投稿する' : view === 'detail' ? '相談の詳細' : view === 'faq' ? 'よくある質問' : '相談ひろば';
  const showBack = view !== 'list';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '24px 12px' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '460px', background: '#fdf6ec', borderRadius: '20px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#dd8a4e', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {showBack && (
              <span onClick={() => setView('list')} style={{ cursor: 'pointer', fontSize: '1.1rem' }}>←</span>
            )}
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>{headerTitle}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '2px' }}>💬 相談ひろば</div>
            </div>
          </div>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}>×</span>
        </header>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '75vh', overflowY: 'auto' }}>

          {view === 'list' && (
            <>
              <button onClick={() => setView('post')} style={{ border: 'none', borderRadius: '24px', padding: '13px 0', width: '100%', background: '#dd8a4e', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>+ 相談を投稿する</button>
              <button onClick={() => setView('faq')} style={{ border: '1px solid #e8c193', borderRadius: '24px', padding: '11px 0', width: '100%', background: '#fff', color: '#8a5f3a', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>よくある質問（FAQ）を見る</button>

              <div style={cardStyle}>
                <div style={labelStyle}>カテゴリ</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                  {CATEGORIES.map(cat => (
                    <div key={cat} style={chipStyle(filterCategories.includes(cat))} onClick={() => toggleFilterCategory(cat)}>{cat}</div>
                  ))}
                </div>

                <div style={labelStyle}>地域</div>
                <input type="text" value={filterArea} onChange={(e) => setFilterArea(e.target.value)} placeholder="例：世田谷区" style={{ ...inputStyle, marginBottom: '16px' }} />

                <div style={labelStyle}>回答状況</div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                  {(['すべて', '未回答', '回答あり'] as const).map(s => (
                    <div key={s} onClick={() => setFilterStatus(s)} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: '10px', background: filterStatus === s ? '#dd8a4e' : '#f5e4d0', color: filterStatus === s ? '#fff' : '#8a5f3a', fontSize: '0.78rem', fontWeight: filterStatus === s ? 700 : 400, cursor: 'pointer' }}>{s}</div>
                  ))}
                </div>

                <div style={labelStyle}>キーワード検索</div>
                <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="悩み・キーワードで検索" style={inputStyle} />
              </div>

              <div style={{ fontWeight: 700, color: '#333', fontSize: '0.95rem' }}>相談一覧（{filtered.length}件）</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filtered.map(c => (
                  <div key={c.id} style={listCardStyle} onClick={() => { setSelectedId(c.id); setView('detail'); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.4 }}>{c.title}</div>
                      {c.answers.length > 0 ? (
                        <span style={{ flexShrink: 0, fontSize: '0.72rem', fontWeight: 900, color: '#fff', background: '#dd8a4e', borderRadius: '8px', padding: '3px 9px', whiteSpace: 'nowrap' }}>回答{c.answers.length}件</span>
                      ) : (
                        <span style={{ flexShrink: 0, fontSize: '0.72rem', fontWeight: 900, color: '#e74c3c', background: '#fdeaea', borderRadius: '8px', padding: '3px 9px', whiteSpace: 'nowrap' }}>未回答</span>
                      )}
                    </div>
                    <div style={{ marginBottom: '8px' }}>{c.categories.map((cat, i) => categoryTag(cat, i))}</div>
                    <div style={{ fontSize: '0.74rem', color: '#999' }}>{c.area || '地域未設定'} ・ {formatDate(c.createdAt)}</div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#a97a4f', fontSize: '0.82rem', padding: '20px 0' }}>条件に合う相談はまだありません</div>
                )}
              </div>
            </>
          )}

          {view === 'post' && (
            <>
              <div style={cardStyle}>
                <div style={labelStyle}>タイトル</div>
                <input type="text" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="例：社員食堂を借りたいが、企業への交渉の仕方が分からない" style={inputStyle} />
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>カテゴリを選択する</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {CATEGORIES.map(cat => (
                    <div key={cat} style={chipStyle(postCategories.includes(cat))} onClick={() => togglePostCategory(cat)}>{cat}</div>
                  ))}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>詳細</div>
                <div style={subLabelStyle}>状況をできるだけ具体的に教えてください</div>
                <textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} placeholder="状況を書いてください" style={{ ...textareaStyle, height: '80px' }} />
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>地域</div>
                <input type="text" value={postArea} onChange={(e) => setPostArea(e.target.value)} placeholder="例：世田谷区" style={inputStyle} />
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>投稿者情報</div>
                <div style={subLabelStyle}>名前</div>
                <input type="text" value={postName} onChange={(e) => setPostName(e.target.value)} placeholder="山田 花子" disabled={postAnonymous} style={{ ...inputStyle, marginBottom: '14px', opacity: postAnonymous ? 0.5 : 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ fontSize: '0.82rem', color: '#555' }}>匿名で投稿する</span>
                  <input type="checkbox" checked={postAnonymous} onChange={(e) => setPostAnonymous(e.target.checked)} />
                </label>
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>連絡先（任意）</div>
                <div style={subLabelStyle}>回答があったときにお知らせします</div>
                <input type="email" value={postEmail} onChange={(e) => setPostEmail(e.target.value)} placeholder="example@kitchen-baton.jp" style={inputStyle} />
              </div>

              {postError && <div style={{ color: '#e74c3c', fontSize: '0.8rem', textAlign: 'center' }}>{postError}</div>}

              <button onClick={submitConsultation} style={{ border: 'none', borderRadius: '24px', padding: '14px 0', width: '100%', background: '#dd8a4e', color: '#fff', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>相談を投稿する</button>
            </>
          )}

          {view === 'detail' && selected && (
            <>
              <div style={cardStyle}>
                <div style={{ marginBottom: '10px' }}>
                  {selected.categories.map((cat, i) => categoryTag(cat, i))}
                  {selected.area && <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: '999px', background: '#f5e4d0', color: '#8a5f3a' }}>{selected.area}</span>}
                </div>
                <div style={{ fontWeight: 900, fontSize: '1.02rem', lineHeight: 1.5, marginBottom: '10px' }}>{selected.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.7, marginBottom: '12px' }}>{selected.body}</div>
                <div style={{ fontSize: '0.74rem', color: '#999' }}>{selected.posterName} ・ {formatDate(selected.createdAt)}</div>
              </div>

              <div style={{ fontWeight: 700, color: '#333', fontSize: '0.95rem' }}>回答（{selected.answers.length}件）</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selected.answers.map(a => (
                  <div key={a.id} style={{ background: '#fff', borderRadius: '14px', padding: '14px', border: '1px solid #f0dcbc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{a.name}</span>
                      {a.credential && <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: '999px', background: '#fbe6d3', color: '#c15a2c', whiteSpace: 'nowrap' }}>{a.credential}</span>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#555', lineHeight: 1.7, marginBottom: '10px' }}>{a.body}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#999' }}>{formatDate(a.createdAt)}</span>
                      <div onClick={() => markHelpful(a.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '999px', border: '1px solid #e8c193', color: '#a97a4f', fontSize: '0.74rem', cursor: 'pointer' }}>👍 役に立った（{a.helpful}）</div>
                    </div>
                  </div>
                ))}
                {selected.answers.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#a97a4f', fontSize: '0.82rem', padding: '10px 0' }}>まだ回答がありません</div>
                )}
              </div>

              <div style={cardStyle}>
                <div style={labelStyle}>あなたの経験を教えてください</div>
                <div style={subLabelStyle}>同じ悩みを抱えた人の力になります</div>
                <div style={{ fontSize: '0.72rem', color: '#777', marginBottom: '4px' }}>名前</div>
                <input type="text" value={answerName} onChange={(e) => setAnswerName(e.target.value)} placeholder="山田 太郎" style={{ ...inputStyle, marginBottom: '12px' }} />
                <div style={{ fontSize: '0.72rem', color: '#777', marginBottom: '4px' }}>肩書き・運営歴</div>
                <input type="text" value={answerCredential} onChange={(e) => setAnswerCredential(e.target.value)} placeholder="例：○○子ども食堂 運営5年" style={{ ...inputStyle, marginBottom: '12px' }} />
                <div style={{ fontSize: '0.72rem', color: '#777', marginBottom: '4px' }}>回答本文</div>
                <textarea value={answerBody} onChange={(e) => setAnswerBody(e.target.value)} placeholder="経験を踏まえてアドバイスをお願いします" style={{ ...textareaStyle, height: '60px', marginBottom: '14px' }} />
                {answerError && <div style={{ color: '#e74c3c', fontSize: '0.8rem', textAlign: 'center', marginBottom: '10px' }}>{answerError}</div>}
                <button onClick={submitAnswer} style={{ border: 'none', borderRadius: '24px', padding: '13px 0', width: '100%', background: '#dd8a4e', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>回答を投稿する</button>
              </div>
            </>
          )}

          {view === 'faq' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {faqItems.map((item, i) => {
                  const isOpen = expandedFaq === i;
                  return (
                    <div key={i} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #f0dcbc', overflow: 'hidden' }}>
                      <div onClick={() => setExpandedFaq(isOpen ? null : i)} style={{ padding: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: item.answer ? 'pointer' : 'default' }}>
                        <span style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '999px', background: '#dd8a4e', color: '#fff', fontWeight: 900, fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Q</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.5, marginBottom: '8px' }}>{item.question}</div>
                          {categoryTag(item.category)}
                          {!item.answer && <span style={{ fontSize: '0.7rem', color: '#b8956a', marginLeft: '6px' }}>回答準備中</span>}
                        </div>
                        {item.answer && <span style={{ flexShrink: 0, color: '#c9a879', fontSize: '0.9rem', marginTop: '2px' }}>{isOpen ? '▾' : '▸'}</span>}
                      </div>
                      {isOpen && item.answer && (
                        <div style={{ padding: '0 14px 16px 48px', fontSize: '0.82rem', color: '#555', lineHeight: 1.9 }}>
                          {item.answer.map((line, li) => <div key={li}>・{line}</div>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {(() => {
                const coveredCategories = new Set(faqItems.map(item => item.category));
                const missingCategories = CATEGORIES.filter(cat => !coveredCategories.has(cat));
                if (missingCategories.length === 0) return null;
                return (
                  <div style={{ textAlign: 'center', fontSize: '0.76rem', color: '#a97a4f' }}>{missingCategories.join('・')}のカテゴリは現在準備中です</div>
                );
              })()}
              <div style={{ background: '#fff8ee', border: '1px solid #e8c193', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#8a5f3a', marginBottom: '10px' }}>知りたいことが見つからない場合は</div>
                <button onClick={() => setView('post')} style={{ border: 'none', borderRadius: '24px', padding: '10px 20px', background: '#dd8a4e', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>+ 相談を投稿する</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
