// シューズ2足の比較（/compare）で使うデータと文章
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const shoesPath = path.join(root, 'data', 'shoesData.js');
const measurements = require('../data/measurements.json');
const scores = require('../data/scores.json');
const PAIRS = require('../data/compare-pairs.json');

// 点数の項目（data/scores.json の items の番号）
const ITEMS = [
  ['クッション', 0],
  ['安定性', 1],
  ['軽さ', 2],
  ['スピード', 7],
  ['グリップ', 8],
  ['耐久性', 9],
];

function shoes() {
  delete require.cache[require.resolve(shoesPath)];
  return require(shoesPath);
}

function pick(list, id) {
  const s = list.find((x) => x.id === id);
  if (!s || s.rating == null) return null;
  const sc = scores[id] || {};
  return {
    id: s.id,
    name: s.name,
    brand: s.brand,
    image: s.image,
    price: s.price,
    buyUrl: s.buyUrl || null,
    category: s.category,
    rating: s.rating,
    value: s.value,
    drop: s.drop,
    midsole: s.midsole,
    items: ITEMS.map(([label, i]) => ({ label, v: sc.items?.[i] ?? null })),
    m: measurements[id] || {},
  };
}

const slugOf = (a, b) => `${a}-vs-${b}`;
const isCurated = (a, b) => PAIRS.some(([x, y]) => x === a && y === b);
const curatedReverse = (a, b) => PAIRS.some(([x, y]) => x === b && y === a);

function parseSlug(slug) {
  const parts = String(slug).split('-vs-');
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) return null;
  return parts;
}

const yen = (n) => '¥' + Number(n).toLocaleString('en-US');
const short = (s) => s.name;

// どちらがどの点で上回るかを、計測値の差から文章にする
function reasons(me, other) {
  const a = me.m, b = other.m, out = [];
  if (a.weight != null && b.weight != null && b.weight - a.weight >= 10) out.push(`軽さを優先する人（実測${a.weight}g、${b.weight - a.weight}g軽い）`);
  if (a.shock != null && b.shock != null && a.shock - b.shock >= 5) out.push(`クッションを重視する人（衝撃吸収${a.shock}SA）`);
  if (a.returnFore != null && b.returnFore != null && a.returnFore - b.returnFore >= 3) out.push(`反発で進みたい人（前足部のエネルギーリターン${a.returnFore}%）`);
  if (a.heelWidth != null && b.heelWidth != null && a.heelWidth - b.heelWidth >= 4) out.push(`着地を安定させたい人（かかと幅${a.heelWidth}mm）`);
  if (a.grip != null && b.grip != null && a.grip - b.grip >= 0.08) out.push(`雨の日も走る人（摩擦係数${a.grip.toFixed(2)}）`);
  if (me.price != null && other.price != null && other.price - me.price >= 2000) out.push(`価格を抑えたい人（${yen(other.price - me.price)}安い）`);
  if (a.yenPerKm != null && b.yenPerKm != null && b.yenPerKm - a.yenPerKm >= 5) out.push(`長く使いたい人（1kmあたり約${a.yenPerKm}円）`);
  return out;
}

function verdict(a, b) {
  const diff = a.rating - b.rating;
  const hi = diff >= 0 ? a : b, lo = diff >= 0 ? b : a;
  const gap = Math.abs(diff);
  const priceGap = (hi.price ?? 0) - (lo.price ?? 0);
  const parts = [];
  if (gap < 0.05) parts.push(`性能点は${short(a)}が${a.rating.toFixed(2)}、${short(b)}が${b.rating.toFixed(2)}で、ほぼ同じ。`);
  else parts.push(`性能点は${short(hi)}が${gap.toFixed(2)}点高い（${hi.rating.toFixed(2)}対${lo.rating.toFixed(2)}）。`);
  if (hi.price != null && lo.price != null) {
    if (priceGap <= 0 && gap >= 0.05) parts.push(`価格も${short(hi)}のほうが${priceGap === 0 ? '同じ' : yen(-priceGap) + '安い'}ので、数字では${short(hi)}が上。`);
    else if (priceGap > 0) parts.push(`価格は${short(hi)}のほうが${yen(priceGap)}高い。その差をどう見るかで選びたい。`);
  }
  if (a.category !== b.category) parts.push(`なお、${short(a)}は${a.category}、${short(b)}は${b.category}として採点しているので、用途の違いにも注意したい。`);
  return parts.join('');
}

function build(aId, bId) {
  const list = shoes();
  const a = pick(list, aId), b = pick(list, bId);
  if (!a || !b) return null;
  const related = PAIRS.filter(([x, y]) => [x, y].some((id) => id === aId || id === bId) && !(x === aId && y === bId))
    .map(([x, y]) => ({ slug: slugOf(x, y), a: pick(list, x), b: pick(list, y) }))
    .filter((p) => p.a && p.b)
    .slice(0, 6);
  return {
    a, b,
    slug: slugOf(aId, bId),
    curated: isCurated(aId, bId),
    verdict: verdict(a, b),
    forA: reasons(a, b),
    forB: reasons(b, a),
    related,
  };
}

function listPairs() {
  const list = shoes();
  return PAIRS.map(([x, y]) => ({ slug: slugOf(x, y), a: pick(list, x), b: pick(list, y) })).filter((p) => p.a && p.b);
}

function pairsFor(id) {
  return listPairs().filter((p) => p.a.id === id || p.b.id === id);
}

module.exports = { build, listPairs, pairsFor, parseSlug, curatedReverse, slugOf, yen };
