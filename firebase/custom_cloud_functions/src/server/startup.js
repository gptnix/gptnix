'use strict';

const {
  PORT,
  logEnvironment,
  OPENAI_API_KEY,
  REPLICATE_API_TOKEN,
  REPLICATE_VERSION,
  COLLECTION_NAME,
  RAG_COLLECTION,
  QDRANT_URL,
  QDRANT_API_KEY,
} = require('../config/env');
const { printBanner } = require('./banner');

/**
 * Pretty startup summary (one place to maintain).
 * Call this ONCE per process role (typically master in production, or single-process dev).
 */
function logStartupSummary({ mode, clustering, workers } = {}) {
  const envMode = mode || process.env.NODE_ENV || 'development';
  const qdrantEnabled = Boolean(QDRANT_URL);

  printBanner(envMode);

  console.log(`✅ Server: Port ${PORT}`);
  console.log(`🧩 Mode: ${envMode}${clustering ? ' (cluster master)' : ''}`);
  if (clustering && workers) {
    console.log(`👷 Workers: ${workers}`);
  }

  console.log('🤖 Chat: DeepSeek primary, OpenAI fallback');
  console.log(`🧠 Embeddings: ${OPENAI_API_KEY ? 'OpenAI (fast)' : 'Disabled'}`);
  console.log(`🖼️  Image Gen: ${REPLICATE_API_TOKEN ? `Replicate (${REPLICATE_VERSION})` : 'Disabled'}`);
  console.log(
    `📦 Qdrant (collection='${COLLECTION_NAME}', rag='${RAG_COLLECTION}'): ${qdrantEnabled ? 'Enabled' : 'Disabled'}`,
  );

  console.log('═══════════════════════════════════════════════════════\n');
}

/**
 * Standard environment log (centralized entry).
 */
function logStartupEnvironmentOnce() {
  logEnvironment();
}

module.exports = { logStartupSummary, logStartupEnvironmentOnce };
