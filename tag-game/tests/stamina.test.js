import test from 'node:test';
import assert from 'node:assert/strict';
import { updateStamina, canDash } from '../src/core/stamina.js';
import { CONFIG } from '../src/config.js';
import { near } from './helpers.js';

const full = () => ({ value: CONFIG.STAMINA_MAX, exhausted: false });

test('ダッシュ中は DRAIN × 倍率 で減る', () => {
  const s = updateStamina(full(), { dashing: true, mult: 2, moving: true, dt: 1 });
  assert.ok(near(s.value, 100 - CONFIG.STAMINA_DRAIN_PER_SEC * 2));
});

test('移動中（非ダッシュ）は REGEN で回復、停止中は ×1.5', () => {
  const moving = updateStamina({ value: 50, exhausted: false }, { dashing: false, mult: 1, moving: true, dt: 1 });
  assert.ok(near(moving.value, 50 + CONFIG.STAMINA_REGEN_PER_SEC));
  const idle = updateStamina({ value: 50, exhausted: false }, { dashing: false, mult: 1, moving: false, dt: 1 });
  assert.ok(near(idle.value, 50 + CONFIG.STAMINA_REGEN_PER_SEC * CONFIG.STAMINA_IDLE_REGEN_MULT));
});

test('上限 100・下限 0 にクランプ', () => {
  assert.equal(updateStamina({ value: 99, exhausted: false }, { dashing: false, mult: 1, moving: false, dt: 1 }).value, 100);
  assert.equal(updateStamina({ value: 5, exhausted: false }, { dashing: true, mult: 2, moving: true, dt: 1 }).value, 0);
});

test('0 になるとバテ、30 まで回復するとバテ解除', () => {
  let s = updateStamina({ value: 1, exhausted: false }, { dashing: true, mult: 1, moving: true, dt: 1 });
  assert.equal(s.exhausted, true);
  assert.equal(canDash(s), false);
  s = updateStamina({ value: 29, exhausted: true }, { dashing: false, mult: 1, moving: true, dt: 1 / 60 });
  assert.equal(s.exhausted, true, '30 未満ならまだバテ');
  s = updateStamina({ value: 29.9, exhausted: true }, { dashing: false, mult: 1, moving: true, dt: 1 });
  assert.equal(s.exhausted, false);
  assert.equal(canDash(s), true);
});

test('バテ中に dashing=true でも減らない（回復する）', () => {
  const s = updateStamina({ value: 10, exhausted: true }, { dashing: true, mult: 2, moving: true, dt: 1 });
  assert.ok(s.value > 10);
});

test('入力オブジェクトを変更しない', () => {
  const s0 = full();
  updateStamina(s0, { dashing: true, mult: 2, moving: true, dt: 1 });
  assert.deepEqual(s0, full());
});
