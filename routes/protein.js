// プロテイン比較（/protein）。データは data/protein/products.json（npm run protein:score で作り直す）
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '..', 'data', 'protein', 'products.json');
const loadData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const USES = ['毎日用', '減量用', '競技者用'];
const USE_LEAD = {
  毎日用: 'タンパク質の割合を中心に、バランスよく見ています。',
  減量用: '糖質と脂質が少ないものを重く見ています。',
  競技者用: 'アンチドーピング認証など、品質の裏付けを重く見ています。',
};
const SORTS = [['performance', '性能点が高い順'], ['value', 'コスパ点が高い順'], ['yen', 'タンパク質1gが安い順']];

router.get('/', (req, res) => {
  const { products, updatedAt } = loadData();
  const use = USES.includes(req.query.use) ? req.query.use : '毎日用';
  const sort = SORTS.some(([v]) => v === req.query.sort) ? req.query.sort : 'performance';
  const type = typeof req.query.type === 'string' ? req.query.type : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const scored = products.filter(p => p.scored);
  const types = [...new Set(scored.map(p => p.type))];
  const hay = p => `${p.brand} ${p.name} ${p.flavor} ${(p.flavors || []).join(' ')}`.toLowerCase();
  let list = scored.filter(p => (!type || p.type === type) && (!q || hay(p).includes(q.toLowerCase())));
  const key = {
    performance: p => -p.performance[use],
    value: p => -(p.value[use] * 10 + p.performance[use]),
    yen: p => p.yenPerGram,
  }[sort];
  list = list.sort((a, b) => key(a) - key(b));

  res.render('protein/home', {
    title: 'プロテインを点数で比べる｜Runnersplac',
    description: `${scored.length}種類のプロテインを、成分表示と価格から同じルールで点数化して比べられます。`,
    products: list, total: scored.length, pending: products.filter(p => !p.scored),
    uses: USES, use, useLead: USE_LEAD[use], sorts: SORTS, sort, types, type, q, updatedAt,
  });
});

router.get('/method', (req, res) => {
  res.render('protein/method', {
    title: 'プロテインの点数の付け方｜Runnersplac',
    description: 'Runnersplac のプロテインの性能点とコスパ点の計算方法。',
  });
});

router.get('/:id', (req, res, next) => {
  const { products } = loadData();
  const p = products.find(x => x.id === req.params.id);
  if (!p) return next();
  const ranks = p.scored ? Object.fromEntries(USES.map(u => {
    const l = products.filter(x => x.scored).sort((a, b) => b.performance[u] - a.performance[u]);
    return [u, { rank: l.indexOf(p) + 1, of: l.length }];
  })) : null;
  res.render('protein/product', {
    title: `${p.brand} ${p.name}の点数と成分｜Runnersplac`,
    description: `${p.brand} ${p.name}（${p.type}）の性能点・コスパ点と、成分表示・タンパク質1gあたりの価格。`,
    p, uses: USES, ranks,
  });
});

module.exports = router;
