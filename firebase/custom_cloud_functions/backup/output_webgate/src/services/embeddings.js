'use strict';

const runtime = require('../state/runtime');
const { OPENAI_API_KEY } = require('../config/env');
const { getFromCache, setInCache } = require('../utils/embeddingCache');
const { logUsageEvent } = require('../billing/logger');
const { usdFromEmbeddings, estimateTokens } = require('../billing/cost');

let EMBEDDINGS_DISABLED_UNTIL = 0;
function embeddingsDisabled() {
  return Date.now() < EMBEDDINGS_DISABLED_UNTIL;
}
function disableEmbeddingsFor(ms) {
  EMBEDDINGS_DISABLED_UNTIL = Date.now() + ms;
}

function _resolveCtx(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  return {
    userId: (c.userId || c.uid || c.user || null) || 'guest',
    conversationId: c.conversationId || null,
    requestId: c.requestId || c.reqId || null,
    operation: c.operation || null,
  };
}

function _sumTokens(inputs) {
  if (Array.isArray(inputs)) {
    let sum = 0;
    for (const s of inputs) sum += estimateTokens(String(s || ''));
    return Math.max(1, sum);
  }
  return estimateTokens(String(inputs || ''));
}

async function _logEmbeddingsBilling({
  ctx,
  model,
  inputTokens,
  totalTokens,
  inputsCount,
  charsIn,
  httpStatus = 200,
}) {
  try {
    const cost = usdFromEmbeddings({ model, inputTokens });
    await logUsageEvent({
      ts: new Date(),
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      requestId: ctx.requestId,
      kind: 'embedding',
      provider: 'openai',
      model,
      operation:
        ctx.operation || (inputsCount && inputsCount > 1 ? 'embeddings_batch' : 'embeddings'),
      units: {
        promptTokens: inputTokens,
        totalTokens: totalTokens || inputTokens,
        inputsCount: inputsCount || 1,
        charsIn: charsIn || 0,
      },
      costUsd: cost.usd || 0,
      meta: {
        breakdown: cost.breakdown || {},
        httpStatus,
      },
    });
  } catch (_) {
    // ignore billing failures
  }
}

async function getEmbedding(text, billingCtx) {
  if (embeddingsDisabled()) {
    return null;
  }

  if (!OPENAI_API_KEY) {
    console.log('⚠️ OpenAI API key missing — embeddings disabled');
    return null;
  }

  try {
    const cleaned = (text || '').trim();
    if (!cleaned) return null;

    const cached = getFromCache(cleaned);
    if (cached) return cached;

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: cleaned.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ OpenAI Embedding error: ${response.status} - ${errorText}`);
      if (response.status === 429 && /insufficient_quota|quota/i.test(errorText)) {
        // smiri backend kad account ostane bez kvote
        disableEmbeddingsFor(30 * 60 * 1000);
      }
      return null;
    }

    const data = await response.json();

    // Billing (OpenAI embeddings)
    const ctx = _resolveCtx(billingCtx);
    const usage = data && data.usage ? data.usage : {};
    const inputTokens =
      Number(usage.prompt_tokens || usage.promptTokens || 0) ||
      _sumTokens(cleaned.slice(0, 8000));
    const totalTokens =
      Number(usage.total_tokens || usage.totalTokens || 0) || inputTokens;

    await _logEmbeddingsBilling({
      ctx,
      model: 'text-embedding-3-small',
      inputTokens,
      totalTokens,
      inputsCount: 1,
      charsIn: cleaned.length,
      httpStatus: 200,
    });

    const embedding = data && data.data && data.data[0] ? data.data[0].embedding : null;

    if (embedding && embedding.length) {
      runtime.embeddingDimension = embedding.length;
    }

    setInCache(cleaned, embedding);
    return embedding;
  } catch (error) {
    console.error('❌ Embedding error:', error.message);
    return null;
  }
}

// RAG batch embeddings
async function embedChunksForRag(chunks, billingCtx) {
  if (embeddingsDisabled()) {
    return [];
  }

  if (!OPENAI_API_KEY) {
    console.log('⚠️ OpenAI API key missing — RAG embeddings disabled');
    return [];
  }

  const safeChunks = (chunks || [])
    .filter((c) => typeof c === 'string' && c.trim().length > 0)
    .map((c) => (c.length > 12000 ? c.slice(0, 12000) : c));

  if (safeChunks.length === 0) return [];

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: safeChunks,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ OpenAI RAG Embedding error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();

    // Billing (OpenAI embeddings)
    const ctx = _resolveCtx(billingCtx);
    const usage = data && data.usage ? data.usage : {};
    const inputTokens =
      Number(usage.prompt_tokens || usage.promptTokens || 0) || _sumTokens(safeChunks);
    const totalTokens =
      Number(usage.total_tokens || usage.totalTokens || 0) || inputTokens;

    const charsIn = safeChunks.reduce((sum, s) => sum + String(s || '').length, 0);

    await _logEmbeddingsBilling({
      ctx,
      model: 'text-embedding-3-small',
      inputTokens,
      totalTokens,
      inputsCount: safeChunks.length,
      charsIn,
      httpStatus: 200,
    });

    const vectors = (data && data.data ? data.data : [])
      .map((item) => item && item.embedding)
      .filter(Boolean);

    if (vectors.length > 0 && vectors[0] && vectors[0].length) {
      runtime.embeddingDimension = vectors[0].length;
    }

    return vectors;
  } catch (err) {
    console.error('❌ RAG embedChunks error:', err.message);
    return [];
  }
}

module.exports = { getEmbedding, embedChunksForRag };
