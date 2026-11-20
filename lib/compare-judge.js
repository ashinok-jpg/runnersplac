// 比較ページの「判断」部分：計測値の組み合わせから、どんな人にどちらかを理由つきで書く
// 数字は data/measurements.json（RunRepeat の計測）と data/shoesData.js（メーカー公表の厚さ・ドロップ・価格）だけを使う
const measurements = require('../data/measurements.json');
const KANA = require('../data/shoe-kana.json');

const FLEX_MAX = 50; // 50Nを超える曲げ剛性は旧方式の値なので使わない
const ok = (k, v) => v != null && Number.isFinite(v) && !(k === 'flex' && v > FLEX_MAX);
const r1 = (v) => Math.round(v * 10) / 10;
const yen = (n) => '¥' + Number(n).toLocaleString('en-US');
const kana = (s) => KANA[s.id] || s.name;

// メーカー公表の厚さ。「前足/かかと」の順が靴によって違うので小さいほうを前足部とし、
// かかととの差がドロップと1mm以上ずれるものは使わない（データの書き間違いの可能性がある）
function stack(shoe) {
  if (!shoe || !shoe.offset) return null;
  const nums = String(shoe.offset).match(/[\d.]+/g);
  if (!nums || nums.length < 2) return null;
  const [x, y] = nums.map(Number);
  const fore = Math.min(x, y), heel = Math.max(x, y);
  if (!fore || !heel) return null;
  if (shoe.drop != null && Math.abs(heel - fore - shoe.drop) > 1) return null;
  return { fore, heel };
}

// 指標の定義。dir は「良いとされる向き」。null は良し悪しのない性質。small はこれ未満の差を「ほぼ同じ」とする幅
const MET = {
  weight: { label: '重さ', unit: 'g', dir: 'low', small: 10, lo: '軽い', hi: '重い' },
  shock: { label: 'かかとの衝撃吸収', unit: 'SA', dir: 'high', small: 8, lo: '小さい', hi: '大きい' },
  softness: { label: 'フォームの硬さ', unit: '', dir: null, small: 3, lo: '柔らかい', hi: '硬い' },
  returnFore: { label: '前足部の反発', unit: '%', dir: 'high', small: 3, lo: '小さい', hi: '大きい' },
  returnHeel: { label: 'かかとの反発', unit: '%', dir: 'high', small: 3, lo: '小さい', hi: '大きい' },
  foreStack: { label: '前足部の厚さ', unit: 'mm', dir: null, small: 3, lo: '薄い', hi: '厚い' },
  heelWidth: { label: 'かかとの幅', unit: 'mm', dir: 'high', small: 4, lo: '狭い', hi: '広い' },
  heelStiffness: { label: 'ヒールカウンターの硬さ', unit: '/5', dir: null, lo: '柔らかい', hi: '硬い', scale: true },
  flex: { label: '曲げの硬さ', unit: 'N', dir: null, small: 3, lo: 'よく曲がる', hi: '曲がりにくい' },
  grip: { label: 'グリップ', unit: '', dir: 'high', small: 0.08, lo: '滑りやすい', hi: '滑りにくい', dec: 2 },
  wear: { label: 'すり減り', unit: 'mm', dir: 'low', small: 1, lo: '少ない', hi: '多い' },
  yenPerKm: { label: '1kmあたりの費用', unit: '円', dir: 'low', small: 10, lo: '安い', hi: '高い' },
  foreWidth: { label: '前足部の幅', unit: 'mm', dir: null, small: 2, lo: '狭い', hi: '広い' },
  breath: { label: '通気性', unit: '/5', dir: 'high', lo: '低い', hi: '高い', scale: true },
};

const fmt = (k, v) => {
  const d = MET[k];
  if (k === 'yenPerKm') return '約' + v + '円';
  return (d.dec != null ? Number(v).toFixed(d.dec) : v) + d.unit;
};

