// JavaScript logic extracted from the original HTML. This file contains
// all the interactive behaviours for the blog template, including
// JSON loading, dynamic dropdowns, smooth scrolling, image upload
// handling, and visual effects such as the glowing cursor.

// サンプルデータ (ダミー記事を大量追加)
const sampleData = {
  // --- 初期サンプル記事 ---
  sample1: {
    manufacturer: "ASICS", 
    linkId: "novablast-4", 
    title: "NOVABLAST 4", 
    price: "¥16,500〜19,000",
    weight: "約250g",
    heroImage: "", 
    rakutenUrl: "https://item.rakuten.co.jp/sample-rakuten-novablast4/", 
    amazonUrl: "https://www.amazon.co.jp/dp/sample-amazon-novablast4", 
    lead: "ASICSの人気ランニングシューズ「NOVABLAST 4」の詳細レビューです。前作から大幅にアップデートされたデザインと性能を徹底解析します。",
    spec: {
      content: "NOVABLAST 4は軽量性とクッション性を両立した日常トレーニング用シューズです。",
      chips: [
        "⚖️ 約250g", "📏 ドロップ：8mm", "📐 スタック：41.5/33.5mm",
        "🧪 ミッドソール：FF BLAST MAX", "🪭 プレート：非搭載", "💴 価格：16,500〜19,000円"
      ]
    },
    design: "トランポリンのような反発力を持つFF BLAST MAXミッドソールが特徴的で、軽やかな走り心地を実現しています。",
    impressions: "実際に走ってみると、着地時の衝撃吸収と蹴り出し時の反発力のバランスが絶妙でした。",
    likes: "軽量で反発力があり、デイリートレーナーとして最適。価格も手頃でコスパが良い。",
    dislikes: "安定性がやや物足りなく、長距離では足が疲れやすい印象。耐久性も気になるところ。",
    scores: [
      { name: "クッション性", value: 4.8, max: 5, comment: "FF BLAST MAXの恩恵で非常に優秀" },
      { name: "反発性", value: 4.5, max: 5, comment: "軽快な蹴り出し" },
      { name: "デザイン", value: 4.0, max: 5, comment: "モダンでカジュアル" },
      { name: "履き心地", value: 4.3, max: 5, comment: "足入れが良く快適" },
      { name: "フィット感", value: 4.1, max: 5, comment: "標準的" },
      { name: "安定性", value: 3.5, max: 5, comment: "控えめ" },
      { name: "スピード性能", value: 4.0, max: 5, comment: "十分対応可能" },
      { name: "耐久性", value: 3.7, max: 5, comment: "比較的早いかも" },
      { name: "グリップ", value: 4.2, max: 5, comment: "まずまずの性能" },
      { name: "コスパ", value: 4.2, max: 5, comment: "価格帯では優秀" }
    ],
    comparison: [
      { name: "Nike Pegasus 40", content: "安定性重視。", image: "" },
      { name: "Adidas Boston 12", content: "スピード性能で上回る。", image: "" },
      { name: "New Balance SC Trainer v2", content: "プレート搭載、価格も高い。", image: "" }
    ],
    tips: "初心者は慣れるまで短い距離から。定期的なローテーションで寿命を延ばせます。",
    summary: "NOVABLAST 4は軽量で反発力に優れたデイリートレーナーです。",
    summaryShort: "軽量・高反発のデイリートレーナー",
    hashtags: "#ASICS #NOVABLAST4 #レビュー"
  },
  sample2: {
    manufacturer: "Nike",
    linkId: "air-zoom-pegasus-40",
    title: "Air Zoom Pegasus 40",
    price: "¥14,300〜16,500",
    weight: "約280g",
    heroImage: "",
    rakutenUrl: "https://item.rakuten.co.jp/sample-rakuten-pegasus40/", 
    amazonUrl: "https://www.amazon.co.jp/dp/sample-amazon-pegasus40",
    lead: "Nikeの定番ランニングシューズ「Air Zoom Pegasus 40」の徹底レビューです。",
    spec: {
      content: "Pegasus 40は安定性とクッション性を重視した万能シューズです。",
      chips: [
        "⚖️ 約280g", "📏 ドロップ：10mm", "📐 スタック：39/29mm", 
        "🧪 ミッドソール：React", "🪭 Zoom Airユニット搭載", "💴 価格：14,300〜16,500円"
      ]
    },
    design: "ReactフォームにZoom Airユニットを組み合わせた信頼の設計です。",
    impressions: "安定感抜群で、初心者から上級者まで幅広く使える万能性が魅力です。",
    likes: "抜群の安定性と信頼性。どんなペースでも対応できる万能性。",
    dislikes: "やや重めで、スピードを出すには物足りない。デザインが保守的。",
    scores: [
      { name: "クッション性", value: 4.2, max: 5, comment: "Reactフォームが優秀" },
      { name: "反発性", value: 3.5, max: 5, comment: "マイルドな反発" },
      { name: "デザイン", value: 3.5, max: 5, comment: "クラシックなデザイン" },
      { name: "履き心地", value: 4.5, max: 5, comment: "非常に快適" },
      { name: "フィット感", value: 4.3, max: 5, comment: "万人に合う" },
      { name: "安定性", value: 4.8, max: 5, comment: "最高クラスの安定性" },
      { name: "スピード性能", value: 3.0, max: 5, comment: "速いペースには不向き" },
      { name: "耐久性", value: 4.8, max: 5, comment: "非常に高く、長く使える" },
      { name: "グリップ", value: 4.5, max: 5, comment: "信頼性が高い" },
      { name: "コスパ", value: 4.5, max: 5, comment: "定番の安心感" }
    ],
    comparison: [
      { name: "ASICS NOVABLAST 4", content: "軽量性で劣るが安定性で上回る。", image: "" },
      { name: "HOKA Clifton 9", content: "よりソフトなクッション性。", image: "" },
      { name: "Brooks Ghost 15", content: "同系統。", image: "" }
    ],
    tips: "毎日のランニングに最適。メンテナンスも簡単で長く使えます。",
    summary: "Pegasus 40は信頼性抜群の定番デイリートレーナーです。",
    summaryShort: "信頼の定番デイリートレーナー",
    hashtags: "#Nike #Pegasus40 #レビュー"
  },
  sample3: {
    manufacturer: "Adidas",
    linkId: "adizero-boston-12",
    title: "Adizero Boston 12",
    price: "¥17,600〜20,900",
    weight: "約230g",
    heroImage: "",
    rakutenUrl: "https://item.rakuten.co.jp/sample-rakuten-boston12/", 
    amazonUrl: "https://www.amazon.co.jp/dp/sample-amazon-boston12",
    lead: "adidasのスピードシューズ「Adizero Boston 12」の詳細レビューです。",
    spec: {
      content: "Boston 12はスピードとクッションを両立した上級者向けシューズです。",
      chips: [
        "⚖️ 約230g", "📏 ドロップ：6.5mm", "📐 スタック：39/32.5mm",
        "🧪 ミッドソール：Lightstrike Pro", "🪭 EnergyRods 2.0搭載", "💴 価格：17,600〜20,900円"
      ]
    },
    design: "Lightstrike ProフォームにEnergyRods 2.0を組み合わせたレーシング仕様です。",
    impressions: "スピードを出した時の安定感と推進力が素晴らしく、レースでも使える性能です。",
    likes: "軽量でスピード性能抜群。レースからトレーニングまで幅広く対応。",
    dislikes: "価格が高め。初心者には扱いが難しい。クッション性はやや硬め。",
    scores: [
      { name: "クッション性", value: 3.8, max: 5, comment: "硬めだが反発は良い" },
      { name: "反発性", value: 4.8, max: 5, comment: "強力な推進力" },
      { name: "デザイン", value: 4.5, max: 5, comment: "洗練されたルックス" },
      { name: "履き心地", value: 3.5, max: 5, comment: "レース向きの硬さ" },
      { name: "フィット感", value: 4.7, max: 5, comment: "吸い付くようなフィット" },
      { name: "安定性", value: 4.0, max: 5, comment: "スピード時も安定" },
      { name: "スピード性能", value: 4.8, max: 5, comment: "最高峰のスピード" },
      { name: "耐久性", value: 4.0, max: 5, comment: "ミッドソールはやや消耗しやすい" },
      { name: "グリップ", value: 4.7, max: 5, comment: "信頼度が高い" },
      { name: "コスパ", value: 3.5, max: 5, comment: "価格は高め" }
    ],
    comparison: [
      { name: "Nike Vaporfly 3", content: "カーボンプレート搭載で性能は上。", image: "" },
      { name: "ASICS METASPEED SKY+", content: "同レベルの性能。", image: "" },
      { name: "Saucony Kinvara 14", content: "より軽量でミニマル。", image: "" }
    ],
    tips: "スピードトレーニングやレースでの使用がおすすめ。",
    summary: "Boston 12はスピードランナー向けの高性能シューズです。",
    summaryShort: "スピードランナー向け高性能シューズ",
    hashtags: "#adidas #Boston12 #レビュー"
  }
};

