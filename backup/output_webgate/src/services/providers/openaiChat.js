'use strict';

const { OPENAI_API_KEY } = require('../../config/env');
const { TextDecoder } = require('util');
const { pullSseEvents } = require('../../utils/sse');
const { logUsageEvent } = require('../../billing/logger');
const { usdFromTokenPricing, estimateTokens } = require('../../billing/cost');

function safeFlush(res) {
  try {
    if (res && typeof res.flush === 'function') res.flush();
  } catch (_) {}
}



function _estimatePromptTokens(messages) {
  try {
    if (!Array.isArray(messages)) return estimateTokens(String(messages || ''));
    let total = 0;
    for (const m of messages) {
      const c = (m && typeof m === 'object' ? (m.content || '') : String(m || ''));
      total += estimateTokens(String(c || ''));
    }
    // add a tiny overhead per message
    total += Math.max(1, messages.length);
    return total;
  } catch (_) {
    return 0;
  }
}

function _extractUsage(usage) {
  const u = usage && typeof usage === 'object' ? usage : {};
  const promptTokens = Number(u.prompt_tokens ?? u.promptTokens ?? 0) || 0;
  const completionTokens = Number(u.completion_tokens ?? u.completionTokens ?? 0) || 0;
  const totalTokens = Number(u.total_tokens ?? u.totalTokens ?? (promptTokens + completionTokens)) || 0;
  const cachedPromptTokens =
    Number(
      u.prompt_tokens_details?.cached_tokens ??
        u.prompt_tokens_details?.cached ??
        u.cached_prompt_tokens ??
        u.cachedPromptTokens ??
        0,
    ) || 0;

  return { promptTokens, completionTokens, totalTokens, cachedPromptTokens };
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

async function callOpenAIChat(input, temperature = 0.7, maxTokens = 4000, billingCtx = null) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key missing for fallback');
  }

  const messages = normalizeMessages(input);
  const model =
    input && typeof input === 'object' && typeof input.model === 'string' && input.model.trim()
      ? input.model.trim()
      : 'gpt-4o-mini';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
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
    console.error(`❌ OpenAI error: ${response.status} ${t}`);
    throw new Error(`OpenAI error ${response.status}`);
  }

  const data = await response.json();
  const content = String(data?.choices?.[0]?.message?.content || '');

  // Billing (OpenAI)
  try {
    const ctx = (billingCtx && typeof billingCtx === 'object') ? billingCtx : (input && typeof input === 'object' ? input : {});
    const chosenModel = model;
    const usage = _extractUsage(data?.usage);
    const promptTokens = usage.promptTokens > 0 ? usage.promptTokens : _estimatePromptTokens(messages);
    const completionTokens = usage.completionTokens > 0 ? usage.completionTokens : estimateTokens(content);

    const cost = usdFromTokenPricing({
      provider: 'openai',
      model: chosenModel,
      promptTokens,
      completionTokens,
      cachedPromptTokens: usage.cachedPromptTokens || 0,
      kind: 'llm',
    });

    await logUsageEvent({
      ts: new Date(),
      userId: (ctx.userId || ctx.uid || ctx.user || null) || 'guest',
      conversationId: ctx.conversationId || null,
      requestId: ctx.requestId || ctx.reqId || null,
      kind: 'llm',
      provider: 'openai',
      model: chosenModel,
      operation: ctx.operation || 'chat',
      units: {
        promptTokens,
        completionTokens,
        totalTokens: usage.totalTokens || (promptTokens + completionTokens),
        cachedPromptTokens: usage.cachedPromptTokens || 0,
        charsOut: content.length,
      },
      costUsd: cost.usd || 0,
      meta: {
        breakdown: cost.breakdown || {},
        httpStatus: 200,
      },
    });
  } catch (_) {
    // ignore billing failures
  }

  return content;
}

/**
 * OpenAI streaming helper (SSE).
 * Accepts either `messages` or `fullPrompt` (backwards compatible).
 */
async function streamFromOpenAI({
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
  if (!OPENAI_API_KEY) {
    const err = new Error('OpenAI API key missing');
    err.statusCode = 500;
    throw err;
  }

  const msgArr = messages && Array.isArray(messages) ? messages : normalizeMessages(fullPrompt || '');

  const chosenModel =
    typeof model === 'string' && model.trim()
      ? model.trim()
      : 'gpt-4o-mini';

  const oaResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: chosenModel,
      messages: msgArr,
      temperature: 0.7,
      max_tokens: 4000,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!oaResponse.ok) {
    const t = await oaResponse.text().catch(() => '');
    console.error(`❌ OpenAI stream error: ${oaResponse.status} ${t}`);
    const err = new Error(`OpenAI stream error ${oaResponse.status}`);
    err.statusCode = oaResponse.status;
    throw err;
  }

  const decoder = new TextDecoder();
  const reader = oaResponse.body.getReader();

  let buffer = '';
  let fullResponse = '';
  let finalUsage = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Robust SSE parsing (handles \r\n, multi-line events, and optional "event:" lines)
    const pulled = pullSseEvents(buffer);
    buffer = pulled.remainder;

    for (const data of pulled.events) {
      if (!data || data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          const out = JSON.stringify({ type: 'token', content });
          res.write(`data: ${out}\n\n`);
          safeFlush(res);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }

  clearTimeout(timeout);
  clearInterval(heartbeat);

  // ── Response Polish hook ──────────────────────────────────────
  if (typeof onBeforeDone === 'function') {
    try { fullResponse = await onBeforeDone(fullResponse); }
    catch (e) { console.warn('[STREAM] onBeforeDone error (non-fatal):', e.message); }
  }

  if (!res.destroyed) {
    const outDone = JSON.stringify({
      type: 'done',
      message: fullResponse,
    });
    res.write(`data: ${outDone}\n\n`);
    safeFlush(res);
    res.end();
  }

  const duration = Date.now() - startTime;
  console.log(`✅ /chat stream completed via OpenAI in ${duration}ms (len=${fullResponse.length})`);

  // Billing (OpenAI stream)
  try {
    const usage = _extractUsage(finalUsage || {});
    const promptTokens = usage.promptTokens > 0 ? usage.promptTokens : _estimatePromptTokens(msgArr);
    const completionTokens = usage.completionTokens > 0 ? usage.completionTokens : estimateTokens(fullResponse);

    const cost = usdFromTokenPricing({
      provider: 'openai',
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
      provider: 'openai',
      model: chosenModel,
      operation: 'chat_stream',
      units: {
        promptTokens,
        completionTokens,
        totalTokens: usage.totalTokens || (promptTokens + completionTokens),
        cachedPromptTokens: usage.cachedPromptTokens || 0,
        charsOut: fullResponse.length,
        durationMs: duration,
      },
      costUsd: cost.usd || 0,
      meta: {
        breakdown: cost.breakdown || {},
        hadUsage: !!finalUsage,
        httpStatus: 200,
      },
    });
  } catch (_) {
    // ignore billing failures
  }

  return fullResponse;
}

module.exports = { callOpenAIChat, streamFromOpenAI };
