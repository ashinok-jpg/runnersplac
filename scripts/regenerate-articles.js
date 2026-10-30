const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'articles');
const pubDir = path.join(__dirname, '..', 'public', 'articles');

function regen(publishAll = false) {
  if (!fs.existsSync(dataDir)) {
    console.error('dataDir not found:', dataDir);
    process.exit(1);
  }
  fs.readdirSync(dataDir).forEach((file) => {
    if (!file.endsWith('.json')) return;
    const jsonPath = path.join(dataDir, file);
    try {
      const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const id = path.basename(file, '.json');
      const htmlPath = path.join(pubDir, id + '.html');
      const shouldPublish = publishAll || !doc.isDraft;
      if (shouldPublish && doc.html) {
        fs.mkdirSync(pubDir, { recursive: true });
        fs.writeFileSync(htmlPath, doc.html, 'utf8');
        console.log('Published:', htmlPath);
      } else {
        // remove existing html if present and doc is draft
        try { fs.unlinkSync(htmlPath); console.log('Removed (draft):', htmlPath); } catch (e) {}
        console.log('Skipped (draft or empty html):', id);
      }
    } catch (e) {
      console.error('Failed to process', jsonPath, e.message);
    }
  });
}

const publishAll = process.argv.includes('--publish-all') || process.argv.includes('-a');
regen(publishAll);

// Usage examples (Windows cmd.exe):
//  node scripts\\regenerate-articles.js        -> publishes non-drafts
//  node scripts\\regenerate-articles.js -a     -> force-publishes all (overwrites)
