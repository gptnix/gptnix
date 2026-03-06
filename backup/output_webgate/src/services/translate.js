'use strict';

const { OPENAI_API_KEY, DEEPSEEK_API_KEY, TRANSLATE_MODEL } = require('../config/env');
const { getOpenAIClient } = require('../clients/openai');
const { logUsageEvent } = require('../billing/logger');
const { usdFromTokenPricing, estimateTokens } = require('../billing/cost');

// Tiny per-instance cache. (Cloud Run instances are ephemeral.)
const CACHE_MAX = 300;
const cache = new Map();

function cacheGet(key) {
  return cache.get(key);
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, value);
}

function cleanOutput(text) {
  if (!text) return '';
  let out = String(text).trim();
  // Strip surrounding quotes that some models add.
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

async function translateToEnglish(inputText, { force = true } = {}) {
  const original = String(inputText || '').trim();
  if (!original) {
    return { original: '', english: '', provider: null, didTranslate: false, cached: false };
  }

  const cacheKey = original.slice(0, 2000);
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  // If you ever want to skip translation for already-English prompts, set force=false.
  if (!force) {
    cacheSet(cacheKey, {
      original,
      english: original,
      provider: 'none',
      didTranslate: false,
      cached: false,
    });
    return { original, english: original, provider: 'none', didTranslate: false, cached: false };
  }

  // 1) Prefer OpenAI (best literal translation + punctuation preservation)
  if (OPENAI_API_KEY) {
    try {
      const openai = getOpenAIClient();
      const resp = await openai.chat.completions.create({
        model: TRANSLATE_MODEL,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a translation engine. Translate the user text into English as literally as possible while preserving meaning, constraints, punctuation, units, and formatting. Do not add explanations. Output ONLY the English translation.',
          },
          { role: 'user', content: original },
        ],
        max_tokens: 1200,
      });

      const english = cleanOutput(resp?.choices?.[0]?.message?.content || '');
      if (english) {
        const out = { original, english, provider: 'openai', didTranslate: true, cached: false };
        cacheSet(cacheKey, out);
        return out;
      }
    } catch (e) {
      console.warn('⚠️ translateToEnglish(OpenAI) failed:', e.message);
    }
  }

  // 2) Fallback: DeepSeek (if present)
  if (DEEPSEEK_API_KEY) {
    try {
      const { callDeepSeek } = require('./providers/deepseek');
      const prompt =
        'Translate the text between <TEXT> tags to English as literally as possible. Keep all constraints, style words, punctuation, numbers, and formatting. Output ONLY the translation.\n\n' +
        '<TEXT>\n' +
        original +
        '\n</TEXT>';

      const english = cleanOutput(await callDeepSeek(prompt, 0, 1400));
      if (english) {
        const out = { original, english, provider: 'deepseek', didTranslate: true, cached: false };
        cacheSet(cacheKey, out);
        return out;
      }
    } catch (e) {
      console.warn('⚠️ translateToEnglish(DeepSeek) failed:', e.message);
    }
  }

  // 3) Last resort: return original
  const out = { original, english: original, provider: 'none', didTranslate: false, cached: false };
  cacheSet(cacheKey, out);
  return out;
}

module.exports = {
  translateToEnglish,
};
