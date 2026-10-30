// routes/shoes.js
const express = require('express');
const path = require('path');
const router = express.Router();
const { loadArticle } = require('../lib/articles');
const { isLocalDev } = require('../lib/session');

const modPath = path.join(__dirname, '..', 'data', 'shoesData.js');
const norm = s => String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'-');

function getShoes(refresh = false){
  if (refresh) delete require.cache[require.resolve(modPath)];
  const list = require(modPath);
  if (!Array.isArray(list)) throw new Error('shoesData.js must export an array');
  return list;
}

router.get('/:id', async (req, res, next) => {
  try {
    const want = norm(req.params.id);
    const list = getShoes(true);
    const shoe = list.find(s => norm(s.id) === want || norm(s.slug||s.name) === want);
    
    if (!shoe) {
      return res.status(404).send('Not Found');
    }

    // 表示用の細かい整形（任意）
    if (shoe.price && typeof shoe.price === 'number') shoe.price = shoe.price;
    if (shoe.offset && !shoe.drop) shoe.drop = shoe.offset;

    const article = loadArticle(shoe.id);
    const canSeeDraft = req.user?.isAdmin || isLocalDev(req);
    shoe.articleHtml = article && (!article.draft || canSeeDraft) ? article.html : '';

    res.render('shoe-detail', { 
      shoe, 
      communityAvg: null, 
      communityCount: 0 
    });
  } catch (e) { 
    next(e); 
  }
});

module.exports = router;


