// routes/compare.js  シューズ2足の比較ページ
const express = require('express');
const router = express.Router();
const { build, listPairs, parseSlug, curatedReverse, slugOf } = require('../lib/compare');

router.get('/', (req, res) => {
  const pairs = listPairs();
  const order = ['レース', 'スピード', 'デイリー'];
  const groups = order.map((cat) => ({ cat, pairs: pairs.filter((p) => p.a.category === cat) }))
    .filter((g) => g.pairs.length);
  res.render('compare/index', { groups, user: res.locals.user, req });
});

router.get('/:slug', (req, res, next) => {
  try {
    const ids = parseSlug(req.params.slug);
    if (!ids) return res.status(404).send('Not Found');
    const [a, b] = ids;
    // 用意した組み合わせの逆順は、正しい向きのURLへ寄せる
    if (curatedReverse(a, b)) return res.redirect(301, '/compare/' + slugOf(b, a));
    const data = build(a, b);
    if (!data) return res.status(404).send('Not Found');
    res.render('compare/show', { ...data, user: res.locals.user, req });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
