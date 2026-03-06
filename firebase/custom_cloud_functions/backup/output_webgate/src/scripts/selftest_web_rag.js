'use strict';

/**
 * Minimal self-test for WebSearch + RAG gating.
 *
 * Run:
 *   node src/scripts/selftest_web_rag.js
 *
 * Notes:
 * - WebSearch requires provider API keys (SERPER/TAVILY/etc.).
 * - RAG requires QDRANT_URL (+ collection created).
 * - Script never throws intentionally; it prints diagnostics.
 */

const { webSearch } = require('../services/websearch');
const { ragContextForChat } = require('../services/rag');

async function run() {
  console.log('🧪 GPTNiX self-test: WebSearch + RAG');
  console.log('ENV:', {
    QDRANT_URL: Boolean(process.env.QDRANT_URL),
    SERPER_API_KEY: Boolean(process.env.SERPER_API_KEY),
    TAVILY_API_KEY: Boolean(process.env.TAVILY_API_KEY),
  });

  // ------------------------------------------------------------
  // 1) RAG must be OFF for non-doc query
  // ------------------------------------------------------------
  try {
    const r1 = await ragContextForChat({
      userId: 'selftest-user',
      conversationId: 'selftest-conv',
      query: 'Avatar 3 kad izlazi?',
      topK: 4,
      windowMinutes: 10,
    });
    console.log('\n[1] RAG non-doc query:', {
      ragUsed: r1?.meta?.ragUsed,
      strategy: r1?.meta?.strategy,
      reason: r1?.meta?.reason,
      ctxChars: (r1?.context || '').length,
    });
  } catch (e) {
    console.log('\n[1] RAG non-doc query crashed (should not):', e?.message || e);
  }

  // ------------------------------------------------------------
  // 2) RAG should be ON for doc query (if you have uploaded docs)
  // ------------------------------------------------------------
  try {
    const r2 = await ragContextForChat({
      userId: 'selftest-user',
      conversationId: 'selftest-conv',
      query: 'Što piše u pdf-u o rokovima isporuke?',
      topK: 4,
      windowMinutes: 10080,
    });
    console.log('\n[2] RAG doc query:', {
      ragUsed: r2?.meta?.ragUsed,
      strategy: r2?.meta?.strategy,
      reason: r2?.meta?.reason,
      upload_id: r2?.meta?.upload_id,
      chunks: r2?.meta?.chunksCount,
      ctxPreview: (r2?.context || '').slice(0, 120).replace(/\s+/g, ' '),
    });
  } catch (e) {
    console.log('\n[2] RAG doc query crashed (should not):', e?.message || e);
  }

  // ------------------------------------------------------------
  // 3) WebSearch query should return results or ok:false (no crash)
  // ------------------------------------------------------------
  try {
    const w = await webSearch('Čime se danas bavi IBM kompanija?', {
      maxResults: 5,
      timeRange: 'month',
      searchDepth: 'balanced',
    });
    console.log('\n[3] WebSearch:', {
      ok: w?.ok,
      provider: w?.provider,
      resultsCount: Array.isArray(w?.results) ? w.results.length : 0,
      reason: w?.reason,
      meta: w?.meta || w?.metadata || null,
    });
    if (Array.isArray(w?.results) && w.results.length) {
      console.log('Top result:', {
        title: w.results[0].title,
        url: w.results[0].url,
      });
    }
  } catch (e) {
    console.log('\n[3] WebSearch crashed (should not):', e?.message || e);
  }

  console.log('\n✅ self-test finished');
}

run().catch((e) => {
  console.error('self-test fatal:', e);
  process.exitCode = 1;
});
