# 記事テンプレートシステム 使用方法

このシステムでは、HTMLの記事本文を挿入するだけで、統一されたテンプレートスタイルが自動的に適用されます。

## 📁 ファイル構成

```
public/
├── css/
│   └── article-template.css      # テンプレートのスタイル
├── js/
│   └── article-template.js       # テンプレートの機能
└── html/
    ├── article-template.html     # 完全版テンプレート
    └── article-content-template.html  # コンテンツ部分のテンプレート
```

## 🚀 使用方法

### 1. 既存のEJSファイルに組み込む場合

#### ヘッダー部分にCSSとJSを追加：
```html
<head>
  <!-- 既存のCSS -->
  <link rel="stylesheet" href="/css/article-template.css">
</head>
<body>
  <!-- 既存のHTML -->
  
  <!-- body終了タグの直前にJSを追加 -->
  <script src="/js/article-template.js"></script>
</body>
```

#### HTMLの本文部分：
```html
<!-- 既存の記事本文をこの構造に置き換える -->
<div class="container">
  <main class="main-content" id="mainContent">
    <div class="cursor-glow">
      <div class="glow-dot" id="glowDot"></div>
    </div>
    
    <div class="wrapper">
      <!-- 記事コンテンツ -->
      <header class="hero">
        <h1 id="pageTitle"><%- shoe.name %> レビュー</h1>
        <div class="hero-actions">
          <span class="chip" id="priceChip">💴 <%- shoe.price %></span>
          <span class="chip" id="weightChip">⚖️ <%- shoe.weight %></span>
        </div>
      </header>

      <!-- 目次 -->
      <nav id="toc" class="toc-card"></nav>

      <!-- リード -->
      <section id="lead" class="card">
        <h2>リード</h2>
        <p id="leadContent"><%- shoe.lead %></p>
      </section>

      <!-- 他のセクションも同様の構造 -->
    </div>
  </main>
</div>
```

### 2. 完全に新しい記事ページを作る場合

`public/html/article-template.html` をベースとして使用してください。

### 3. 動的データの設定

#### JavaScript側でデータを設定：
```javascript
// ページ読み込み後にデータを設定
document.addEventListener('DOMContentLoaded', function() {
  const shoeData = {
    manufacturer: "ASICS",
    title: "NOVABLAST 4",
    price: "¥16,500〜19,000",
    weight: "約250g",
    lead: "リード文...",
    // 他のデータ...
  };
  
  // テンプレートにデータを読み込み
  if (typeof loadDataToPage === 'function') {
    loadDataToPage(shoeData);
  }
});
```

## 🎨 利用可能な機能

### 自動生成される機能：
- **目次（TOC）** - `buildTOC()`で自動生成
- **スコアバー** - `updateScoreBars()`でアニメーション
- **グローエフェクト** - マウス追従の視覚効果

### データ構造：
```javascript
const articleData = {
  // 基本情報
  manufacturer: "メーカー名",
  title: "シューズ名", 
  price: "価格",
  weight: "重量",
  
  // コンテンツ
  lead: "リード文",
  spec: {
    content: "スペック説明",
    chips: ["⚖️ 約250g", "📏 ドロップ：8mm"]
  },
  design: "設計思想",
  impressions: "実走インプレ",
  likes: "好きな点",
  dislikes: "惜しい点",
  
  // スコア（10項目評価）
  scores: [
    { name: "クッション性", value: 4.8, max: 5, comment: "優秀" }
  ],
  
  // 比較
  comparison: [
    { name: "Nike Pegasus 40", content: "比較内容", image: "" }
  ],
  
  // まとめ
  tips: "Tips",
  summary: "まとめ",
  summaryShort: "要約",
  hashtags: "#タグ1 #タグ2",
  
  // 購入リンク
  rakutenUrl: "楽天URL",
  amazonUrl: "AmazonURL"
};
```

## 🔧 カスタマイズ

### CSSカスタムプロパティで色やサイズを調整：
```css
:root {
  --accent: #6366f1;        /* アクセントカラー */
  --bg: #f5f7fa;           /* 背景色 */
  --card: #ffffff;         /* カード背景 */
  --maxw: 920px;           /* 最大幅 */
  --radius: 14px;          /* 角丸 */
}
```

### 必要なHTML要素のID：
- `pageTitle` - 記事タイトル
- `priceChip`, `weightChip` - 価格・重量チップ
- `leadContent`, `designContent`, etc. - 各セクション内容
- `scoresContainer` - スコア表示エリア
- `comparisonContainer` - 比較表示エリア
- `toc` - 目次エリア

## ⚡ 最小構成

最低限、以下があれば動作します：

```html
<link rel="stylesheet" href="/css/article-template.css">

<div class="container">
  <main class="main-content" id="mainContent">
    <div class="wrapper">
      <h1 id="pageTitle">記事タイトル</h1>
      
      <section id="lead" class="card">
        <h2>リード</h2>
        <p id="leadContent">記事内容...</p>
      </section>
    </div>
  </main>
</div>

<script src="/js/article-template.js"></script>
```

これで統一されたデザインとインタラクティブ機能が適用されます！