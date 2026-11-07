# 手鬼ごっこ（Tag Dash）設計書

> この文書は **Claude Code に渡して、遊べる状態まで自走で作らせる** ための設計書です。
> 同時に「AI エージェント（サブエージェント）を役割分担させて開発が回るか」を試す実験も兼ねます。
> Claude Code はこの文書を上から読み、**§7 自走プロトコル** に従って、人間に確認せずに完成まで進めてください。

---

## 0. Claude Code への最初の指示（これをそのまま貼る）

```
tag-game/DESIGN.md を読んで、その内容どおりに手鬼ごっこゲームを完成させて。
§6 の役割分担でサブエージェント（Agent ツール）を使い、§7 の自走プロトコルに従って
受け入れ基準（§8）がすべて通るまで、私に確認せずに進めること。
仕様に書いていない細かい判断は自分で決めて DECISIONS.md に記録すること。
完了したら AGENT_LOG.md に各エージェントの働きぶりの評価を書き、コミットして push して。
```

---

## 1. ゲーム概要

| 項目 | 内容 |
|---|---|
| ジャンル | 見下ろし型 2D 鬼ごっこ（ブラウザゲーム） |
| プレイ人数 | 1 人（プレイヤー）＋ CPU 3 体 |
| 1 ラウンド | 60 秒 |
| 操作 | **方向キーで移動 / スペースキー連打でダッシュ** |
| 肝 | ダッシュは体力（スタミナ）を消費。**体力ゲージを見ながら、いつ連打して逃げる/追うかを判断する** |

### 1.1 ルール

1. 開始時、4 人のうちランダムで 1 人が「鬼」。
2. 鬼が他のキャラに触れる（当たり判定が重なる）と、触れられた側が新しい鬼になる。
3. **タッチ返し禁止**：鬼が交代した直後 1.0 秒間、新しい鬼は動けない（硬直）＆元の鬼にはタッチできない。
4. 60 秒経過でラウンド終了。
5. **スコア = 鬼でなかった時間（秒）**。終了時に順位を表示。終了時点で鬼だったキャラは「負け」と表示。
6. フィールドは矩形のアリーナ（壁で囲まれる）＋固定の障害物 4〜6 個。キャラは壁・障害物を通り抜けられない。

### 1.2 ダッシュと体力（このゲームの中心）

- **連打判定**：直近 `MASH_WINDOW_MS`（=1000ms）以内のスペース押下回数を数える。
  - 押下回数 ≥ `MASH_MIN_TAPS`（=4）でダッシュ状態。
  - 速度倍率は連打数に応じて上がる：`multiplier = min(1 + (taps - 3) * 0.25, DASH_MAX_MULT)`（`DASH_MAX_MULT`=2.0）
  - キーを押しっぱなし（リピート）はカウントしない（`event.repeat` を無視）。
- **体力**：最大 100。
  - ダッシュ中：`STAMINA_DRAIN_PER_SEC`（=35）× 倍率 で減る。
  - 非ダッシュ時：`STAMINA_REGEN_PER_SEC`（=15）で回復。停止中は ×1.5。
  - **0 になると「バテ」状態**：移動速度 ×0.6、体力が 30 に回復するまでダッシュ不可。
- **鬼のボーナス**：鬼の基本速度は ×1.05（わずかに速い）。ただし体力の仕組みは同じ。

### 1.3 画面

```
┌───────────────────────────────────────────┐
│ 残り 42.3s        あなた: 逃げる側        │ ← HUD 上段
│ [体力 ████████░░░░ 68]  DASH x1.5         │ ← 体力ゲージ＋ダッシュ倍率
├───────────────────────────────────────────┤
│                                           │
│    ■        ●(鬼:赤)                       │
│        ○(あなた:青)       ■               │
│                    ○(CPU)                 │
│   ■                          ○(CPU)       │
│                                           │
└───────────────────────────────────────────┘
```

- 体力ゲージ：緑（>50）→ 黄（20〜50）→ 赤（<20）。バテ中は点滅。
- 鬼の頭上に「鬼」マーク。プレイヤーには「YOU」ラベル。
- CPU も頭上に小さな体力バーを表示（相手の消耗を見て判断できるように）。
- 画面状態：`タイトル` → `カウントダウン(3,2,1)` → `プレイ中` → `リザルト` →（Enter で）`タイトル`。
- `P` で一時停止、`Esc` でタイトルへ。

---

## 2. 技術方針

