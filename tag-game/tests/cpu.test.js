import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { createRng } from '../src/core/rng.js';
import { decide } from '../src/ai/cpu.js';
import { CONFIG } from '../src/config.js';
import { ranking } from '../src/core/scoring.js';
import { simulate } from './sim.js';

// 鬼(player)と逃げる側(cpu1)を近くに置き、他 2 体は遠くに置いた world
function scenario({ itPos, runnerPos, runnerStamina = 100, itStamina = 100, time = 5 }) {
  const w = createWorld({ seed: 1 });
  const entities = w.entities.map((e) => ({ ...e, isIt: false, frozenUntil: 0, noTagBackId: null }));
  entities[0] = { ...entities[0], pos: itPos, isIt: true, stamina: { value: itStamina, exhausted: false } };
  entities[1] = { ...entities[1], pos: runnerPos, stamina: { value: runnerStamina, exhausted: false } };
  entities[2] = { ...entities[2], pos: { x: 900, y: 550 } };
  entities[3] = { ...entities[3], pos: { x: 900, y: 50 } };
  return { ...w, obstacles: [], entities, time };
}
const dot = (a, b) => a.x * b.x + a.y * b.y;

test('Input の形を返す', () => {
  const inp = decide(createWorld({ seed: 1 }), 'cpu1', createRng(1));
  assert.ok([-1, 0, 1].includes(inp.dir.x) && [-1, 0, 1].includes(inp.dir.y));
  assert.equal(typeof inp.dashTap, 'boolean');
});

test('逃げる側は鬼から離れる方向へ動く', () => {
  const w = scenario({ itPos: { x: 400, y: 300 }, runnerPos: { x: 500, y: 300 } });
  const inp = decide(w, 'cpu1', createRng(1));
  assert.ok(dot(inp.dir, { x: 1, y: 0 }) > 0);
});

test('逃げる側は壁際でも壁に突っ込まない', () => {
  const w = scenario({ itPos: { x: 860, y: 300 }, runnerPos: { x: 940, y: 300 } });
  const inp = decide(w, 'cpu1', createRng(1));
  assert.notEqual(inp.dir.x, 1);
  assert.ok(inp.dir.x !== 0 || inp.dir.y !== 0, '止まらない');
});

test('鬼は最も近い相手へ向かう', () => {
  const w = scenario({ itPos: { x: 400, y: 300 }, runnerPos: { x: 400, y: 450 } });
  const inp = decide(w, 'player', createRng(1));
  assert.ok(dot(inp.dir, { x: 0, y: 1 }) > 0);
});

test('鬼はタッチ返し禁止の相手を追わない', () => {
  const w = scenario({ itPos: { x: 400, y: 300 }, runnerPos: { x: 400, y: 350 } });
  w.entities[0] = { ...w.entities[0], noTagBackId: 'cpu1', frozenUntil: w.time + 0.5 };
  w.entities[2] = { ...w.entities[2], pos: { x: 100, y: 300 } };
  const inp = decide(w, 'player', createRng(1));
  assert.ok(inp.dir.x < 0);
});

function tapRate(w, id, n = 600) {
  const rng = createRng(9);
  let taps = 0;
  for (let i = 0; i < n; i++) if (decide({ ...w, time: w.time + i / 60 }, id, rng).dashTap) taps++;
  return taps / (n / 60);
}

test('逃げる側: 鬼が近く体力十分なら 5〜7 回/秒 前後で連打、遠ければ連打しない', () => {
  const close = scenario({ itPos: { x: 400, y: 300 }, runnerPos: { x: 500, y: 300 } });
  const r = tapRate(close, 'cpu1');
  assert.ok(r >= 4.5 && r <= 7.5, `連打 ${r}/s`);
  const far = scenario({ itPos: { x: 100, y: 300 }, runnerPos: { x: 700, y: 300 } });
  assert.equal(tapRate(far, 'cpu1'), 0);
});

test('体力 < 20 なら連打しない（温存）', () => {
  const w = scenario({ itPos: { x: 400, y: 300 }, runnerPos: { x: 450, y: 300 }, runnerStamina: 15 });
  assert.equal(tapRate(w, 'cpu1'), 0);
  const w2 = scenario({ itPos: { x: 400, y: 300 }, runnerPos: { x: 450, y: 300 }, itStamina: 15 });
  assert.equal(tapRate(w2, 'player'), 0);
});

test('鬼: 距離 < 200 かつ体力 > 30 で連打', () => {
  const w = scenario({ itPos: { x: 400, y: 300 }, runnerPos: { x: 550, y: 300 } });
  assert.ok(tapRate(w, 'player') > 3);
});

test('反応遅延: CPU_REACTION_MS 以内は前回の方向を保つ', () => {
  const w = scenario({ itPos: { x: 400, y: 300 }, runnerPos: { x: 500, y: 300 } });
  const prev = { dir: { x: -1, y: 0 }, dashTap: false, decidedAt: w.time - CONFIG.CPU_REACTION_MS / 2000 };
  assert.deepEqual(decide(w, 'cpu1', createRng(1), prev).dir, { x: -1, y: 0 });
  const old = { ...prev, decidedAt: w.time - CONFIG.CPU_REACTION_MS / 1000 - 0.01 };
  assert.notDeepEqual(decide(w, 'cpu1', createRng(1), old).dir, { x: -1, y: 0 });
});

test('シミュ: 1 ラウンドで鬼交代が 3 回以上起き、勝ち方が極端でない', () => {
  const winners = {};
  let totalTags = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const end = simulate(seed);
    totalTags += end.events.filter((e) => e.type === 'tag').length;
    const top = ranking(end.entities)[0].id;
    winners[top] = (winners[top] || 0) + 1;
  }
  assert.ok(totalTags / 20 >= 3, `平均交代 ${totalTags / 20}`);
  for (const id of Object.keys(winners)) assert.ok(winners[id] <= 14, `${id} が勝ちすぎ ${JSON.stringify(winners)}`);
});

test('scoring.ranking: safeTime 降順、同点は同順位', () => {
  const r = ranking([
    { id: 'a', safeTime: 10, isIt: false },
    { id: 'b', safeTime: 30, isIt: false },
    { id: 'c', safeTime: 10, isIt: true },
  ]);
  assert.deepEqual(r.map((x) => [x.id, x.rank]), [['b', 1], ['a', 2], ['c', 2]]);
  assert.equal(r[2].isIt, true);
});
