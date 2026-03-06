'use strict';

const { getPricing } = require('./pricing');

// gruba procjena tokena ako provider ne vrati usage
function estimateTokens(text) {
  const s = String(text || '');
  // "4 chars ~= 1 token" je gruba aproksimacija za eng, HR malo varira, ali dovoljno za fallback.
  return Math.max(1, Math.ceil(s.length / 4));
}

function toNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function usdFromTokenPricing({ provider, model, promptTokens, completionTokens, cachedPromptTokens = 0, kind = 'llm' }) {
  const pricing = getPricing();
  let p;
  if (provider === 'openai') p = pricing.openai[model] || pricing.openai['gpt-4o-mini'];
  else if (provider === 'deepseek') p = pricing.deepseek[model] || pricing.deepseek['deepseek-chat'];
  else if (provider === 'openrouter') p = (pricing.openrouter && (pricing.openrouter[model] || pricing.openrouter['default'])) || null;
  else p = null;

  if (!p) return { usd: 0, breakdown: {} };

  const prompt = toNumber(promptTokens);
  const completion = toNumber(completionTokens);
  const cached = Math.min(toNumber(cachedPromptTokens), prompt);
  const nonCached = Math.max(0, prompt - cached);

  const usdPrompt = (nonCached * toNumber(p.input)) / 1_000_000;
  const usdCachedPrompt = (cached * toNumber(p.cached_input || p.input)) / 1_000_000;
  const usdCompletion = (completion * toNumber(p.output)) / 1_000_000;

  const usd = usdPrompt + usdCachedPrompt + usdCompletion;

  return {
    usd,
    breakdown: {
      kind,
      provider,
      model,
      promptTokens: prompt,
      cachedPromptTokens: cached,
      completionTokens: completion,
      usdPrompt,
      usdCachedPrompt,
      usdCompletion,
    },
  };
}

function usdFromEmbeddings({ model, inputTokens }) {
  const pricing = getPricing();
  const p = pricing.embeddings[model] || pricing.embeddings['text-embedding-3-small'];
  const tokens = toNumber(inputTokens);
  const usd = (tokens * toNumber(p.input)) / 1_000_000;
  return { usd, breakdown: { kind: 'embeddings', model, inputTokens: tokens } };
}

function usdFromTavily({ credits }) {
  const pricing = getPricing();
  const c = toNumber(credits);
  const usd = c * toNumber(pricing.tavily.usd_per_credit);
  return { usd, breakdown: { kind: 'websearch', provider: 'tavily', credits: c } };
}

function usdFromSerper({ queries = 1 }) {
  const pricing = getPricing();
  const q = toNumber(queries, 1);
  const usd = q * toNumber(pricing.serper.usd_per_query);
  return { usd, breakdown: { kind: 'websearch', provider: 'serper', queries: q } };
}

function usdFromScrapeDev({ credits = 1 }) {
  const pricing = getPricing();
  const c = toNumber(credits, 1);
  const usd = c * toNumber(pricing.scrapedev.usd_per_credit);
  return { usd, breakdown: { kind: 'fetch', provider: 'scrapedev', credits: c } };
}

function usdFromReplicate({ seconds = 0, images = 0, model = null }) {
  const pricing = getPricing();
  const s = toNumber(seconds, 0);
  const imgs = toNumber(images, 0);
  const modelName = String(model || '').trim();
  
  // Check for model-specific pricing (e.g., Minimax image-01)
  const modelPricing = modelName && pricing.replicate.models && pricing.replicate.models[modelName];
  
  let usd = 0;
  let billingMode = 'per_second';  // default
  
  if (modelPricing) {
    // Model has specific pricing
    billingMode = modelPricing.billing_mode || 'per_second';
    
    if (billingMode === 'per_image' && imgs > 0) {
      // Bill per image (e.g., Minimax image-01)
      const perImage = toNumber(modelPricing.usd_per_image, 0);
      usd = imgs * perImage;
    } else if (billingMode === 'per_second' && s > 0) {
      // Bill per second (e.g., Minimax video-01)
      const perSecond = toNumber(modelPricing.usd_per_second, 0);
      usd = s * perSecond;
    }
  } else {
    // Fallback to default per-second pricing
    const perSecond = toNumber(pricing.replicate.usd_per_second, 0);
    usd = s * perSecond;
  }
  
  return {
    usd,
    breakdown: {
      kind: 'image',
      provider: 'replicate',
      model: modelName || null,
      billing_mode: billingMode,
      seconds: s,
      images: imgs,
    },
  };
}

