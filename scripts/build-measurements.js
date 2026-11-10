// 比較ページ用に、計測値と1kmあたりの費用を data/measurements.json にまとめる
// 使い方: node scripts/build-measurements.js
// 入力: research/shoe-data-filled-round2-2026-10-30.csv（計測値）、research/score-preview.csv（円/km）
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SRC = path.join(root, 'research', 'shoe-data-filled-round2-2026-10-30.csv');
const PREVIEW = path.join(root, 'research', 'score-preview.csv');
const OUT = path.join(root, 'data', 'measurements.json');

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r[0]).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

// score-shoes.js と同じ理由で、METASPEED EDGE の前足部ERは別方式の値なので使わない
const SKIP = { metaspeededge: ['エネルギーリターン前足部(%)'] };

const yenPerKm = {};
for (const r of parseCsv(fs.readFileSync(PREVIEW, 'utf8'))) yenPerKm[r['シューズID']] = num(r['円/km']);

const out = {};
for (const r of parseCsv(fs.readFileSync(SRC, 'utf8'))) {
  const id = r['シューズID'];
  const g = (k) => ((SKIP[id] || []).includes(k) ? null : num(r[k]));
  const m = {
    weight: g('27cm重量(g)'),
    heelWidth: g('かかとの幅(mm)'),
    foreWidth: g('前足部の幅(mm)'),
    heelStiffness: g('ヒール剛性(1-5)'),
    shock: g('衝撃吸収かかと(SA)'),
    returnHeel: g('エネルギーリターンかかと(%)'),
    returnFore: g('エネルギーリターン前足部(%)'),
    softness: g('フォーム硬度(AC)'),
    flex: g('曲げ剛性(N)'),
    grip: g('摩擦係数'),
    breath: g('通気性(1-5)'),
    wear: g('摩耗深度(mm)'),
    yenPerKm: yenPerKm[id] ?? null,
  };
  if (Object.values(m).some((v) => v != null)) out[id] = m;
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out).length}足を ${path.relative(root, OUT)} に書き出しました`);
