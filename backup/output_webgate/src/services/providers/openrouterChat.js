'use strict';

const { OPENROUTER_API_KEY, OPENROUTER_API_BASE } = require('../../config/env');
const { TextDecoder } = require('util');
const { pullSseEvents } = require('../../utils/sse');
const { logUsageEvent } = require('../../billing/logger');
const { usdFromTokenPricing, estimateTokens } = require('../../billing/cost');

function safeFlush(res) {
  try {
    if (res && typeof res.flush === 'function') res.flush();
  } catch (_) {}
}

function normalizeMessages(input) {
  if (Array.isArray(input)) return input;

  if (input && typeof input === 'object' && Array.isArray(input.messages)) {
    return input.messages;
  }

  if (typeof input === 'string') {
    return [{ role: 'user', content: input }];
  }

  if (input && typeof input === 'object' && typeof input.prompt === 'string') {
    return [{ role: 'user', content: input.prompt }];
  }

  return [{ role: 'user', content: String(input || '') }];
}

function _estimatePromptTokens(messages) {
  try {
    if (!Array.isArray(messages)) return estimateTokens(String(messages || ''));
    let total = 0;
    for (const m of messages) {
      const c = (m && typeof m === 'object' ? (m.content || '') : String(m || ''));
      total += estimateTokens(String(c || ''));
    }
    total += Math.max(1, messages.length);
    return total;
  } catch (_) {
    return 0;
  }
}

function _extractUsage(usage) {
  const u = usage && typeof usage === 'object' ? usage : {};
  const promptTokens =
    Number(u.prompt_tokens ?? u.promptTokens ?? u.input_tokens ?? u.inputTokens ?? 0) || 0;
  const completionTokens =
    Number(u.completion_tokens ?? u.completionTokens ?? u.output_tokens ?? u.outputTokens ?? 0) || 0;
  const totalTokens =
    Number(u.total_tokens ?? u.totalTokens ?? (promptTokens + completionTokens)) || 0;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedPromptTokens: Number(u.cached_prompt_tokens ?? u.cachedPromptTokens ?? 0) || 0,
  };
}