// --- JavaScript関数群 ---

/**
 * メーカー名で記事をグルーピングし、ドロップダウンメニューを生成する
 */
function buildArticleDropdown() {
  const articleLinksContainer = document.getElementById('articleLinks');
  if (!articleLinksContainer) return; // 要素がない場合は何もしない
  
  articleLinksContainer.innerHTML = '';
  
  // グルーピング
  const groupedArticles = {};
  Object.keys(sampleData).forEach(key => {
    const article = sampleData[key];
    const manufacturer = article.manufacturer || "その他";
    if (!groupedArticles[manufacturer]) {
      groupedArticles[manufacturer] = [];
    }
    groupedArticles[manufacturer].push({ 
      title: article.title, 
      key: key,
      link: `https://runnersplac.com/shoes/${article.linkId}`
    });
  });
  
  Object.keys(groupedArticles).sort().forEach(manufacturer => {
    // 親カテゴリ
    const manufacturerLink = document.createElement('a');
    manufacturerLink.href = '#';
    manufacturerLink.textContent = manufacturer;
    manufacturerLink.className = 'manufacturer-link';
    manufacturerLink.onclick = (e) => toggleSubList(e);
    
    const arrow = document.createElement('span');
    arrow.textContent = '▶';
    arrow.className = 'arrow';
    manufacturerLink.appendChild(arrow);
    articleLinksContainer.appendChild(manufacturerLink);
    
    // 子リスト
    const subList = document.createElement('div');
    subList.className = 'sub-list';
    subList.dataset.manufacturer = manufacturer;
    
    groupedArticles[manufacturer].sort((a, b) => a.title.localeCompare(b.title)).forEach(item => {
      const itemLink = document.createElement('a');
      itemLink.href = item.link;
      itemLink.textContent = item.title;
      itemLink.className = 'sub-item';
      itemLink.target = '_blank';
      itemLink.onclick = (e) => {
        e.preventDefault();
        loadDataToPage(sampleData[item.key]);
        document.querySelectorAll('#articleLinks .sub-item').forEach(a => a.classList.remove('active'));
        e.target.classList.add('active');
        closeAllDropdowns();
      };
      subList.appendChild(itemLink);
    });
    articleLinksContainer.appendChild(subList);
  });
}

