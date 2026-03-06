'use strict';

const { QdrantClient } = require('@qdrant/js-client-rest');
const {
  QDRANT_URL,
  QDRANT_API_KEY,
  COLLECTION_NAME,
  RAG_COLLECTION,
  QDRANT_WAKEUP_MAX_RETRIES,
  QDRANT_WAKEUP_RETRY_BASE_MS,
} = require('../config/env');
const runtime = require('../state/runtime');

const qdrantEnabled = Boolean(QDRANT_URL);
// API key is optional (Qdrant Cloud uses it; self-hosted may not).

const qdrantClient = qdrantEnabled
  ? new QdrantClient({
      url: QDRANT_URL,
      ...(QDRANT_API_KEY ? { apiKey: QDRANT_API_KEY } : {}),
    })
  : null;

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Qdrant Cloud (and some managed setups) may "sleep" after inactivity.
// On first request you might see transient 502/503/504, timeouts, or connection resets.
// This helper retries a lightweight endpoint until Qdrant is awake.
function _isTransientWakeupError(err) {
  const status = err?.status || err?.response?.status;
  const code = err?.code;
  const msg = String(err?.message || '').toLowerCase();

  if ([502, 503, 504].includes(status)) return true;
  if (code && ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code)) return true;
  if (msg.includes('timeout') || msg.includes('timed out')) return true;
  if (msg.includes('connect') && msg.includes('refused')) return true;
  if (msg.includes('socket') && msg.includes('hang up')) return true;
  if (msg.includes('bad gateway') || msg.includes('service unavailable') || msg.includes('gateway timeout')) return true;

  return false;
}

async function wakeUpQdrant(options = {}) {
  if (!qdrantEnabled) return false;

  const maxRetries = Number.isFinite(Number(options.maxRetries))
    ? Number(options.maxRetries)
    : Number(QDRANT_WAKEUP_MAX_RETRIES || 8);

  const baseDelayMs = Number.isFinite(Number(options.baseDelayMs))
    ? Number(options.baseDelayMs)
    : Number(QDRANT_WAKEUP_RETRY_BASE_MS || 1500);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Very cheap "ping" that also verifies auth.
      await qdrantClient.getCollections();
      return true;
    } catch (err) {
      const transient = _isTransientWakeupError(err);

      if (!transient || attempt === maxRetries) {
        const status = err?.status || err?.response?.status;
        const code = err?.code;
        const msg = err?.message || String(err);
        console.warn(`⚠️ Qdrant wake-up failed (attempt ${attempt + 1}/${maxRetries + 1}) status=${status || '-'} code=${code || '-'} msg=${msg}`);
        return false;
      }

      const delay = Math.min(30000, baseDelayMs * Math.pow(1.6, attempt));
      console.log(`⏳ Qdrant sleeping / transient error. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries + 1})...`);
      await _sleep(delay);
    }
  }

  return false;
}


// user_memories
async function ensureMemoriesCollection({ skipWakeUp = false } = {}) {
  if (!qdrantEnabled) return false;

  // Best-effort wake-up (do not throw). Caller may skip if already awake.
  if (!skipWakeUp) await wakeUpQdrant();

  try {
    const col = await qdrantClient.getCollection(COLLECTION_NAME);
    const size = col?.result?.config?.params?.vectors?.size ?? runtime.embeddingDimension;

    console.log(`📦 Qdrant collection '${COLLECTION_NAME}' OK (dim=${size})`);
    runtime.embeddingDimension = size;
    return true;
  } catch (_error) {
    console.log(`📦 Creating Qdrant collection '${COLLECTION_NAME}'...`);

    try {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: runtime.embeddingDimension,
          distance: 'Cosine',
        },
      });
    } catch (e) {
      console.warn('⚠️ Failed to create Qdrant memories collection:', e?.message || e);
      return false;
    }

    // Wrap index creation like ensureRagCollection does — idempotent, non-fatal
    try {
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'userId',
        field_schema: 'keyword',
      });
      console.log('✅ Qdrant collection created');
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('exists') || e?.status === 409) {
        console.log('ℹ️ Memories index userId already exists');
      } else {
        console.warn('⚠️ Failed to create memories userId index:', e?.message || e);
      }
    }

    return true;
  }
}

// gptnix_rag
async function ensureRagCollection({ skipWakeUp = false } = {}) {
  if (!qdrantEnabled) return false;

  // Best-effort wake-up (do not throw). Caller may skip if already awake.
  if (!skipWakeUp) await wakeUpQdrant();

  // Helper: create indexes idempotently (ignore "already exists" errors)
  async function ensureIndex(field_name, field_schema) {
    try {
      await qdrantClient.createPayloadIndex(RAG_COLLECTION, {
        field_name,
        field_schema,
      });
      console.log(`✅ RAG index ensured: ${field_name} (${field_schema})`);
    } catch (e) {
      const msg = String(e?.message || '');
      const lower = msg.toLowerCase();
      if (lower.includes('already') || lower.includes('exists') || e?.status === 409) {
        console.log(`ℹ️ RAG index exists: ${field_name}`);
      } else {
        console.warn(`⚠️ Failed to ensure RAG index ${field_name}:`, msg);
      }
    }
  }

  try {
    const col = await qdrantClient.getCollection(RAG_COLLECTION);
    const size = col?.result?.config?.params?.vectors?.size ?? 1536;

    console.log(`📦 RAG collection '${RAG_COLLECTION}' OK (dim=${size})`);

    // ✅ Ensure indexes even when the collection already exists
    await ensureIndex('user_id', 'keyword');
    await ensureIndex('conversation_id', 'keyword');
    await ensureIndex('uploaded_at_ms', 'integer');
    await ensureIndex('filename', 'keyword');
    await ensureIndex('upload_id', 'keyword');

    return true;
  } catch (_err) {
    console.log(`📦 Creating RAG collection '${RAG_COLLECTION}'...`);

    try {
      await qdrantClient.createCollection(RAG_COLLECTION, {
      vectors: {
        size: 1536,
        distance: 'Cosine',
      },
      });
    } catch (e) {
      console.warn('⚠️ Failed to create Qdrant RAG collection:', e?.message || e);
      return false;
    }

    await ensureIndex('user_id', 'keyword');
    await ensureIndex('conversation_id', 'keyword');
    await ensureIndex('uploaded_at_ms', 'integer');
    await ensureIndex('filename', 'keyword');
    await ensureIndex('upload_id', 'keyword');

    console.log('✅ RAG collection created');
    return true;
  }
}

module.exports = {
  qdrantClient,
  qdrantEnabled,
  ensureMemoriesCollection,
  ensureRagCollection,
  wakeUpQdrant,
};
