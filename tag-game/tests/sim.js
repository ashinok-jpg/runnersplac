// world.test / cpu.test 共通: CPU 4 体で 1 ラウンドを回すシミュレーション
import { createWorld, step } from '../src/core/world.js';
import { createRng } from '../src/core/rng.js';
import { decide } from '../src/ai/cpu.js';
import { CONFIG } from '../src/config.js';

export function simulate(seed, { onStep } = {}) {
  let world = createWorld({ seed });
  const rng = createRng(seed * 7919 + 13);
  const prev = {};
  const dt = 1 / CONFIG.FPS;
  let guard = 0;
  while (!world.over) {
    const inputs = {};
    for (const e of world.entities) {
      inputs[e.id] = decide(world, e.id, rng, prev[e.id]);
      prev[e.id] = inputs[e.id];
    }
    world = step(world, inputs, dt);
    if (onStep) onStep(world);
    if (++guard > CONFIG.FPS * (CONFIG.ROUND_SEC + 5)) throw new Error('ラウンドが終わらない');
  }
  return world;
}