/**
 * メーカー名クリック時にシューズリストの開閉を制御する
 */
function toggleSubList(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const clickedLink = event.currentTarget;
  const subList = clickedLink.nextElementSibling;
  
  if (!subList || !subList.classList.contains('sub-list')) return;
  
  const isOpen = subList.classList.contains('open');
  const parentContent = clickedLink.closest('.dropdown-content');
  
  if (parentContent) {
    parentContent.querySelectorAll('.manufacturer-link').forEach(link => {
      if (link !== clickedLink) link.classList.remove('open');
    });
    parentContent.querySelectorAll('.sub-list').forEach(list => {
      if (list !== subList) list.classList.remove('open');
    });
  }
  
  if (!isOpen) {
    clickedLink.classList.add('open');
    subList.classList.add('open');
  } else {
    clickedLink.classList.remove('open');
    subList.classList.remove('open');
  }
}

// JSONファイル読み込み機能
function loadJsonFile() {
  const fileInput = document.getElementById('jsonFileInput');
  if (!fileInput) return;
  
  const file = fileInput.files[0];
  if (!file) {
    showMessageBox('JSONファイルを選択してください。', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      loadDataToPage(data);
      showMessageBox('データが正常に読み込まれました！', 'success');
    } catch (error) {
      showMessageBox('JSONファイルの読み込みに失敗しました。ファイル形式を確認してください。', 'error');
      console.error('JSON parse error:', error);
    }
  };
  reader.readAsText(file);
}

