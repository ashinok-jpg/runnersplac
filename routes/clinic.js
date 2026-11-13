// ランナー向け治療院（/clinic）。データは data/clinic/clinics.json（npm run clinic:build で作り直す）
// 院には点数や順位をつけない（医療広告ガイドライン・柔整/あはき法の広告制限）。事実だけで絞り込む
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '..', 'data', 'clinic', 'clinics.json');
const loadData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const str = v => (typeof v === 'string' ? v.trim() : '');

router.get('/', (req, res) => {
  const { clinics, vocab, updatedAt } = loadData();
  const f = {
    pref: str(req.query.pref), city: str(req.query.city), type: str(req.query.type),
    part: str(req.query.part), feature: str(req.query.feature), q: str(req.query.q),
    weekend: req.query.weekend === '1', night: req.query.night === '1', insurance: req.query.insurance === '1',
  };
  const cities = [...new Set(clinics.filter(c => !f.pref || c.pref === f.pref).map(c => c.city))].sort();
  const hay = c => `${c.name} ${c.city} ${c.station} ${c.address}`.toLowerCase();
  const list = clinics.filter(c =>
    (!f.pref || c.pref === f.pref) && (!f.city || c.city === f.city) && (!f.type || c.type === f.type)
    && (!f.part || c.parts.includes(f.part)) && (!f.feature || c.features.includes(f.feature))
    && (!f.weekend || c.saturday || c.sunday) && (!f.night || c.night)
    && (!f.insurance || c.insurance === '使える' || c.insurance === '使える場合がある')
    && (!f.q || hay(c).includes(f.q.toLowerCase())))
    // 順位に見えないよう、並びは地域→院名の順だけにする
    .sort((a, b) => `${a.pref}${a.city}${a.name}`.localeCompare(`${b.pref}${b.city}${b.name}`, 'ja'));
  const filtered = Object.entries(f).some(([, v]) => v);

  res.render('clinic/home', {
    title: 'ランナーが行ける治療院を探す（東京23区・神奈川）｜Runnersplac',
    description: '膝やアキレス腱など走って痛めた部位、土日の受付、フォーム分析の有無などから、東京23区と神奈川県の整骨院・鍼灸院・整体・スポーツ整形外科を探せます。',
    robots: clinics.length ? '' : 'noindex',
    clinics: list, total: clinics.length, vocab, cities, f, filtered, updatedAt,
  });
});

router.get('/about', (req, res) => {
  res.render('clinic/about', {
    title: '治療院の載せ方と注意点｜Runnersplac',
    description: 'Runnersplac の治療院ページに載せる院の選び方、載せる情報、載せない情報について。',
  });
});

router.get('/apply', (req, res) => {
  const { clinics } = loadData();
  const target = clinics.find(c => c.id === str(req.query.id));
  res.render('clinic/apply', {
    title: '治療院の掲載申込・修正依頼｜Runnersplac',
    description: 'Runnersplac の治療院ページへの掲載申込、掲載内容の修正・削除の依頼はこちらから。',
    robots: 'noindex', target, sent: false, error: '', form: {},
  });
});

const KINDS = ['新しく載せてほしい', '載っている内容を直してほしい', '掲載をやめてほしい'];
router.post('/apply', async (req, res) => {
  const b = req.body || {};
  const form = {
    kind: str(b.kind), clinicName: str(b.clinicName).slice(0, 100), clinicId: str(b.clinicId).slice(0, 60),
    site: str(b.site).slice(0, 300), contactName: str(b.contactName).slice(0, 60),
    email: str(b.email).slice(0, 120), role: str(b.role).slice(0, 60), message: str(b.message).slice(0, 3000),
  };
  const render = (status, extra) => res.status(status).render('clinic/apply', {
    title: '治療院の掲載申込・修正依頼｜Runnersplac', description: '', robots: 'noindex',
    target: null, sent: false, error: '', form, ...extra,
  });
  // 見えない欄に何か入っていたら機械の送信とみなして、送れたふりだけする
  if (str(b.website2)) return render(200, { sent: true });
  if (!KINDS.includes(form.kind) || !form.clinicName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) || !form.contactName) {
    return render(400, { error: '申込の種類・院名・お名前・メールアドレスを入れてください。' });
  }
  try {
    const { db, admin } = require('../firebase/admin');
    await db.collection('clinicApplications').add({ ...form, status: '未対応', createdAt: admin.firestore.Timestamp.now() });
    render(200, { sent: true });
  } catch (e) {
    console.error('[clinic/apply]', e);
    render(500, { error: '送信できませんでした。時間をおいてもう一度お試しください。' });
  }
});

