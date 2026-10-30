// routes/shoes.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const { db } = require('../firebase/admin');
const { marked } = require('marked');
const { sanitizeArticleHtml } = require('../lib/sanitize');

const modPath = path.join(__dirname, '..', 'data', 'shoesData.js');
const norm = s => String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'-');

function getShoes(refresh = false){
  if (refresh) delete require.cache[require.resolve(modPath)];
  const list = require(modPath);
  if (!Array.isArray(list)) throw new Error('shoesData.js must export an array');
  return list;
}

// ローカルファイル優先で記事を読み込み
async function loadArticle(docId){
  console.log('[articles] loading docId=', docId);
  
  // 1. まずローカルのMarkdownファイルから読み込み（最優先）
  try {
    const mdPath = path.join(__dirname, '..', 'data', 'articles', `${docId}.md`);
    const mdContent = await fs.readFile(mdPath, 'utf-8');
    console.log(`[articles] ✅ Markdownファイルから読み込み: ${mdPath}`);
    const htmlContent = marked.parse(mdContent);
    return {
      html: htmlContent,
      author: 'Local MD File',
      updatedAtISO: null,
      isDraft: false,
      source: 'local-md'
    };
  } catch (mdError) {
    // Markdownファイルが無い場合は続行
  }
  
  // 2. ローカルJSONファイルから読み込み
  try {
    const jsonPath = path.join(__dirname, '..', 'data', 'articles', `${docId}.json`);
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const article = JSON.parse(jsonData);
    console.log(`[articles] ✅ ローカルJSONファイルから読み込み: ${jsonPath}`);
    return {
      html: article.html || '',
      author: article.author || 'Local JSON',
      updatedAtISO: article.updatedAt || null,
      isDraft: article.isDraft || false,
      source: 'local-json'
    };
  } catch (jsonError) {
    // JSONファイルが無い場合は続行
  }

  // 3. ローカルHTMLファイルから読み込み
  try {
    const htmlPath = path.join(__dirname, '..', 'public', 'articles', `${docId}.html`);
    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    console.log(`[articles] ✅ ローカルHTMLファイルから読み込み: ${htmlPath}`);
    return {
      html: htmlContent,
      author: 'Local HTML File',
      updatedAtISO: null,
      isDraft: false,
      source: 'local-html'
    };
  } catch (localError) {
    // HTMLファイルが無い場合は続行
  }

  // 4. 最後にFirestoreから読み込み（フォールバック）
  try {
    const snap = await db.collection('articles').doc(String(docId)).get();
    if (snap.exists) {
      const a = snap.data() || {};
      console.log(`[articles] ⚠️ Firestoreから読み込み（フォールバック）: articles/${docId}`);
      return {
        html: a.html || '',
        author: a.author || 'Firestore',
        updatedAtISO: a.updatedAt?.toDate?.()?.toISOString() || null,
        isDraft: a.isDraft || false,
        source: 'firestore'
      };
    }
  } catch (firestoreError) {
    console.error('[articles] Firestore読み込みエラー:', firestoreError);
  }
  
  console.log(`[articles] ❌ 記事が見つかりません: ${docId}`);
  return null;
}

router.get('/:id', async (req, res, next) => {
  try {
    const want = norm(req.params.id);
    const list = getShoes(true);
    const shoe = list.find(s => norm(s.id) === want || norm(s.slug||s.name) === want);
    
    if (!shoe) {
      return res.status(404).send('Not Found');
    }

    // 表示用の細かい整形（任意）
    if (shoe.price && typeof shoe.price === 'number') shoe.price = shoe.price;
    if (shoe.offset && !shoe.drop) shoe.drop = shoe.offset;

    // 記事ドキュメントID（基本は数値/文字列id、無ければslug）
    const docId = shoe.id ?? (shoe.slug ? norm(shoe.slug) : norm(shoe.name));
    console.log('[shoes] detail for', shoe.name, 'docId=', docId);

    // 記事を読み込み（ローカル優先）
    const article = await loadArticle(docId);
    console.log('[shoes] article loaded:', !!article, article?.source);
    
    if (article) {
      // 下書きチェック（管理者以外には下書きを表示しない）
      if (article.isDraft && !(req.user?.isAdmin)) {
        shoe.articleHtml = ''; // 一般ユーザーには下書きを表示しない
      } else {
        shoe.articleHtml = sanitizeArticleHtml(article.html);
      }
      shoe.articleAuthor = article.author || null;
      shoe.articleUpdatedAt = article.updatedAtISO || null;
      shoe.articleSource = article.source || 'unknown'; // デバッグ用
    } else {
      // 記事が見つからない場合
      shoe.articleHtml = '';
      shoe.articleAuthor = null;
      shoe.articleUpdatedAt = null;
      shoe.articleSource = 'none';
    }

    res.render('shoe-detail', { 
      shoe, 
      communityAvg: null, 
      communityCount: 0 
    });
  } catch (e) { 
    next(e); 
  }
});

module.exports = router;


