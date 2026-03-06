'use strict';

const express = require('express');

const { qdrantClient, qdrantEnabled, wakeUpQdrant } = require('../clients/qdrant');
const {
  OPENAI_API_KEY,
  REPLICATE_API_TOKEN,
  REPLICATE_VERSION,
  TAVILY_API_KEY,
  SERPER_API_KEY,
} = require('../config/env');
const runtime = require('../state/runtime');
const { getBucketName } = require('../config/firebase');
const { getCacheSize } = require('../utils/embeddingCache');
const { callDeepSeek } = require('../services/providers/deepseek');
const { getMetricsSnapshot } = require('../utils/observability');

function createHealthRouter() {
  const router = express.Router();

  // Clean helper — wake up Qdrant then verify with a real collections call
  async function checkQdrant() {
    const ok = await wakeUpQdrant();
    if (!ok) throw new Error('Qdrant wake-up failed');
    return qdrantClient.getCollections();
  }

  router.get('/health', async (req, res) => {
    try {
      const checks = await Promise.allSettled([
        Promise.race([
          callDeepSeek('Test', 0.1, 5),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DeepSeek timeout')), 5000),
          ),
        ]),
        qdrantEnabled ? checkQdrant() : Promise.resolve('disabled'),
      ]);

      const deepseekStatus = checks[0].status === 'fulfilled' ? 'connected' : 'error';
      const qdrantStatus = qdrantEnabled
        ? checks[1].status === 'fulfilled'
          ? 'connected'
          : 'error'
        : 'disabled';

      res.json({
        status: 'healthy',
        deepseek: deepseekStatus,
        qdrant: qdrantStatus,
        embeddings: OPENAI_API_KEY ? 'openai-fast' : 'disabled',
        replicate: {
          available: Boolean(REPLICATE_API_TOKEN),
          model: REPLICATE_VERSION,
        },
        websearch: {
          tavily: { available: Boolean(TAVILY_API_KEY) },
          serper: { available: Boolean(SERPER_API_KEY) },
          ddg: { available: true },
        },
        cars: {
          vpic: { available: true },
          nhtsaRecalls: { available: true },
          carquery: { available: true },
        },
        storage: { bucket: getBucketName() },
        embeddingDimension: runtime.embeddingDimension,
        cacheSize: getCacheSize(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // V3: Observability metrics endpoint
  router.get('/metrics', (req, res) => {
    try {
      const metrics = getMetricsSnapshot();
      res.json({
        ...metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}

module.exports = { createHealthRouter };
