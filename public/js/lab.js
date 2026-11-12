// シューズ実験室（/lab）
// ボールを落とす: 跳ね返る高さ = 落とした高さ × 前足部のエネルギーリターン
// 曲げて離す: 曲げる力は計測値。ボールの飛距離はその力から計算したイメージ
(function () {
  const { items, pick } = window.LAB;
  const byId = Object.fromEntries(items.map((s) => [s.id, s]));
  const COLORS = ['#ece6da', '#ff5a26', '#3fb27f'];
  const DEFAULTS = {
    ret: ['metaspeedray', 'novablast5', 'waveinspire20'],
    flex: ['primex2strung', 'metaspeedray', 'japan9'],
  };
  const G = 9.8;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- 靴を選ぶ ----------
  const chosen = { ret: [], flex: [] };
  function initPicks(kind, onChange) {
    const box = document.querySelector(`.lab-picks[data-kind="${kind}"]`);
    const pool = items.filter((s) => s[kind] != null);
    const fromUrl = pick.filter((id) => byId[id] && byId[id][kind] != null);
    const defaults = DEFAULTS[kind].filter((id) => byId[id] && byId[id][kind] != null);
    // 1足だけ指定されたら、残りはいつもの比較相手で埋める
    let start = fromUrl.length >= 2 ? fromUrl : [...fromUrl, ...defaults.filter((id) => !fromUrl.includes(id))].slice(0, 3);
    if (start.length < 2) start = pool.slice(0, 2).map((s) => s.id);
    const brands = [...new Set(pool.map((s) => s.brand))];
    for (let i = 0; i < 3; i++) {
      const label = document.createElement('label');
      label.className = 'lab-pick';
      label.style.setProperty('--c', COLORS[i]);
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', `${i + 1}足目`);
      if (i === 2) sel.add(new Option('（なし）', ''));
      brands.forEach((b) => {
        const og = document.createElement('optgroup');
        og.label = b;
        pool.filter((s) => s.brand === b).forEach((s) => og.appendChild(new Option(s.name, s.id)));
        sel.appendChild(og);
      });
      sel.value = start[i] || '';
      sel.addEventListener('change', () => { read(true); onChange(); });
      label.appendChild(sel);
      box.appendChild(label);
    }
    function read(save) {
      chosen[kind] = [...box.querySelectorAll('select')].map((s) => s.value).filter(Boolean);
      if (!save) return;
      const url = new URL(location.href);
      url.searchParams.set('shoes', chosen[kind].join(','));
      history.replaceState(null, '', url);
    }
    read();
  }

  function setupCanvas(cv, height) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.parentElement.clientWidth;
    cv.style.height = height + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(height * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h: height };
  }
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // 靴の写真（読み込めたら描き直す）
  const photos = {};
  function photo(s, redraw) {
    if (!s || !s.image) return null;
    let p = photos[s.id];
    if (!p) {
      p = photos[s.id] = { img: new Image(), ok: false };
      p.img.onload = () => { p.ok = true; redraw(); };
      p.img.src = s.image;
    }
    return p.ok ? p.img : null;
  }
  // 白い枠の中に、縦横比を保って収める
  function drawPhoto(ctx, img, x, y, w, h, color) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, w, h);
    if (img) {
      const k = Math.min((w - 6) / img.naturalWidth, (h - 6) / img.naturalHeight);
      const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
      ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    }
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 3);
  }

  // ---------- ボールを落とす ----------
  const drop = { cv: document.getElementById('dropCanvas'), lanes: [], raf: 0, last: 0 };
  // 衝撃吸収（SA）→ へこむ深さ(px)。SA が大きいほど深く沈む
  const dipOf = (sa) => (sa == null ? 10 : 5 + clamp((sa - 95) / 75, 0, 1) * 22);
  const softWord = (sa) => (sa == null ? '' : sa >= 150 ? 'ふかふか' : sa >= 130 ? 'やわらかめ' : sa >= 115 ? 'ふつう' : 'かため');

  function dropReset() {
    drop.lanes = chosen.ret.map((id, i) => ({
      s: byId[id], color: COLORS[i], h: 1, v: 0, phase: 'ready', tc: 0, vin: 0, dip: 0, peaks: [], done: false,
    }));
    drop.size = setupCanvas(drop.cv, 440);
    dropDraw();
    dropResult(false);
  }
  function dropStep(dt) {
    const T = 0.09; // 接地の時間（見やすく長め）
    for (const L of drop.lanes) {
      if (L.done || L.phase === 'ready') continue;
      const er = L.s.ret / 100;
      if (L.phase === 'air') {
        L.v -= G * dt;
        L.h += L.v * dt;
        if (L.v < 0 && L.top == null) { L.top = L.h; if (L.peaks.length < 6 && L.bounces) L.peaks.push(L.peaks.length ? L.h : er); } // 1回目の高さは計測値どおりに表示
        if (L.h <= 0 && L.v < 0) { L.phase = 'contact'; L.vin = -L.v; L.tc = 0; L.h = 0; }
      } else if (L.phase === 'contact') {
        L.tc += dt;
        const depth = dipOf(L.s.shock) * Math.min(1, L.vin / 4.4);
        L.dip = depth * Math.sin(Math.PI * clamp(L.tc / T, 0, 1));
        if (L.tc >= T) {
          L.dip = 0;
          L.v = L.vin * Math.sqrt(er);
          L.bounces = (L.bounces || 0) + 1;
          L.top = null;
          if (L.v < 0.35) { L.done = true; L.h = 0; L.v = 0; } else L.phase = 'air';
        }
      }
    }
  }
  function dropDraw() {
    const { ctx, w, h } = drop.size;
    ctx.clearRect(0, 0, w, h);
    const n = Math.max(1, drop.lanes.length);
    const left = 34, laneW = (w - left) / n;
    const foamTop = h - 158, foamH = 34, r = 11;
    const imgTop = h - 104, imgH = 74;
    const top = 26, scale = foamTop - r * 2 - top; // 1m のピクセル数
    // 目盛り
    ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = css('--muted') || '#9a9384';
    ctx.strokeStyle = 'rgba(236,230,218,.10)';
    ctx.textAlign = 'right';
    for (const cm of [0, 25, 50, 75, 100]) {
      const yy = foamTop - (cm / 100) * scale;
      ctx.fillText(cm + 'cm', left - 4, yy + 4);
      ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(w, yy); ctx.stroke();
    }
    drop.lanes.forEach((L, i) => {
      const cx = left + laneW * i + laneW / 2;
      const fw = Math.min(laneW - 16, 150);
      // フォーム（ボールの下だけ沈む）
      ctx.fillStyle = L.color + '33';
      ctx.strokeStyle = L.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - fw / 2, foamTop + foamH);
      ctx.lineTo(cx - fw / 2, foamTop);
      const steps = 24;
      for (let k = 0; k <= steps; k++) {
        const x = cx - fw / 2 + (fw * k) / steps;
        const d = Math.abs(x - cx);
        const sink = L.dip * Math.exp(-(d * d) / (2 * (r * 1.4) ** 2));
        ctx.lineTo(x, foamTop + sink);
      }
      ctx.lineTo(cx + fw / 2, foamTop + foamH);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 1回目に跳ね返った高さ
      if (L.peaks.length) {
        const y = foamTop - L.peaks[0] * scale;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = L.color;
        ctx.beginPath(); ctx.moveTo(cx - fw / 2, y); ctx.lineTo(cx + fw / 2, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = L.color;
        ctx.textAlign = 'right';
        ctx.font = 'bold 13px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillText(Math.round(L.peaks[0] * 100) + 'cm', cx + fw / 2, y - 6);
      }
      // ボール
      const by = foamTop + L.dip - r - L.h * scale;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      const sh = clamp(1 - L.h, 0.2, 1);
      ctx.beginPath(); ctx.ellipse(cx, foamTop + foamH + 8, r * sh, 3 * sh, 0, 0, Math.PI * 2); ctx.fill();
      const squash = L.phase === 'contact' ? 1 - (L.dip / 30) * 0.35 : 1;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#17150f'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, by + r * (1 - squash), r / squash, r * squash, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = L.color;
      ctx.beginPath(); ctx.ellipse(cx - 3, by - 3 + r * (1 - squash), 3, 3, 0, 0, Math.PI * 2); ctx.fill();
      // 写真と名前
      const pw = Math.min(fw, 130);
      drawPhoto(ctx, photo(L.s, () => { if (!drop.lanes.some((x) => x.phase === 'air' || x.phase === 'contact')) dropDraw(); }), cx - pw / 2, imgTop, pw, imgH, L.color);
      ctx.fillStyle = css('--text') || '#ece6da';
      ctx.textAlign = 'center';
      ctx.font = '12px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(fit(ctx, L.s.name, laneW - 6), cx, h - 12);
    });
  }
  function fit(ctx, t, max) {
    if (ctx.measureText(t).width <= max) return t;
    while (t.length > 2 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  }
  function dropResult(show) {
    const ol = document.getElementById('dropResult');
    if (!show) { ol.innerHTML = ''; return; }
    const rows = [...drop.lanes].sort((a, b) => b.s.ret - a.s.ret);
    ol.innerHTML = rows.map((L) => `<li style="--c:${L.color}"><a href="/shoes/${L.s.id}">${esc(L.s.name)}</a>
      <span><b>${Math.round(L.s.ret)}cm</b> 跳ね返る（反発 ${L.s.ret}%）${L.s.shock != null ? ` ・ 沈み込み ${softWord(L.s.shock)}（衝撃吸収 ${L.s.shock}）` : ''}</span></li>`).join('');
  }
  function dropGo() {
    cancelAnimationFrame(drop.raf);
    dropReset();
    drop.lanes.forEach((L) => { L.phase = 'air'; L.h = 1; L.v = 0; });
    drop.last = performance.now();
    const slow = document.getElementById('dropSlow');
    const loop = (t) => {
      const real = Math.min(0.05, (t - drop.last) / 1000);
      drop.last = t;
      const rate = slow.checked ? 0.4 : 1;
      const sub = 8;
      for (let k = 0; k < sub; k++) dropStep((real * rate) / sub);
      dropDraw();
      if (drop.lanes.every((L) => L.done)) { dropResult(true); return; }
      if (drop.lanes.some((L) => L.peaks.length)) dropResult(true);
      drop.raf = requestAnimationFrame(loop);
    };
    drop.raf = requestAnimationFrame(loop);
  }

  // ---------- 曲げて離す ----------
  const bend = { cv: document.getElementById('bendCanvas'), lanes: [], theta: 0, raf: 0, state: 'idle' };
  const MAX_DEG = 40, PIVOT = 0.66;
  const distOf = (F, deg) => 4 * F * (deg / 30) ** 2; // 飛距離のイメージ(cm)
  // 横から見た靴（かかと x=0、つま先 x=1、y は上向き）
  const SOLE = [[0, 0.03], [0.03, 0], [0.9, 0], [0.97, 0.02], [1, 0.05], [1, 0.09], [0, 0.11]];
  const UPPER = [[0.01, 0.11], [0.0, 0.2], [0.03, 0.3], [0.1, 0.36], [0.2, 0.33], [0.3, 0.31], [0.4, 0.35], [0.47, 0.33],
    [0.62, 0.24], [0.8, 0.17], [0.93, 0.13], [0.99, 0.09]];
  function densify(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.abs(x2 - x1) / 0.02));
      for (let k = 0; k < n; k++) out.push([x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  const SOLE_D = densify([...SOLE, SOLE[0]]), UPPER_D = densify(UPPER);
  function bendPt([x, y], rad) {
    const z0 = PIVOT - 0.07, z1 = PIVOT + 0.07;
    const a = rad * clamp((x - z0) / (z1 - z0), 0, 1);
    if (!a) return [x, y];
    const dx = x - PIVOT, dy = y;
    return [PIVOT + dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  }
  function bendReset() {
    cancelAnimationFrame(bend.raf);
    bend.lanes = chosen.flex.map((id, i) => ({ s: byId[id], color: COLORS[i], th: 0, w: 0, ball: null, launched: false, from: 0 }));
    bend.theta = 0;
    bend.state = 'idle';
    bend.size = setupCanvas(bend.cv, Math.max(2, bend.lanes.length) * 130 + 10);
    bendDraw();
    bendResult(false);
  }
  function geom(i) {
    const { w } = bend.size;
    const laneH = 130, y0 = 10 + laneH * i;
    const len = Math.min(w * 0.38, 200);
    const ground = y0 + laneH - 28;
    const heelX = 14;
    const toeX = heelX + len;
    const pxPerCm = (w - toeX - 26) / 170;
    return { y0, laneH, len, ground, heelX, toeX, pxPerCm };
  }
  function bendDraw() {
    const { ctx, w, h } = bend.size;
    ctx.clearRect(0, 0, w, h);
    bend.lanes.forEach((L, i) => {
      const g = geom(i);
      const deg = L.th;
      const rad = (deg * Math.PI) / 180;
      const P = ([x, y]) => [g.heelX + x * g.len, g.ground - y * g.len];
      // 地面と目盛り
      ctx.strokeStyle = 'rgba(236,230,218,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8, g.ground + 0.5); ctx.lineTo(w - 8, g.ground + 0.5); ctx.stroke();
      ctx.fillStyle = css('--muted') || '#9a9384';
      ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (const cm of [50, 100, 150]) {
        const x = g.toeX + 8 + cm * g.pxPerCm;
        if (x > w - 10) continue;
        ctx.fillRect(x, g.ground, 1, 5);
        ctx.fillText(cm + 'cm', x, g.ground + 16);
      }
      // 靴
      const sole = SOLE_D.map((p) => P(bendPt(p, rad)));
      const upper = UPPER_D.map((p) => P(bendPt(p, rad)));
      ctx.fillStyle = L.color + '40';
      ctx.strokeStyle = L.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); upper.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2620';
      ctx.beginPath(); sole.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = L.color; ctx.stroke();
      // ボール
      const r = 8;
      let bx, by;
      if (L.ball) { bx = g.toeX + 8 + L.ball.x * g.pxPerCm; by = g.ground - r - L.ball.y * g.pxPerCm; }
      else { bx = g.toeX + r + 2; by = g.ground - r; }
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#17150f'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(Math.min(bx, w - r - 2), by, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = L.color;
      ctx.beginPath(); ctx.arc(Math.min(bx, w - r - 2) - 2, by - 2, 2.5, 0, Math.PI * 2); ctx.fill();
      // 文字
      ctx.textAlign = 'left';
      ctx.fillStyle = css('--text') || '#ece6da';
      ctx.font = 'bold 12px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(fit(ctx, L.s.name, w * 0.5), 12, g.y0 + 14);
      ctx.font = '12px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = css('--muted') || '#9a9384';
      const holdDeg = bend.state === 'hold' ? deg : L.from;
      const force = (L.s.flex * holdDeg) / 30;
      const txt = bend.state === 'hold' ? `${Math.round(deg)}° ・ 必要な力 ${force.toFixed(1)}N` : `曲げる力 ${L.s.flex}N（30°）`;
      ctx.textAlign = 'right';
      ctx.fillText(txt, w - 12, g.y0 + 14);
      if (L.ball && L.ball.landed) {
        ctx.fillStyle = L.color;
        ctx.font = 'bold 13px "IBM Plex Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(L.ball.x) + 'cm', Math.min(bx, w - 30), by - 14);
      }
    });
  }
  function bendResult(show) {
    const ol = document.getElementById('bendResult');
    if (!show) { ol.innerHTML = ''; return; }
    const rows = [...bend.lanes].sort((a, b) => b.s.flex - a.s.flex);
    ol.innerHTML = rows.map((L) => `<li style="--c:${L.color}"><a href="/shoes/${L.s.id}">${esc(L.s.name)}</a>
      <span>曲げる力 <b>${L.s.flex}N</b> ・ ${L.s.flex >= 25 ? 'かなり硬い（板が強い）' : L.s.flex >= 15 ? '硬め' : L.s.flex >= 10 ? 'ふつう' : 'よく曲がる'} ・ ボール ${Math.round(distOf(L.s.flex, L.from))}cm（イメージ）</span></li>`).join('');
  }
  function release() {
    if (bend.state !== 'hold') return;
    bend.state = 'run';
    bend.lanes.forEach((L) => { L.from = L.th; L.w = 0; L.ball = null; L.launched = false; });
    let last = performance.now();
    let shown = false;
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000) * 0.55;
      last = t;
      let busy = false;
      for (const L of bend.lanes) {
        const om = 2 * Math.PI * (1.2 + 0.09 * L.s.flex);
        for (let k = 0; k < 8; k++) {
          const d = dt / 8;
          const prev = L.th;
          L.w += (-om * om * L.th - 2 * 0.22 * om * L.w) * d;
          L.th += L.w * d;
          if (!L.launched && prev > 0 && L.th <= 0) {
            L.launched = true;
            const D = distOf(L.s.flex, L.from);
            const a = (35 * Math.PI) / 180;
            const v = Math.sqrt((D * 980) / Math.sin(2 * a));
            L.ball = { x: 0, y: 0, vx: v * Math.cos(a), vy: v * Math.sin(a), landed: D < 1 };
          }
          if (L.ball && !L.ball.landed) {
            L.ball.x += L.ball.vx * d;
            L.ball.y += L.ball.vy * d;
            L.ball.vy -= 980 * d;
            if (L.ball.y <= 0 && L.ball.vy < 0) { L.ball.y = 0; L.ball.landed = true; L.ball.x = distOf(L.s.flex, L.from); }
          }
        }
        if (Math.abs(L.th) > 0.3 || Math.abs(L.w) > 3 || !L.ball || !L.ball.landed) busy = true;
      }
      bendDraw();
      if (!shown && bend.lanes.every((L) => L.ball && L.ball.landed)) { shown = true; bendResult(true); }
      if (busy) bend.raf = requestAnimationFrame(loop);
      else { bend.state = 'idle'; bend.lanes.forEach((L) => (L.th = 0)); bendDraw(); }
    };
    bend.raf = requestAnimationFrame(loop);
  }
  function hold(deg) {
    if (bend.state === 'run') return;
    cancelAnimationFrame(bend.raf);
    bend.state = 'hold';
    bend.lanes.forEach((L) => { L.th = deg; L.ball = null; });
    bendDraw();
  }
  // つまんで引っぱる
  let dragY = null;
  bend.cv.addEventListener('pointerdown', (e) => {
    if (bend.state === 'run') return;
    dragY = e.clientY;
    bend.cv.setPointerCapture(e.pointerId);
    hold(0);
  });
  bend.cv.addEventListener('pointermove', (e) => {
    if (dragY == null) return;
    hold(clamp((dragY - e.clientY) / 3, 0, MAX_DEG));
  });
  const up = () => { if (dragY == null) return; dragY = null; release(); };
  bend.cv.addEventListener('pointerup', up);
  bend.cv.addEventListener('pointercancel', up);
  document.getElementById('bendGo').addEventListener('click', () => {
    if (bend.state === 'run') return;
    let d = 0;
    const step = () => {
      d = Math.min(30, d + 1.5);
      hold(d);
      if (d < 30) requestAnimationFrame(step);
      else setTimeout(release, 350);
    };
    step();
  });

  function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  // ---------- タブ ----------
  const tabs = [...document.querySelectorAll('.lab-tab')];
  function show(name) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    document.querySelectorAll('.lab-panel').forEach((p) => (p.hidden = p.dataset.panel !== name));
    if (name === 'drop') dropReset(); else bendReset();
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));

  initPicks('ret', dropReset);
  initPicks('flex', bendReset);
  document.getElementById('dropGo').addEventListener('click', dropGo);
  let rt, lastW = innerWidth;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => {
    if (innerWidth === lastW) return;
    lastW = innerWidth; if (!document.querySelector('[data-panel="drop"]').hidden) dropReset(); else bendReset(); }, 150); });
  show(new URL(location.href).searchParams.get('tab') === 'bend' ? 'bend' : 'drop');
})();
