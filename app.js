require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();

// ----- 基本ミドルウェア（順序大事） -----
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// セッション → ユーザー展開（これを先に）
const { sessionMiddleware } = require('./lib/session');
sessionMiddleware(app);

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

// 記事の写真（articles/<id>/images/ だけを公開）
const { ARTICLES_DIR } = require('./lib/articles');
const { BLOGS_DIR } = require('./lib/blogs');
const onlyImages = (req, res, next) => {
  if (!/^\/[\w-]+\/images\//.test(req.path)) return res.status(404).end();
  next();
};
app.use('/article-assets', onlyImages, express.static(ARTICLES_DIR));
app.use('/blog-assets', onlyImages, express.static(BLOGS_DIR));

// 旧URLの記事ページは詳細ページへ
app.get('/articles/:file', (req, res) => {
  res.redirect(301, '/shoes/' + encodeURIComponent(req.params.file.replace(/\.html$/, '')));
});

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

// ブログ
app.use('/blog', require('./routes/blog'));

// ヘルス
app.get('/__health', (_req,res)=>res.json({ok:true}));


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
