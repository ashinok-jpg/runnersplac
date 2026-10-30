require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;

const app = express();

// ----- 基本ミドルウェア（順序大事） -----
// Firestoreデータクリーンアップ関数
function cleanFirestoreData(data) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue; // undefined/nullをスキップ
    }
    
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // ネストされたオブジェクトを再帰的にクリーンアップ
      const nestedCleaned = cleanFirestoreData(value);
      if (Object.keys(nestedCleaned).length > 0) {
        cleaned[key] = nestedCleaned;
      }
    } else if (Array.isArray(value)) {
      // 配列の場合
      const cleanedArray = value.filter(item => {
        if (item === null || item === undefined) return false;
        if (typeof item === 'object' && !(item instanceof Date)) {
          // 配列内のオブジェクトもクリーンアップ
          return Object.keys(cleanFirestoreData(item)).length > 0;
        }
        return true;
      }).map(item => {
        if (typeof item === 'object' && !(item instanceof Date)) {
          return cleanFirestoreData(item);
        }
        return item;
      });
      
      if (cleanedArray.length > 0) {
        cleaned[key] = cleanedArray;
      }
    } else {
      // プリミティブ値
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// セッション → ユーザー展開（これを先に）
const { sessionMiddleware, requireAdmin, validateIdParam } = require('./lib/session');
sessionMiddleware(app);
app.param('id', validateIdParam);

app.use((req, _res, next)=>{
  console.log('[DBG] cookies=', req.headers.cookie || '(none)');
  next();
});


// res.locals の共通セット（これも早めに）
app.use((req, res, next) => {
  res.locals.req = req;
  res.locals.currentUrl = req.originalUrl;
  next();
});

// 静的ファイル
app.use(express.static(path.join(__dirname, 'public')));
// firebase/ には serviceAccountKey.json があるのでフォルダごと公開しない。クライアント設定だけ配信
app.get('/firebase/config.js', (_req, res) => {
  res.type('application/javascript').sendFile(path.join(__dirname, 'firebase', 'config.js'));
});

// 静的ファイル配信（記事HTML用）
app.use('/articles', express.static(path.join(__dirname, 'public', 'articles')));

// テンプレ
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ----- ルート（依存順に） -----
const formRouter = require('./routes/form');
const vomero18Router = require('./routes/form_vomero18');
const resultRouter = require('./routes/result');
const resultvomero18Router = require('./routes/result_vomero18');
const reviewRouter = require('./routes/review');

app.use('/form', formRouter);
app.use('/form_vomero18', vomero18Router);
app.use('/result', resultRouter);
app.use('/result_vomero18', resultvomero18Router);
app.use('/review', reviewRouter);

// シューズ詳細は catch-all より前に
app.use('/shoes', require('./routes/shoes'));

// API（※ 重複マウントを削除して1回だけ）
app.use('/api/comments', require('./routes/api/comments'));
app.use('/', require('./routes/wishlist'));

// 認証や管理画面（セッション後に）
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/admin.articles'));
app.use('/', require('./routes/template'));

app.get('/__set_test_cookie', (req, res) => {
  res.cookie('__session_test', 'hello', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // ローカルHTTPなら secure を付けない
    secure: false,
    maxAge: 600000,
  });
  res.send('ok');
});

// 404より前に置く
console.log('[BOOT] cwd=', process.cwd());
console.log('[BOOT] auth resolve=', require.resolve('./routes/auth')); // ここで例外出たらパス違い

const authRouter = require('./routes/auth');
console.log('[BOOT] authRouter type=', typeof authRouter); // "function" じゃなければexport崩れ

app.use('/', authRouter);