// カスタムメッセージボックス
function showMessageBox(message, type = 'info') {
  let box = document.getElementById('customMessageBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'customMessageBox';
    box.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 25px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      opacity: 0;
      transition: opacity 0.5s, transform 0.5s;
      transform: translateY(-20px);
    `;
    document.body.appendChild(box);
  }

  box.textContent = message;
  if (type === 'success') {
    box.style.backgroundColor = '#10b981';
  } else if (type === 'error') {
    box.style.backgroundColor = '#ef4444';
  } else {
    box.style.backgroundColor = '#6366f1';
  }

  box.style.opacity = '1';
  box.style.transform = 'translateY(0)';

  setTimeout(() => {
    box.style.opacity = '0';
    box.style.transform = 'translateY(-20px)';
  }, 3000);
}

// データをページに反映する関数
function loadDataToPage(data) {
  // タイトルと基本情報
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    if (data.title && data.manufacturer) {
      pageTitle.textContent = `${data.manufacturer} ${data.title} レビュー`;
    } else if (data.title) {
      pageTitle.textContent = data.title;
    }
  }
  
  const priceChip = document.getElementById('priceChip');
  if (priceChip && data.price) priceChip.textContent = `💴 ${data.price}`;
  
  const weightChip = document.getElementById('weightChip');
  if (weightChip && data.weight) weightChip.textContent = `⚖️ ${data.weight}`;
  
  // 購入リンクの更新
  const rakutenLink = document.getElementById('rakutenLink');
  const amazonLink = document.getElementById('amazonLink');
  
  if (rakutenLink) {
    if (data.rakutenUrl) {
      rakutenLink.href = data.rakutenUrl;
      rakutenLink.style.display = 'inline-flex';
    } else {
      rakutenLink.href = '#';
      rakutenLink.style.display = 'none';
    }
  }

  if (amazonLink) {
    if (data.amazonUrl) {
      amazonLink.href = data.amazonUrl;
      amazonLink.style.display = 'inline-flex';
    } else {
      amazonLink.href = '#';
      amazonLink.style.display = 'none';
    }
  }

  // ヒーロー画像の設定
  const heroImg = document.getElementById('mainHeroImage');
  if (heroImg) {
    if (data.heroImage) {
      heroImg.src = data.heroImage;
      heroImg.style.display = 'block';
    } else {
      heroImg.src = '';
      heroImg.style.display = 'none';
    }
  }

  // 各セクションの内容を設定
  const contentFields = [
    { id: 'leadContent', key: 'lead' },
    { id: 'designContent', key: 'design' },
    { id: 'impressionsContent', key: 'impressions' },
    { id: 'likesContent', key: 'likes' },
    { id: 'dislikesContent', key: 'dislikes' },
    { id: 'tipsContent', key: 'tips' },
    { id: 'summaryContent', key: 'summary' },
    { id: 'summaryShort', key: 'summaryShort' },
    { id: 'hashtags', key: 'hashtags' }
  ];

  contentFields.forEach(field => {
    const element = document.getElementById(field.id);
    if (element && data[field.key]) {
      element.textContent = data[field.key];
    }
  });
  
  // スペック情報
  if (data.spec) {
    const specContent = document.getElementById('specContent');
    if (specContent && data.spec.content) {
      specContent.textContent = data.spec.content;
    }
    
    if (data.spec.chips) {
      const specsContainer = document.getElementById('specChips');
      if (specsContainer) {
        specsContainer.innerHTML = '';
        data.spec.chips.forEach(chip => {
          const chipEl = document.createElement('div');
          chipEl.className = 'spec';
          chipEl.textContent = chip;
          specsContainer.appendChild(chipEl);
        });
      }
    }
  }
  
  // スコア情報
  if (data.scores) {
    const scoresContainer = document.getElementById('scoresContainer');
    if (scoresContainer) {
      scoresContainer.innerHTML = '';
      data.scores.forEach(score => {
        const scoreEl = document.createElement('div');
        scoreEl.className = 'score';
        scoreEl.innerHTML = `
          <div class="label">
            <span>${score.name}</span>
            <span class="val" contenteditable="false" style="outline: none;">${score.value}／${score.max}</span>
          </div>
          <div class="bar"><span></span></div>
          <p class="sub" style="font-size:0.85rem;color:var(--muted);" contenteditable="false">${score.comment}</p>
        `;
        scoresContainer.appendChild(scoreEl);
      });
      updateScoreBars();
    }
  }
  
  // 比較情報
  if (data.comparison) {
    const comparisonContainer = document.getElementById('comparisonContainer');
    if (comparisonContainer) {
      comparisonContainer.innerHTML = '';
      
      data.comparison.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'mini card comparison-item';
        itemEl.style.background = 'var(--card-soft)';
        
        itemEl.innerHTML = `
          <img class="comparison-img" id="compImg${index}" alt="${item.name} image" style="display: ${item.image ? 'block' : 'none'};" src="${item.image || ''}" />
          <h3 contenteditable="false" style="outline: none;">${item.name}</h3>
          <p contenteditable="false" style="outline: none;">${item.content}</p>
          <div class="image-controls">
              <button class="btn addCompImg" type="button" data-target-id="compImg${index}">写真を追加</button>
              <input type="file" accept="image/*" class="compImgInput" data-target-id="compImg${index}" style="display:none;">
          </div>
        `;
        comparisonContainer.appendChild(itemEl);
      });
      setupComparisonImageLoaders();
    }
  }
  
  // 目次を更新
  buildTOC();
}

// 比較画像ローダー設定関数
function setupComparisonImageLoaders() {
  // 既存のリスナーを削除
  document.querySelectorAll('.addCompImg').forEach(btn => {
    btn.removeEventListener('click', handleAddCompImgClick);
  });
  document.querySelectorAll('.compImgInput').forEach(input => {
    input.removeEventListener('change', handleCompImgInputChange);
  });

  // 新しいリスナーを追加
  document.querySelectorAll('.addCompImg').forEach(btn => {
    btn.addEventListener('click', handleAddCompImgClick);
  });
  
  document.querySelectorAll('.compImgInput').forEach(input => {
    input.addEventListener('change', handleCompImgInputChange);
  });
}

function handleAddCompImgClick(e) {
  e.preventDefault();
  const targetId = e.currentTarget.getAttribute('data-target-id');
  const input = document.querySelector(`.compImgInput[data-target-id="${targetId}"]`);
  if (input) input.click();
}

function handleCompImgInputChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  
  const targetId = e.target.getAttribute('data-target-id');
  const img = document.getElementById(targetId);
  
  const reader = new FileReader();
  reader.onload = (ev) => {
    if (img) {
      img.src = ev.target.result;
      img.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

// JSONテンプレートをダウンロードする関数
function downloadTemplate() {
  const template = {
    manufacturer: "メーカー名",
    linkId: "shoe-model-name",
    title: "記事タイトル",
    price: "¥10,000〜15,000",
    weight: "約250g",
    heroImage: "",
    rakutenUrl: "https://example.com/rakuten-link",
    amazonUrl: "https://example.com/amazon-link",
    lead: "リード文をここに入力してください。",
    spec: {
      content: "スペックの説明文",
      chips: [
        "⚖️ 重量情報",
        "📏 ドロップ情報",
        "📐 スタック情報",
        "🧪 ミッドソール情報",
        "🪭 プレート情報",
        "💴 価格情報"
      ]
    },
    design: "設計思想の説明",
    impressions: "実走インプレッション",
    likes: "好きな点",
    dislikes: "惜しい点",
    scores: [
      { name: "クッション性", value: 4.0, max: 5, comment: "コメント" },
      { name: "反発性", value: 4.0, max: 5, comment: "コメント" },
      { name: "デザイン", value: 4.0, max: 5, comment: "コメント" },
      { name: "履き心地", value: 4.0, max: 5, comment: "コメント" },
      { name: "フィット感", value: 4.0, max: 5, comment: "コメント" },
      { name: "安定性", value: 4.0, max: 5, comment: "コメント" },
      { name: "スピード性能", value: 4.0, max: 5, comment: "コメント" },
      { name: "耐久性", value: 4.0, max: 5, comment: "コメント" },
      { name: "グリップ", value: 4.0, max: 5, comment: "コメント" },
      { name: "コスパ", value: 4.0, max: 5, comment: "コメント" }
    ],
    comparison: [
      { name: "比較対象1", content: "比較内容1", image: "" },
      { name: "比較対象2", content: "比較内容2", image: "" },
      { name: "比較対象3", content: "比較内容3", image: "" }
    ],
    tips: "使いこなしTipsと寿命について",
    summary: "まとめの文章",
    summaryShort: "要約文",
    hashtags: "#タグ1 #タグ2 #タグ3"
  };
  
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'blog_template.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// スコアバーの幅を設定
function updateScoreBars() {
  document.querySelectorAll('.score').forEach((el) => {
    const valText = el.querySelector('.val')?.textContent || '';
    const m = valText.trim().match(/([0-9]+(?:\.[0-9]+)?)\s*[／\/]\s*([0-9]+)/);
    let pct = 0;
    if (m) {
      const val = parseFloat(m[1]);
      const max = parseFloat(m[2]);
      pct = Math.max(0, Math.min(100, (val / max) * 100));
    }
    requestAnimationFrame(() => {
      const bar = el.querySelector('.bar>span');
      if (bar) bar.style.width = pct + '%';
    });
  });
}

// 目次を生成する関数
function buildTOC() {
  const toc = document.getElementById('toc');
  const tocLinks = document.getElementById('tocLinks');
  if (!toc && !tocLinks) return;
  
  if (toc) toc.innerHTML = '';
  if (tocLinks) tocLinks.innerHTML = '';
  
  document.querySelectorAll('section[id]').forEach(section => {
    const id = section.id;
    if (id === 'hero-image-section') return;
    
    const heading = section.querySelector('h2');
    const title = heading ? heading.textContent.trim() : id;
    
    // メイン目次
    if (toc) {
      const a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = title;
      toc.appendChild(a);
    }
    
    // ドロップダウン目次
    if (tocLinks) {
      const sideA = document.createElement('a');
      sideA.href = '#' + id;
      sideA.textContent = title;
      sideA.onclick = (e) => smoothScroll(e, '#' + id);
      sideA.className = 'sub-item';
      tocLinks.appendChild(sideA);
    }
  });
}

// ドロップダウンの開閉制御
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown').forEach(d => {
    d.classList.remove('open');
  });
}

function toggleDropdown(event) {
  const clickedDropdown = event.currentTarget;
  const isCurrentlyOpen = clickedDropdown.classList.contains('open');

  closeAllDropdowns();
  
  document.querySelectorAll('.manufacturer-link').forEach(link => link.classList.remove('open'));
  document.querySelectorAll('.sub-list').forEach(list => list.classList.remove('open'));

  if (!isCurrentlyOpen) {
    clickedDropdown.classList.add('open');
  }
  event.stopPropagation();
}

// グローバルな編集状態
let editing = false;

// ヒーロー画像ローダー
function setupHeroImageLoader() {
  const btn = document.querySelector('.addHeroImg');
  const input = document.getElementById('heroImgInput');
  const img = document.getElementById('mainHeroImage');
  
  if (btn && input && img) {
    btn.addEventListener('click', () => {
      input.click();
    });

    input.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        img.src = ev.target.result;
        img.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }
}

// セクションごとの画像追加機能
function setupSectionImageLoaders() {
  document.querySelectorAll('.addImg').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('section');
      const input = section.querySelector('.imgInput');
      if (input) input.click();
    });
  });

  document.querySelectorAll('.imgInput').forEach(input => {
    input.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const section = input.closest('section');
        const img = section.querySelector('.section-img');
        if (img) {
          img.src = ev.target.result;
          img.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    });
  });
}

// 編集モード切替
function setupEditMode() {
  const editBtn = document.getElementById('editBtn');
  if (!editBtn) return;

  editBtn.addEventListener('click', () => {
    editing = !editing;
    document.querySelectorAll('h1, h2, h3, p, .spec, .val, .sub, .hashtags').forEach(el => {
      el.contentEditable = editing;
      el.style.outline = editing ? '1px dashed var(--accent)' : 'none';
      el.style.outlineOffset = editing ? '2px' : '0';
    });
    editBtn.textContent = editing ? '編集終了' : '編集';
    if (!editing) {
      buildTOC();
      updateScoreBars();
    }
  });
}

// 保存機能
function setupSaveFunction() {
  const saveBtn = document.getElementById('saveBtn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', () => {
    document.querySelectorAll('h1, h2, h3, p, .spec, .val, .sub, .hashtags').forEach(el => {
      el.removeAttribute('contenteditable');
      el.style.outline = '';
      el.style.outlineOffset = '';
    });
    editing = false;
    
    const editBtn = document.getElementById('editBtn');
    if (editBtn) editBtn.textContent = '編集';

    const html = '<!doctype html>\n' + document.documentElement.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blog_article.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    buildTOC();
    showMessageBox('記事がHTMLファイルとしてダウンロードされました！', 'success');
  });
}

// スムーススクロール
function smoothScroll(e, targetSelector) {
  e.preventDefault();
  const target = document.querySelector(targetSelector);
  if (target) {
    const fixedHeader = document.getElementById('fixedHeader');
    const headerHeight = fixedHeader ? fixedHeader.offsetHeight : 0;
    const targetPosition = target.offsetTop - headerHeight - 10;
    
    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });
  }
  closeAllDropdowns();
}

// マウスカーソル追従グローエフェクト
function setupGlowEffect() {
  const mainContent = document.getElementById('mainContent');
  const glowDot = document.getElementById('glowDot');
  
  if (!mainContent || !glowDot) return;
  
  let mouseX = 0, mouseY = 0;
  let currentX = 0, currentY = 0;
  
  mainContent.addEventListener('mousemove', (e) => {
    const rect = mainContent.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    const mainContentTopAbs = rect.top + window.scrollY;
    const cursorYAbs = e.clientY + window.scrollY;
    mouseY = cursorYAbs - mainContentTopAbs;
  });

  function animateGlow() {
    currentX += (mouseX - currentX) * 0.08;
    currentY += (mouseY - currentY) * 0.08;
    glowDot.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
    requestAnimationFrame(animateGlow);
  }

  window.addEventListener('load', animateGlow);
}

// 初期化関数
function initializeTemplate() {
  // 基本機能の初期化
  buildArticleDropdown();
  buildTOC();
  updateScoreBars();
  
  // サンプルデータの初期ロード（存在する場合）
  if (sampleData && sampleData['sample1']) {
    loadDataToPage(sampleData['sample1']);
  }
  
  // アクティブリンクの設定
  const firstArticleLink = document.querySelector('#articleLinks .sub-item');
  if (firstArticleLink) {
    firstArticleLink.classList.add('active');
  }

  // イベントリスナーの設定
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#fixedHeader')) {
      closeAllDropdowns();
    }
  });

  // スクロールイベントハンドリング
  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('#')) {
      smoothScroll(e, e.target.getAttribute('href'));
    }
  });
  
  // 各機能の初期化
  setupHeroImageLoader();
  setupSectionImageLoaders();
  setupEditMode();
  setupSaveFunction();
  setupGlowEffect();
}

// DOMが読み込まれたら初期化を実行
document.addEventListener('DOMContentLoaded', initializeTemplate);

// グローバルに公開する関数（必要に応じて）
window.loadJsonFile = loadJsonFile;
window.downloadTemplate = downloadTemplate;
window.toggleDropdown = toggleDropdown;