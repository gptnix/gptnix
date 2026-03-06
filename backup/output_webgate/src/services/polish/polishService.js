'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Polish Service — GPTNiX Response Polish System v2              ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Pipeline:                                                        ║
 * ║   raw answer                                                      ║
 * ║     → Level 1: applyRules()  [always, free, ~0ms]               ║
 * ║     → bypass checks (too short? pure code? disabled?)            ║
 * ║     → Level 2: LLM polish    [optional, latency-gated]          ║
 * ║     → diffCheck() safety validation                              ║
 * ║     → polished answer                                             ║
 * ║                                                                   ║
 * ║  Entry points:                                                    ║
 * ║    polishAnswer(text, opts)   — full pipeline (non-stream)       ║
 * ║    applyRulesOnly(text)       — L1 only, sync, zero cost         ║
 * ║    createStreamHook(opts)     — returns onBeforeDone() for SSE   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const {
  applyRules,
  extractImmutables,
  restoreImmutables,
  isPureCodeResponse,
  isTooShort,
  diffCheck,
} = require('./polishRules');

const { selectPolishPrompt } = require('./polishPrompt');

// ─────────────────────────────────────────────────────────────────
// CONFIG (read from env at call-time so hot-reload works)
// ─────────────────────────────────────────────────────────────────

function getConfig() {
  return {
    enabled:            _envBool(process.env.POLISH_ENABLED,              false),
    provider:           String(process.env.POLISH_PROVIDER  || 'auto').toLowerCase(),
    model:              String(process.env.POLISH_MODEL     || ''),
    minChars:           _envInt(process.env.POLISH_MIN_CHARS,              120),
    maxLatencyMs:       _envInt(process.env.POLISH_MAX_LATENCY_MS,        1800),
    maxInputChars:      _envInt(process.env.POLISH_MAX_INPUT_CHARS,       6000),
    maxTokens:          _envInt(process.env.POLISH_MAX_TOKENS,            1500),
    debug:              _envBool(process.env.POLISH_DEBUG,                false),
    level1Only:         _envBool(process.env.POLISH_LEVEL1_ONLY,          false),
    streamMaxLatencyMs: _envInt(
      process.env.POLISH_STREAM_MAX_LATENCY_MS,
      _envInt(process.env.POLISH_MAX_LATENCY_MS, 900)
    ),
  };
}

// ─────────────────────────────────────────────────────────────────
// DEBUG (hash-only, never logs full text → privacy safe)
// ─────────────────────────────────────────────────────────────────

function _debugLog(label, orig, polished) {
  const crypto = require('crypto');
  const h = (s) => crypto.createHash('sha256').update(String(s || '')).digest('hex').slice(0, 12);
  console.log(
    `[POLISH] ${label} | origLen=${String(orig || '').length} polLen=${String(polished || '').length} ` +
    `origHash=${h(orig)} polHash=${h(polished)}`
  );
}

// ─────────────────────────────────────────────────────────────────
// CHUNKING for long answers
// ─────────────────────────────────────────────────────────────────

function _splitCodeAndText(text) {
  const segments = [];
  const re = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex)
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    segments.push({ type: 'code', content: match[0] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length)
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  return segments;
}

function _buildPolishChunks(text, maxChars) {
  const segs   = _splitCodeAndText(text);
  const chunks = [];
  let accumulated = '';

  const flush = () => {
    if (accumulated.trim()) {
      chunks.push({ type: 'text', content: accumulated, needsPolish: true });
      accumulated = '';
    }
  };

  for (const seg of segs) {
    if (seg.type === 'code') {
      flush();
      chunks.push({ type: 'code', content: seg.content, needsPolish: false });
    } else {
      if (accumulated.length + seg.content.length > maxChars) flush();
      accumulated += seg.content;
    }
  }
  flush();
  return chunks;
}

// ─────────────────────────────────────────────────────────────────
// LLM PROVIDER CALL
// ─────────────────────────────────────────────────────────────────

