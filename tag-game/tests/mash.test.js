import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTap, countTaps, dashMultiplier } from '../src/core/mash.js';
import { CONFIG } from '../src/config.js';

const tapsAt = (times) => times.reduce((m, t) => registerTap(m, t), { taps: [] });

test('窓内の押下数を数える', () => {
  const m = tapsAt([0, 0.2, 0.4, 0.6]);
  assert.equal(countTaps(m, 0.6), 4);
});

test('窓外（1000ms より前）の押下は数えない・捨てる', () => {
  const m = tapsAt([0, 0.2, 0.4, 1.3]);
  assert.equal(countTaps(m, 1.3), 2);
  assert.ok(m.taps.length <= 2, '古い押下は捨てる');
});

test('連打をやめると 1 秒以内にダッシュが終わる', () => {
  const m = tapsAt([0, 0.1, 0.2, 0.3, 0.4]);
  assert.ok(countTaps(m, 0.4) >= CONFIG.MASH_MIN_TAPS);
  assert.ok(countTaps(m, 1.35) < CONFIG.MASH_MIN_TAPS);
});

test('倍率: 4 未満は 1.0、以降 0.25 刻み、上限 2.0', () => {
  assert.equal(dashMultiplier(0), 1);
  assert.equal(dashMultiplier(3), 1);
  assert.equal(dashMultiplier(4), 1.25);
  assert.equal(dashMultiplier(5), 1.5);
  assert.equal(dashMultiplier(7), 2);
  assert.equal(dashMultiplier(20), CONFIG.DASH_MAX_MULT);
});

test('registerTap は入力を変更しない', () => {
  const m0 = { taps: [0.1] };
  registerTap(m0, 0.2);
  assert.deepEqual(m0, { taps: [0.1] });
});
