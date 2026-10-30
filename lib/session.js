// lib/session.js
const { admin } = require('../firebase/admin');

const ADMIN_UIDS = new Set(['7MAnXoevBOZG80P0LivUnIn2hTu1']);

async function getUserFromSessionCookie(req) {
  const cookie = req.cookies?.__session;
  if (!cookie) return null;
  try {
    const decoded = await admin.auth().verifySessionCookie(cookie, true);
    return decoded;
  } catch (e) {
    console.error('[DBG] verifySessionCookie error:', e.message);
    return null;
  }
}

async function exposeUser(req, res, next) {
  const decoded = await getUserFromSessionCookie(req);
  if (decoded) {
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      isAdmin: decoded.isAdmin === true || ADMIN_UIDS.has(decoded.uid),
    };
    res.locals.user = req.user;
  } else {
    req.user = null;
    res.locals.user = null;
  }
  next();
}

//function sessionMiddleware(app){ return app.use((req,_res,next)=>next()); }

function sessionMiddleware(app){
  return app.use(exposeUser); // ← no-opやめてこれ
}

function requireAuth() {
  return async (req, res, next) => {
    const decoded = await getUserFromSessionCookie(req);
    if (!decoded) return res.status(401).json({ ok:false, msg:'unauthorized' });
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      isAdmin: decoded.isAdmin === true || ADMIN_UIDS.has(decoded.uid),
    };
    next();
  };
}

// ★ これを追加（routes/auth.js から呼ばれる）
async function createSessionCookie(idToken, expiresIn){
  return admin.auth().createSessionCookie(idToken, { expiresIn });
}



function isLoopback(req) {
  const ip = req.socket?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// 管理者のみ許可。NODE_ENV=development かつ localhost からのアクセスに限り認証をスキップ
function requireAdmin(req, res, next) {
  if (process.env.NODE_ENV === 'development' && isLoopback(req)) {
    if (!req.user?.isAdmin) req.user = { uid: 'dev-user', isAdmin: true };
    return next();
  }

  const isApi = req.originalUrl.startsWith('/api/') || (req.headers.accept || '').includes('application/json');
  if (!req.user) {
    if (isApi) return res.status(401).json({ ok: false, error: 'unauthorized' });
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  if (!req.user.isAdmin) {
    if (isApi) return res.status(403).json({ ok: false, error: 'forbidden' });
    return res.status(403).send('管理者権限が必要です');
  }
  next();
}

// URLパラメータのID検証（パストラバーサル対策）。router.param / app.param で使う
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;
function validateIdParam(req, res, next, value) {
  if (!SAFE_ID.test(String(value))) {
    return res.status(400).json({ ok: false, error: 'invalid id' });
  }
  next();
}

module.exports = { sessionMiddleware, exposeUser, requireAuth, requireAdmin, validateIdParam, createSessionCookie };
