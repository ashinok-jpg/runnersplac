// テスト共通ヘルパ
export const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
export function makeEntity(over = {}) {
  return {
    id: 'cpu1', pos: { x: 100, y: 100 }, vel: { x: 0, y: 0 }, radius: 14,
    isIt: false, frozenUntil: 0, noTagBackId: null,
    stamina: { value: 100, exhausted: false }, mash: { taps: [] },
    dashMult: 1, safeTime: 0, color: '#888',
    ...over,
  };
}
export const ARENA = { w: 960, h: 600 };
