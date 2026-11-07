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

router.get('/:id', (req, res, next) => {
  const { clinics } = loadData();
  const c = clinics.find(x => x.id === req.params.id);
  if (!c) return next();
  res.render('clinic/detail', {
    title: `${c.name}（${c.city}・${c.type}）｜ランナー向け治療院｜Runnersplac`,
    description: `${c.pref}${c.city}の${c.type}「${c.name}」の受付時間、相談できる部位、ランナー向けの設備・サービス。`,
    c,
  });
});

module.exports = router;
