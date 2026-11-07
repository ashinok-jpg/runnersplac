import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../src/core/world.js';
import { createRng } from '../src/core/rng.js';
import { CONFIG } from '../src/config.js';
import { simulate } from './sim.js';

const IDS = ['player', 'cpu1', 'cpu2', 'cpu3'];

export function assertInvariants(world) {
  const its = world.entities.filter((e) => e.isIt);
  assert.equal(its.length, 1, `鬼が ${its.length} 人 (t=${world.time})`);
  for (const e of world.entities) {
    assert.ok(e.stamina.value >= 0 && e.stamina.value <= CONFIG.STAMINA_MAX, `体力範囲外 ${e.stamina.value}`);
    const { x, y } = e.pos;
    assert.ok(x >= e.radius - 1e-6 && x <= world.arena.w - e.radius + 1e-6, `x はみ出し ${x}`);
    assert.ok(y >= e.radius - 1e-6 && y <= world.arena.h - e.radius + 1e-6, `y はみ出し ${y}`);
    for (const o of world.obstacles) {
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      assert.ok(Math.hypot(x - cx, y - cy) >= e.radius - 1e-6, `${e.id} が障害物にめり込み`);
    }
  }
}

test('rng: 同じシードは同じ列、[0,1)', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 100; i++) {
    const v = a.next();
    assert.equal(v, b.next());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(createRng(1).next(), createRng(2).next());
});

test('createWorld: §4.1 の形、4 体・鬼 1 人・障害物 4〜6 個', () => {
  const w = createWorld({ seed: 1 });
  assert.equal(w.time, 0);
  assert.equal(w.duration, CONFIG.ROUND_SEC);
  assert.deepEqual(w.arena, { w: CONFIG.ARENA_W, h: CONFIG.ARENA_H });
  assert.deepEqual(w.entities.map((e) => e.id), IDS);
  assert.ok(w.obstacles.length >= 4 && w.obstacles.length <= 6);
  assert.equal(w.over, false);
  assertInvariants(w);
});

test('createWorld: シードで最初の鬼が変わる（全員が鬼になり得る）', () => {
  const seen = new Set();
  for (let s = 1; s <= 40; s++) seen.add(createWorld({ seed: s }).entities.find((e) => e.isIt).id);
  assert.equal(seen.size, 4);
});

test('createWorld: duration を指定できる（?round=5 用）', () => {
  assert.equal(createWorld({ seed: 1, duration: 5 }).duration, 5);
});

test('step は純粋関数（入力 world を変更しない）', () => {
  const w = createWorld({ seed: 3 });
  const snap = JSON.stringify(w);
  step(w, { player: { dir: { x: 1, y: 0 }, dashTap: true } }, 1 / 60);
  assert.equal(JSON.stringify(w), snap);
});

test('step: 入力どおりにプレイヤーが動く、時間が進む', () => {
  let w = createWorld({ seed: 5 });
  const start = w.entities[0].pos.x;
  for (let i = 0; i < 90; i++) w = step(w, { player: { dir: { x: 1, y: 0 }, dashTap: false } }, 1 / 60);
  assert.ok(Math.abs(w.time - 1.5) < 1e-9);
  assert.notEqual(w.entities[0].pos.x, start);
});

test('step: 連打でダッシュ倍率 > 1、体力が減る。連打し続けるとバテる', () => {
  let w = createWorld({ seed: 2 });
  let sawDash = false, sawExhausted = false;
  for (let i = 0; i < 60 * 10; i++) {
    const tap = i % 6 === 0; // 10 回/秒
    w = step(w, { player: { dir: { x: i % 240 < 120 ? 1 : -1, y: 0 }, dashTap: tap } }, 1 / 60);
    const p = w.entities[0];
    if (p.dashMult > 1 && p.stamina.value < 100) sawDash = true;
    if (p.stamina.exhausted) { sawExhausted = true; break; }
  }
  assert.ok(sawDash, 'ダッシュしなかった');
  assert.ok(sawExhausted, 'バテなかった');
  assert.ok(w.events.some((e) => e.type === 'exhausted' && e.id === 'player'));
});

test('step: 鬼でなかった時間が safeTime に溜まり、duration で over', () => {
  let w = createWorld({ seed: 4, duration: 2 });
  while (!w.over) w = step(w, {}, 1 / 60);
  assert.ok(Math.abs(w.time - 2) < 1e-6);
  const total = w.entities.reduce((s, e) => s + e.safeTime, 0);
  assert.ok(Math.abs(total - 2 * 3) < 1e-6, '鬼以外 3 人分の時間の合計');
  const w2 = step(w, {}, 1 / 60);
  assert.equal(w2.time, w.time, 'over 後は進まない');
});

test('シミュレーション: シード 1〜20、CPU 4 体 60 秒で不変条件が保たれ、平均交代回数 3〜15', () => {
  let totalTags = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const end = simulate(seed, { onStep: assertInvariants });
    totalTags += end.events.filter((e) => e.type === 'tag').length;
  }
  const avg = totalTags / 20;
  assert.ok(avg >= 3 && avg <= 15, `平均交代回数 ${avg}`);
});
