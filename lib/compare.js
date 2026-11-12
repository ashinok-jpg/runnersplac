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

// ---- 項目ごとの解説（計測値と、計測した全シューズの中での順位だけで書く） ----
const ALL = Object.values(measurements);
const FLEX_MAX = 50; // 50Nを超える曲げ剛性は旧方式の値なので使わない
const ok = (k, v) => v != null && !(k === 'flex' && v > FLEX_MAX);
// 「大きいほうから」(dir='high') か「小さいほうから」(dir='low') の順位
function rank(k, v, dir) {
  const vals = ALL.map((x) => x[k]).filter((x) => ok(k, x));
  const r = vals.filter((x) => (dir === 'high' ? x > v : x < v)).length + 1;
  return { r, n: vals.length };
}
const r1 = (v) => Math.round(v * 10) / 10;

function topic(a, b, k, opt) {
  const va = a.m[k], vb = b.m[k];
  if (!ok(k, va) || !ok(k, vb)) return null;
  const ra = rank(k, va, opt.dir), rb = rank(k, vb, opt.dir);
  const f = opt.fmt || ((v) => v + (opt.unit || ''));
  const s = [`${opt.label}は${short(a)}が${f(va)}、${short(b)}が${f(vb)}（${opt.hint}）。`];
  const d = Math.abs(va - vb);
  if (d === 0) s.push('同じ値です。');
  else {
    const better = (opt.dir === 'high' ? va > vb : va < vb) ? a : b;
    const diff = opt.diff ? opt.diff(d) : r1(d) + (opt.unit || '');
    s.push(`${short(better)}のほうが${opt.word}、差は${diff}${opt.small != null && d < opt.small ? 'と小さめです' : 'です'}。`);
  }
  s.push(`計測した${ra.n}足の中で、${opt.rankWord}${short(a)}は${ra.r}番目、${short(b)}は${rb.r}番目。`);
  return s.join('');
}

const flexWord = (f) => (f >= 25 ? 'かなり硬い' : f >= 15 ? '硬め' : f >= 10 ? 'ふつう' : 'よく曲がる');

