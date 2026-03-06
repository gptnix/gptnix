'use strict';

/**
 * 🔧 ADMIN: Memory System Diagnostics
 * 
 * GET /admin/memory/stats - Memory system statistics
 * POST /admin/memory/cache/warm - Warm embedding cache
 * POST /admin/memory/cache/clear - Clear memory result cache
 * 
 * Usage: Add to your admin routes or call directly for debugging
 */

const express = require('express');
const { getCacheStats: getEmbeddingCacheStats } = require('../utils/embeddingCache');
const { getCacheStats: getMemoryCacheStats } = require('../utils/memoryResultCache');
const { warmEmbeddingCache } = require('../utils/cacheWarming');
const { qdrantClient, qdrantEnabled } = require('../clients/qdrant');
const { COLLECTION_NAME } = require('../config/env');

function createMemoryAdminRouter() {
  const router = express.Router();

  /**
   * GET /admin/memory/stats
   * Returns comprehensive memory system statistics
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        caches: {
          embedding: getEmbeddingCacheStats(),
          memoryResults: getMemoryCacheStats(),
        },
        qdrant: {
          enabled: qdrantEnabled,
          collection: COLLECTION_NAME,
        },
      };

      // Get Qdrant collection info if available
      if (qdrantEnabled) {
        try {
          const collectionInfo = await qdrantClient.getCollection(COLLECTION_NAME);
          stats.qdrant.pointsCount = collectionInfo.points_count || 0;
          stats.qdrant.vectorSize = collectionInfo.config?.params?.vectors?.size || 0;
        } catch (err) {
          stats.qdrant.error = err.message;
        }
      }

      return res.json(stats);
    } catch (error) {
      console.error('❌ [ADMIN] Memory stats error:', error);
      return res.status(500).json({ error: 'Failed to get memory stats' });
    }
  });

  /**
   * POST /admin/memory/cache/warm
   * Warm embedding cache for common queries
   */
  router.post('/cache/warm', async (req, res) => {
    try {
      console.log('🔥 [ADMIN] Starting cache warming...');
      const result = await warmEmbeddingCache();
      return res.json({
        success: true,
        ...result,
        message: `Warmed ${result.warmed}/${result.total} embeddings`,
      });
    } catch (error) {
      console.error('❌ [ADMIN] Cache warming error:', error);
      return res.status(500).json({ error: 'Failed to warm cache' });
    }
  });

  /**
   * POST /admin/memory/cache/clear
   * Clear memory result cache (useful after updating memories manually)
   */
  router.post('/cache/clear', (req, res) => {
    try {
      const { clearUserCache } = require('../utils/memoryResultCache');
      // Clear all (pass null userId to clear everything)
      clearUserCache(null);
      return res.json({
        success: true,
        message: 'Memory result cache cleared',
      });
    } catch (error) {
      console.error('❌ [ADMIN] Cache clear error:', error);
      return res.status(500).json({ error: 'Failed to clear cache' });
    }
  });

  return router;
}

module.exports = { createMemoryAdminRouter };
