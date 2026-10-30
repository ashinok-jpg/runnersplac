// routes/admin.articles.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase/admin');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});
const bucket = admin.storage().bucket();
const fs = require('fs').promises;
const path = require('path');
// const DOMPurify = require('isomorphic-dompurify'); // 一時的にコメントアウト

const { requireAdmin, validateIdParam } = require('../lib/session');
const { sanitizeArticleHtml } = require('../lib/sanitize');

router.param('id', validateIdParam);
router.param('shoeId', validateIdParam);

// プレーンテキスト（Markdown/HTML）の生データを取得するヘルパー
async function getRawArticleContent(docId) {
  // 1. Markdown優先
  try {
    const mdPath = path.join(__dirname, '..', 'data', 'articles', `${docId}.md`);
    const content = await fs.readFile(mdPath, 'utf-8');
    return { content, format: 'markdown' };
  } catch (e) {}

  // 2. ローカルJSONのhtmlフィールド優先
  try {
    const jsonPath = path.join(__dirname, '..', 'data', 'articles', `${docId}.json`);
    const data = await fs.readFile(jsonPath, 'utf-8');
    const article = JSON.parse(data);
    return { content: article.html || '', format: 'html-json' };
  } catch (e) {}

  // 3. ローカルHTML優先
  try {
    const htmlPath = path.join(__dirname, '..', 'public', 'articles', `${docId}.html`);
    const content = await fs.readFile(htmlPath, 'utf-8');
    return { content, format: 'html' };
  } catch (e) {}

  // 4. Firestore優先
  try {
    const snap = await db.collection('articles').doc(String(docId)).get();
    if (snap.exists) {
      return { content: snap.data().html || '', format: 'firestore-html' };
    }
  } catch (e) {}

  // 新規記事用テンプレート
  const template = `# 新しい記事タイトル

ここに商品の特徴やレビュー内容を記述してください。Markdownが使用可能です。

## 特徴
- 特徴1
- 特徴2

## スペック
| 項目 | スペック |
| --- | --- |
| 重量 | g |
| ドロップ | mm |
`;
  return { content: template, format: 'new' };
}