// ---------- 体験談（投稿） ----------
const multer = require('multer');
const { requireAdmin, isLocalDev } = require('../lib/session');
const posts = require('../lib/clinic-posts');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: posts.LIMITS.photos, fileSize: posts.LIMITS.photoBytes, fields: 20, fieldSize: 8 * 1024 },
});
const POST_ID = /^[A-Za-z0-9]{10,40}$/;
// 投稿できる人。ローカル開発（NODE_ENV=development かつ localhost）では Google ログインなしで試せるようにする
const poster = req => req.user || (isLocalDev(req) ? { uid: 'dev-user', email: null, isAdmin: true } : null);
const findClinic = id => loadData().clinics.find(x => x.id === id);

async function renderDetail(req, res, c, { status = 200, error = '', form = {} } = {}) {
  const me = poster(req);
  const isAdmin = !!me?.isAdmin;
  let all = [], liked = new Set(), loadError = false;
  try {
    const [own, embeds] = await Promise.all([
      posts.listByClinic(c.id, { includeHidden: isAdmin }),
      posts.listEmbedsByClinic(c.id, { includeHidden: isAdmin }),
    ]);
    liked = await posts.helpfulBy(me?.uid, own.map(p => p.id));
    // サイトへの投稿と SNS の紹介をまとめて新しい順に（SNS は投稿日、無ければ登録日）
    const t = p => (p.postedAt || p.createdAt)?.getTime() || 0;
    all = [...own, ...embeds].sort((a, b) => t(b) - t(a));
  } catch (e) {
    console.error('[clinic/posts]', e);
    loadError = true;
  }
  const injury = posts.INJURIES.includes(str(req.query.injury)) ? str(req.query.injury) : '';
  const counts = {};
  all.filter(p => !p.hidden).forEach(p => { counts[p.injury] = (counts[p.injury] || 0) + 1; });
  const visibleCount = all.filter(p => !p.hidden).length;
  res.status(status).render('clinic/detail', {
    title: `${c.name}（${c.city}・${c.type}）｜ランナー向け治療院｜Runnersplac`,
    description: `${c.pref}${c.city}の${c.type}「${c.name}」の受付時間、相談できる部位、ランナー向けの設備・サービス`
      + (visibleCount ? `。ランナーの体験談${visibleCount}件。` : '。'),
    c, me, isAdmin, liked, loadError, injury, counts, visibleCount,
    posts: injury ? all.filter(p => p.injury === injury) : all,
    choices: { INJURIES: posts.INJURIES, PERIODS: posts.PERIODS, OUTCOMES: posts.OUTCOMES, LIMITS: posts.LIMITS },
    error, form, posted: req.query.posted === '1',
  });
}

router.get('/photo/:photoId', async (req, res, next) => {
  if (!POST_ID.test(req.params.photoId)) return next();
  try {
    const photo = await posts.getPhoto(req.params.photoId);
    if (!photo) return next();
    const post = await posts.getPost(photo.postId);
    if (!post || (post.hidden && !poster(req)?.isAdmin)) return next();
    res.set('Cache-Control', post.hidden ? 'private, no-store' : 'public, max-age=86400');
    res.type(photo.type).send(photo.data);
  } catch (e) { next(e); }
});

router.post('/:id/posts', (req, res, next) => {
  const c = findClinic(req.params.id);
  if (!c) return next();
  const me = poster(req);
  if (!me) return res.redirect('/login?redirect=' + encodeURIComponent(`/clinic/${c.id}#post-form`));

  upload.array('photos', posts.LIMITS.photos)(req, res, async err => {
    const b = req.body || {};
    const L = posts.LIMITS;
    const form = {
      nickname: str(b.nickname).slice(0, L.nickname), injury: str(b.injury), injuryNote: str(b.injuryNote).slice(0, L.injuryNote),
      treatment: str(b.treatment).slice(0, L.treatment), period: str(b.period), outcome: str(b.outcome),
      body: str(b.body).slice(0, L.body),
    };
    const fail = msg => renderDetail(req, res, c, { status: 400, error: msg, form });
    if (err) {
      return fail(err.code === 'LIMIT_FILE_SIZE' ? '写真が大きすぎます。1枚900KBまでです（ページのJavaScriptが動いていれば自動で縮めます）。'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `写真は${L.photos}枚までです。`
        : '送信内容を読み取れませんでした。');
    }
    if (str(b.website2)) return res.redirect(`/clinic/${c.id}`); // 見えない欄が埋まっていたら機械の送信
    if (!posts.INJURIES.includes(form.injury) || !posts.PERIODS.includes(form.period) || !posts.OUTCOMES.includes(form.outcome)) {
      return fail('ケガ・症状、通った期間、その後の状態を選んでください。');
    }
    if (form.treatment.length < 5 || form.body.length < 20) {
      return fail('受けた施術（5文字以上）と、体験の詳しい内容（20文字以上）を書いてください。');
    }
    if (b.agree !== '1') return fail('投稿のルールを確認して、チェックを入れてください。');
    const photos = [];
    for (const f of req.files || []) {
      const clean = posts.stripJpegExif(f.buffer);
      if (!clean) return fail('写真は JPEG で送ってください（ページのJavaScriptが動いていれば自動で変換します）。');
      photos.push(clean);
    }
    try {
      if (!me.isAdmin && await posts.countRecentByUser(me.uid) >= posts.MAX_POSTS_PER_DAY) {
        return fail(`投稿は1日${posts.MAX_POSTS_PER_DAY}件までです。`);
      }
      const id = await posts.createPost({ clinicId: c.id, user: me, fields: { ...form, nickname: form.nickname || 'ランナー' }, photos });
      res.redirect(303, `/clinic/${c.id}?posted=1#post-${id}`);
    } catch (e) {
      console.error('[clinic/posts create]', e);
      renderDetail(req, res, c, { status: 500, error: '保存できませんでした。時間をおいてもう一度お試しください。', form });
    }
  });
});

