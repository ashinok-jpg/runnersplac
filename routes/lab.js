// routes/lab.js  計測データを動きで見せる「シューズ実験室」
const express = require('express');
const router = express.Router();
const shoes = require('../data/shoesData.js');
const m = require('../data/measurements.json');

// 曲げ剛性は旧方式の値（50N超）が混ざっているので使わない（research/scoring-rules.md）
const FLEX_MAX = 50;

function list() {
  return shoes
    .map((s) => {
      const x = m[s.id] || {};
      const flex = x.flex != null && x.flex <= FLEX_MAX ? x.flex : null;
      return {
        id: s.id, name: s.name, brand: s.brand, image: s.image,
        ret: x.returnFore ?? null, shock: x.shock ?? null, flex,
      };
    })
    .filter((s) => s.ret != null || s.flex != null)
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
}

router.get('/', (req, res) => {
  const items = list();
  const ids = new Set(items.map((s) => s.id));
  const pick = String(req.query.shoes || '').split(',').filter((id) => ids.has(id)).slice(0, 3);
  res.render('lab/index', { items, pick, user: res.locals.user, req });
});

module.exports = router;