function sections(a, b) {
  const out = [];
  const add = (title, en, parts, extra) => {
    const text = parts.filter(Boolean);
    if (text.length) out.push({ title, en, text, extra: extra || null });
  };
  add('重さ', 'WEIGHT', [
    topic(a, b, 'weight', { label: '実測重量（US9）', unit: 'g', dir: 'low', word: '軽く', hint: '片足', small: 10, rankWord: '軽いほうから' }),
  ]);
  add('クッション', 'CUSHION', [
    topic(a, b, 'shock', { label: 'かかとの衝撃吸収', unit: 'SA', dir: 'high', word: '衝撃をやわらげ', hint: '数値が大きいほど着地の衝撃をやわらげる', small: 5, rankWord: '大きいほうから' }),
    topic(a, b, 'softness', { label: 'フォームの硬さ', unit: '', dir: 'low', word: '柔らかく', hint: 'アスカーC。数値が小さいほど柔らかい', small: 3, rankWord: '柔らかいほうから' }),
  ]);
  add('反発', 'ENERGY RETURN', [
    topic(a, b, 'returnFore', { label: '前足部のエネルギーリターン', unit: '%', dir: 'high', word: '反発が大きく', hint: '踏んだ力が戻ってくる割合', small: 3, diff: (d) => r1(d) + 'ポイント', rankWord: '大きいほうから' }),
    topic(a, b, 'returnHeel', { label: 'かかとのエネルギーリターン', unit: '%', dir: 'high', word: '反発が大きく', hint: 'かかと着地のとき', small: 3, diff: (d) => r1(d) + 'ポイント', rankWord: '大きいほうから' }),
  ], ok('returnFore', a.m.returnFore) && ok('returnFore', b.m.returnFore) ? { lab: 'drop', label: '2足にボールを落として反発を見比べる' } : null);
  add('安定性', 'STABILITY', [
    topic(a, b, 'heelWidth', { label: 'かかと部分の幅', unit: 'mm', dir: 'high', word: '幅が広く', hint: '広いほど着地がぶれにくい', small: 4, rankWord: '広いほうから' }),
    topic(a, b, 'heelStiffness', { label: 'ヒールカウンターの硬さ', unit: '', dir: 'high', word: 'かかとの芯が硬く', hint: '1〜5の5段階。大きいほど硬い', fmt: (v) => v + '/5', diff: (d) => d + '段階', rankWord: '硬いほうから' }),
  ]);
  const fa = a.m.flex, fb = b.m.flex;
  add('曲げの硬さ', 'FLEXIBILITY', [
    topic(a, b, 'flex', { label: 'ソールを30度曲げるのに必要な力', unit: 'N', dir: 'high', word: '硬く', hint: '大きいほど曲がりにくい', small: 3, rankWord: '硬いほうから' }),
    ok('flex', fa) && ok('flex', fb) ? (flexWord(fa) === flexWord(fb) ? `目安で言うと、どちらも「${flexWord(fa)}」の部類です。` : `目安で言うと、${short(a)}は「${flexWord(fa)}」、${short(b)}は「${flexWord(fb)}」。`) : null,
  ], ok('flex', fa) && ok('flex', fb) ? { lab: 'bend', label: '2足を曲げて離して硬さを見比べる' } : null);
  add('グリップ', 'GRIP', [
    topic(a, b, 'grip', { label: 'アウトソールの摩擦係数', unit: '', dir: 'high', word: '滑りにくく', hint: '大きいほど滑りにくい', small: 0.05, fmt: (v) => v.toFixed(2), diff: (d) => d.toFixed(2), rankWord: '大きいほうから' }),
  ]);
  add('耐久性とコスト', 'DURABILITY', [
    topic(a, b, 'wear', { label: '摩耗テスト後のすり減り', unit: 'mm', dir: 'low', word: 'すり減りにくく', hint: '小さいほど長持ち', small: 0.3, rankWord: 'すり減りが少ないほうから' }),
    topic(a, b, 'yenPerKm', { label: '1kmあたりの費用', dir: 'low', word: '安く走れ', hint: '価格をすり減りから出した寿命で割った概算', fmt: (v) => '約' + v + '円', diff: (d) => '約' + d + '円', small: 5, rankWord: '安いほうから' }),
  ]);
  add('足幅と通気性', 'FIT', [
    topic(a, b, 'foreWidth', { label: '前足部の幅', unit: 'mm', dir: 'high', word: '幅が広く', hint: '計測値', small: 3, rankWord: '広いほうから' }),
    topic(a, b, 'breath', { label: '通気性', dir: 'high', word: '風が通りやすく', hint: '1〜5の5段階', fmt: (v) => v + '/5', diff: (d) => d + '段階', rankWord: '通気性が高いほうから' }),
  ]);
  return out;
}

// よくある質問（数字で答えられるものだけ）
function faq(a, b) {
  const qs = [];
  const q = (question, k, dir, say) => {
    const va = a.m[k], vb = b.m[k];
    if (!ok(k, va) || !ok(k, vb) || va === vb) return;
    const w = (dir === 'high' ? va > vb : va < vb) ? a : b;
    const l = w === a ? b : a;
    qs.push({ q: question, a: say(w, l, w === a ? va : vb, w === a ? vb : va) });
  };
  q(`${short(a)}と${short(b)}、どっちが軽い？`, 'weight', 'low', (w, l, x, y) => `${short(w)}です。実測で${x}g、${short(l)}は${y}gで、${y - x}g軽い（US9・片足）。`);
  q(`着地の衝撃をよりやわらげるのはどっち？`, 'shock', 'high', (w, l, x, y) => `かかとの衝撃吸収は${short(w)}が${x}SA、${short(l)}が${y}SAで、${short(w)}のほうが衝撃をやわらげます。`);
  q(`反発が強いのはどっち？`, 'returnFore', 'high', (w, l, x, y) => `前足部のエネルギーリターンは${short(w)}が${x}%、${short(l)}が${y}%で、${short(w)}のほうが大きいです。`);
  if (a.price != null && b.price != null && a.price !== b.price) {
    const w = a.price < b.price ? a : b, l = w === a ? b : a;
    qs.push({ q: `値段が安いのはどっち？`, a: `${short(w)}です。当サイトの掲載価格で${yen(w.price)}、${short(l)}は${yen(l.price)}で、${yen(l.price - w.price)}の差があります。` });
  }
  return qs;
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
    sections: sections(a, b),
    faq: faq(a, b),
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
