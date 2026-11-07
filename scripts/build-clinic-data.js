// research/clinic/clinic-data.csv から、サイトが読む data/clinic/clinics.json を作る
// 実行: npm run clinic:build（別の CSV で試すときは node scripts/build-clinic-data.js <CSVのパス> <出力先>）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'research', 'clinic', 'clinic-data.csv');
const OUT = process.argv[3] || path.join(ROOT, 'data', 'clinic', 'clinics.json');

// 絞り込みに使う言葉。CSV ではこの言葉を「／」区切りで書く（ここにない言葉は警告を出して捨てる）
const TYPES = ['整骨院・接骨院', '鍼灸院', '整体・コンディショニング', 'スポーツ整形外科'];
const PREFS = ['東京都', '神奈川県'];
const PARTS = ['膝', 'すね', 'ふくらはぎ', 'アキレス腱', '足首', '足裏', '太もも', '股関節', '腰', 'その他'];
const FEATURES = ['ランニングフォームの分析', 'トレッドミル', 'インソールの作成', 'テーピング', '走る再開までの指導', '超音波エコー', 'MRI・CT', 'レントゲン', '理学療法士のリハビリ'];
const LICENSES = ['医師', '理学療法士', '柔道整復師', 'はり師', 'きゅう師', 'あん摩マッサージ指圧師', 'アスレティックトレーナー', '民間資格のみ'];
const INSURANCE = ['使える', '使える場合がある', '自費のみ'];

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...rest] = rows;
  return rest.filter(r => r[0]).map(r => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const warnings = [];
const num = v => (v === '' || isNaN(Number(v)) ? null : Number(v));
const yes = v => /^(あり|○|はい|yes)$/i.test(v);
const list = (v, allowed, where) => (v || '').split(/[／/、,]/).map(s => s.trim()).filter(Boolean).filter(s => {
  if (allowed.includes(s)) return true;
  warnings.push(`${where}：「${s}」は決まった言葉にないので外しました`);
  return false;
});
const url = v => (/^https?:\/\//.test(v) ? v : '');

const rows = parseCsv(fs.readFileSync(SRC, 'utf8'));
const clinics = rows.filter(d => !/掲載しない/.test(d['備考'])).map(d => {
  const id = d['院ID'];
  const where = `${id}`;
  if (!/^[a-z0-9-]+$/.test(id)) warnings.push(`${where}：院IDは半角英小文字・数字・ハイフンだけにしてください`);
  if (!TYPES.includes(d['種類'])) warnings.push(`${where}：種類「${d['種類']}」が決まった言葉にありません`);
  if (!PREFS.includes(d['都道府県'])) warnings.push(`${where}：都道府県「${d['都道府県']}」は対象外です`);
  return {
    id,
    name: d['院名'],
    type: d['種類'],
    pref: d['都道府県'],
    city: d['市区町村'],
    address: d['住所'],
    station: d['最寄り駅'],
    walk: num(d['駅から徒歩(分)']),
    tel: d['電話'],
    site: url(d['公式サイトURL']),
    booking: url(d['予約URL']),
    hours: d['営業時間'],
    saturday: yes(d['土曜の受付']),
    sunday: yes(d['日曜祝日の受付']),
    night: yes(d['19時以降の受付']),
    licenses: list(d['資格'], LICENSES, `${where} 資格`),
    parts: list(d['相談できる部位'], PARTS, `${where} 部位`),
    features: list(d['ランナー向けの設備・サービス'], FEATURES, `${where} 設備`),
    insurance: INSURANCE.includes(d['健康保険']) ? d['健康保険'] : '',
    firstFee: num(d['初回料金の目安(円)']),
    intro: d['院の紹介'].slice(0, 200),
    source: url(d['出典URL']),
    checkedAt: d['確認日'],
    origin: d['掲載の経緯'] === '院からの申込' ? '院からの申込' : '公開情報',
  };
});

const ids = new Set();
clinics.forEach(c => { if (ids.has(c.id)) warnings.push(`${c.id}：院IDが重複しています`); ids.add(c.id); });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const updatedAt = clinics.map(c => c.checkedAt).filter(Boolean).sort().pop() || '';
fs.writeFileSync(OUT, JSON.stringify({ updatedAt, vocab: { TYPES, PREFS, PARTS, FEATURES, LICENSES, INSURANCE }, clinics }, null, 2) + '\n');
console.log(`${clinics.length}院を ${path.relative(ROOT, OUT)} に書き出しました`);
warnings.forEach(w => console.warn('  注意: ' + w));
