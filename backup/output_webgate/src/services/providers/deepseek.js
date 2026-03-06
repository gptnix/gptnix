'use strict';

const { DEEPSEEK_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, LLM_FALLBACK_ENABLED } = require('../../config/env');
const { callOpenAIChat, streamFromOpenAI } = require('./openaiChat');
const { callOpenRouterChat, streamFromOpenRouter } = require('./openrouterChat');
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

  const cachedPromptTokens =
    Number(
      u.prompt_tokens_details?.cached_tokens ??
        u.prompt_tokens_details?.cached ??
        u.prompt_cache_hit_tokens ??
        u.promptCacheHitTokens ??
        u.cache_hit_tokens ??
        u.cacheHitTokens ??
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

/**
 * DeepSeek (non-stream) helper + fallback to OpenAI.
 * Accepts either:
 *  - prompt string
 *  - messages array
 *  - { messages: [...] }
 */
// DeepSeek tends to drift at higher temperatures; keep a conservative default.
async function callDeepSeek(input, temperature = 0.25, maxTokens = 4000, billingCtx = null) {
  const messages = normalizeMessages(input);
  const model =
    input && typeof input === 'object' && typeof input.model === 'string' && input.model.trim()
      ? input.model.trim()
      : 'deepseek-chat';

  if (!DEEPSEEK_API_KEY) {
    if (LLM_FALLBACK_ENABLED && OPENAI_API_KEY) {
      console.log('🤖 DeepSeek missing, using OpenAI fallback...');
      return callOpenAIChat({ messages }, temperature, maxTokens, billingCtx);
    }
    if (LLM_FALLBACK_ENABLED && OPENROUTER_API_KEY) {
      console.log('🤖 DeepSeek missing, using OpenRouter fallback...');
      return callOpenRouterChat({ messages, model }, temperature, maxTokens, billingCtx);
    }
    throw new Error('DeepSeek API key missing');
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
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
      console.error(`❌ DeepSeek error: ${response.status} ${t}`);

      if (
        LLM_FALLBACK_ENABLED &&
        (response.status === 503 || response.status === 500 || response.status === 429) &&
        (OPENAI_API_KEY || OPENROUTER_API_KEY)
      ) {
        if (OPENAI_API_KEY) {
          console.log('🤖 DeepSeek failed, using OpenAI fallback...');
          return callOpenAIChat({ messages }, temperature, maxTokens, billingCtx);
        }
        if (OPENROUTER_API_KEY) {
          console.log('🤖 DeepSeek failed, using OpenRouter fallback...');
          return callOpenRouterChat({ messages, model }, temperature, maxTokens, billingCtx);
        }
      }

      throw new Error(`DeepSeek error ${response.status}`);
    }

    const data = await response.json();
    const out = data?.choices?.[0]?.message?.content || '';
    const reasoning = data?.choices?.[0]?.message?.reasoning_content || data?.choices?.[0]?.message?.reasoning || '';

    // Billing (DeepSeek)
    try {
      const ctx =
        (billingCtx && typeof billingCtx === 'object')
          ? billingCtx
          : (input && typeof input === 'object' ? input : {});
      const usage = _extractUsage(data?.usage);
      const promptTokens = usage.promptTokens > 0 ? usage.promptTokens : _estimatePromptTokens(messages);
      const completionTokens =
        usage.completionTokens > 0
          ? usage.completionTokens
          : estimateTokens(String(out || '') + String(reasoning || ''));

      const cost = usdFromTokenPricing({
        provider: 'deepseek',
        model,
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
        provider: 'deepseek',
        model,
        operation: ctx.operation || 'chat',
        units: {
          promptTokens,
          completionTokens,
          totalTokens: usage.totalTokens || (promptTokens + completionTokens),
          cachedPromptTokens: usage.cachedPromptTokens || 0,
          charsOut: String(out || '').length,
          charsReasoning: String(reasoning || '').length,
        },
        costUsd: cost.usd || 0,
        meta: {
          breakdown: cost.breakdown || {},
          hadUsage: !!data?.usage,
          httpStatus: 200,
        },
      });
    } catch (_) {}

    return String(out || '');
  } catch (err) {
    console.error('❌ DeepSeek exception:', err.message);

    if (LLM_FALLBACK_ENABLED && OPENAI_API_KEY) {
      console.log('🤖 DeepSeek exception, using OpenAI fallback...');
      return callOpenAIChat({ messages }, temperature, maxTokens, billingCtx);
    }

    throw err;
  }
}

