'use strict';

const { OPENAI_API_KEY } = require('../config/env');
const { getEmbedding } = require('./embeddings');
const { cosineSimilarity } = require('../utils/similarity');

function withTimeout(promise, ms, fallback) {
  let t;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      t = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(t));
}


async function filterRelevantHistory(conversation, latestMessage, options = {}) {
  const { maxMessages = 8, similarityThreshold = 0.6 } = options;

  if (!conversation.length) {
    return [];
  }

  // no embeddings => skip semantic addon (recent window is handled elsewhere)
  if (!OPENAI_API_KEY) {
    return [];
  }

  try {
    const latestEmbedding = await getEmbedding(latestMessage);
    if (!latestEmbedding) {
      return [];
    }

    const tail = conversation.slice(-maxMessages);

    // ALWAYS keep last 3–4 messages (user+assistant)
    const forcedTailCount = Math.min(4, tail.length);
    const forcedTail = tail.slice(-forcedTailCount);

    // Short messages => lower threshold
    const dynamicThreshold =
      latestMessage.length < 80
        ? Math.min(0.45, similarityThreshold)
        : similarityThreshold;

    const filtered = [];

    // Embed a small tail in parallel (bounded) to reduce latency.
    const candidates = [];
    for (const msg of tail) {
      const text = (msg.content || '').trim();
      if (!text) continue;
      candidates.push({ msg, text });
    }

    const CONCURRENCY = 4;

    async function asyncPool(items, worker) {
      const ret = [];
      let i = 0;
      const runners = new Array(Math.min(CONCURRENCY, items.length)).fill(0).map(async () => {
        while (i < items.length) {
          const my = i++;
          try {
            const r = await worker(items[my], my);
            if (r) ret.push(r);
          } catch (_) {}
        }
      });
      await Promise.all(runners);
      return ret;
    }

    const embedded = await withTimeout(
      asyncPool(candidates, async ({ msg, text }) => {
        const emb = await withTimeout(getEmbedding(text), 900, null);
        if (!emb) return null;
        const sim = cosineSimilarity(latestEmbedding, emb);
        // debug log (short)
        console.log(
          `🧠 [HISTORY-FILTER] sim=${sim.toFixed(3)} role=${msg.role} text="${text.slice(0, 60)}"`,
        );
        if (sim >= dynamicThreshold) return msg;
        return null;
      }),
      1500,
      [],
    );

    filtered.push(...embedded);

    // Combine forced tail + semantic hits
    const combined = [...forcedTail, ...filtered];

    // remove duplicates (keep first occurrence)
    const unique = [];
    const seen = new Set();
    for (const msg of combined) {
      if (!msg) continue;
      const key = `${msg.role || ''}:${(msg.content || '').trim()}:${msg.ts ?? msg.created_at ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(msg);
    }

    console.log(
      `🧠 [HISTORY-FILTER] final kept ${unique.length}/${tail.length} messages.`,
    );

    // Ensure chronological order by timestamp if available
    return unique.sort((a, b) => (Number(a.ts || a.created_at || 0) - Number(b.ts || b.created_at || 0)));
  } catch (err) {
    console.error('❌ [HISTORY-FILTER] Error:', err);
    return [];
  }
}

module.exports = { filterRelevantHistory };