// 比べる母集団の値（厚さは shoesData から）。2足が同じ区分なら、その区分の靴だけで比べる
// （レース用どうしの12gの差は、全シューズの中では小さく見えても、レース用の中では大きい）
function pool(list, k, cat) {
  const shoes = list.filter((s) => !cat || s.category === cat);
  const vals = k === 'foreStack' ? shoes.map((s) => stack(s)?.fore) : shoes.map((s) => measurements[s.id]?.[k]);
  const out = vals.filter((v) => ok(k, v));
  return out.length >= 15 || !cat ? out : pool(list, k, null);
}
// 値が全体のどこにあるか（0=最小, 100=最大）。同じ値は真ん中に置く
function pos(vals, v) {
  const lt = vals.filter((x) => x < v).length, eq = vals.filter((x) => x === v).length;
  return ((lt + eq / 2) / vals.length) * 100;
}
// 良い向きでの順位
function rank(vals, v, dir) {
  return { r: vals.filter((x) => (dir === 'low' ? x < v : x > v)).length + 1, n: vals.length };
}

// 差の大きさ：全シューズの中での位置の差で決める（5段階評価は段階の差で）
function tierOf(k, va, vb, pa, pb) {
  if (va === vb) return 'same';
  if (MET[k].scale) return Math.abs(va - vb) >= 2 ? 'big' : 'some';
  if (Math.abs(va - vb) < MET[k].small) return 'same';
  return Math.abs(pa - pb) >= 30 ? 'big' : 'some';
}
const TIER_WORD = { big: '大きな差', some: '少し差がある', same: 'ほぼ同じ' };

function valueOf(shoe, k) {
  if (k === 'foreStack') return stack(shoe)?.fore ?? null;
  return measurements[shoe.id]?.[k] ?? null;
}

// 2足の、指標ごとの比較
function metrics(list, a, b) {
  const out = {};
  const cat = a.category === b.category ? a.category : null;
  for (const k of Object.keys(MET)) {
    const va = valueOf(a, k), vb = valueOf(b, k);
    if (!ok(k, va) || !ok(k, vb)) continue;
    const vals = pool(list, k, cat), all = pool(list, k, null);
    const pa = pos(vals, va), pb = pos(vals, vb);
    const tier = tierOf(k, va, vb, pa, pb);
    out[k] = {
      k, ...MET[k], va, vb, pa: r1(pa), pb: r1(pb), tier, tierWord: TIER_WORD[tier],
      hiSide: va === vb ? null : va > vb ? 'a' : 'b',
      ra: MET[k].dir ? rank(all, va, MET[k].dir) : null,
      rb: MET[k].dir ? rank(all, vb, MET[k].dir) : null,
      n: all.length,
      group: vals.length === all.length ? null : cat,
    };
  }
  return out;
}

const differs = (m) => m && m.tier !== 'same';
const sideHigh = (m) => m.hiSide; // 値が大きいほう
const sideLow = (m) => (m.hiSide === 'a' ? 'b' : m.hiSide === 'b' ? 'a' : null);
const better = (m) => (m.dir === 'low' ? sideLow(m) : sideHigh(m));
const pair = (m) => `${fmt(m.k, m.va)}対${fmt(m.k, m.vb)}`;