async function _callPolishLLM({ system, user, config }) {
  const { OPENAI_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY } = require('../../config/env');
  const provider = config.provider;

  const useOpenAI     = provider === 'openai'    || (provider === 'auto' && Boolean(OPENAI_API_KEY));
  const useDeepSeek   = !useOpenAI && (provider === 'deepseek' || Boolean(DEEPSEEK_API_KEY));
  const useOpenRouter = !useOpenAI && !useDeepSeek && Boolean(OPENROUTER_API_KEY);

  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: user   },
  ];

  if (useOpenAI) {
    const { callOpenAIChat } = require('../providers/openaiChat');
    return callOpenAIChat({ messages, model: config.model || 'gpt-4o-mini' }, 0, config.maxTokens, { operation: 'polish' });
  }
  if (useDeepSeek) {
    const { callDeepSeek } = require('../providers/deepseek');
    return callDeepSeek({ messages, model: config.model || 'deepseek-chat' }, 0, config.maxTokens, { operation: 'polish' });
  }
  if (useOpenRouter) {
    const { callOpenRouterChat } = require('../providers/openrouterChat');
    return callOpenRouterChat({ messages, model: config.model || 'openai/gpt-4o-mini' }, 0, config.maxTokens, { operation: 'polish' });
  }

  throw new Error('[POLISH] No LLM provider (set OPENAI_API_KEY, DEEPSEEK_API_KEY, or OPENROUTER_API_KEY)');
}

// ─────────────────────────────────────────────────────────────────
// CORE L2 LOGIC (shared by polishAnswer + createStreamHook)
// ─────────────────────────────────────────────────────────────────

