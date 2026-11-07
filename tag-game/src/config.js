// 全パラメータ定数（DESIGN.md §5）。数値はここにだけ書く。
// §5 以外に追加した値は DECISIONS.md に理由を記録している。
export const CONFIG = {
  FPS: 60,
  ROUND_SEC: 60,
  ARENA_W: 960, ARENA_H: 600,
  RADIUS: 14,
  BASE_SPEED: 180,          // px/s
  IT_SPEED_BONUS: 1.05,
  EXHAUSTED_SPEED: 0.6,
  MASH_WINDOW_MS: 1000,
  MASH_MIN_TAPS: 4,
  DASH_MAX_MULT: 2.0,
  DASH_MULT_STEP: 0.25,     // 追加: 連打 1 回あたりの倍率上昇（§1.2 の式）
  STAMINA_MAX: 100,
  STAMINA_DRAIN_PER_SEC: 35,
  STAMINA_REGEN_PER_SEC: 15,
  STAMINA_IDLE_REGEN_MULT: 1.5,
  STAMINA_RECOVER_THRESHOLD: 30,
  TAG_FREEZE_SEC: 1.0,
  CPU_REACTION_MS: 200,
  COUNTDOWN_SEC: 3,

  // 追加: CPU の思考（§4.3 の数値）
  CPU_FLEE_DASH_DIST: 150,      // 逃げる側: 鬼がこれより近いと連打
  CPU_FLEE_DASH_STAMINA: 40,    // 逃げる側: 体力がこれより多いと連打
  CPU_CHASE_DASH_DIST: 200,     // 鬼: 相手がこれより近いと連打
  CPU_CHASE_DASH_STAMINA: 30,   // 鬼: 体力がこれより多いと連打
  CPU_SAVE_STAMINA: 20,         // これ未満は連打しない（温存）
  CPU_TAPS_PER_SEC: 6,          // 連打の平均回数（5〜7 回/秒）
  CPU_WEAK_TARGET_BONUS: 0.3,   // 体力が低い相手の優先度 +30%
  CPU_WEAK_TARGET_STAMINA: 50,  // 「体力が低い」とみなす値
  CPU_LOOKAHEAD: 60,            // 候補方向を評価する先読み距離 px
  CPU_WALL_MARGIN: 90,          // 壁・障害物にこれより近い方向にペナルティ
  CPU_WALL_PENALTY: 2.0,        // 壁近接ペナルティの重み
  CPU_BLOCKED_PENALTY: 1000,    // 進めない方向のペナルティ

  // 追加: フィールド配置（px、アリーナ左上原点）
  OBSTACLES: [
    { x: 180, y: 120, w: 90, h: 70 },
    { x: 690, y: 110, w: 90, h: 80 },
    { x: 430, y: 260, w: 100, h: 80 },
    { x: 170, y: 420, w: 110, h: 60 },
    { x: 680, y: 410, w: 100, h: 70 },
  ],
  SPAWNS: {
    player: { x: 120, y: 300 },
    cpu1: { x: 480, y: 90 },
    cpu2: { x: 840, y: 300 },
    cpu3: { x: 480, y: 520 },
  },
  COLORS: {
    player: '#3b82f6',
    cpu1: '#f59e0b',
    cpu2: '#10b981',
    cpu3: '#a855f7',
    it: '#ef4444',
  },
};
