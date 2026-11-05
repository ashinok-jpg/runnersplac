// プロテインの点数計算。ルールは research/protein/scoring-rules.md
// 実行: node research/protein/score-protein.js
// 入力: protein-data-request.csv  出力: score-preview.csv
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const IN = path.join(DIR, 'protein-data-request.csv');
const OUT = path.join(DIR, 'score-preview.csv');

// --- CSV 読み込み（引用符付きセル対応） ---
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
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
  return rows;
}
const raw = parseCsv(fs.readFileSync(IN, 'utf8').replace(/^﻿/, ''));
const H = raw[0];
const items = raw.slice(1).filter(r => r[0]).map(r => Object.fromEntries(H.map((h, i) => [h, r[i] ?? ''])));
const num = v => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

// --- 変換表（値が条件を満たす最初の段の点） ---
const T = {
  含有率: [[85, 5], [80, 4.5], [75, 4], [70, 3.5], [65, 3], [60, 2.5], [55, 2]], // 以上
  糖質脂質: [[1.0, 5], [2.0, 4.5], [3.0, 4], [4.5, 3.5], [6.0, 3], [8.0, 2.5], [10, 2]], // 以下
  ロイシン: [[2.5, 5], [2.2, 4.5], [2.0, 4], [1.8, 3.5], [1.6, 3], [1.4, 2.5], [1.2, 2]], // 以上
};
const atLeast = (v, t) => { for (const [l, p] of t) if (v >= l) return p; return 1.5; };
const atMost = (v, t) => { for (const [l, p] of t) if (v <= l) return p; return 1.5; };

function quality(o) {
  const cert = o['第三者認証'];
  if (/インフォームド|アンチドーピング/.test(cert)) return 5;
  if (o['成分分析の公開']) return 4;
  if (/GMP|FSSC|国内|日本製造/.test(o['製造国・工場認証'])) return 3;
  return 2.5;
}

const W = {
  毎日用: { 含有率: 30, 糖質脂質: 15, ロイシン: 15, 品質: 10, 飲みやすさ: 30 },
  減量用: { 含有率: 25, 糖質脂質: 35, ロイシン: 10, 品質: 10, 飲みやすさ: 20 },
  競技者用: { 含有率: 20, 糖質脂質: 10, ロイシン: 15, 品質: 35, 飲みやすさ: 20 },
};
const USES = Object.keys(W);

// ロイシンは表示のある商品が半数以上になるまで点数に入れない（ルール参照）
const eligible = items.filter(o => num(o['1食の量(g)']) && num(o['1食のタンパク質(g)']) && num(o['1食の糖質(g)']) != null && num(o['通常価格(円)']) && num(o['容量(g)']));
const leuCoverage = eligible.filter(o => num(o['ロイシン(g/1食)']) != null).length / eligible.length;
const USE_LEUCINE = leuCoverage >= 0.5;

// --- 各商品の項目点 ---
const scored = [];
for (const o of items) {
  const serv = num(o['1食の量(g)']), p = num(o['1食のタンパク質(g)']);
  const carb = num(o['1食の糖質(g)']), fat = num(o['1食の脂質(g)']);
  const price = num(o['通常価格(円)']), vol = num(o['容量(g)']), leu = num(o['ロイシン(g/1食)']);
  if (!(serv && p && carb != null && price && vol)) continue; // 含有率・糖質＋脂質・価格がそろう商品だけ
  const ratio = p / serv * 100;
  const cf = (carb + (fat ?? 0)) / p * 20;
  const leu20 = leu != null ? leu / p * 20 : null;
  const sc = {
    含有率: atLeast(ratio, T.含有率),
    糖質脂質: atMost(cf, T.糖質脂質),
    ロイシン: USE_LEUCINE && leu20 != null ? atLeast(leu20, T.ロイシン) : null,
    品質: quality(o),
    飲みやすさ: null, // まだ試飲していない
  };
  const yenPer100gP = price / (vol * p / serv) * 100;
  const perf = {};
  for (const u of USES) {
    let s = 0, w = 0;
    for (const [k, wt] of Object.entries(W[u])) if (sc[k] != null) { s += sc[k] * wt; w += wt; }
    perf[u] = s / w;
  }
  scored.push({ o, ratio, cf, leu20, sc, yenPer100gP, perf, value: {}, cospa: {} });
}

// --- コスパ点（用途ごとの順位から） ---
for (const u of USES) {
  for (const x of scored) x.value[u] = (x.perf[u] - 2) / (x.yenPer100gP / 500);
  const l = [...scored].sort((a, b) => b.value[u] - a.value[u]);
  l.forEach((x, i) => {
    const pr = (i + 0.5) / l.length;
    x.cospa[u] = pr <= 0.1 ? 5 : pr <= 0.25 ? 4.5 : pr <= 0.45 ? 4 : pr <= 0.65 ? 3.5 : pr <= 0.8 ? 3 : pr <= 0.9 ? 2.5 : 2;
  });
}

// --- 出力 ---
const cols = ['商品ID', 'ブランド', '商品名', '種類', '含有率(%)', '糖質脂質(/P20g)', 'ロイシン(/P20g)', '点_含有率', '点_糖質脂質', '点_ロイシン', '点_品質',
  '円/タンパク質1g', ...USES.flatMap(u => [`性能_${u}`, `コスパ_${u}`])];
const esc = v => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v);
const lines = [cols.join(',')];
for (const x of [...scored].sort((a, b) => b.perf.毎日用 - a.perf.毎日用)) {
  lines.push([x.o['商品ID'], x.o['ブランド'], x.o['商品名'], x.o['種類'], x.ratio.toFixed(1), x.cf.toFixed(2), x.leu20 != null ? x.leu20.toFixed(2) : '',
    x.sc.含有率, x.sc.糖質脂質, x.sc.ロイシン ?? '', x.sc.品質, (x.yenPer100gP / 100).toFixed(2),
    ...USES.flatMap(u => [x.perf[u].toFixed(2), x.cospa[u]])].map(esc).join(','));
}
fs.writeFileSync(OUT, '﻿' + lines.join('\n') + '\n');
console.log(`${scored.length} products -> ${path.relative(process.cwd(), OUT)} (leucine coverage ${Math.round(leuCoverage * 100)}%, ${USE_LEUCINE ? 'scored' : 'not scored'})`);
