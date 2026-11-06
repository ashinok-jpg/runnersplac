// research/protein/ の CSV 2つ（集めたデータと点数）から、サイトが読む data/protein/products.json を作る
// 実行: npm run protein:score（点数の計算からやり直す） / node scripts/build-protein-data.js（JSON だけ作り直す）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_CSV = path.join(ROOT, 'research', 'protein', 'protein-data-request.csv');
const SCORE_CSV = path.join(ROOT, 'research', 'protein', 'score-preview.csv');
const OUT = path.join(ROOT, 'data', 'protein', 'products.json');

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
  return rest.filter(r => r[0]).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const num = v => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

const data = parseCsv(fs.readFileSync(DATA_CSV, 'utf8'));
const scores = Object.fromEntries(parseCsv(fs.readFileSync(SCORE_CSV, 'utf8')).map(r => [r['商品ID'], r]));

const USES = ['毎日用', '減量用', '競技者用'];
// 対象外にした商品（終売・飲料など）は出さない
const EXCLUDE = /対象から外す/;

const products = data.filter(d => !EXCLUDE.test(d['備考'])).map(d => {
  const s = scores[d['商品ID']];
  const serving = num(d['1食の量(g)']);
  const protein = num(d['1食のタンパク質(g)']);
  return {
    id: d['商品ID'],
    brand: d['ブランド'],
    name: d['商品名'],
    type: d['種類'],
    flavor: d['代表の味'],
    // 味の種類は「／」区切り（「、」「,」も可）。代表の味が入っていなければ先頭に足す
    flavors: (() => {
      const list = (d['味の種類'] || '').split(/[／/、,]/).map(s => s.trim()).filter(Boolean);
      if (list.length && d['代表の味'] && !list.includes(d['代表の味'])) list.unshift(d['代表の味']);
      return list;
    })(),
    volume: num(d['容量(g)']),
    price: num(d['通常価格(円)']),
    checkedAt: d['価格確認日'],
    serving,
    protein,
    carb: num(d['1食の糖質(g)']),
    fat: num(d['1食の脂質(g)']),
    kcal: num(d['1食のカロリー(kcal)']),
    leucine: num(d['ロイシン(g/1食)']),
    certification: d['第三者認証'],
    factory: d['製造国・工場認証'],
    sweetener: d['人工甘味料の有無'],
    source: d['出典URL'],
    note: d['備考'],
    scored: Boolean(s),
    items: s ? {
      ratio: num(s['含有率(%)']),
      carbFatPer20: num(s['糖質脂質(/P20g)']),
      leucinePer20: num(s['ロイシン(/P20g)']),
      pRatio: num(s['点_含有率']),
      pCarbFat: num(s['点_糖質脂質']),
      pLeucine: num(s['点_ロイシン']),
      pQuality: num(s['点_品質']),
    } : null,
    yenPerGram: s ? num(s['円/タンパク質1g']) : null,
    performance: s ? Object.fromEntries(USES.map(u => [u, num(s[`性能_${u}`])])) : null,
    value: s ? Object.fromEntries(USES.map(u => [u, num(s[`コスパ_${u}`])])) : null,
  };
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: data.map(d => d['価格確認日']).filter(Boolean).sort().pop() || null, products }, null, 2) + '\n');
console.log(`${products.length} products (${products.filter(p => p.scored).length} scored) -> data/protein/products.json`);