| 項目 | 決定 | 理由 |
|---|---|---|
| 実行環境 | ブラウザ（Canvas 2D） | インストール不要で動作確認しやすい |
| 言語 | Vanilla JavaScript（ES Modules） | ビルド不要。エージェントが迷わない |
| 依存 | **本体は依存ゼロ**。テストのみ Node 標準 `node:test`、E2E に `playwright` | 環境差異で詰まらないため |
| 構造 | **ロジック（純粋関数）と描画・入力を分離** | ロジックを Node 上で単体テストできるようにする |
| ループ | 固定タイムステップ 60Hz（`dt = 1/60`）、描画は `requestAnimationFrame` | 決定的でテスト可能 |
| 乱数 | シード付き乱数（`rng.js`）を全ロジックで使う | テストで再現可能にする |
| 起動 | `npx http-server` 等不要。`node tag-game/scripts/serve.js` の自前静的サーバ（依存ゼロ） | ES Modules は file:// で動かないため |

このフォルダ `tag-game/` は親リポジトリ（runnersplac の Web サイト）から**完全に独立**させる。親の `package.json`・`app.js`・`public/` には触らない。

---

## 3. ファイル構成

```
tag-game/
├── DESIGN.md              # この設計書（人間が書いた仕様。エージェントは原則編集しない）
├── CLAUDE.md              # Claude Code 向けの作業ルール要約
├── DECISIONS.md           # 仕様に無い判断の記録（Lead が追記）
├── AGENT_LOG.md           # エージェント評価ログ（§9）
├── package.json           # scripts: test / test:e2e / serve / check
├── index.html             # Canvas と HUD のマークアップ
├── style.css              # 画面レイアウト
├── src/
│   ├── main.js            # エントリ。各モジュールを組み立ててゲームループ開始
│   ├── config.js          # 全パラメータ定数（§5）。マジックナンバー禁止
│   ├── core/              # ★DOM 非依存の純粋ロジック（Node でテスト可能）
│   │   ├── rng.js         # シード付き乱数 (mulberry32)
│   │   ├── vector.js      # 2D ベクトル演算
│   │   ├── stamina.js     # 体力の増減・バテ判定
│   │   ├── mash.js        # 連打カウンタ・ダッシュ倍率計算
│   │   ├── physics.js     # 移動・壁/障害物との衝突解決
│   │   ├── tag.js         # タッチ判定・鬼交代・硬直
│   │   ├── world.js       # ワールド状態の生成と 1 ステップ更新 (step)
│   │   └── scoring.js     # スコア集計・順位
│   ├── ai/
│   │   └── cpu.js         # CPU の意思決定（逃げる/追う/ダッシュするか）。純粋関数
│   ├── input/
│   │   └── keyboard.js    # キーボード → 入力状態オブジェクト（DOM 依存はここだけ）
│   ├── render/
│   │   ├── renderer.js    # Canvas 描画（アリーナ・キャラ・障害物）
│   │   └── hud.js         # 残り時間・体力ゲージ・倍率・ラベル
│   └── scenes/
│       └── sceneManager.js # タイトル/カウントダウン/プレイ/ポーズ/リザルト の状態遷移
├── tests/
│   ├── stamina.test.js
│   ├── mash.test.js
│   ├── physics.test.js
│   ├── tag.test.js
│   ├── world.test.js      # シード固定で 60 秒シミュレーションし不変条件を検査
│   ├── cpu.test.js
│   └── e2e/
│       └── smoke.e2e.js   # Playwright: 起動→開始→キー操作→リザルトまで
└── scripts/
    ├── serve.js           # 依存ゼロの静的ファイルサーバ（port 5173、使用中なら +1）
    └── check.js           # 全テスト＋E2E＋禁止事項チェックを一括実行（§8 の自動判定）
```

### 3.1 依存方向（厳守）

```
main.js ──► scenes ──► core, ai, render, input
render  ──► core（読み取りのみ）
ai      ──► core
input   ──► （何にも依存しない）
core    ──► config のみ   ※ core は document / window / Date.now / Math.random を使わない
```

---

## 4. モジュール仕様（インターフェース）

各エージェントはこのシグネチャを守る。**シグネチャを変えたい場合は Lead に申請し、DECISIONS.md に記録してから変更**。

### 4.1 データ型

