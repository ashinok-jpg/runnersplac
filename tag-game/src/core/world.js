// ワールド状態の生成と 1 ステップ更新。step は純粋関数（入力 world を変更しない）。
import { CONFIG } from '../config.js';
import { createRng } from './rng.js';
import { registerTap, countTaps, dashMultiplier } from './mash.js';
import { updateStamina, canDash } from './stamina.js';
import { moveEntity } from './physics.js';
import { resolveTags } from './tag.js';

export const ENTITY_IDS = ['player', 'cpu1', 'cpu2', 'cpu3'];
const NEUTRAL = { dir: { x: 0, y: 0 }, dashTap: false };
const EPS = 1e-9;

export function createWorld({ seed, duration = CONFIG.ROUND_SEC } = {}) {
  const rng = createRng(seed);
  const itIdx = Math.floor(rng.next() * ENTITY_IDS.length);
  const entities = ENTITY_IDS.map((id, i) => ({
    id,
    pos: { ...CONFIG.SPAWNS[id] },
    vel: { x: 0, y: 0 },
    radius: CONFIG.RADIUS,
    isIt: i === itIdx,
    frozenUntil: i === itIdx ? CONFIG.TAG_FREEZE_SEC : 0,
    noTagBackId: null,
    stamina: { value: CONFIG.STAMINA_MAX, exhausted: false },
    mash: { taps: [] },
    dashMult: 1,
    safeTime: 0,
    color: CONFIG.COLORS[id],
  }));
  return {
    time: 0,
    duration,
    arena: { w: CONFIG.ARENA_W, h: CONFIG.ARENA_H },
    obstacles: CONFIG.OBSTACLES.map((o) => ({ ...o })),
    entities,
    events: [],
    rngState: rng.state,
    over: false,
  };
}

const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

function stepEntity(e, input, world, dt, events, newTime) {
  const t = world.time;
  const dir = { x: sign(input.dir?.x ?? 0), y: sign(input.dir?.y ?? 0) };
  const frozen = t < e.frozenUntil;
  const moving = !frozen && (dir.x !== 0 || dir.y !== 0);

  const mash = !frozen && input.dashTap ? registerTap(e.mash, t) : e.mash;
  const taps = countTaps(mash, t);
  const dashing = moving && taps >= CONFIG.MASH_MIN_TAPS && canDash(e.stamina);
  const mult = dashing ? dashMultiplier(taps) : 1;

  const stamina = updateStamina(e.stamina, { dashing, mult, moving, dt });
  if (!e.stamina.exhausted && stamina.exhausted) events.push({ type: 'exhausted', id: e.id, time: newTime });

  const speed = CONFIG.BASE_SPEED
    * (e.isIt ? CONFIG.IT_SPEED_BONUS : 1)
    * mult
    * (stamina.exhausted ? CONFIG.EXHAUSTED_SPEED : 1);
  const moved = moving
    ? moveEntity(e, dir, speed, dt, world.arena, world.obstacles)
    : { ...e, vel: { x: 0, y: 0 } };

  return {
    ...moved,
    mash,
    stamina,
    dashMult: mult,
    safeTime: e.isIt ? e.safeTime : e.safeTime + dt,
  };
}

export function step(world, inputsById = {}, dt = 1 / CONFIG.FPS) {
  if (world.over) return world;
  const newTime = world.time + dt;
  const events = [...world.events];
  const moved = world.entities.map((e) => stepEntity(e, inputsById[e.id] || NEUTRAL, world, dt, events, newTime));
  const tagged = resolveTags(moved, newTime);
  events.push(...tagged.events);
  return {
    ...world,
    time: newTime,
    entities: tagged.entities,
    events,
    over: newTime >= world.duration - EPS,
  };
}
