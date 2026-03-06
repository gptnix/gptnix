'use strict';

const { openai } = require('../../clients/openai');
const { logUsageEvent } = require('../../billing/logger');
const { usdFromTokenPricing, estimateTokens } = require('../../billing/cost');
const {
  WEBSEARCH_VISION_MODEL,
  WEBSEARCH_VISION_MAX_IMAGES,
  WEBSEARCH_VISION_DEFAULT,
  WEBSEARCH_VISION_TIMEOUT_MS,
  WEBSEARCH_VISION_STRICT_GUARD,
} = require('../../config/env');

/**
 * Heuristic: only run vision when it likely helps (promo images, flyers, menus, schedules, product lists).
 * User can force via options.vision = 'on' | 'off' | 'auto'
 */
function shouldRunVision(query, options = {}) {
  const mode = String(options.vision || WEBSEARCH_VISION_DEFAULT || 'auto').toLowerCase();
  if (mode === 'off' || mode === 'false' || mode === '0') return false;
  const strict = (WEBSEARCH_VISION_STRICT_GUARD !== false);

  // Explicit user ask (OCR / "što piše" / "pročitaj s slike")
  const q = String(query || '').toLowerCase();
  const explicit = /(ocr|optical character|čitaj|procitaj|pročitaj|šta piše|sto pise|što piše|read (the )?text|extract (the )?text|izvuci tekst|izvuci cijene|izvuci stavke|prepiši|prepis(i|ati)|transkrib)/i.test(q);

  // Flyer/price-list/menu/schedule heuristics
  const flyerKw = /(akcij|snižen|snizen|popust|letak|flyer|promo|deal|katalog|ponud|cijen|cijena|price|sale|discount|menu|jelovnik|cjenik|cjenovnik|cjenik|katalog|katalo(g|zi)|cjenik|raspored|radno vrijeme|working hours|otvara|otvoreno|kada radi|kada je otvoreno|kada radi|satnica|schedule)/i.test(q);

  // Force mode
  const forced = (mode === 'on' || mode === 'true' || mode === '1');
  if (forced) {
    // If strict guard enabled, still only allow when it makes sense (unless caller explicitly overrides).
    if (!strict) return true;
    if (options.forceVision === true) return true;
    return explicit || flyerKw;
  }

  // auto
  return explicit || flyerKw;
}

function pickTopImages(images, max) {
  const arr = Array.isArray(images) ? images : [];
  const uniq = [];
  const seen = new Set();
  for (const im of arr) {
    const url = (im?.url || im?.image || im?.src || '').trim();
    if (!url) continue;
    const key = url.replace(/[#?].*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push({ url, description: (im?.description || im?.alt || '').toString().trim() });
    if (uniq.length >= max) break;
  }
  return uniq;
}

/**
 * Run a single OpenAI Vision request over up to N images.
 * Returns:
 * {
 *   ok: true,
 *   language: 'hr' | 'en' | ...,
 *   images: [{ url, ocrText, items: [{name, price, currency, unit}], notes }],
 *   brief: '...'
 * }
 */
async function analyzeImagesWithVision({ query, images, timeoutMs = WEBSEARCH_VISION_TIMEOUT_MS, billing = null }) {
  if (!openai) return { ok: false, error: 'OpenAI not configured' };

  const selected = pickTopImages(images, WEBSEARCH_VISION_MAX_IMAGES);
  if (!selected.length) return { ok: false, error: 'no images' };

  const t0 = Date.now();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(2000, Number(timeoutMs) || 15000));

  try {
    const content = [
      {
        type: 'text',
        text:
          'Zadatak: Napravi OCR i izvuci strukturirane informacije iz slika za upit korisnika. ' +
          'Ako je letak/akcija/katalog: izvuci artikle i cijene (valuta, jedinica) koliko se vidi. ' +
          'Ako nije letak: kratko opisi sta se vidi i izvuci sav vidljiv tekst. ' +
          'Vrati ISKLJUČIVO JSON objekt sa poljima: ' +
          '{ language: "hr|en|de|...", brief: string, images: [{ url, ocrText, items: [{name, price, currency, unit}], notes }] }.' +
          '\nUpit korisnika: ' + String(query || ''),
      },
      ...selected.map((im) => ({
        type: 'image_url',
        image_url: { url: im.url, detail: 'low' },
      })),
    ];

    const resp = await openai.chat.completions.create(
      {
        model: WEBSEARCH_VISION_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Ti si precizan OCR/Vision ekstraktor. Ne izmišljaj. Ako nešto ne vidiš jasno, napiši da je nečitko. ' +
              'Vrati samo JSON (bez markdowna).',
          },
          { role: 'user', content },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );

  // Billing (OpenAI vision)
  try {
    const modelUsed = WEBSEARCH_VISION_MODEL || 'gpt-4o-mini';
    const u = (resp && resp.usage) ? resp.usage : {};
    const promptTokens = Number(u.prompt_tokens || 0) || estimateTokens(String(query || ''));
    const completionTokens = Number(u.completion_tokens || 0) || 0;
    const cost = usdFromTokenPricing({ provider: 'openai', model: modelUsed, promptTokens, completionTokens, kind: 'vision' });

    await logUsageEvent({
      ts: new Date(),
      userId: billing?.userId || null,
      conversationId: billing?.conversationId || null,
      requestId: billing?.requestId || null,
      kind: 'vision',
      provider: 'openai',
      model: modelUsed,
      operation: 'websearch_vision',
      units: { promptTokens, completionTokens, totalTokens: Number(u.total_tokens || (promptTokens + completionTokens)) || (promptTokens + completionTokens), images: Array.isArray(selected) ? selected.length : 0 },
      costUsd: cost.usd || 0,
      meta: { breakdown: cost.breakdown || {}, httpStatus: 200 },
    });
  } catch (_) {
    // ignore billing failures
  }


    const txt = resp?.choices?.[0]?.message?.content || '';
    let parsed = null;
    try {
      parsed = JSON.parse(txt);
    } catch (_) {
      const m = String(txt).match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (_) {}
      }
    }

    if (!parsed) {
      return { ok: false, error: 'vision_parse_failed', raw: txt, images: selected };
    }

    const out = {
      ok: true,
      language: (parsed.language || '').toString().trim() || null,
      brief: (parsed.brief || '').toString().trim() || '',
      images: Array.isArray(parsed.images) ? parsed.images.slice(0, selected.length) : [],
      timingMs: Date.now() - t0,
    };

    out.images = out.images.map((it, i) => ({
      url: (it?.url || selected[i]?.url || '').toString().trim(),
      ocrText: (it?.ocrText || it?.ocr_text || '').toString().trim(),
      items: Array.isArray(it?.items) ? it.items.slice(0, 30) : [],
      notes: (it?.notes || '').toString().trim(),
    }));

    return out;
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'vision_timeout' : (e?.message || String(e));
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { shouldRunVision, analyzeImagesWithVision };