```js
// Entity
{
  id: 'player' | 'cpu1' | 'cpu2' | 'cpu3',
  pos: { x, y },            // px, アリーナ左上原点
  vel: { x, y },
  radius: 14,
  isIt: boolean,            // 鬼か
  frozenUntil: number,      // world.time(秒) がこれ未満なら硬直
  noTagBackId: string|null, // タッチ返し禁止の相手
  stamina: { value: 0..100, exhausted: boolean },
  mash: { taps: number[] }, // 押下時刻(秒)の配列
  dashMult: number,         // 現在の速度倍率 (1.0〜2.0)
  safeTime: number,         // 鬼でなかった累計秒
  color: string,
}

// Input（1 体分、1 ステップ分）
{ dir: { x: -1|0|1, y: -1|0|1 }, dashTap: boolean /* このステップでスペースが新規に押されたか */ }

// World
{ time, duration: 60, arena: { w: 960, h: 600 }, obstacles: Rect[], entities: Entity[], events: Event[], rngState, over: boolean }
// Event: { type: 'tag', from, to, time } | { type: 'exhausted', id, time }
```

### 4.2 関数

| ファイル | export | 説明 |
|---|---|---|
| `core/rng.js` | `createRng(seed) → { next(): number /*[0,1)*/, state }` | |
| `core/vector.js` | `add, sub, scale, len, normalize, dist` | 全て新しいオブジェクトを返す |
| `core/mash.js` | `registerTap(mash, t) → mash` / `countTaps(mash, t) → number` / `dashMultiplier(taps) → number` | 古い押下は窓外になったら捨てる |
| `core/stamina.js` | `updateStamina(stamina, { dashing, mult, moving, dt }) → stamina` / `canDash(stamina) → boolean` | §1.2 の式どおり |
| `core/physics.js` | `moveEntity(entity, dir, speed, dt, arena, obstacles) → entity` | 円 vs 矩形の衝突を押し戻しで解決。斜め移動は正規化 |
| `core/tag.js` | `resolveTags(entities, time) → { entities, events }` | 1 ステップで交代は最大 1 回 |
| `core/scoring.js` | `ranking(entities) → [{ id, safeTime, rank, isIt }]` | |
| `core/world.js` | `createWorld({ seed }) → World` / `step(world, inputsById, dt) → World` | **純粋関数**。入力された world を変更しない |
| `ai/cpu.js` | `decide(world, selfId, rng) → Input` | §4.3 |
| `input/keyboard.js` | `createKeyboard(target) → { read(): Input, onKey(cb), dispose() }` | `read()` は呼ぶたびに `dashTap` をリセット |
| `render/renderer.js` | `createRenderer(canvas) → { draw(world, playerId) }` | |
| `render/hud.js` | `drawHud(ctx, world, playerId)` | |
| `scenes/sceneManager.js` | `createSceneManager({ renderer, keyboard }) → { update(dt), draw(), get scene() }` | |

`window.__TAG_GAME__ = { getScene(), getWorld(), setSeed(n) }` を `main.js` で公開する（E2E テスト用フック）。

### 4.3 CPU の思考（ai/cpu.js）

- 自分が**逃げる側**：最も近い鬼から離れる方向へ移動。壁際で詰まらないよう、壁・障害物に近い方向にはペナルティ（候補 8 方向をスコアリングして最良を選ぶ）。
  鬼との距離 < 150px かつ体力 > 40 なら連打（`dashTap` を確率的に true にして 1 秒あたり 5〜7 回相当にする）。
- 自分が**鬼**：最も近い（タッチ返し禁止相手を除く）ターゲットを追う。体力が低い相手を優先度 +30%。
  距離 < 200px かつ体力 > 30 なら連打。
- 体力 < 20 のときは連打しない（温存）。
- 難易度：`config.CPU_REACTION_MS`（=200）ごとにしか方針を更新しない（反応遅延で人間が勝てる余地を作る）。

---

## 5. パラメータ（src/config.js）

```js
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
  STAMINA_MAX: 100,
  STAMINA_DRAIN_PER_SEC: 35,
  STAMINA_REGEN_PER_SEC: 15,
  STAMINA_IDLE_REGEN_MULT: 1.5,
  STAMINA_RECOVER_THRESHOLD: 30,
  TAG_FREEZE_SEC: 1.0,
  CPU_REACTION_MS: 200,
  COUNTDOWN_SEC: 3,
};
```

調整した場合は DECISIONS.md に「旧値 → 新値・理由」を書く。

---

## 6. エージェント役割分担

