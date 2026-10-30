// 新しい記事のブランチとフォルダを作る: npm run new-article -- <シューズID>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ARTICLES_DIR, RATING_LABELS } = require('../lib/articles');

const id = process.argv[2];
if (!id) {
  console.error('使い方: npm run new-article -- <シューズID>  (例: npm run new-article -- gelnimbus27)');
  process.exit(1);
}

const shoe = require('../data/shoesData.js').find((s) => s.id === id);
if (!shoe) {
  console.error(`"${id}" は data/shoesData.js にありません。先にシューズを追加してください。`);
  process.exit(1);
}

const dir = path.join(ARTICLES_DIR, id);
if (fs.existsSync(path.join(dir, 'article.html'))) {
  console.error(`articles/${id}/article.html はすでにあります。`);
  process.exit(1);
}

execFileSync('git', ['switch', '-c', `article/${id}`], { stdio: 'inherit' });

fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
fs.writeFileSync(path.join(dir, 'images', '.gitkeep'), '');
fs.writeFileSync(path.join(dir, 'article.html'), `<p class="lead">ここにリード文を書きます。</p>

<h2>見出し</h2>
<p>本文を書きます。</p>

<!-- 写真は images/ に置いて、こう書くだけ -->
<!-- <img src="images/photo.jpg" alt="写真の説明"> -->
`);

const ratings = {};
RATING_LABELS.forEach((label, i) => { ratings[label] = shoe.chartData[i]; });
fs.writeFileSync(path.join(dir, 'meta.json'), `${JSON.stringify({ ratings, comments: {} }, null, 2)}\n`);

console.log(`\nブランチ article/${id} を作りました。articles/${id}/ を編集してください。`);