// ホーム/一覧（最後のほうでOK）
app.get('/', (req, res) => {
  const i = req.originalUrl.indexOf('?');
  const qs = i >= 0 ? req.originalUrl.slice(i) : '';
  res.redirect(302, '/home2' + qs);
});
app.get('/home', (req, res) => {
  const i = req.originalUrl.indexOf('?');
  const qs = i >= 0 ? req.originalUrl.slice(i) : '';
  res.redirect(301, '/home2' + qs);
});
app.use('/', require('./routes/home2'));
app.use('/', require('./routes/profile'));

// ブログページのルート
app.get('/blog/oldspice', (req, res) => {
  res.render('blog/oldspice');
});

// ヘルス
app.get('/__health', (_req,res)=>res.json({ok:true}));


// POST /admin/articles/:id は routes/admin.articles.js で処理される

// テスト用：記事ファイルの存在確認
app.get('/admin/articles/:id/check', requireAdmin, async (req, res) => {
  try {
    const shoeId = req.params.id;
    const articlesDir = path.join(__dirname, 'public', 'articles');
    const htmlPath = path.join(articlesDir, `${shoeId}.html`);
    const jsonDir = path.join(__dirname, 'data', 'articles');
    const jsonPath = path.join(jsonDir, `${shoeId}.json`);
    
    const result = {
      articlesDir,
      htmlPath,
      jsonPath,
      htmlExists: false,
      jsonExists: false,
      htmlContent: null,
      jsonContent: null
    };
    
    try {
      await fs.access(htmlPath);
      result.htmlExists = true;
      result.htmlContent = await fs.readFile(htmlPath, 'utf-8');
    } catch (e) {
      result.htmlError = e.message;
    }
    
    try {
      await fs.access(jsonPath);
      result.jsonExists = true;
      result.jsonContent = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
    } catch (e) {
      result.jsonError = e.message;
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 簡単な接続テスト
app.get('/test', (req, res) => {
  res.json({ 
    message: 'サーバーは動いています', 
    time: new Date().toISOString(),
    __dirname: __dirname 
  });
});

// POST テスト
app.post('/test-post', (req, res) => {
  console.log('POST test received:', req.body);
  res.json({ received: req.body, time: new Date().toISOString() });
});

// 記事保存エンドポイント（管理画面用）
app.post('/api/articles/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('=== 記事保存リクエスト受信（app.js） ===');
    console.log('記事ID:', id);
    console.log('リクエストボディサイズ:', JSON.stringify(req.body).length, 'bytes');
    console.log('HTMLサイズ:', req.body.html ? req.body.html.length : 0, 'bytes');
    
    const { html, category, author, isDraft, jsonData, title } = req.body;
    
    if (!html) {
      return res.status(400).json({ success: false, message: 'HTMLコンテンツが必要です' });
    }
    
    const articlePath = path.join(__dirname, 'public', 'articles', `${id}.html`);
    const jsonPath = path.join(__dirname, 'data', 'articles', `${id}.json`);
    
    // JSONディレクトリを作成
    await fs.mkdir(path.dirname(jsonPath), { recursive: true });

    // JSONデータを準備（構造化データがあればそれを使用、なければ基本データ）
    const baseArticleData = jsonData ? {
      ...jsonData,
      category: category || jsonData.manufacturer || '',
      author: author || 'Admin Editor',
      isDraft: isDraft === 'true' || isDraft === true || isDraft === 'on',
      updatedAt: new Date().toISOString(),
      // 画像データが含まれていることを確認
      images: jsonData.images || [],
      heroImage: jsonData.heroImage || '',
      sectionImages: jsonData.sectionImages || {}
    } : {
      category: category || '',
      author: author || 'Admin Editor',
      isDraft: isDraft === 'true' || isDraft === true || isDraft === 'on',
      title: title || '',
      updatedAt: new Date().toISOString(),
      images: [],
      heroImage: '',
      sectionImages: {}
    };

    // HTML生成: shoe-detail.ejsテンプレートからHTMLを生成
    let generatedHtml = html;
    if (!generatedHtml || generatedHtml.trim().length < 100) {
      try {
        console.log('EJSテンプレートからHTMLを生成中...');
        console.log('テンプレートに渡すデータ - images:', baseArticleData.images?.length || 0);
        console.log('テンプレートに渡すデータ - heroImage:', baseArticleData.heroImage ? '有り' : '無し');
        
        // EJSテンプレートからHTMLを生成（Express appを使用）
        generatedHtml = await new Promise((resolve, reject) => {
          // Express appからrenderメソッドを取得
          const app = res.app || req.app;
          if (!app) {
            reject(new Error('Express app not available'));
            return;
          }
          
          app.render('shoe-detail', baseArticleData, (err, html) => {
            if (err) {
              console.error('EJS render error:', err);
              reject(err);
            } else {
              resolve(html);
            }
          });
        });
        
        console.log('EJSからのHTML生成完了 (length:', generatedHtml.length, ')');
      } catch (ejsError) {
        console.error('EJSテンプレート生成エラー:', ejsError);
        generatedHtml = html || '<p>HTML生成エラー</p>';
      }
    }

    // 最終的な記事データにHTMLを追加
    const articleData = {
      ...baseArticleData,
      html: generatedHtml
    };

    // デバッグ: 保存されるデータの内容を確認
    console.log('保存されるarticleDataの主要項目:');
    console.log('- title:', articleData.title);
    console.log('- comparison length:', articleData.comparison ? articleData.comparison.length : 'undefined');
    console.log('- tips length:', articleData.tips ? articleData.tips.length : 'undefined');
    console.log('- images:', articleData.images ? 'あり' : 'なし');
    console.log('- scores length:', articleData.scores ? articleData.scores.length : 'undefined');
    
    await fs.writeFile(jsonPath, JSON.stringify(articleData, null, 2), 'utf8');
    
    // HTMLファイルをpublic/articlesフォルダに保存（常に実行）
    let htmlSaved = false;
    
    if (generatedHtml && generatedHtml.trim()) {
      try {
        // public/articlesディレクトリを作成
        await fs.mkdir(path.dirname(articlePath), { recursive: true });
        await fs.writeFile(articlePath, generatedHtml, 'utf8');
        htmlSaved = true;
        console.log(`HTMLファイルをpublic/articlesに保存: ${articlePath}`);
      } catch (htmlError) {
        console.error('HTMLファイル保存エラー:', htmlError);
      }
    }
    
    console.log(`記事データが保存されました: ${jsonPath}`);
    if (htmlSaved) {
      console.log(`HTMLファイルをpublic/articlesに保存完了: ${articlePath}`);
    }
    
    // Firestoreにも保存（優先的に保存）
    let firestoreSuccess = false;
    let firestoreError = null;
    try {
      const { db } = require('./firebase/admin');
      console.log('Firestoreへの保存を開始...');
      
      // Firestoreへの保存データを準備
      const firestoreData = {
        ...articleData,
        updatedAt: new Date(),
        createdAt: new Date() // 新規作成時のみ設定される
      };
      
      // Firestoreでサポートされていないデータ型をクリーンアップ
      if (firestoreData.images) {
        // imagesが配列または文字列でない場合は削除
        if (Array.isArray(firestoreData.images)) {
          // 配列の場合、文字列のみを保持
          firestoreData.images = firestoreData.images.filter(img => 
            typeof img === 'string' || (typeof img === 'object' && img !== null && typeof img.url === 'string')
          ).map(img => typeof img === 'string' ? img : img.url);
        } else if (typeof firestoreData.images === 'object') {
          // オブジェクトの場合は削除
          delete firestoreData.images;
          console.log('⚠️ 複雑なimagesオブジェクトを削除しました');
        }
      }
      
      // その他の問題のあるフィールドをクリーンアップ
      const cleanData = cleanFirestoreData(firestoreData);
      
      console.log('クリーンアップ後のデータサイズ:', JSON.stringify(cleanData).length, 'bytes');
      
      // 既存のドキュメントがある場合はcreatedAtを保持
      try {
        const existingDoc = await db.collection('articles').doc(id).get();
        if (existingDoc.exists && existingDoc.data().createdAt) {
          cleanData.createdAt = existingDoc.data().createdAt; // 既存の作成日時を保持
          console.log('既存記事を更新します');
        } else {
          console.log('新規記事を作成します');
        }
      } catch (checkError) {
        console.warn('既存記事チェックでエラー:', checkError.message);
      }
      
      await db.collection('articles').doc(id).set(cleanData, { merge: true });
      firestoreSuccess = true;
      console.log(`✅ Firestoreに保存完了: articles/${id}`);
      console.log('保存されたデータ:', {
        hasHtml: !!cleanData.html,
        htmlLength: cleanData.html?.length || 0,
        isDraft: cleanData.isDraft,
        hasJsonData: !!cleanData.jsonData
      });
    } catch (err) {
      firestoreError = err;
      console.error('❌ Firestore保存エラー:', err);
      console.error('エラー詳細:', err.message);
      // Firestoreエラーでも続行
    }
    
    // 保存されたファイルが存在するかチェック
    const jsonExists = await fs.access(jsonPath).then(() => true).catch(() => false);
    const htmlExists = await fs.access(articlePath).then(() => true).catch(() => false);
    
    res.json({ 
      success: true, 
      message: htmlSaved && firestoreSuccess ? 
        'public/articlesとFirestoreの両方に保存しました！' :
        htmlSaved ? 'public/articlesに保存しました（Firestore保存エラー）' :
        firestoreSuccess ? 'Firestoreに保存しました（HTML生成なし）' :
        '記事データを保存しました（一部エラー）',
      paths: {
        json: `/data/articles/${id}.json`,
        html: htmlSaved ? `/articles/${id}.html` : null,
        publicHtml: htmlSaved ? `public/articles/${id}.html` : null
      },
      timestamp: new Date().toISOString(),
      saved: {
        json: jsonExists,
        firestore: firestoreSuccess,
        html: htmlSaved,
        isDraft: articleData.isDraft
      },
      errors: {
        firestore: firestoreError ? firestoreError.message : null
      }
    });
  } catch (error) {
    console.error('記事保存エラー（app.js）:', error);
    res.status(500).json({ 
      success: false, 
      message: '保存に失敗しました: ' + error.message 
    });
  }
});

// テスト用エンドポイント（管理画面用）
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    server: 'app.js (main server)'
  });
});

