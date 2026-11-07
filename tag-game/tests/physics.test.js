import test from 'node:test';
import assert from 'node:assert/strict';
import { moveEntity } from '../src/core/physics.js';
import { makeEntity, ARENA, near } from './helpers.js';

test('右へ speed*dt 進む', () => {
  const e = moveEntity(makeEntity(), { x: 1, y: 0 }, 180, 1 / 60, ARENA, []);
  assert.ok(near(e.pos.x, 103));
  assert.ok(near(e.pos.y, 100));
});

test('斜め移動は正規化される', () => {
  const e = moveEntity(makeEntity(), { x: 1, y: 1 }, 100, 1, ARENA, []);
  const d = Math.hypot(e.pos.x - 100, e.pos.y - 100);
  assert.ok(near(d, 100, 1e-6));
});

test('壁を越えない（半径分内側で止まる）', () => {
  let e = makeEntity({ pos: { x: 20, y: 20 } });
  for (let i = 0; i < 60; i++) e = moveEntity(e, { x: -1, y: -1 }, 300, 1 / 60, ARENA, []);
  assert.ok(near(e.pos.x, 14) && near(e.pos.y, 14));
  let f = makeEntity({ pos: { x: 940, y: 580 } });
  for (let i = 0; i < 60; i++) f = moveEntity(f, { x: 1, y: 1 }, 300, 1 / 60, ARENA, []);
  assert.ok(near(f.pos.x, 946) && near(f.pos.y, 586));
});

test('障害物にめり込まない（正面・角・斜め）', () => {
  const ob = [{ x: 200, y: 200, w: 100, h: 100 }];
  const cases = [
    [{ x: 150, y: 250 }, { x: 1, y: 0 }],
    [{ x: 150, y: 150 }, { x: 1, y: 1 }],
    [{ x: 250, y: 350 }, { x: 0, y: -1 }],
    [{ x: 350, y: 180 }, { x: -1, y: 1 }],
  ];
  for (const [pos, dir] of cases) {
    let e = makeEntity({ pos });
    for (let i = 0; i < 120; i++) e = moveEntity(e, dir, 378, 1 / 60, ARENA, ob);
    const cx = Math.max(200, Math.min(e.pos.x, 300));
    const cy = Math.max(200, Math.min(e.pos.y, 300));
    assert.ok(Math.hypot(e.pos.x - cx, e.pos.y - cy) >= 14 - 1e-6, `めり込み: ${JSON.stringify(e.pos)}`);
  }
});

test('障害物に沿って滑る（壁にぶつかっても斜め成分で進む）', () => {
  const ob = [{ x: 200, y: 0, w: 50, h: 600 }];
  let e = makeEntity({ pos: { x: 180, y: 100 } });
  for (let i = 0; i < 30; i++) e = moveEntity(e, { x: 1, y: 1 }, 180, 1 / 60, ARENA, ob);
  assert.ok(e.pos.y > 140);
});

test('dir=0 なら動かない・vel=0、入力を変更しない', () => {
  const e0 = makeEntity();
  const e = moveEntity(e0, { x: 0, y: 0 }, 180, 1 / 60, ARENA, []);
  assert.deepEqual(e.pos, { x: 100, y: 100 });
  assert.deepEqual(e.vel, { x: 0, y: 0 });
  moveEntity(e0, { x: 1, y: 0 }, 180, 1, ARENA, []);
  assert.deepEqual(e0.pos, { x: 100, y: 100 });
});