async function callOpenRouterChat(input, temperature = 0.7, maxTokens = 4000, billingCtx = null) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key missing');
  }

  const messages = normalizeMessages(input);
  const model =
    input && typeof input === 'object' && typeof input.model === 'string' && input.model.trim()
      ? input.model.trim()
      : 'openai/gpt-4o-mini';

  const url = `${(OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const t = await response.text().catch(() => '');
    const err = new Error(`OpenRouter error ${response.status}: ${t || response.statusText}`);
    err.statusCode = response.status;
    throw err;
  }

  const data = await response.json();
  const out = data?.choices?.[0]?.message?.content || '';

  // Billing (OpenRouter) — best-effort (some models omit usage)
  try {
    const usage = _extractUsage(data?.usage);
    const promptTokens =
      usage.promptTokens > 0 ? usage.promptTokens : _estimatePromptTokens(messages);
    const completionTokens =
      usage.completionTokens > 0 ? usage.completionTokens : estimateTokens(out);

    const cost = usdFromTokenPricing({
      provider: 'openrouter',
      model,
      promptTokens,
      completionTokens,
      cachedPromptTokens: usage.cachedPromptTokens || 0,
      kind: 'llm',
    });

    await logUsageEvent({
      ts: new Date(),
      userId: (billingCtx && billingCtx.userId) || 'guest',
      conversationId: (billingCtx && billingCtx.conversationId) || null,
      requestId: (billingCtx && billingCtx.requestId) || null,
      kind: 'llm',
      provider: 'openrouter',
      model,
      operation: 'chat',
      units: {
        promptTokens,
        completionTokens,
        totalTokens: usage.totalTokens || (promptTokens + completionTokens),
        cachedPromptTokens: usage.cachedPromptTokens || 0,
      },
      usd: cost.usd,
      breakdown: cost.breakdown,
      meta: billingCtx && billingCtx.meta ? billingCtx.meta : null,
    });
  } catch (_) {}

  return out;
}

async function streamFromOpenRouter({
  messages,
  fullPrompt,
  model,
  res,
  heartbeat,
  timeout,
  userId,
  message,
  conversationId,
  startTime,
  onBeforeDone,  // optional: async (fullText: string) => string
}) {
  if (!OPENROUTER_API_KEY) {
    const err = new Error('OpenRouter API key missing');
    err.statusCode = 500;
    throw err;
  }

  const msgArr = messages && Array.isArray(messages) ? messages : normalizeMessages(fullPrompt || '');

  const chosenModel =
    typeof model === 'string' && model.trim() ? model.trim() : 'openai/gpt-4o-mini';

  const url = `${(OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`;

  const orResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: chosenModel,
      messages: msgArr,
      temperature: 0.25,
      max_tokens: 4000,
      stream: true,
    }),
  });

  if (!orResponse.ok) {
    const t = await orResponse.text().catch(() => '');
    const err = new Error(`OpenRouter stream error ${orResponse.status}: ${t || orResponse.statusText}`);
    err.statusCode = orResponse.status;
    throw err;
  }

  const decoder = new TextDecoder();
  const reader = orResponse.body.getReader();

  let buffer = '';
  let fullResponse = '';
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedPromptTokens: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events to handle partial frames robustly
    const { events, rest } = pullSseEvents(buffer);
    buffer = rest || '';

    for (const ev of events) {
      const raw = String(ev || '').trim();
      if (!raw) continue;
      if (raw === '[DONE]') continue;

      try {
        const j = JSON.parse(raw);

        // OpenAI-style delta stream
        const delta = j?.choices?.[0]?.delta;
        const content = delta?.content;
        if (typeof content === 'string' && content.length) {
          fullResponse += content;
          const out = JSON.stringify({ type: 'token', content });
          res.write(`data: ${out}\n\n`);
          safeFlush(res);
        }

        // Some providers include `usage` only in final chunk
        if (j && j.usage) {
          usage = _extractUsage(j.usage);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }

  clearTimeout(timeout);
  clearInterval(heartbeat);

  // Best-effort billing
  try {
    const promptTokens = usage.promptTokens > 0 ? usage.promptTokens : _estimatePromptTokens(msgArr);
    const completionTokens = usage.completionTokens > 0 ? usage.completionTokens : estimateTokens(fullResponse);

    const cost = usdFromTokenPricing({
      provider: 'openrouter',
      model: chosenModel,
      promptTokens,
      completionTokens,
      cachedPromptTokens: usage.cachedPromptTokens || 0,
      kind: 'llm',
    });

    await logUsageEvent({
      ts: new Date(),
      userId: userId || 'guest',
      conversationId: conversationId || null,
      requestId: null,
      kind: 'llm',
      provider: 'openrouter',
      model: chosenModel,
      operation: 'chat_stream',
      units: {
        promptTokens,
        completionTokens,
        totalTokens: usage.totalTokens || (promptTokens + completionTokens),
        cachedPromptTokens: usage.cachedPromptTokens || 0,
      },
      usd: cost.usd,
      breakdown: cost.breakdown,
      meta: {
        startTime: startTime || null,
        message: message || null,
      },
    });
  } catch (_) {}

  if (!res.writableEnded) {
    // ── Response Polish hook ────────────────────────────────────
    if (typeof onBeforeDone === 'function') {
      try { fullResponse = await onBeforeDone(fullResponse); }
      catch (e) { console.warn('[STREAM] onBeforeDone error (non-fatal):', e.message); }
    }

    const out = JSON.stringify({ type: 'done', message: fullResponse });
    res.write(`data: ${out}\n\n`);
    safeFlush(res);
    res.end();
  }

  return fullResponse;
}

module.exports = {
  callOpenRouterChat,
  streamFromOpenRouter,
};
