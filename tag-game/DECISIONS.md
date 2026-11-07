# DECISIONS（仕様にない判断の記録）

| 日付 | フェーズ | 判断 | 理由 |
|---|---|---|---|
| 2026-11-07 | P0 | スタブ関数は `throw new Error("not implemented")` にする | P1 のテストが「失敗」として正しく動くため |
| 2026-11-07 | P0 | `serve.js` は 127.0.0.1 のみで待ち受け、`Cache-Control: no-store` を付ける | 外部公開しない・開発中の古いキャッシュを避ける |
| 2026-11-07 | P0 | `npm run test` は `node --test tests/` にする | DESIGN §7.2 P1 のゲートに合わせる |
| 2026-11-07 | P0 | `tag-game/.gitignore` に `screenshots/` と `node_modules/` を入れる | DESIGN §7.3 で screenshots は対象外指定 |