// ---- こんな人はこっち（場面ごとの判断） ----
function scenes(list, a, b, M) {
  const S = { a, b };
  const name = (side) => kana(S[side]);
  const race = a.category === 'レース' && b.category === 'レース';
  const out = [];
  const add = (title, pick, why) => out.push({ title, pick, pickName: pick ? name(pick) : null, why });

  // 1. 脚を守る（衝撃吸収と前足部の厚さ）
  {
    const sh = M.shock, st = M.foreStack;
    const ss = [sh, st].filter(differs);
    const sides = new Set(ss.map((m) => sideHigh(m)));
    const title = race ? 'フルマラソンの後半まで脚を守りたい' : '長い距離で脚を守りたい';
    if (ss.length && sides.size === 1) {
      const p = [...sides][0];
      const parts = [];
      if (sh) parts.push(`かかとの衝撃吸収が${pair(sh)}`);
      if (st) parts.push(`前足部の厚さ（公表値）が${pair(st)}`);
      const both = ss.length === 2 ? 'どちらも' : '';
      add(title, p, `${parts.join('、')}で、${both}${name(p)}のほうが上。フォームの量で着地を受け止める作りになっている。`);
    } else if (ss.length === 2) {
      add(title, null, `かかとの衝撃吸収は${name(sideHigh(sh))}、前足部の厚さは${name(sideHigh(st))}が上で、数字の向きが分かれる。決め手にならない。`);
    }
  }

  // 2. 接地感・キレ（前足部の薄さと軽さ）
  {
    const st = M.foreStack, w = M.weight;
    const title = race ? '5km〜ハーフなど、短めの距離でキレを出したい' : 'テンポ走など、軽快に走りたい';
    const thin = differs(st) ? sideLow(st) : null;
    const light = differs(w) ? sideLow(w) : null;
    if (thin && (!light || light === thin)) {
      const parts = [`前足部の厚さ（公表値）が${pair(st)}で、${name(thin)}は${r1(Math.abs(st.va - st.vb))}mm低く地面が近い`];
      if (light) parts.push(`実測重量も${pair(w)}で軽い`);
      else if (w) parts.push(`重さの差は${Math.abs(w.va - w.vb)}gで小さい`);
      add(title, thin, parts.join('。') + '。');
    } else if (!thin && light) {
      add(title, light, `実測重量が${pair(w)}で、${name(light)}が${Math.abs(w.va - w.vb)}g軽い。`);
    } else if (thin && light && thin !== light) {
      add(title, null, `${name(thin)}は前足部が${r1(Math.abs(st.va - st.vb))}mm低く、${name(light)}は${Math.abs(w.va - w.vb)}g軽い。どちらを重く見るかで分かれる。`);
    }
  }

  // 3. 反発
  {
    const rf = M.returnFore;
    if (differs(rf)) {
      const p = sideHigh(rf);
      const fl = M.flex;
      let extra = '';
      if (differs(fl) && sideHigh(fl) === p) extra = `曲げの硬さも${pair(fl)}で${name(p)}が曲がりにくく、ソール全体で押し返す作り。`;
      add('踏み込んだ力を返してほしい', p, `前足部のエネルギーリターンが${pair(rf)}で、${name(p)}が${r1(Math.abs(rf.va - rf.vb))}ポイント大きい。${extra}`);
    }
  }

  // 4. 雨の日
  {
    const g = M.grip;
    if (differs(g)) {
      const p = sideHigh(g);
      const r = p === 'a' ? g.ra : g.rb;
      if (r.r <= r.n / 2) add('雨の日のレースや練習でも使いたい', p, `アウトソールの摩擦係数が${pair(g)}で、${name(p)}は計測した${r.n}足の中で${r.r}番目に滑りにくい。`);
    }
  }

  // 5. 足幅
  {
    const fw = M.foreWidth;
    if (fw) {
      if (differs(fw)) {
        const p = sideHigh(fw);
        add('足幅が広め', p, `前足部の幅（計測値）が${pair(fw)}で、${name(p)}が${r1(Math.abs(fw.va - fw.vb))}mm広い。`);
      } else {
        add('足幅が広め', null, `前足部の幅（計測値）は${pair(fw)}で、差は${r1(Math.abs(fw.va - fw.vb))}mmしかない。幅でどちらかを選ぶ理由にはならない。`);
      }
    }
  }

  // 6. 長く使いたい・練習にも使いたい
  {
    const c = M.yenPerKm;
    if (c) {
      const ra = c.ra, rb = c.rb;
      const half = c.n / 2;
      const p = c.va === c.vb ? null : sideLow(c);
      const rp = p === 'a' ? ra : rb;
      const title = race ? 'レースだけでなく練習でも使いたい' : '長く使いたい';
      if (p && differs(c) && rp.r <= half) {
        add(title, p, `1kmあたりの費用（すり減りから出した寿命で価格を割った概算）が${pair(c)}で、${name(p)}は計測した${c.n}足の中で${rp.r}番目に安い。`);
      } else if (ra.r > half && rb.r > half) {
        add(title, null, `1kmあたりの費用は${pair(c)}で、計測した${c.n}足の中で${ra.r}番目と${rb.r}番目。どちらも高い部類なので、本番用と割り切りたい。`);
      } else if (p && differs(c)) {
        add(title, p, `1kmあたりの費用が${pair(c)}で、${name(p)}のほうが安く走れる。`);
      }
    }
  }

  // 7. かかとから着地する
  {
    const hw = M.heelWidth;
    if (differs(hw)) {
      const p = sideHigh(hw);
      add('かかとから着地する', p, `かかと部分の幅が${pair(hw)}で、${name(p)}が${r1(Math.abs(hw.va - hw.vb))}mm広く、着地がぶれにくい。`);
    }
  }

  // 8. 価格
  if (a.price != null && b.price != null && Math.abs(a.price - b.price) >= 2000) {
    const p = a.price < b.price ? 'a' : 'b';
    add('買うときの値段を抑えたい', p, `当サイトの掲載価格で${yen(S[p].price)}と${yen(S[p === 'a' ? 'b' : 'a'].price)}で、${yen(Math.abs(a.price - b.price))}安い。`);
  }

  return out;
}

