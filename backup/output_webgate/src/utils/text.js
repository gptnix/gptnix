'use strict';

const path = require('path');

function safeExtFromName(originalName) {
  const ext = path.extname(originalName || '').toLowerCase().replace('.', '');
  return ext || '';
}

// Simple chunker with overlap (used for RAG indexing)
function chunkText(text, maxLen = 800, overlap = 120) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  const chunks = [];
  let i = 0;

  while (i < clean.length) {
    const end = Math.min(i + maxLen, clean.length);
    const slice = clean.slice(i, end);

    chunks.push(slice);
    i = end - overlap;
    if (i < 0) i = 0;
    if (end === clean.length) break;
  }

  return chunks.filter((c) => c.trim().length > 0);
}

module.exports = {
  chunkText,
  safeExtFromName,
};