async function _runLevel2(afterL1, opts, cfg, latencyBudgetMs) {
  const budget = (latencyBudgetMs != null) ? latencyBudgetMs : cfg.maxLatencyMs;
  const isLong = afterL1.length > 600 || Boolean(opts.isLongForm);
  let polished  = '';

  if (afterL1.length <= cfg.maxInputChars) {
    const { text: draft, segments } = extractImmutables(afterL1);
    const { system, user } = selectPolishPrompt({
      draftWithPlaceholders: draft,
      userMessage: opts.userMessage || '',
      language:    opts.language    || 'auto',
      wantsShort:  Boolean(opts.wantsShort),
      isLong,
    });
    const raw  = await Promise.race([
      _callPolishLLM({ system, user, config: cfg }),
      _timeout(budget, 'POLISH_TIMEOUT'),
    ]);
    polished = restoreImmutables(String(raw || '').trim(), segments);

  } else {
    const chunks = _buildPolishChunks(afterL1, cfg.maxInputChars);
    const parts  = [];
    for (const chunk of chunks) {
      if (!chunk.needsPolish) { parts.push(chunk.content); continue; }
      const { text: d, segments: seg } = extractImmutables(chunk.content);
      const { system, user } = selectPolishPrompt({
        draftWithPlaceholders: d,
        userMessage: opts.userMessage || '',
        language:    opts.language    || 'auto',
        wantsShort:  Boolean(opts.wantsShort),
        isLong:      false,
      });
      try {
        const raw = await Promise.race([
          _callPolishLLM({ system, user, config: cfg }),
          _timeout(budget, 'CHUNK_TIMEOUT'),
        ]);
        parts.push(restoreImmutables(String(raw || '').trim(), seg));
      } catch (chunkErr) {
        console.warn(`[POLISH] Chunk polish failed (${chunkErr.message}) — using original chunk`);
        parts.push(chunk.content);
      }
    }
    polished = parts.join('');
  }

  return polished;
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC: polishAnswer
// ─────────────────────────────────────────────────────────────────

/**
 * Full L1 + L2 pipeline. Safe to await before sending response.
 *
 * @param {string} rawAnswer
 * @param {object} [opts]
 * @param {string}  [opts.userMessage]
 * @param {string}  [opts.language]   — e.g. "hr", "en"
 * @param {boolean} [opts.wantsShort]
 * @param {boolean} [opts.isLongForm]
 * @param {string}  [opts.userId]
 * @param {string}  [opts.conversationId]
 * @param {string}  [opts.requestId]
 * @returns {Promise<string>}
 */
async function polishAnswer(rawAnswer, opts = {}) {
  const t0  = Date.now();
  const cfg = getConfig();

  // Level 1 — always, free
  const afterL1 = applyRules(rawAnswer);
  if (cfg.debug) _debugLog('L1', rawAnswer, afterL1);

  // L2 bypass
  if (!cfg.enabled || cfg.level1Only) return afterL1;
  if (isTooShort(afterL1, cfg.minChars)) {
    console.log(`[POLISH] L2 skipped: too_short (${afterL1.length} < ${cfg.minChars})`);
    return afterL1;
  }
  if (isPureCodeResponse(afterL1)) {
    console.log('[POLISH] L2 skipped: pure_code_response');
    return afterL1;
  }

  // Level 2 — LLM
  try {
    const polished = await _runLevel2(afterL1, opts, cfg);
    const { safe, reasons } = diffCheck(afterL1, polished);
    if (!safe) {
      console.warn(`[POLISH] diffCheck FAILED (${reasons.join('; ')}) — fallback to L1`);
      return afterL1;
    }
    if (cfg.debug) _debugLog('L2', afterL1, polished);
    console.log(`[POLISH] ✅ ${Date.now() - t0}ms | origLen=${rawAnswer.length} polLen=${polished.length}`);
    return polished;
  } catch (err) {
    console.warn(`[POLISH] L2 ${err.message === 'POLISH_TIMEOUT' ? 'timeout' : 'error: ' + err.message} — L1 fallback`);
    return afterL1;
  }
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC: applyRulesOnly — Level 1 only, sync
// ─────────────────────────────────────────────────────────────────

function applyRulesOnly(rawAnswer) {
  return applyRules(rawAnswer);
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC: createStreamHook
//
// Returns `onBeforeDone(fullText) → Promise<string>`.
// Pass as the `onBeforeDone` param to stream providers.
//
// Flow:
//   1. L1 rules (always, free)
//   2. L2 LLM polish (if enabled + budget)
//   3. If text changed → write `polished` SSE event to res
//   4. Returns polished text → caller uses it in `done.message`
// ─────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {import('http').ServerResponse} opts.res  — SSE response (to write polished event)
 * @param {string}  [opts.userMessage]
 * @param {string}  [opts.language]
 * @param {boolean} [opts.wantsShort]
 * @param {boolean} [opts.isLongForm]
 * @param {string}  [opts.userId]
 * @param {string}  [opts.conversationId]
 * @param {string}  [opts.requestId]
 */
function createStreamHook(opts = {}) {
  return async function onBeforeDone(fullText) {
    const t0  = Date.now();
    const cfg = getConfig();
    const raw = String(fullText || '');

    // Level 1 — always, free
    const afterL1 = applyRules(raw);

    const skip = (
      !cfg.enabled   ||
      cfg.level1Only ||
      isTooShort(afterL1, cfg.minChars) ||
      isPureCodeResponse(afterL1)
    );

    let final = afterL1;

    if (!skip) {
      try {
        const polished = await _runLevel2(afterL1, opts, cfg, cfg.streamMaxLatencyMs);
        const { safe, reasons } = diffCheck(afterL1, polished);
        if (!safe) {
          console.warn(`[POLISH-STREAM] diffCheck FAILED (${reasons.join('; ')}) — L1 fallback`);
        } else {
          final = polished;
          if (cfg.debug) _debugLog('stream:L2', afterL1, polished);
          console.log(`[POLISH-STREAM] ✅ ${Date.now() - t0}ms | origLen=${raw.length} polLen=${polished.length}`);
        }
      } catch (err) {
        console.warn(`[POLISH-STREAM] ${err.message === 'POLISH_TIMEOUT' || err.message === 'CHUNK_TIMEOUT' ? 'timeout' : 'error: ' + err.message} — L1 fallback`);
      }
    }

    // Write `polished` SSE event if text changed (frontend can swap bubble)
    if (final !== raw && opts.res && !opts.res.destroyed && !opts.res.writableEnded) {
      try {
        opts.res.write(`data: ${JSON.stringify({ type: 'polished', message: final })}\n\n`);
        if (typeof opts.res.flush === 'function') opts.res.flush();
      } catch (e) {
        console.warn('[POLISH-STREAM] Failed to write polished event:', e.message);
      }
    }

    return final;
  };
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function _timeout(ms, msg) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}

function _envBool(v, def = false) {
  if (v === undefined || v === null || v === '') return def;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function _envInt(v, def) {
  const n = parseInt(String(v || ''), 10);
  return Number.isFinite(n) ? n : def;
}

// ─────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────

module.exports = {
  polishAnswer,
  applyRulesOnly,
  createStreamHook,
  getConfig,
  polishAssistantText: polishAnswer,  // legacy compat
  _buildPolishChunks,                 // exposed for tests
  _splitCodeAndText,                  // exposed for tests
};
