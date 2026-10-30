// routes/admin.articles.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});
const fs = require('fs').promises;
const path = require('path');

const { requireAdmin, validateIdParam } = require('../lib/session');
const { sanitizeArticleHtml } = require('../lib/sanitize');

router.param('id', validateIdParam);

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
