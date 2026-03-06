'use strict';

const crypto = require('crypto');
const embeddingCache = new Map();
const CACHE_MAX_SIZE = 200;
const CACHE_TTL = 60 * 60 * 1000; // 1h

function cacheKey(text) {
  return crypto.createHash('sha1').update(String(text || '')).digest('hex');
}

function getFromCache(text) {
  const key = cacheKey(text);
  const cached = embeddingCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    embeddingCache.delete(key);
    return null;
  }
  return cached.embedding;
}

function setInCache(text, embedding) {
  if (!embedding) return;

  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }

  embeddingCache.set(cacheKey(text), {
    embedding,
    timestamp: Date.now(),
  });
}

function getCacheSize() {
  return embeddingCache.size;
}

module.exports = {
  getFromCache,
  setInCache,
  getCacheSize,
};
