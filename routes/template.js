const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { requireAdmin, validateIdParam } = require('../lib/session');

router.param('configName', validateIdParam);

// JSONテンプレート設定を読み込んでHTMLを生成するルート
router.get('/template/:configName', async (req, res) => {
  try {
    const configName = req.params.configName;
    
    // JSONファイルを読み込み
    const configPath = path.join(__dirname, '..', 'data', `${configName}.json`);
    console.log('Loading config from:', configPath);
    
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    console.log('Config loaded:', config.metadata?.title);
    
    // EJSテンプレートでレンダリング
    res.render('article-template', { config });
    
  } catch (error) {
    console.error('Template generation error:', error);
    
    if (error.code === 'ENOENT') {
      return res.status(404).send(`設定ファイル '${req.params.configName}.json' が見つかりません`);
    }
    
    res.status(500).send('テンプレート生成エラー: ' + error.message);
  }
});

// 設定ファイル一覧を取得するAPI
router.get('/api/configs', requireAdmin, async (req, res) => {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    const files = await fs.readdir(dataDir);
    
    // .jsonファイルのみを抽出
    const jsonFiles = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    
    res.json({ configs: jsonFiles });
  } catch (error) {
    console.error('Config list error:', error);
    res.status(500).json({ error: 'Failed to load config list' });
  }
});

// デフォルトのエディタページ
router.get('/editor', requireAdmin, async (req, res) => {
  res.redirect('/editor/template-config');
});

// JSONファイルを直接編集するためのエディタページ
router.get('/editor/:configName', requireAdmin, async (req, res) => {
  try {
    const configName = req.params.configName || 'template-config';
    
    let config = {};
    
    try {
      const configPath = path.join(__dirname, '..', 'data', `${configName}.json`);
      const configData = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configData);
    } catch (error) {
      console.log('No existing config found, using default');
    }
    
    res.render('json-editor', { 
      configName, 
      configJson: JSON.stringify(config, null, 2) 
    });
    
  } catch (error) {
    console.error('Editor load error:', error);
    res.status(500).send('エディタ読み込みエラー: ' + error.message);
  }
});

// JSON設定を保存するAPI
router.post('/api/save-config/:configName', requireAdmin, async (req, res) => {
  try {
    const configName = req.params.configName;
    const { config } = req.body;
    
    console.log('Saving config:', configName);
    
    // JSONの妥当性をチェック
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(config);
    } catch (parseError) {
      return res.status(400).json({ 
        error: 'JSONの形式が正しくありません', 
        details: parseError.message 
      });
    }
    
    // ファイルに保存
    const configPath = path.join(__dirname, '..', 'data', `${configName}.json`);
    await fs.writeFile(configPath, JSON.stringify(parsedConfig, null, 2), 'utf-8');
    
    console.log('Config saved to:', configPath);
    
    res.json({ 
      success: true, 
      message: '設定が保存されました',
      previewUrl: `/template/${configName}`
    });
    
  } catch (error) {
    console.error('Save config error:', error);
    res.status(500).json({ 
      error: '設定の保存に失敗しました', 
      details: error.message 
    });
  }
});

module.exports = router;