'use strict';

/**
 * Background Copilot (OpenAI gpt-4o-mini) - V3 Production
 *
 * Purpose:
 * - Analyze user intent and conversation context
 * - Provide RISK SIGNAL (not model suggestion - we decide model based on risk + business logic)
 * - Produce compact guidance for main model (consistency rules, invariants)
 * - Zero PII/sensitive data (structured facts only)
 *
 * Returns:
 * {
 *   ok: boolean,
 *   risk_level: 'low' | 'medium' | 'high',
 *   why: string (1 sentence explanation),
 *   must_keep_invariants: string[] (max 3 critical rules),
 *   systemAddendum: string (compact guidance for main model)
 * }
 */

const {
  OPENAI_API_KEY,
  BACKGROUND_ASSISTANT_ENABLED,
  BACKGROUND_ASSISTANT_MODEL,
  BACKGROUND_ASSISTANT_MAX_TOKENS,
  BACKGROUND_ASSISTANT_TIMEOUT_MS,
  BACKGROUND_ASSISTANT_MIN_CHARS,
} = require('../config/env');

const { callOpenAIChat } = require('./providers/openaiChat');

function _stripCodeFences(s) {
  let t = String(s || '').trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  return t;
}

function _safeJsonParse(s) {
  const t = _stripCodeFences(s);
  try {
    return JSON.parse(t);
  } catch (_) {
    // try to recover JSON object from surrounding text
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(t.slice(first, last + 1));
      } catch (_) {}
    }
    return null;
  }
}

function _withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const to = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    Promise.resolve(promise)
      .then((v) => {
        if (!done) {
          done = true;
          clearTimeout(to);
          resolve(v);
        }
      })
      .catch(() => {
        if (!done) {
          done = true;
          clearTimeout(to);
          resolve(fallback);
        }
      });
  });
}

function _compactHistory(history, max = 8) {
  const arr = Array.isArray(history) ? history : [];
  const slice = arr.slice(-max);
  return slice
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 800) }));
}

/**
 * @param {object} args
 * @param {string} args.userText
 * @param {string} args.language
 * @param {string} args.threadSummary
 * @param {string} args.memoryBlock
 * @param {object} args.toolFlags
 * @param {string} args.toolResults
 * @param {Array<{role:string, content:string}>} args.recentHistory
 * @returns {Promise<{ok:boolean, risk_level?:string, why?:string, must_keep_invariants?:string[], systemAddendum?:string}>}
 */
async function getCopilotBrief({
  userText,
  language,
  threadSummary,
  memoryBlock,
  toolFlags,
  toolResults,
  recentHistory,
} = {}) {
  try {
    if (!BACKGROUND_ASSISTANT_ENABLED) return { ok: false };
    if (!OPENAI_API_KEY) return { ok: false };

    const text = String(userText || '').trim();
    const minChars = Number.isFinite(Number(BACKGROUND_ASSISTANT_MIN_CHARS))
      ? Number(BACKGROUND_ASSISTANT_MIN_CHARS)
      : 0;

    if (text.length < minChars) return { ok: false };

    const flags = toolFlags && typeof toolFlags === 'object' ? toolFlags : {};

    const messages = [
      {
        role: 'system',
        content:
          'You are an INTERNAL copilot for a backend chat system. ' +
          'Your job is to produce a SHORT, STRICT JSON object that helps the MAIN model (DeepSeek) stay consistent. ' +
          'Do NOT write any user-facing content. Do NOT include tool names, only high-level actions. ' +
          'Be conservative: if unsure, say so. Output JSON only.',
      },
      {
        role: 'user',
        content:
          'Return ONLY JSON with this schema:\n' +
          '{\n' +
          '  "risk_level": "low" | "medium" | "high",\n' +
          '  "why": "string (1 sentence)",\n' +
          '  "must_keep_invariants": ["string", "string", "string"],\n' +
          '  "systemAddendum": "string"\n' +
          '}\n\n' +
          'Risk level guidelines:\n' +
          '- HIGH: factual claims requiring grounding (dates, numbers, medical/legal/finance, step-by-step proofs)\n' +
          '- MEDIUM: analysis with some factual components, file processing, complex reasoning\n' +
          '- LOW: casual chat, opinions, creative writing, general knowledge\n\n' +
          'Constraints for systemAddendum:\n' +
          '- Max 600 chars (STRICT!)\n' +
          '- Focus on ONE critical aspect only\n' +
          '- Written as instructions for the MAIN model\n' +
          '- Do NOT mention tools, internal processes, or meta-information\n\n' +
          'Context bundle:\n' +
          `LANGUAGE: ${String(language || '').slice(0, 24)}\n` +
          `TOOL FLAGS (high-level): ${JSON.stringify(flags).slice(0, 600)}\n\n` +
          (toolResults ? `TOOL OUTPUT SUMMARY (may include facts; use to guide consistency):\n${String(toolResults).slice(0, 1400)}\n\n` : '') +
          (threadSummary ? `THREAD SUMMARY:\n${String(threadSummary).slice(0, 1200)}\n\n` : '') +
          (memoryBlock ? `MEMORY BLOCK (already injected elsewhere):\n${String(memoryBlock).slice(0, 1200)}\n\n` : '') +
          (recentHistory && recentHistory.length
            ? `RECENT HISTORY (compressed):\n${JSON.stringify(_compactHistory(recentHistory, 8))}\n\n`
            : '') +
          `LATEST USER MESSAGE:\n${text.slice(0, 1800)}\n`,
      },
    ];

    const maxTokens = Number.isFinite(Number(BACKGROUND_ASSISTANT_MAX_TOKENS))
      ? Number(BACKGROUND_ASSISTANT_MAX_TOKENS)
      : 260;

    const timeoutMs = Number.isFinite(Number(BACKGROUND_ASSISTANT_TIMEOUT_MS))
      ? Number(BACKGROUND_ASSISTANT_TIMEOUT_MS)
      : 900;

    const raw = await _withTimeout(
      callOpenAIChat(
        { messages, model: BACKGROUND_ASSISTANT_MODEL || 'gpt-4o-mini' },
        0,
        maxTokens,
        { operation: 'background_copilot' },
      ),
      timeoutMs,
      '',
    );

    const parsed = _safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') return { ok: false };

    const risk_level = ['low', 'medium', 'high'].includes(parsed.risk_level)
      ? parsed.risk_level
      : 'low';

    const why = String(parsed.why || '').trim() || 'No specific reason provided';
    
    const must_keep_invariants = Array.isArray(parsed.must_keep_invariants)
      ? parsed.must_keep_invariants.slice(0, 3).map((x) => String(x).trim()).filter(Boolean)
      : [];

    const systemAddendum = String(parsed.systemAddendum || '').trim();
    if (!systemAddendum) return { ok: false, risk_level, why, must_keep_invariants };

    return {
      ok: true,
      risk_level,
      why: why.slice(0, 200),
      must_keep_invariants,
      systemAddendum: systemAddendum.slice(0, 600), // STRICT limit
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

module.exports = {
  getCopilotBrief,
};