// 記事確認エンドポイント（デバッグ用）
app.get('/api/articles/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = {
      articleId: id,
      sources: {
        firestore: null,
        localJson: null,
        staticHtml: null
      }
    };
    
    // Firestore確認
    try {
      const { db } = require('./firebase/admin');
      const snap = await db.collection('articles').doc(id).get();
      result.sources.firestore = {
        exists: snap.exists,
        data: snap.exists ? {
          hasHtml: !!(snap.data()?.html),
          htmlLength: (snap.data()?.html || '').length,
          isDraft: snap.data()?.isDraft,
          updatedAt: snap.data()?.updatedAt?.toDate?.()?.toISOString()
        } : null
      };
    } catch (error) {
      result.sources.firestore = { error: error.message };
    }
    
    // ローカルJSON確認
    try {
      const jsonPath = path.join(__dirname, 'data', 'articles', `${id}.json`);
      const data = await fs.readFile(jsonPath, 'utf-8');
      const article = JSON.parse(data);
      result.sources.localJson = {
        exists: true,
        hasHtml: !!article.html,
        htmlLength: (article.html || '').length,
        isDraft: article.isDraft,
        updatedAt: article.updatedAt
      };
    } catch (error) {
      result.sources.localJson = { exists: false, error: error.message };
    }
    
    // 静的HTML確認
    try {
      const htmlPath = path.join(__dirname, 'public', 'articles', `${id}.html`);
      const html = await fs.readFile(htmlPath, 'utf-8');
      result.sources.staticHtml = {
        exists: true,
        htmlLength: html.length
      };
    } catch (error) {
      result.sources.staticHtml = { exists: false, error: error.message };
    }
    
    res.json(result);
  } catch (error) {
    console.error('記事確認エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// HTMLファイルから記事データを取得するエンドポイント（編集画面用）
app.get('/api/articles/:id/html-data', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    // public/articles/[id].htmlファイルを読み込み
    const htmlPath = path.join(__dirname, 'public', 'articles', `${id}.html`);
    
    try {
      const htmlContent = await fs.readFile(htmlPath, 'utf-8');
      console.log('Loaded HTML file for editing:', htmlPath);
      
      res.json({
        success: true,
        articleId: id,
        htmlContent: htmlContent,
        filePath: htmlPath,
        loadedAt: new Date().toISOString()
      });
    } catch (fileError) {
      console.log('HTML file not found:', htmlPath);
      res.status(404).json({ 
        success: false, 
        error: 'HTML file not found',
        filePath: htmlPath 
      });
    }
  } catch (error) {
    console.error('HTML file read error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to read HTML file: ' + error.message 
    });
  }
});

