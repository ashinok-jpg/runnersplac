// 連打カウンタ・ダッシュ倍率計算。時刻は秒。
import { CONFIG } from '../config.js';

const WINDOW = CONFIG.MASH_WINDOW_MS / 1000;
const inWindow = (tap, t) => tap <= t && t - tap < WINDOW;

export function registerTap(mash, t) {
  return { taps: [...mash.taps.filter((x) => inWindow(x, t)), t] };
}

export function countTaps(mash, t) {
  return mash.taps.filter((x) => inWindow(x, t)).length;
}

export function dashMultiplier(taps) {
  if (taps < CONFIG.MASH_MIN_TAPS) return 1;
  return Math.min(1 + (taps - (CONFIG.MASH_MIN_TAPS - 1)) * CONFIG.DASH_MULT_STEP, CONFIG.DASH_MAX_MULT);
}