function usdFromVision({ units = 1 }) {
  const pricing = getPricing();
  const u = toNumber(units, 1);
  const usd = u * toNumber(pricing.gcv_vision.usd_per_unit);
  return { usd, breakdown: { kind: 'vision', provider: 'gcv_vision', units: u } };
}

function usdFromVoiceStt({ model, seconds = 0 }) {
  const pricing = getPricing();
  const m = String(model || '').trim() || 'whisper-1';
  const s = toNumber(seconds, 0);
  const perMin =
    (pricing.voice && pricing.voice.openai_stt_usd_per_minute_by_model && pricing.voice.openai_stt_usd_per_minute_by_model[m]) ||
    (pricing.voice && pricing.voice.openai_stt_usd_per_minute_by_model && pricing.voice.openai_stt_usd_per_minute_by_model['whisper-1']) ||
    0;
  const minutes = s / 60;
  const usd = minutes * toNumber(perMin, 0);
  return { usd, breakdown: { kind: 'voice', provider: 'openai', operation: 'stt', model: m, seconds: s, minutes, usd_per_minute: perMin } };
}

function usdFromVoiceTts({ model, seconds = 0, chars = 0, textTokens = 0 }) {
  const pricing = getPricing();
  const m = String(model || '').trim() || 'gpt-4o-mini-tts';
  const s = toNumber(seconds, 0);
  const c = toNumber(chars, 0);
  const t = toNumber(textTokens, 0);

  const perMin =
    (pricing.voice && pricing.voice.openai_tts_usd_per_minute_by_model && pricing.voice.openai_tts_usd_per_minute_by_model[m]) ||
    null;

  const per1mChars =
    (pricing.voice && pricing.voice.openai_tts_usd_per_1m_chars_by_model && pricing.voice.openai_tts_usd_per_1m_chars_by_model[m]) ||
    null;

  let usd = 0;
  let mode = 'unknown';

  if (per1mChars != null) {
    usd = (c / 1_000_000) * toNumber(per1mChars, 0);
    mode = 'per_1m_chars';
  } else if (perMin != null) {
    usd = (s / 60) * toNumber(perMin, 0);
    mode = 'per_minute';
  } else {
    // fallback: tts-1 per 1M chars ako ništa nije definirano
    const fallback = (pricing.voice && pricing.voice.openai_tts_usd_per_1m_chars_by_model && pricing.voice.openai_tts_usd_per_1m_chars_by_model['tts-1']) || 0;
    usd = (c / 1_000_000) * toNumber(fallback, 0);
    mode = 'fallback_tts1_per_1m_chars';
  }

  return {
    usd,
    breakdown: {
      kind: 'voice',
      provider: 'openai',
      operation: 'tts',
      model: m,
      seconds: s,
      minutes: s / 60,
      chars: c,
      textTokens: t,
      pricingMode: mode,
      usd_per_minute: perMin,
      usd_per_1m_chars: per1mChars,
    },
  };
}

module.exports = {
  estimateTokens,
  usdFromTokenPricing,
  usdFromEmbeddings,
  usdFromTavily,
  usdFromSerper,
  usdFromScrapeDev,
  usdFromReplicate,
  usdFromVision,
  usdFromVoiceStt,
  usdFromVoiceTts,
};