Lead（メインの Claude Code セッション）が指揮し、各作業は **Agent ツールでサブエージェントに委譲** する。
各ロールは**自分の担当ファイルだけを書く**。他ロールのファイルを直したいときは Lead に報告して Lead が再委譲する（所有権の衝突を防ぐ）。

| # | ロール | 担当ファイル（書き込み権） | 主な仕事 | 完了条件 |
|---|---|---|---|---|
| 0 | **Lead / 指揮** | `DECISIONS.md`, `AGENT_LOG.md`, `CLAUDE.md`, `package.json`, `src/main.js`, `src/config.js` | 計画、委譲、統合、結果検証、判断記録 | §8 全項目合格 |
| 1 | **Core Engineer** | `src/core/**` | 純粋ロジック（体力・連打・物理・タッチ・world.step） | 担当テスト全合格、DOM 非依存 |
| 2 | **AI Engineer** | `src/ai/**` | CPU の思考 | `cpu.test.js` 合格、シミュで鬼交代が 1 ラウンド 3 回以上起きる |
| 3 | **UI/Render Engineer** | `index.html`, `style.css`, `src/render/**`, `src/input/**`, `src/scenes/**` | 描画、HUD、入力、画面遷移 | ブラウザで全画面遷移が動く、スクショ確認 |
| 4 | **QA Engineer** | `tests/**`, `scripts/**` | テスト作成（実装より先に仕様から書く）、E2E、check.js | テストが仕様を網羅、`npm run check` が機能する |
| 5 | **Reviewer** | （書き込み無し・読むだけ） | 依存方向違反、仕様との差異、バグ、遊びやすさのレビュー | 指摘リストを Lead に返す |

### 6.1 委譲するときのプロンプト雛形（Lead が使う）

```
あなたは tag-game の <ロール名> です。
まず tag-game/DESIGN.md の §1, §4, §5 と、あなたの担当範囲を読んでください。
担当ファイル: <ファイル一覧>（これ以外は書き込み禁止。必要なら報告に書くこと）
今回のタスク: <具体的なタスク>
完了条件: <コマンドと期待結果。例: `cd tag-game && node --test tests/stamina.test.js` が全合格>
報告形式: 1) 変更ファイル 2) 実行したコマンドと結果 3) 未解決事項・他ロールへの依頼 を箇条書きで。
```

### 6.2 並列化

- QA（テスト先行）と Core は同時に走らせてよい（QA が仕様からテスト、Core が実装）。
- AI と UI/Render は Core の `world.js` のインターフェースが確定（＝ §4 どおりにスタブがある）した時点で並列に開始できる。
- 同じファイルに 2 つのエージェントが同時に書くのは禁止。

---

## 7. 自走プロトコル（人間に確認せず完成まで進む手順）

### 7.1 大原則

1. **人間に質問しない。** 仕様の空白は「遊んで楽しい方」「実装が単純な方」の順で自分で決め、`DECISIONS.md` に 1 行で記録して進む。
2. **「動いた」は必ずコマンド実行結果で確認する。** 推測で完了扱いにしない。
3. 各フェーズの終わりに **コミット**（`tag-game: <フェーズ名>` という形式）。
4. 同じエラーで 3 回失敗したら、アプローチを変える（別案を DECISIONS.md に書いてから）。5 回失敗したらその機能を簡略化して先に進み、`DECISIONS.md` に「保留」として残す。**止まらないことを優先**。
5. 親リポジトリのファイル（`tag-game/` の外）は一切変更しない。

### 7.2 フェーズ

| Phase | 内容 | 担当 | 完了の判定（ゲート） |
|---|---|---|---|
| P0 準備 | フォルダ・`package.json`・`config.js`・全ファイルのスタブ（export だけ）・`serve.js` を作る | Lead + QA | `node scripts/serve.js` で `index.html` が 200 を返す |
| P1 テスト先行 | §1.2, §4 から単体テストを書く（この時点では失敗して良い） | QA | テストファイルが揃い、`node --test tests/` が「失敗」で動く（構文エラー無し） |
| P2 コア実装 | `core/**` を実装 | Core | `node --test tests/` の core 系が全合格 |
| P3 AI ＆ 描画（並列） | `ai/cpu.js` / `render`・`input`・`scenes` | AI, UI | `cpu.test.js` 合格 / ブラウザで操作可能 |
| P4 統合 | `main.js` で結線、E2E 作成・実行 | Lead + QA | `npm run test:e2e` 合格 |
| P5 レビュー | Reviewer が全体レビュー → 指摘を各ロールに再委譲して修正 | Reviewer → 各ロール | 重大指摘 0 件 |
| P6 プレイテスト | Playwright でスクリーンショットを撮り、Lead が目視確認（§7.3） | Lead | スクショで HUD・キャラ・鬼表示が確認できる |
| P7 仕上げ | `npm run check` 全合格、README 相当の説明を `CLAUDE.md` 末尾に、`AGENT_LOG.md` 記入、push | Lead | §8 全合格・push 完了 |

