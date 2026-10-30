# 記事の書き方

記事は 1 足につき 1 フォルダです。

```
articles/<シューズID>/
├── article.html   本文（HTML。<script> で動きも付けられる）
├── meta.json      評価（任意）
└── images/        写真
```

## 追加から公開まで

1. `npm run new-article -- <シューズID>` を実行する（ブランチ `article/<シューズID>` とフォルダができる）
2. `article.html` を書く。写真は `images/` に置いて `<img src="images/photo.jpg" alt="説明">` と書く
3. `npm start` で起動し、`http://localhost:3000/shoes/<シューズID>` で確認する
4. コミットして main にマージし、push する（Render が自動で公開する）

公開ボタンはありません。main に入ったものが本番です。

## article.html

`<html>` や `<head>` は書かず、本文だけを書きます。見た目はサイト共通のものが自動で付きます。

- リード文: `<p class="lead">`
- 見出し: `<h2>`、`<h3>`
- 動き: 本文の中に `<script>` をそのまま書ける

## meta.json

一覧と詳細ページの評価に反映されます。書かなかった項目は `data/shoesData.js` の値のままです。

```json
{
  "ratings": { "クッション性": 4.5, "安定性": 3 },
  "comments": { "クッション性": "コメント" }
}
```

下書きにしたいときは `"draft": true` を足します。本番では管理者以外に表示されません。
