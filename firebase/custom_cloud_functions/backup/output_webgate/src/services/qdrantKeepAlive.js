'use strict';

const {
  QDRANT_KEEPALIVE_ENABLED,
  QDRANT_KEEPALIVE_INTERVAL_MS,
  QDRANT_AUTO_ENSURE_COLLECTIONS,
} = require('../config/env');

const {
  qdrantEnabled,
  wakeUpQdrant,
  ensureMemoriesCollection,
  ensureRagCollection,
} = require('../clients/qdrant');

let _timer = null;

async function _tick() {
  if (!qdrantEnabled) return;

  const ok = await wakeUpQdrant();
  if (!ok) return;

  if (QDRANT_AUTO_ENSURE_COLLECTIONS) {
    // Pass skipWakeUp=true — Qdrant is already confirmed awake, no need for 2 extra getCollections() calls
    await ensureMemoriesCollection({ skipWakeUp: true });
    await ensureRagCollection({ skipWakeUp: true });
  }
}

/**
 * Starts a background keep-alive ping to prevent managed Qdrant instances from sleeping.
 * Safe to call multiple times (it will only start once).
 */
function startQdrantKeepAlive() {
  if (!qdrantEnabled) {
    console.log('🧠 Qdrant keep-alive: disabled (QDRANT_URL not set)');
    return false;
  }

  if (!QDRANT_KEEPALIVE_ENABLED) {
    console.log('🧠 Qdrant keep-alive: disabled (QDRANT_KEEPALIVE_ENABLED=false)');
    return false;
  }

  if (_timer) return true;

  const interval = Number.isFinite(Number(QDRANT_KEEPALIVE_INTERVAL_MS))
    ? Number(QDRANT_KEEPALIVE_INTERVAL_MS)
    : 12 * 60 * 1000;

  // Run a first wake-up immediately, then interval.
  _tick().catch((e) => console.warn('⚠️ Qdrant keep-alive first tick error:', e?.message || e));

  _timer = setInterval(() => {
    _tick().catch((e) => console.warn('⚠️ Qdrant keep-alive tick error:', e?.message || e));
  }, interval);

  // allow process to exit naturally
  _timer.unref?.();

  console.log(`🧠 Qdrant keep-alive: ON (interval=${Math.round(interval / 1000)}s)`);
  return true;
}

function stopQdrantKeepAlive() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { startQdrantKeepAlive, stopQdrantKeepAlive };
