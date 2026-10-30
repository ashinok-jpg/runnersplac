// routes/home2.js
const express = require('express');
const router = express.Router();
const { shoes } = require('../lib/data');
const { listBlogs } = require('../lib/blogs');

const BRANDS = Array.from(new Set(shoes.map((s) => s.brand).filter(Boolean)));
const SORTERS = {
  score: (a, b) => (b.score?.overall ?? -1) - (a.score?.overall ?? -1),
  priceAsc: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  weightAsc: (a, b) => (a.weight ?? Infinity) - (b.weight ?? Infinity),
};

const toNum = (v) => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

router.get('/home2', (req, res) => {
  const q            = (req.query.q || '').trim();
  const brand        = (req.query.brand || '').trim();
  const priceMax     = toNum(req.query.priceMax);
  const weightMax    = toNum(req.query.weightMax);
  const cushionMin   = toNum(req.query.cushionMin);
  const stabilityMin = toNum(req.query.stabilityMin);
  const speedMin     = toNum(req.query.speedMin);
  const review       = req.query.review === '1';
  const sort         = SORTERS[req.query.sort] ? req.query.sort : 'score';

  const lower = s => (s || '').toString().toLowerCase();
  let list = shoes.slice();

  if (q) {
    const k = lower(q);
    list = list.filter(s => [s.name, s.brand, s.id].some(v => v && lower(v).includes(k)));
  }
  if (brand) {
    const b = lower(brand);
    list = list.filter(s => s.brand && lower(s.brand).includes(b));
  }
  if (priceMax !== undefined)  list = list.filter(s => (typeof s.price  === 'number' ? s.price  <= priceMax  : true));
  if (weightMax !== undefined) list = list.filter(s => (typeof s.weight === 'number' ? s.weight <= weightMax : true));
  if (cushionMin !== undefined)   list = list.filter(s => (typeof s.score?.cushion   === 'number' && s.score.cushion   >= cushionMin));
  if (stabilityMin !== undefined) list = list.filter(s => (typeof s.score?.stability === 'number' && s.score.stability >= stabilityMin));
  if (speedMin !== undefined)     list = list.filter(s => (typeof s.score?.speed     === 'number' && s.score.speed     >= speedMin));

  if (review) list = list.filter(s => s.hasArticle);

  list = list.sort(SORTERS[sort]);

  const activeFilters = [];
  if (q) activeFilters.push('q');
  if (brand) activeFilters.push('brand');
  if (priceMax !== undefined) activeFilters.push('priceMax');
  if (weightMax !== undefined) activeFilters.push('weightMax');
  if (cushionMin !== undefined) activeFilters.push('cushionMin');
  if (stabilityMin !== undefined) activeFilters.push('stabilityMin');
  if (speedMin !== undefined) activeFilters.push('speedMin');

  // 並び順・レビュー絞り込みを変えても他の条件を保つ
  const keepParams = {};
  ['q', 'brand', 'priceMax', 'weightMax', 'cushionMin', 'stabilityMin', 'speedMin'].forEach((k) => {
    if (req.query[k]) keepParams[k] = req.query[k];
  });

  res.render('home2', {
    shoes: list,
    q, brand, priceMax, weightMax, cushionMin, stabilityMin, speedMin,
    activeFilters,
    review, sort, keepParams,
    brands: BRANDS,
    totalCount: shoes.length,
    blogs: listBlogs(),
    user: res.locals.user,
    req
  });
});

module.exports = router;
