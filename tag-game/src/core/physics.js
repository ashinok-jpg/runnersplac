// 移動・壁/障害物との衝突解決（円 vs 矩形を押し戻しで解決）。
import { normalize, scale, add } from './vector.js';

const ITERATIONS = 3;

function clampToArena(p, r, arena) {
  return {
    x: Math.min(arena.w - r, Math.max(r, p.x)),
    y: Math.min(arena.h - r, Math.max(r, p.y)),
  };
}

function pushOut(p, r, o) {
  const cx = Math.max(o.x, Math.min(p.x, o.x + o.w));
  const cy = Math.max(o.y, Math.min(p.y, o.y + o.h));
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= r) return p;
  if (d > 1e-9) return { x: cx + (dx / d) * r, y: cy + (dy / d) * r };
  // 中心が矩形の中: いちばん浅い辺から外へ出す
  const left = p.x - o.x, right = o.x + o.w - p.x, top = p.y - o.y, bottom = o.y + o.h - p.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: o.x - r, y: p.y };
  if (m === right) return { x: o.x + o.w + r, y: p.y };
  if (m === top) return { x: p.x, y: o.y - r };
  return { x: p.x, y: o.y + o.h + r };
}

export function resolveCollisions(pos, r, arena, obstacles) {
  let p = clampToArena(pos, r, arena);
  for (let i = 0; i < ITERATIONS; i++) {
    for (const o of obstacles) p = pushOut(p, r, o);
    p = clampToArena(p, r, arena);
  }
  return p;
}

export function moveEntity(entity, dir, speed, dt, arena, obstacles) {
  const vel = scale(normalize(dir), speed);
  const target = add(entity.pos, scale(vel, dt));
  return { ...entity, vel, pos: resolveCollisions(target, entity.radius, arena, obstacles) };
}
