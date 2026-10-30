// lib/articles.js
// 記事は articles/<シューズID>/ フォルダで管理する（書き方は articles/README.md）
const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, '..', 'articles');
const RATING_LABELS = ['クッション性', '安定性', '軽さ', 'コスパ', '履き心地', 'デザイン', '通気性', 'スピード性能', 'グリップ', '耐久性'];

function readMeta(id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, id, 'meta.json'), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw new Error(`articles/${id}/meta.json を読めません: ${e.message}`);
  }
}

// 本文を返す。記事がなければ null
function loadArticle(id) {
  let html;
  try {
    html = fs.readFileSync(path.join(ARTICLES_DIR, id, 'article.html'), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  // 記事内の images/xxx.jpg を公開URLに変換
  html = html.replace(/(\s(?:src|href)=["'])images\//g, `$1/article-assets/${id}/images/`);
  return { html, draft: readMeta(id).draft === true };
}

// meta.json の評価をシューズデータに反映する（一覧・詳細の両方に効く）
function applyArticleRatings(shoe) {
  const { ratings, comments } = readMeta(shoe.id);
  if (ratings) {
    const chart = Array.isArray(shoe.chartData) ? shoe.chartData : [];
    shoe.chartData = RATING_LABELS.map((label, i) => (typeof ratings[label] === 'number' ? ratings[label] : chart[i]));
  }
  if (comments) shoe.hostComment = { ...shoe.hostComment, ...comments };
  return shoe;
}

module.exports = { ARTICLES_DIR, RATING_LABELS, loadArticle, applyArticleRatings };
