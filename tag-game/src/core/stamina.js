// 体力の増減・バテ判定（§1.2）。
import { CONFIG } from '../config.js';

export function canDash(stamina) {
  return !stamina.exhausted && stamina.value > 0;
}

export function updateStamina(stamina, { dashing, mult = 1, moving, dt }) {
  let value = stamina.value;
  let exhausted = stamina.exhausted;
  if (dashing && canDash(stamina)) {
    value -= CONFIG.STAMINA_DRAIN_PER_SEC * mult * dt;
  } else {
    value += CONFIG.STAMINA_REGEN_PER_SEC * (moving ? 1 : CONFIG.STAMINA_IDLE_REGEN_MULT) * dt;
  }
  value = Math.min(CONFIG.STAMINA_MAX, Math.max(0, value));
  if (value <= 0) exhausted = true;
  else if (exhausted && value >= CONFIG.STAMINA_RECOVER_THRESHOLD) exhausted = false;
  return { value, exhausted };
}
