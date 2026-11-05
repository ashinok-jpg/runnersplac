---
name: publish-article
description: 記事の文面（シューズのレビュー記事またはランニングブログ）がチャットで届いたら、articles/ か blogs/ に記事を作り、ローカルで表示を確認し、main に push して本番（runnersplac.onrender.com）での表示まで確認する。「記事公開」「この記事を載せて」「ブログ追加」や、記事の文面が貼られたときに使う。
---

# 記事公開

文面が届いた時点で公開の依頼とみなしてよい（push まで進める）。ただし push してよいのは記事の追加・加筆だけ。デザインやコードの変更が混ざるときは、その部分は push 前に確認する。

## 守ること

- **文面は勝手に創作・加筆しない。** 届いた文章をそのまま HTML にする。誤字らしきものは直さずに最後に報告する。
- 数字（点数・重量・価格など）を自分で補わない。文面にない数字が必要なら聞く。
- 足りない情報（シューズID、ブログのスラッグ・カテゴリ、写真）があれば、作業を始める前にまとめて一度だけ聞く。推測で埋められるもの（日付＝今日、スラッグ＝内容から英小文字とハイフンで作る）は聞かずに決めて、報告で伝える。

## 1. 種類を決める

| 文面 | 置き場所 | 本番URL |
|---|---|---|
| 特定のシューズのレビュー | `articles/<シューズID>/` | `/shoes/<シューズID>` |
| それ以外（選び方・練習・コラム） | `blogs/<スラッグ>/` | `/blog/<スラッグ>` |

シューズIDは `data/shoesData.js` の `id`。無ければ止めて、先にシューズを追加するか聞く。

## 2. ファイルを作る

main の上で直接作業する（`npm run new-article` は別ブランチを切るので使わない）。

書き方の決まりは `articles/README.md`。見た目は既存記事に合わせる。手本:
- シューズ記事: `articles/clifton10/article.html`
- ブログ: `blogs/weekday-shoes/article.html` と `meta.json`

よく使う部品（既存記事と同じクラス名を使う）:
- 冒頭: `<div class="rp-hero">` の中に `rp-kicker`・`rp-catch`・`<p class="lead">`・`rp-stats`
- 見出し: `<h2 data-en="英語ラベル">`
- 向く人／向かない人: `rp-verdict` と `rp-card rp-good` / `rp-bad`
- スペック: `rp-spec`、表: `rp-table`、写真: `rp-photos` の `<figure>`、点数バー: `rp-chart`

`<html>` や `<head>` は書かない。

**シューズ記事**
- `article.html` を作る。写真は `images/` に置き `images/side.jpg` のように書く。
- 評価を変える指示があれば `meta.json`（`ratings` / `comments`）。無ければ作らない。
- 購入リンクの指示があれば `data/shoesData.js` の該当シューズに `buyUrl` を足す。
- 写真を一覧のサムネにする場合は `image: "/article-assets/<ID>/images/side.jpg"`。

**ブログ**
- `article.html` と `meta.json`（`title` `excerpt` `category` `date` `image`）。
- `category` は既存に合わせる（例: `GUIDE`、`GEAR`）。`image` は自分の `images/` か、`/article-assets/<シューズID>/images/side.jpg` を使ってよい。

## 3. ローカルで確認する

`preview_start`（名前 `start`、ポート3000）で起動し、該当URLを開く。確認すること:
- ページがエラーなく表示される（コンソールとサーバーログにエラーが無い）
- 写真が全部読み込まれている（壊れた画像が無い）
- ブログなら `/blog` の一覧にも出ている
- スマホ幅（mobile）で横にはみ出していない

スクリーンショットを1枚撮って、報告に添える。

## 4. コミットして push

- 記事に関係するファイルだけを `git add` する（`research/` など他の未追跡ファイルは入れない）。
- コミットメッセージは日本語で、何をしたかを一文で。例: `ブログ「〇〇」を追加` / `ノバブラスト 6 のレビュー記事を追加`
- `git push origin main`

## 5. 本番を確認する

Render のデプロイには数分かかる。本番URL（`https://runnersplac.onrender.com/...`）を開き、新しい記事が出るまで少し間を空けて確認する（目安: 2〜3分おきに数回。10分たっても出なければそう報告する）。表示を確認できたら、本番URLを添えて報告する。

## 報告

短く:
- 公開したURL
- 決めたこと（スラッグ、日付、カテゴリなど）
- 気づいた点（誤字の疑い、写真が足りない、など）
