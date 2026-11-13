// research/clinic/sns-posts.csv の SNS 投稿を Firestore の clinicEmbeds に登録する（同じ投稿は上書きなので何度流してもよい）
// 実行: node scripts/add-clinic-embeds.js
// 載せる基準：ランナー本人の投稿で、院の名前とケガがわかるもの。院・業者の宣伝の投稿は載せない。本文は写さず、ひとことは自分の言葉で書く
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'research', 'clinic', 'sns-posts.csv');
const posts = require('../lib/clinic-posts');
const { clinics } = require('../data/clinic/clinics.json');

const lines = fs.readFileSync(SRC, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
const head = lines[0].split(',');
const rows = lines.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [head[i], v.trim()])));

(async () => {
  let ok = 0;
  for (const r of rows) {
    const where = `${r['院ID']} ${r['投稿URL']}`;
    if (!clinics.some(c => c.id === r['院ID'])) { console.warn(`× ${where}：院IDが clinics.json にありません`); continue; }
    if (!posts.parseSnsUrl(r['投稿URL'])) { console.warn(`× ${where}：X か Instagram の投稿URLではありません`); continue; }
    if (!posts.INJURIES.includes(r['ケガ・症状'])) { console.warn(`× ${where}：ケガ・症状「${r['ケガ・症状']}」が決まった言葉にありません`); continue; }
    const postedAt = /^\d{4}-\d{2}-\d{2}$/.test(r['投稿日']) ? new Date(r['投稿日'] + 'T12:00:00+09:00') : null;
    const id = await posts.upsertEmbed({ clinicId: r['院ID'], url: r['投稿URL'], injury: r['ケガ・症状'], note: (r['ひとこと'] || '').slice(0, 80), postedAt, by: 'script' });
    console.log(`○ ${id} → /clinic/${r['院ID']}`);
    ok++;
  }
  console.log(`${ok}/${rows.length}件を登録しました`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