各フェーズ完了時、Lead は `AGENT_LOG.md` に 1 行追記する（§9 形式）。

### 7.3 自動プレイテストの観点（P6）

Playwright で以下を行い、スクショを `tag-game/screenshots/`（.gitignore 対象）に保存して確認する：

1. タイトル画面
2. Enter → カウントダウン中
3. プレイ中に方向キー 1 秒 → プレイヤーの座標が変わったことを `window.__TAG_GAME__.getWorld()` で確認
4. スペースを 100ms 間隔で 10 回 → `dashMult > 1` かつ体力が減っていることを確認
5. 体力 0 までスペース連打 → `exhausted === true` を確認
6. 時間を進めて（テスト用に `?round=5` クエリでラウンド 5 秒にできるようにする）リザルト画面

### 7.4 環境で詰まったとき

- `playwright` が無い/ブラウザが起動しない → E2E はスキップ可能にし（`check.js` は警告扱い）、代わりに `world.test.js` のシミュレーションを厚くする。DECISIONS.md に記録。
- ポートが使用中 → `serve.js` が自動で次のポートを使う。

---

## 8. 受け入れ基準（Definition of Done）

`cd tag-game && npm run check` が以下をすべて自動判定し、全て ✅ になること。

- [ ] 単体テスト全合格（`node --test tests/*.test.js`）
- [ ] `src/core/**` と `src/ai/**` に `document` `window` `Math.random` `Date.now` `performance` が出現しない（grep で検査）
- [ ] `src/**` 内で `config.js` 以外に §5 のパラメータ値の直書きがない（主要な値だけ grep で検査で可）
- [ ] world シミュレーション（シード 1〜20、CPU 4 体で 60 秒）で：
  - [ ] 例外が出ない、エンティティが壁・障害物にめり込まない
  - [ ] 体力が常に 0〜100
  - [ ] 鬼は常にちょうど 1 人
  - [ ] 1 ラウンドの平均鬼交代回数が 3 回以上 15 回以下（ゲームとして成立している）
- [ ] E2E スモーク合格（§7.3 の 1〜6）
- [ ] `tag-game/` の外に変更がない（`git diff --name-only` で検査）

加えて Lead が目視で確認する項目：
- [ ] 体力ゲージの色が残量に応じて変わる
- [ ] 連打をやめるとダッシュが 1 秒以内に終わる
- [ ] 人間が普通に遊んで「逃げ切れることもあるし捕まることもある」バランス（CPU 勝率がシミュで 極端でない）

---

## 9. エージェント評価ログ（AGENT_LOG.md の形式）

この開発の目的の一つは「AI エージェントが使えるか」の検証なので、以下を必ず記録する。

### 9.1 フェーズごとの記録

```
| Phase | ロール | 委譲回数 | 1 回で完了した? | やり直し理由 | 所要(目安) | 備考 |
|---|---|---|---|---|---|---|
| P2 | Core | 2 | No | physics の斜め衝突でテスト失敗 | 中 | 2回目で解決 |
```

### 9.2 最終評価（完了時に Lead が書く）

各ロールについて 5 段階で：

- **仕様理解**：設計書を読んで意図どおりに作れたか
- **自己検証**：自分でテストを回して確かめてから報告したか
- **担当範囲の遵守**：担当外のファイルを触らなかったか
- **報告の正確さ**：「できた」と言ったものが本当にできていたか（Lead の検証で嘘・誤りが見つかった件数）
- **自走性**：人の介入なしに詰まりを解消できたか

最後に「次回やるなら役割分担をどう変えるか」を 3 行以内で書く。

---

## 10. スコープ外（今回は作らない）

- オンライン対戦、2P 対戦（将来 WASD+左Shift 連打で 2P を足せる構造にはしておく）
- サウンド（入れる場合は WebAudio で短いビープのみ・任意）
- スマホ操作（将来、画面タップ連打＝ダッシュ、仮想スティック＝方向で対応可能な入力抽象にしておく）
- 親サイト（runnersplac）への組み込み