/**
 * DeepSeek streaming helper (SSE-ish response parsing) + fallback to OpenAI stream.
 * Returns fullResponse (string) if successful.
 *
 * Accepts either `messages` or `fullPrompt` (backwards compatible).
 */
async function streamFromDeepSeek({
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
  onBeforeDone,  // optional: async (fullText: string) => string — runs before done event
}) {
  const msgArr = messages && Array.isArray(messages) ? messages : normalizeMessages(fullPrompt || '');

  const chosenModel =
    typeof model === 'string' && model.trim() ? model.trim() : 'deepseek-chat';

  const dsResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
        model: chosenModel,
      messages: msgArr,
      temperature: 0.25,
      max_tokens: 4000,
      stream: true,
    }),
  });

  if (!dsResponse.ok) {
    const t = await dsResponse.text().catch(() => '');
    console.error(`❌ DeepSeek stream error: ${dsResponse.status} ${t}`);

    if (
      LLM_FALLBACK_ENABLED &&
      (dsResponse.status === 503 || dsResponse.status === 500 || dsResponse.status === 429) &&
      (OPENAI_API_KEY || OPENROUTER_API_KEY)
    ) {
      if (OPENAI_API_KEY) {
        await streamFromOpenAI({
          messages: msgArr,
          fullPrompt,
          res,
          heartbeat,
          timeout,
          userId,
          message,
          conversationId,
          startTime,
        });
        return '';
      }
      if (OPENROUTER_API_KEY) {
        await streamFromOpenRouter({
          messages: msgArr,
          fullPrompt,
          model: chosenModel,
          res,
          heartbeat,
          timeout,
          userId,
          message,
          conversationId,
          startTime,
        });
        return '';
      }
    }

    const err = new Error(`DeepSeek stream error ${dsResponse.status}`);
    err.statusCode = dsResponse.status;
    throw err;
  }

  const decoder = new TextDecoder();
  const reader = dsResponse.body.getReader();

  let buffer = '';
  let fullResponse = '';
  let fullReasoning = '';
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
        // DeepSeek can (optionally) include reasoning tokens under `reasoning_content`.
        const delta = parsed.choices?.[0]?.delta || {};
        const content = delta.content || '';
        const reasoning = delta.reasoning_content || delta.reasoning || '';
        if (reasoning) fullReasoning += reasoning;
        if (parsed.usage) finalUsage = parsed.usage;

        if (content) {
          fullResponse += content;
          const out = JSON.stringify({ type: 'token', content });
          res.write(`data: ${out}\n\n`);
          safeFlush(res);
        }
      } catch {
        // if DeepSeek ever returns raw text, forward it as token
        fullResponse += data;
        const out = JSON.stringify({ type: 'token', content: data });
        res.write(`data: ${out}\n\n`);
        safeFlush(res);
      }
    }
  }

  clearTimeout(timeout);
  clearInterval(heartbeat);

  // ── Response Polish hook (L1 always; L2 if enabled) ──────────
  if (typeof onBeforeDone === 'function') {
    try { fullResponse = await onBeforeDone(fullResponse); }
    catch (e) { console.warn('[STREAM] onBeforeDone error (non-fatal):', e.message); }
  }

  // Done
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
  console.log(`✅ /chat stream completed via DeepSeek in ${duration}ms (len=${fullResponse.length})`);


  // Billing (DeepSeek stream)
  try {
    const usage = _extractUsage(finalUsage || {});
    const promptTokens = usage.promptTokens > 0 ? usage.promptTokens : _estimatePromptTokens(msgArr);
    const completionTokens =
      usage.completionTokens > 0
        ? usage.completionTokens
        : estimateTokens(String(fullResponse || '') + String(fullReasoning || ''));

    const cost = usdFromTokenPricing({
      provider: 'deepseek',
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
      provider: 'deepseek',
      model: chosenModel,
      operation: 'chat_stream',
      units: {
        promptTokens,
        completionTokens,
        totalTokens: usage.totalTokens || (promptTokens + completionTokens),
        cachedPromptTokens: usage.cachedPromptTokens || 0,
        charsOut: String(fullResponse || '').length,
        charsReasoning: String(fullReasoning || '').length,
        durationMs: duration,
      },
      costUsd: cost.usd || 0,
      meta: {
        breakdown: cost.breakdown || {},
        hadUsage: !!finalUsage,
        httpStatus: 200,
      },
    });
  } catch (_) {}

  return fullResponse;
}

module.exports = { callDeepSeek, streamFromDeepSeek };