// ---- ひとことで言うと（大きな差の組み合わせから） ----
const TRAIT = {
  weight: ['軽い', '重い'],
  shock: ['衝撃吸収が小さい', '着地の衝撃をよくやわらげる'],
  softness: ['フォームが柔らかい', 'フォームが硬め'],
  returnFore: ['前足部の反発が小さめ', '前足部の反発が大きい'],
  foreStack: ['地面が近い', '前足部が厚い'],
  heelWidth: ['かかとが細い', 'かかとが広い'],
  flex: ['ソールが曲がりやすい', 'ソールが曲がりにくい'],
  grip: ['滑りやすい', '滑りにくい'],
  wear: ['すり減りにくい', 'すり減りやすい'],
  foreWidth: ['前足部が細い', '前足部が広い'],
  breath: ['通気性が低い', '通気性が高い'],
};
// 良い面を書く（悪い面は相手の良い面として書く）
const GOOD = { weight: 0, shock: 1, returnFore: 1, grip: 1, wear: 0, breath: 1, heelWidth: 1 };

function summary(a, b, M) {
  const S = { a, b };
  const traits = { a: [], b: [] };
  const order = Object.values(M).filter((m) => differs(m) && TRAIT[m.k]).sort((x, y) => Math.abs(y.pa - y.pb) - Math.abs(x.pa - x.pb));
  for (const m of order) {
    if (GOOD[m.k] != null) {
      const side = GOOD[m.k] === 1 ? sideHigh(m) : sideLow(m);
      traits[side].push(TRAIT[m.k][GOOD[m.k]]);
    } else {
      traits[sideHigh(m)].push(TRAIT[m.k][1]);
      traits[sideLow(m)].push(TRAIT[m.k][0]);
    }
  }
  const lines = [];
  const t = (side) => [...new Set(traits[side])].slice(0, 4).join('・');
  if (traits.a.length || traits.b.length) {
    const pa = traits.a.length ? `${kana(a)}は「${t('a')}」` : `${kana(a)}に目立つ強みはなく`;
    const pb = traits.b.length ? `${kana(b)}は「${t('b')}」` : `${kana(b)}に目立つ強みはない`;
    lines.push(`計測値で差がはっきり出たところだけを拾うと、${pa}、${pb}。`);
  }

  // 組み合わせで読む
  const st = M.foreStack, sh = M.shock, w = M.weight, fl = M.flex, rf = M.returnFore, so = M.softness;
  if (differs(st) && differs(sh) && sideHigh(st) === sideHigh(sh)) {
    const thick = sideHigh(st), thin = sideLow(st);
    let s = `前足部の厚さと衝撃吸収がそろって${kana(S[thick])}に傾いていて、フォームの量で着地を受け止める作り。${kana(S[thin])}は厚さを${r1(Math.abs(st.va - st.vb))}mm抑えて、地面に近い作りになっている。`;
    if (w && !differs(w)) s += `それでいて重さは${pair(w)}でほぼ同じなので、厚いほうが重さで損をしているわけではない。`;
    else if (differs(w) && sideLow(w) === thick) s += `しかも厚い${kana(S[thick])}のほうが${Math.abs(w.va - w.vb)}g軽い。`;
    lines.push(s);
  } else if (differs(st)) {
    lines.push(`前足部の厚さ（公表値）は${pair(st)}で、${kana(S[sideLow(st)])}のほうが地面に近い。`);
  }
  if (differs(fl) && differs(rf) && sideHigh(fl) === sideHigh(rf)) {
    lines.push(`${kana(S[sideHigh(fl)])}は曲げの硬さ（${pair(fl)}）と前足部の反発（${pair(rf)}）がどちらも上。曲がりにくいソールと反発の大きいフォームで、前に押し出す作りといえる。`);
  } else if (differs(fl) && differs(rf)) {
    lines.push(`曲げの硬さは${kana(S[sideHigh(fl)])}（${pair(fl)}）、前足部の反発は${kana(S[sideHigh(rf)])}（${pair(rf)}）が上。ソールの硬さで進むか、フォームの戻りで進むかの違いが出ている。`);
  }
  if (differs(so) && differs(rf) && sideLow(so) === sideHigh(rf)) {
    lines.push(`${kana(S[sideHigh(rf)])}はフォームが柔らかい（アスカーC ${pair(so)}）のに反発も大きく、沈んでから戻る感覚が出やすい組み合わせ。`);
  }
  return lines;
}