router.post('/posts/:postId/helpful', async (req, res) => {
  const me = poster(req);
  if (!me) return res.status(401).json({ ok: false, login: true });
  if (!POST_ID.test(req.params.postId)) return res.status(400).json({ ok: false });
  try {
    const r = await posts.toggleHelpful(req.params.postId, me.uid);
    if (!r) return res.status(404).json({ ok: false });
    res.json({ ok: true, ...r });
  } catch (e) {
    console.error('[clinic/posts helpful]', e);
    res.status(500).json({ ok: false });
  }
});

// 管理者：非表示にする／戻す
router.post('/posts/:postId/hide', requireAdmin, async (req, res, next) => {
  if (!POST_ID.test(req.params.postId)) return next();
  const post = await posts.getPost(req.params.postId).catch(() => null);
  if (!post) return next();
  await posts.setHidden(post.id, req.body?.hidden === '1', req.user?.uid);
  res.redirect(303, `/clinic/${post.clinicId}#post-${post.id}`);
});

// 管理者：SNS の投稿（X・Instagram）の URL を貼って紹介する
router.post('/:id/embeds', requireAdmin, async (req, res, next) => {
  const c = findClinic(req.params.id);
  if (!c) return next();
  const b = req.body || {};
  const form = { embedUrl: str(b.url), embedInjury: str(b.injury), embedNote: str(b.note).slice(0, 80), embedDate: str(b.postedAt) };
  const fail = msg => renderDetail(req, res, c, { status: 400, error: msg, form });
  if (!posts.parseSnsUrl(form.embedUrl)) return fail('X か Instagram の投稿の URL を貼ってください。');
  if (!posts.INJURIES.includes(form.embedInjury)) return fail('ケガ・症状を選んでください。');
  const postedAt = /^\d{4}-\d{2}-\d{2}$/.test(form.embedDate) ? new Date(form.embedDate + 'T12:00:00+09:00') : null;
  const id = await posts.upsertEmbed({ clinicId: c.id, url: form.embedUrl, injury: form.embedInjury, note: form.embedNote, postedAt, by: req.user?.uid });
  res.redirect(303, `/clinic/${c.id}#post-${id}`);
});

router.post('/embeds/:embedId/:action', requireAdmin, async (req, res, next) => {
  const { embedId, action } = req.params;
  if (!/^(x|instagram)-[A-Za-z0-9_-]{5,40}$/.test(embedId) || !['hide', 'delete'].includes(action)) return next();
  const e = await posts.getEmbed(embedId).catch(() => null);
  if (!e) return next();
  if (action === 'hide') await posts.setEmbedHidden(e.id, req.body?.hidden === '1', req.user?.uid);
  else await posts.deleteEmbed(e.id);
  res.redirect(303, `/clinic/${e.clinicId}#${action === 'hide' ? 'post-' + e.id : 'posts'}`);
});

// 投稿した本人（と管理者）は消せる
router.post('/posts/:postId/delete', async (req, res, next) => {
  const me = poster(req);
  if (!POST_ID.test(req.params.postId)) return next();
  const post = await posts.getPost(req.params.postId).catch(() => null);
  if (!post) return next();
  if (!me || (me.uid !== post.uid && !me.isAdmin)) return res.status(403).send('この投稿は消せません');
  await posts.deletePost(post);
  res.redirect(303, `/clinic/${post.clinicId}#posts`);
});

router.get('/:id', async (req, res, next) => {
  const c = findClinic(req.params.id);
  if (!c) return next();
  try { await renderDetail(req, res, c); } catch (e) { next(e); }
});

module.exports = router;