// 記事データ取得エンドポイント（編集画面用）
app.get('/api/articles/:id/data', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    let articleData = null;
    
    // 1. Firestoreから読み込み
    try {
      const { db } = require('./firebase/admin');
      const snap = await db.collection('articles').doc(id).get();
      if (snap.exists) {
        articleData = snap.data();
        console.log('Loaded from Firestore for API:', id);
        
        // HTMLからJSONデータを抽出する試み
        if (articleData.html && !articleData.title) {
          const extractedData = extractDataFromHTML(articleData.html);
          if (extractedData) {
            articleData = { ...articleData, ...extractedData };
          }
        }
      }
    } catch (error) {
      console.error('Firestore read error:', error);
    }
    
    // 2. ローカルJSONから読み込み（Firestoreになければ）
    if (!articleData) {
      const jsonPath = path.join(__dirname, 'data', 'articles', `${id}.json`);
      try {
        const data = await fs.readFile(jsonPath, 'utf-8');
        articleData = JSON.parse(data);
        console.log('Loaded from local JSON for API:', id);
      } catch (error) {
        console.log('No local JSON found for API:', id);
      }
    }
    
    if (articleData) {
      res.json(articleData);
    } else {
      res.status(404).json({ error: 'Article not found' });
    }
  } catch (error) {
    console.error('Article data fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch article data' });
  }
});

// HTMLからデータを抽出する関数
function extractDataFromHTML(html) {
  try {
    // 簡単なHTMLパースでタイトルや内容を抽出
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/レビュー$/, '').trim() : '';
    
    // 他の要素も抽出可能だが、基本的な情報のみ
    return {
      title,
      html // 既存のHTMLは保持
    };
  } catch (error) {
    console.error('HTML extraction error:', error);
    return null;
  }
}

// GET /admin/articles/:id は routes/admin.articles.js で処理される

// グローバルエラーハンドラ
app.use((error, req, res, next) => {
  console.error('=== Global Error Handler ===');
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  console.error('Request URL:', req.url);
  console.error('Request Method:', req.method);
  console.error('Request Body:', req.body);
  
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Server error: ' + error.message,
      stack: error.stack
    });
  }
});

// 404エラーハンドラ
app.use((req, res) => {
  console.log('404 - Not Found:', req.url);
  res.status(404).json({ error: 'Not Found' });
});

// 500（原因をそのまま表示）
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.stack || err);
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ error: err.message || 'internal' });
  } else {
    res
      .status(500)
      .send('Server error: ' + (err.message || 'internal'));
  }
});






const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT} でサーバーが起動しました`);
});