// 差がほとんどない項目（選ぶ理由にならない）
function sameList(a, b, M) {
  const out = Object.values(M).filter((m) => m.tier === 'same').map((m) => `${m.label}（${pair(m)}）`);
  if (a.drop != null && b.drop != null && Math.abs(a.drop - b.drop) < 3) out.push(`ドロップ（${a.drop}mm対${b.drop}mm）`);
  return out;
}

// ---- どちらも違うと思ったら：同じブランド・同じ区分で、相手の強みを持つ靴 ----
const SCENE_KEYS = [
  ['shock', 'foreStack'],
  ['returnFore'],
  ['grip'],
  ['yenPerKm'],
  ['foreWidth'],
];
const SCENE_WORD = { shock: 'クッションの厚さ', returnFore: '前足部の反発', grip: '滑りにくさ', yenPerKm: '1kmあたりの安さ', foreWidth: '前足部の広さ' };

function alternatives(list, a, b, M, picks) {
  const out = [];
  for (const [self, other] of [['a', 'b'], ['b', 'a']]) {
    const me = self === 'a' ? a : b;
    for (const keys of SCENE_KEYS) {
      const ms = keys.map((k) => M[k]).filter(differs);
      if (!ms.length || !ms.every((m) => better(m) === other || (m.dir == null && sideHigh(m) === other))) continue;
      // 同じブランド・同じ区分で、me より keys の向きで上回る靴
      const cands = list.filter((s) => s.brand === me.brand && s.category === me.category && s.id !== a.id && s.id !== b.id && s.rating != null)
        .map((s) => {
          let wins = 0, total = 0;
          const nums = [];
          for (const k of keys) {
            const v = valueOf(s, k), mv = valueOf(me, k);
            if (!ok(k, v) || !ok(k, mv)) continue;
            total++;
            const up = MET[k].dir === 'low' ? v < mv : v > mv;
            if (up) { wins++; nums.push(`${MET[k].label} ${fmt(k, v)}（${kana(me)}は${fmt(k, mv)}）`); }
          }
          return { s, wins, total, nums };
        })
        .filter((c) => c.total && c.wins === c.total)
        .sort((x, y) => (y.s.rating ?? 0) - (x.s.rating ?? 0));
      if (cands.length) {
        const c = cands[0];
        out.push({ brand: me.brand, from: kana(me), want: SCENE_WORD[keys[0]], to: c.s, toName: kana(c.s), why: c.nums.join('、') });
        break; // 1足につき1件
      }
    }
  }
  return out;
}

function judge(list, a, b) {
  const M = metrics(list, a, b);
  return {
    kanaA: kana(a),
    kanaB: kana(b),
    metrics: M,
    summary: summary(a, b, M),
    scenes: scenes(list, a, b, M),
    same: sameList(a, b, M),
    alternatives: alternatives(list, a, b, M),
  };
}

module.exports = { judge, stack, kana, MET, fmt };
