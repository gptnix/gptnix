'use strict';

/**
 * Centralna tablica cijena (USD).
 *
 * ⚠️ Cijene se mijenjaju – zato:
 *  - defaulti su "razumni" (prema javnim cjenicima),
 *  - sve možeš override-ati ENV varijablama bez deploya koda.
 *
 * ENV override format (JSON):
 *   BILLING_PRICING_JSON='{"openai":{"gpt-4o-mini":{"input":0.15,"output":0.60}}}'
 *
 * Sve cijene su "USD per 1M tokens" ili "USD per unit" (ovisno o tipu).
 */

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function getPricing() {
  // Defaulti (USD)
  const defaults = {
    // LLM token cijene (USD per 1M tokens)
    deepseek: {
      // deepseek-chat: input cache miss 0.27, output 1.10
      // deepseek-reasoner: input cache miss 0.55, output 2.19
      'deepseek-chat': { input: 0.27, cached_input: 0.07, output: 1.10 },
      'deepseek-reasoner': { input: 0.55, cached_input: 0.14, output: 2.19 },
      // aliasi koji se često pojavljuju u kodu:
      r1: { input: 0.55, cached_input: 0.14, output: 2.19 },
      v3: { input: 0.27, cached_input: 0.07, output: 1.10 },
    },

    openai: {
      // gpt-4o-mini: 0.15 input, 0.60 output (standard tier)
      'gpt-4o-mini': { input: 0.15, cached_input: 0.075, output: 0.60 },
      'gpt-4o': { input: 2.50, cached_input: 1.25, output: 10.00 },
      // ako koristiš nove modele – samo dodaj ovdje ili kroz BILLING_PRICING_JSON
    },

    // OpenRouter (model pricing varies by provider/model) — default is empty.
    // Dodaj kroz BILLING_PRICING_JSON, npr:
    // BILLING_PRICING_JSON='{\"openrouter\":{\"openai/gpt-4o-mini\":{\"input\":0.15,\"output\":0.60}}}'
    openrouter: {},


    embeddings: {
      // USD per 1M tokens
      'text-embedding-3-small': { input: 0.02 },
      'text-embedding-3-large': { input: 0.13 },
      'text-embedding-ada-002': { input: 0.10 },
    },

    // Web search (USD per unit)
    tavily: {
      usd_per_credit: 0.008,
      // osnovno pravilo kredita: basic=1, advanced=2
      credit_per_search_basic: 1,
      credit_per_search_advanced: 2,
      // extract: basic 1 credit per 5 URL, advanced 2 per 5 URL (ako koristiš extract)
      credit_per_extract5_basic: 1,
      credit_per_extract5_advanced: 2,
    },

    serper: {
      // "starting at $0.30 per 1000 queries" => $0.0003 po query
      usd_per_query: 0.0003,
    },

    scrapedev: {
      // ScrapeDev je "credit" model; default: procjena iz plana $19 / 200k credits ≈ 0.000095 USD / credit
      // OBAVEZNO override-aj svojim stvarnim planom.
      usd_per_credit: 0.000095,
      // koliko kredita troši jedan fetch (ako ne znaš, stavi 1 i kasnije korigiraj)
      credit_per_fetch: 1,
    },

    // Image gen (Replicate)
    replicate: {
      // Većina modela naplaćuje po vremenu (sekunde)
      // Default za stare modele (Flux, SDXL, itd.)
      usd_per_second: 0,
      
      // Minimax image-01 i slični modeli naplaćuju po slici
      models: {
        'minimax/image-01': {
          usd_per_image: 0.01,  // $0.01 per image (Replicate pricing - VERIFIED 2026-01-11)
          billing_mode: 'per_image',
        },
        'minimax/video-01': {
          usd_per_second: 0.003,  // Video se naplaćuje po sekundi
          billing_mode: 'per_second',
        },
        // Dodaj druge modele ovdje ako ima specifičnog pricing-a
      },
    },

    // Vision / OCR
    gcv_vision: {
      // default: $1.50 / 1000 = $0.0015 po request/feature (ovisno o featureu)
      usd_per_unit: 0.0015,
      free_units_per_month: 1000,
    },


    // Voice (STT/TTS)
    voice: {
      // STT – USD per minute (Audio API). Source: OpenAI pricing "Transcription and speech generation".
      // Defaulti pokrivaju whisper-1 i nove transcribe modele.
      openai_stt_usd_per_minute_by_model: {
        'whisper-1': 0.006,
        whisper: 0.006,
        'gpt-4o-transcribe': 0.006,
        'gpt-4o-transcribe-diarize': 0.006,
        'gpt-4o-mini-transcribe': 0.003,
      },

      // TTS – dva načina: (1) per minute (za gpt-4o-mini-tts) ili (2) per 1M characters (tts-1 / tts-1-hd).
      openai_tts_usd_per_minute_by_model: {
        'gpt-4o-mini-tts': 0.015,
      },
      openai_tts_usd_per_1m_chars_by_model: {
        'tts-1': 15.0,
        'tts-1-hd': 30.0,
      },

      // Koliko znakova u prosjeku "stane" u 1 sekundu govora (gruba procjena).
      // Koristi se samo kad nemamo stvarni duration.
      estimate_chars_per_second: 14,
    },

    // Fiksni trošak infrastrukture (Cloud Run, Firebase, storage, logging…)
    infra: {
      usd_per_day: 0, // postavi npr. 2.5 ako želiš "real profit"
    },
  };

  const overrideJson = safeJsonParse(process.env.BILLING_PRICING_JSON || '');
  const merged = deepMerge(defaults, overrideJson || {});
  // jednostavni override-i (bez JSON-a)
  if (process.env.REPLICATE_USD_PER_SECOND) merged.replicate.usd_per_second = Number(process.env.REPLICATE_USD_PER_SECOND);
  if (process.env.INFRA_USD_PER_DAY) merged.infra.usd_per_day = Number(process.env.INFRA_USD_PER_DAY);
  if (process.env.SERPER_USD_PER_QUERY) merged.serper.usd_per_query = Number(process.env.SERPER_USD_PER_QUERY);
  if (process.env.TAVILY_USD_PER_CREDIT) merged.tavily.usd_per_credit = Number(process.env.TAVILY_USD_PER_CREDIT);
  if (process.env.SCRAPEDEV_USD_PER_CREDIT) merged.scrapedev.usd_per_credit = Number(process.env.SCRAPEDEV_USD_PER_CREDIT);
  return merged;
}

module.exports = { getPricing };
