// タッチ判定・鬼交代・硬直。1 ステップで交代は最大 1 回。
import { CONFIG } from '../config.js';
import { dist } from './vector.js';

export function resolveTags(entities, time) {
  const itIdx = entities.findIndex((e) => e.isIt);
  if (itIdx < 0) return { entities: entities.slice(), events: [] };
  const it = entities[itIdx];
  const frozen = time < it.frozenUntil;
  if (frozen) return { entities: entities.slice(), events: [] };

  let best = -1;
  let bestD = Infinity;
  entities.forEach((e, i) => {
    if (i === itIdx) return;
    const d = dist(e.pos, it.pos);
    if (d < e.radius + it.radius && d < bestD) {
      best = i;
      bestD = d;
    }
  });

  if (best < 0) {
    // 硬直が解けたらタッチ返し禁止も解除
    if (it.noTagBackId === null) return { entities: entities.slice(), events: [] };
    const out = entities.slice();
    out[itIdx] = { ...it, noTagBackId: null };
    return { entities: out, events: [] };
  }

  const target = entities[best];
  const out = entities.slice();
  out[itIdx] = { ...it, isIt: false, noTagBackId: null };
  out[best] = { ...target, isIt: true, frozenUntil: time + CONFIG.TAG_FREEZE_SEC, noTagBackId: it.id };
  return { entities: out, events: [{ type: 'tag', from: it.id, to: target.id, time }] };
}

// AI 用: 今この鬼がタッチできない相手か
export function isNoTagBack(it, otherId, time) {
  return it.noTagBackId === otherId && time < it.frozenUntil;
}