// GET /admin/articles/:id - 記事編集ページを表示
router.get('/admin/articles/:id', requireAdmin, async (req, res, next) => {
  try {
    const shoeId = req.params.id;
    const { content, format } = await getRawArticleContent(shoeId);
    
    res.render('admin-article-edit', {
      shoeId,
      markdownContent: content,
      dataFormat: format
    });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/articles/:shoeId/image',
  requireAdmin,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok:false, msg:'no file' });
      const mime = req.file.mimetype;
      if (!/^image\/(png|jpe?g|webp|gif)$/i.test(mime)) {
        return res.status(400).json({ ok:false, msg:'invalid mime' });
      }

      const ext = mime.split('/')[1].replace('jpeg','jpg');
      const bucketName = (bucket && bucket.name) ? String(bucket.name) : '';
      const forceLocal = String(process.env.FORCE_LOCAL_UPLOADS || '').trim() === '1';
      const useCloud = !!bucketName && !forceLocal;

      let url = null;

      if (useCloud) {
        try {
          const dest = `articles/${req.params.shoeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const file = bucket.file(dest);
          await file.save(req.file.buffer, {
            contentType: mime,
            resumable: false,
            metadata: { cacheControl: 'public,max-age=31536000' },
          });
          const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 });
          url = signedUrl;
        } catch (cloudErr) {
          console.warn('Cloud upload failed, switching to local. Reason:', cloudErr?.message || cloudErr);
        }
      } else {
        console.log('Using local upload (bucket missing or FORCE_LOCAL_UPLOADS=1). bucketName:', bucketName);
      }

      if (!url) {
        const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'articles', String(req.params.shoeId));
        await fs.mkdir(uploadsDir, { recursive: true });
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const localPath = path.join(uploadsDir, fileName);
        await fs.writeFile(localPath, req.file.buffer);
        url = `/uploads/articles/${encodeURIComponent(String(req.params.shoeId))}/${encodeURIComponent(fileName)}`;
      }

      return res.json({ ok:true, url, storage: url.startsWith('http') ? 'cloud' : 'local' });
    } catch (e) {
      console.error('Upload handler error:', e);
      return res.status(500).json({ ok:false, msg:'upload failed', error: e?.message || String(e) });
    }
  }
);


// AJAX/JSONリクエスト判定ヘルパー
function wantsJSON(req) {
  const accept = req.headers.accept || '';
  const ctype = req.headers['content-type'] || '';
  const xrw = (req.headers['x-requested-with'] || '').toLowerCase();
  return ctype.includes('application/json') || accept.includes('application/json') || xrw === 'xmlhttprequest';
}

// この古いルートは削除（下の新しいPOST /admin/articles/:idルートを使用）

// POST /admin/articles/:id - 記事を保存（Markdownファイルとして保存）
router.post('/admin/articles/:id', requireAdmin, async (req, res) => {
  try {
    const shoeId = req.params.id;
    const { markdown } = req.body;
    
    if (markdown === undefined || markdown === null) {
      return res.status(400).json({ ok: false, error: 'コンテンツが空です' });
    }
    
    const articlesDir = path.join(__dirname, '..', 'data', 'articles');
    // ディレクトリ作成
    await fs.mkdir(articlesDir, { recursive: true });
    
    const mdPath = path.join(articlesDir, `${shoeId}.md`);
    await fs.writeFile(mdPath, markdown, 'utf-8');
    
    console.log(`[articles] ✅ Markdown保存成功: ${mdPath}`);
    res.json({ ok: true, message: '記事をMarkdownとして保存しました！' });
  } catch (err) {
    console.error('[articles] Markdown保存エラー:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- ブログ編集ルート（admin/blogs） ---
// 新規作成用ルート
router.get('/admin/blogs/new', requireAdmin, async (req, res) => {
  try {
    const id = 'new';
    const doc = { title:'', slug:'', excerpt:'', author:'', category:'', html:'', isDraft:true };
    res.render('admin-blog-edit', { blogId: id, doc });
  } catch (e) {
    console.error('Failed to open new blog editor:', e);
    res.status(500).send('ロード失敗');
  }
});

// GET /admin/blogs/:id
router.get('/admin/blogs/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  try {
    const jsonPath = path.join(__dirname, '..', 'data', 'blogs', `${id}.json`);
    let doc = { title:'', slug:'', excerpt:'', author:'', category:'', html:'', isDraft:true };
    try { const txt = await fs.readFile(jsonPath,'utf8'); doc = JSON.parse(txt); } catch(_){}
    res.render('admin-blog-edit', { blogId: id, doc });
  } catch (e) {
    console.error('Failed to open blog editor:', e);
    res.status(500).send('ロード失敗');
  }
});

// POST /admin/blogs/:id
router.post('/admin/blogs/:id', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { title, slug, excerpt, author, category, isDraft, html } = req.body;
    const doc = { title, slug, excerpt, author, category, isDraft: !!isDraft, html: sanitizeArticleHtml(html), updatedAt: new Date().toISOString() };
    const jsonDir = path.join(__dirname, '..', 'data', 'blogs');
    await fs.mkdir(jsonDir, { recursive: true });
    const jsonPath = path.join(jsonDir, `${id}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(doc, null, 2), 'utf8');
    const pubDir = path.join(__dirname, '..', 'public', 'blogs');
    await fs.mkdir(pubDir, { recursive: true });
    const htmlPath = path.join(pubDir, `${id}.html`);
    if (!doc.isDraft) await fs.writeFile(htmlPath, doc.html, 'utf8'); else try{ await fs.unlink(htmlPath) }catch(_){}
    return res.json({ ok:true, paths:{ json: jsonPath, html: htmlPath } });
  } catch (e) {
    console.error('Save blog failed:', e);
    return res.status(500).json({ ok:false, error: e.message });
  }
});

// POST /admin/blogs/:id/image
router.post('/admin/blogs/:id/image', requireAdmin, upload.single('image'), async (req, res)=>{
  try{
    if(!req.file) return res.status(400).json({ ok:false, msg:'no file' });
    const mime = req.file.mimetype;
    if(!/^image\/(png|jpe?g|webp|gif)$/i.test(mime)) return res.status(400).json({ ok:false, msg:'invalid mime' });
    const ext = mime.split('/')[1].replace('jpeg','jpg');
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'blogs', String(req.params.id));
    await fs.mkdir(uploadsDir, { recursive:true });
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const localPath = path.join(uploadsDir, fileName);
    await fs.writeFile(localPath, req.file.buffer);
    const url = `/uploads/blogs/${encodeURIComponent(String(req.params.id))}/${encodeURIComponent(fileName)}`;
    return res.json({ ok:true, url });
  }catch(e){ console.error('blog image upload failed:', e); return res.status(500).json({ ok:false, msg:e.message }); }
});


module.exports = router;
