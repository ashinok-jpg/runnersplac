# tag-game 作業ルール（Claude Code 用）

- 仕様は `DESIGN.md` が正。作業前に必ず読む。仕様にない判断は `DECISIONS.md` に記録して自分で決める（人間に質問しない）。
- 役割分担は `DESIGN.md` §6。各サブエージェントは担当ファイル以外を書き換えない。
- 進め方は `DESIGN.md` §7 のフェーズ順。各フェーズはゲート条件をコマンド実行で確認してからコミット。
- `src/core/**` と `src/ai/**` は DOM・`Math.random`・`Date.now` 禁止（シード付き rng を使う）。
- パラメータは `src/config.js` にだけ書く。
- `tag-game/` の外のファイルは変更しない。
- 完了条件は `npm run check` 全合格（`DESIGN.md` §8）。
- 各フェーズ後に `AGENT_LOG.md` へ記録（`DESIGN.md` §9）。

## 起動方法（完成後に追記）
