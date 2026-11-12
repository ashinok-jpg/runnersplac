// シューズ詳細ページの「計測データで見る」テンプレ
// 計測値と、計測した全シューズの中での順位だけで書く（感想や評価の言葉は足さない）
const measurements = require('../data/measurements.json');
const { rank, ok, flexWord } = require('./compare');

const r1 = (v) => Math.round(v * 10) / 10;

// 項目：key, 見出し用の名前, 単位の付け方, 良い向き, バーの名前（右に行くほど○○）, 説明
const METRICS = [
  { k: 'weight', label: '実測重量', fmt: (v) => v + 'g', dir: 'low', bar: '軽さ', hint: 'US9・片足', group: 'weight' },
  { k: 'shock', label: 'かかとの衝撃吸収', fmt: (v) => v + 'SA', dir: 'high', bar: '衝撃吸収', hint: '大きいほど着地の衝撃をやわらげる', group: 'cushion' },
  { k: 'softness', label: 'フォームの硬さ', fmt: (v) => String(v), dir: 'low', bar: '柔らかさ', hint: 'アスカーC。小さいほど柔らかい', group: 'cushion' },
  { k: 'returnFore', label: '前足部のエネルギーリターン', fmt: (v) => v + '%', dir: 'high', bar: '反発（前足部）', hint: '踏んだ力が戻ってくる割合', group: 'return' },
  { k: 'returnHeel', label: 'かかとのエネルギーリターン', fmt: (v) => v + '%', dir: 'high', bar: '反発（かかと）', hint: 'かかと着地のとき', group: 'return' },
  { k: 'heelWidth', label: 'かかと部分の幅', fmt: (v) => v + 'mm', dir: 'high', bar: 'かかとの幅', hint: '広いほど着地がぶれにくい', group: 'stability' },
  { k: 'heelStiffness', label: 'ヒールカウンターの硬さ', fmt: (v) => v + '/5', dir: 'high', bar: 'かかとの芯の硬さ', hint: '1〜5の5段階', group: 'stability' },
  { k: 'flex', label: 'ソールを30度曲げるのに必要な力', fmt: (v) => v + 'N', dir: 'high', bar: '曲げの硬さ', hint: '大きいほど曲がりにくい', group: 'flex' },
  { k: 'grip', label: 'アウトソールの摩擦係数', fmt: (v) => v.toFixed(2), dir: 'high', bar: 'グリップ', hint: '大きいほど滑りにくい', group: 'grip' },
  { k: 'wear', label: '摩耗テスト後のすり減り', fmt: (v) => v + 'mm', dir: 'low', bar: 'すり減りにくさ', hint: '小さいほど長持ち', group: 'durability' },
  { k: 'yenPerKm', label: '1kmあたりの費用', fmt: (v) => '約' + v + '円', dir: 'low', bar: '1kmあたりの安さ', hint: '価格をすり減りから出した寿命で割った概算', group: 'durability' },
  { k: 'foreWidth', label: '前足部の幅', fmt: (v) => v + 'mm', dir: 'high', bar: '前足部の広さ', hint: '計測値', group: 'fit' },
  { k: 'breath', label: '通気性', fmt: (v) => v + '/5', dir: 'high', bar: '通気性', hint: '1〜5の5段階', group: 'fit' },
];

const GROUPS = [
  ['weight', '重さ', 'WEIGHT'],
  ['cushion', 'クッション', 'CUSHION'],
  ['return', '反発', 'ENERGY RETURN'],
  ['stability', '安定性', 'STABILITY'],
  ['flex', '曲げの硬さ', 'FLEXIBILITY'],
  ['grip', 'グリップ', 'GRIP'],
  ['durability', '耐久性とコスト', 'DURABILITY'],
  ['fit', '足幅と通気性', 'FIT'],
];

// 上位・下位4分の1だけ言葉を付ける（それ以外は「真ん中あたり」）
function place(r, n) {
  const p = (r - 1) / Math.max(1, n - 1); // 0 が一番良い側
  if (p <= 0.25) return '上位4分の1に入る';
  if (p >= 0.75) return '下位4分の1に入る';
  return '真ん中あたり';
}

function profile(shoe) {
  const m = measurements[shoe.id] || {};
  const rows = [];
  for (const d of METRICS) {
    const v = m[d.k];
    if (!ok(d.k, v)) continue;
    const { r, n } = rank(d.k, v, d.dir);
    // バーの長さ：その項目で、このシューズより下にいる靴の割合
    const pct = n > 1 ? Math.round(((n - r) / (n - 1)) * 100) : 50;
    rows.push({ ...d, v, r, n, pct, text: d.fmt(v) });
  }
  if (!rows.length) return null;

  const by = (g) => rows.filter((x) => x.group === g);
  const groups = GROUPS.map(([g, title, en]) => {
    const items = by(g);
    if (!items.length) return null;
    const text = items.map((x) => {
      const dirWord = { weight: '軽い', softness: '柔らかい', wear: 'すり減りが少ない', yenPerKm: '安い', heelWidth: '広い', foreWidth: '広い', flex: '硬い', heelStiffness: '硬い' }[x.k] || (x.dir === 'high' ? '大きい' : '小さい');
      return `${x.label}は${x.text}（${x.hint}）。計測した${x.n}足の中で、${dirWord}ほうから${x.r}番目で、${place(x.r, x.n)}。`;
    });
    if (g === 'flex') text.push(`目安で言うと「${flexWord(items[0].v)}」の部類です。`);
    return { title, en, text, lab: g === 'return' && by('return').some((x) => x.k === 'returnFore') ? 'drop' : g === 'flex' ? 'bend' : null };
  }).filter(Boolean);

  // 冒頭の3つの数字（あるものだけ）
  const stats = ['weight', 'shock', 'returnFore'].map((k) => rows.find((x) => x.k === k)).filter(Boolean)
    .map((x) => ({ value: x.text, note: `${x.bar}　${x.n}足中${x.r}位` }));

  return { rows, groups, stats, count: rows.length };
}

module.exports = { profile };
