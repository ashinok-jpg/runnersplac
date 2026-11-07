// 2D ベクトル演算。全て新しいオブジェクトを返す。
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v, k) => ({ x: v.x * k, y: v.y * k });
export const len = (v) => Math.hypot(v.x, v.y);
export function normalize(v) {
  const l = len(v);
  return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
