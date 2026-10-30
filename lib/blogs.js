// lib/blogs.js
// ブログは blogs/<スラッグ>/ フォルダで管理する（書き方は articles/README.md）
const fs = require('fs');
const path = require('path');

const BLOGS_DIR = path.join(__dirname, '..', 'blogs');

function readMeta(slug) {
  try {
    return JSON.parse(fs.readFileSync(path.join(BLOGS_DIR, slug, 'meta.json'), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`blogs/${slug}/meta.json を読めません: ${e.message}`);
  }
}

// 記事内の images/xxx.jpg を公開URLに変換
function assetUrl(slug, src) {
  return src && src.startsWith('images/') ? `/blog-assets/${slug}/${src}` : src;
}

function loadBlog(slug) {
  const meta = readMeta(slug);
  if (!meta) return null;
  const blog = { ...meta, slug, image: assetUrl(slug, meta.image) };
  if (!meta.view) {
    const html = fs.readFileSync(path.join(BLOGS_DIR, slug, 'article.html'), 'utf8');
    blog.html = html.replace(/(\s(?:src|href)=["'])images\//g, `$1/blog-assets/${slug}/images/`);
  }
  return blog;
}

// 公開中のブログを新しい順に返す
function listBlogs() {
  if (!fs.existsSync(BLOGS_DIR)) return [];
  return fs.readdirSync(BLOGS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const meta = readMeta(d.name);
      return meta && { ...meta, slug: d.name, image: assetUrl(d.name, meta.image) };
    })
    .filter((b) => b && !b.draft)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

module.exports = { BLOGS_DIR, loadBlog, listBlogs };
