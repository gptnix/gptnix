'use strict';

/**
 * 🚀 MEMORY RESULT CACHE
 * 
 * Problem: retrieveFromQdrant() traje 3-4s (OpenAI embeddings + Qdrant search)
 * Rješenje: Cache rezultate memory query-a za 5 minuta
 * 
 * Benefit: Drugi request sa istim pitanjem = instant (<10ms)
 */

const crypto = require('crypto');

const memoryResultCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

/**
 * Generiši cache key iz userId + query
 */
function generateCacheKey(userId, query) {
  const normalized = String(query || '').toLowerCase().trim();
  const hash = crypto.createHash('sha256')
    .update(`${userId}:${normalized}`)
    .digest('hex')
    .slice(0, 16);
  return `mem_${hash}`;
}

/**
 * Dobavi cached memory results
 */
function getCachedMemories(userId, query) {
  const key = generateCacheKey(userId, query);
  const cached = memoryResultCache.get(key);
  
  if (!cached) return null;
  
  // Check TTL
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    memoryResultCache.delete(key);
    return null;
  }
  
  console.log(`🚀 [MEMORY-CACHE] HIT for user ${userId} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
  return cached.results;
}

/**
 * Cache memory results
 */
function cacheMemories(userId, query, results) {
  if (!results || !Array.isArray(results)) return;
  
  const key = generateCacheKey(userId, query);
  
  // LRU eviction
  if (memoryResultCache.size >= MAX_CACHE_SIZE) {
    const firstKey = memoryResultCache.keys().next().value;
    memoryResultCache.delete(firstKey);
  }
  
  memoryResultCache.set(key, {
    results,
    timestamp: Date.now(),
  });
  
  console.log(`💾 [MEMORY-CACHE] STORE for user ${userId} (${results.length} memories)`);
}

/**
 * Clear cache za određenog usera (ili sve ako userId = null)
 */
function clearUserCache(userId) {
  let cleared = 0;
  
  if (userId === null || userId === undefined) {
    // Clear all
    cleared = memoryResultCache.size;
    memoryResultCache.clear();
    if (cleared > 0) {
      console.log(`🧹 [MEMORY-CACHE] Cleared all ${cleared} entries`);
    }
  } else {
    // Clear for specific user (future: track userId in cache key)
    // For now, just clear all since we don't track userId separately
    cleared = memoryResultCache.size;
    memoryResultCache.clear();
    if (cleared > 0) {
      console.log(`🧹 [MEMORY-CACHE] Cleared ${cleared} entries for user ${userId}`);
    }
  }
  
  return cleared;
}

function getCacheStats() {
  return {
    size: memoryResultCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL,
  };
}

module.exports = {
  getCachedMemories,
  cacheMemories,
  clearUserCache,
  getCacheStats,
};
