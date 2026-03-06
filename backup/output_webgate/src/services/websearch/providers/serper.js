'use strict';

const {
  SERPER_API_KEY,
  SERPER_API_BASE,
  SERPER_DEFAULT_GL,
  SERPER_DEFAULT_HL,
  WEBSEARCH_DEFAULT_MAX_RESULTS,
} = require('../../../config/env');
const { fetchJson } = require('../http');
const { logUsageEvent } = require('../../../billing/logger');
const { usdFromSerper } = require('../../../billing/cost');

function serperAvailable() {
  return Boolean(SERPER_API_KEY);
}

function normaliseOrganic(items = []) {
  const out = [];
  for (const it of items) {
    out.push({
      title: it?.title || '',
      url: it?.link || it?.url || '',
      snippet: it?.snippet || '',
      position: it?.position ?? null,
      favicon: it?.favicon || null,
      date: it?.date || it?.publishedDate || it?.publishedAt || null,
    });
  }
  return out;
}

// If the query is clearly Bosnian/Croatian/Serbian (BCS), bias Serper towards a local
// region & language so municipal / regional entities are easier to find.
function detectSerperLocale(query) {
  const t = String(query || '').toLowerCase();
  const hasBcsChars = /[čćđšž]/i.test(t);
  const bcsWords = /\b(tko|ko|gdje|kada|načelnik|nacelnik|gradonačelnik|gradonacelnik|općina|opcina|županija|zupanija|kanton|federacija|bosna|hercegovina|kupres|tomislavgrad|sarajevo|mostar|livno)\b/i.test(
    t,
  );

  if (hasBcsChars || bcsWords) {
    return { gl: 'ba', hl: 'hr' };
  }
  return null;
}

async function serperSearch({
  query,
  type = 'search', // search|news|images
  maxResults = WEBSEARCH_DEFAULT_MAX_RESULTS,
  gl = SERPER_DEFAULT_GL,
  hl = SERPER_DEFAULT_HL,
  billing,
} = {}) {
  if (!serperAvailable()) {
    const err = new Error('Serper API key missing');
    err.code = 'SERPER_KEY_MISSING';
    throw err;
  }

  if (!query || typeof query !== 'string') {
    throw new Error('query required');
  }

  const autoLocale = detectSerperLocale(query);
  const effectiveGl = autoLocale?.gl || gl;
  const effectiveHl = autoLocale?.hl || hl;

  const endpoint = `${SERPER_API_BASE.replace(/\/$/, '')}/${type}`;
  const payload = {
    q: query,
    gl: effectiveGl,
    hl: effectiveHl,
    num: Math.max(1, Math.min(20, Number(maxResults) || 5)),
  };

  const json = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // 💸 billing: Serper query (google.serper.dev)
  // NOTE: `billing` je opcionalan; ako ga nema, upisujemo kao guest.
  try {
    const ctx = (billing && typeof billing === 'object') ? billing : {};
    const { usd, breakdown } = usdFromSerper({ queries: 1 });
    await logUsageEvent({
      ts: new Date(),
      userId: (ctx.userId || ctx.uid || ctx.user || null) || 'guest',
      conversationId: ctx.conversationId || null,
      requestId: ctx.requestId || ctx.reqId || null,
      kind: 'websearch',
      provider: 'serper',
      model: null,
      operation: type || 'search',
      units: {
        queries: 1,
        num: payload.num,
        gl: payload.gl,
        hl: payload.hl,
      },
      costUsd: usd || 0,
      meta: {
        breakdown: breakdown || {},
        queryLen: String(query || '').length,
      },
    });
  } catch (_) {
    // ignore billing failures
  }

  const organic = normaliseOrganic(json?.organic || []);

  // "news" is sometimes in json?.news (depending on endpoint/type)
  const news = normaliseOrganic(json?.news || []);

  const results = type === 'news' ? (news.length ? news : organic) : organic;

  return {
    provider: 'serper',
    query,
    type,
    gl: effectiveGl,
    hl: effectiveHl,
    results: results.map((r, idx) => ({
      rank: idx + 1,
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      position: r.position,
      favicon: r.favicon,
      publishedAt: r.date || null,
    })),
    raw: json,
  };
}

module.exports = {
  serperAvailable,
  serperSearch,
};

// Compatibility helper for WebSearch V2 providerWrappers
async function searchSerper(query, options = {}) {
  const num = options.num || options.max_results || options.maxResults || 10;
  const type = options.type || 'search';
  const out = await serperSearch({ query, num, type });
  const results = Array.isArray(out?.results) ? out.results : [];
  return results.slice(0, num).map(r => ({
    url: r.url || '',
    title: r.title || '',
    snippet: r.snippet || '',
    publishedAt: r.publishedAt || null,
  }));
}

module.exports.searchSerper = searchSerper;
