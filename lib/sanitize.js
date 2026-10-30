// lib/sanitize.js
const DOMPurify = require('isomorphic-dompurify');

// 記事HTML用のサニタイズ。<script>・onclick等のイベント属性・javascript: URL を除去し、<style> は残す
function sanitizeArticleHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(String(html), {
    FORCE_BODY: true, // 先頭の <style> が落ちないように
    ADD_TAGS: ['style'],
  });
}

module.exports = { sanitizeArticleHtml };
