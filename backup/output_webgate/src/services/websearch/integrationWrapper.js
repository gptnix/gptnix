'use strict';

/**
 * Web Search V2 - Integration Wrapper (CommonJS)
 *
 * Goals:
 * - NO ESM imports / NO dynamic import()
 * - Preserve old handler options (maxResults, timeRange, searchDepth, prefer)
 * - Always return standard shape: { ok, results: [], provider, meta }
 * - Never crash chat: on failure return ok:false + reason + empty results
 */

const { createProviders } = require('./providerWrappers');
const { webSearch } = require('./webSearch');
const { classifyQuery } = require('./queryClassifier');

// Optional tool-first shortcuts (keep existing behavior)
const { getWeather } = require('../tools/weather');
const osmTool = require('../tools/osm');

let providersInstance = null;
function getProviders() {
  if (!providersInstance) providersInstance = createProviders();
  return providersInstance;
}

function normalizeSearchDepth(depth) {
  const d = String(depth || 'basic').toLowerCase();
  if (d === 'deep') return 'deep';
  if (d === 'balanced') return 'balanced';
  return 'basic';
}

function timeRangeHint(timeRange) {
  const tr = String(timeRange || '').trim().toLowerCase();
  if (!tr) return '';
  // Accept common values: day/week/month/year/24h/7d/30d, or natural phrases
  if (tr === 'day' || tr === '24h' || tr === 'today' || tr === 'past_day') return 'past day';
  if (tr === 'week' || tr === '7d' || tr === 'past_week') return 'past week';
  if (tr === 'month' || tr === '30d' || tr === 'past_month') return 'past month';
  if (tr === 'year' || tr === '365d' || tr === 'past_year') return 'past year';
  return tr;
}

function makeToolFirstResult({ query, intent, provider, snippet, extra, startTime }) {
  const results = [
    {
      title: intent === 'weather' ? `Weather — ${query}` : `Lookup — ${intent}`,
      url: `${provider}://lookup?q=${encodeURIComponent(String(query || ''))}`,
      snippet: snippet || '',
      provider,
      trustScore: 10.0,
    },
  ];

  const meta = {
    intent,
    tool_first: true,
    total_latency_ms: Date.now() - startTime,
    success: true,
    extra: extra || null,
  };

  return {
    ok: true,
    results,
    provider,
    meta,
    // legacy fields
    metadata: { ...meta, totalResults: results.length, querySent: query },
    usedProviders: [provider],
  };
}

/**
 * Main wrapper used by router/handler
 */
async function webSearchV2Wrapper(query, options = {}) {
  const startTime = Date.now();
  const q = String(query || '').trim();

  const maxResults = Number(options.maxResults || options.max_results || 10) || 10;
  const prefer = options.prefer || options.provider || null;
  const searchDepth = normalizeSearchDepth(options.searchDepth);
  const timeRange = options.timeRange || null;

  const providers = getProviders();

  // Small but helpful, non-spam log
  console.log('🔎 [WEBSEARCH] on', {
    prefer: prefer || 'auto',
    maxResults,
    searchDepth,
    timeRange: timeRange || null,
  });

  try {
    // ------------------------------------------------------------
    // Tool-first shortcircuit (weather/geo) — avoid wasting websearch quota
    // ------------------------------------------------------------
    let classification = null;
    try {
      classification = classifyQuery(q);
    } catch (_e) {
      classification = null;
    }

    if (classification && classification.intent === 'weather') {
      const place = classification.location || q;
      console.log('🌦️ [WEBSEARCH] shortcircuit weather → weather tool');
      const wx = await getWeather({ place, provider: 'auto', languageHint: 'en' });
      const snippet = wx?.ok ? formatWeatherSnippet(wx) : `Weather lookup failed for "${place}".`;
      return makeToolFirstResult({ query: place, intent: 'weather', provider: wx?.provider || 'weather', snippet, extra: { weather: wx }, startTime });
    }

    if (classification && (classification.intent === 'geo' || classification.intent === 'nearby')) {
      const qq = q;
      console.log('🗺️ [WEBSEARCH] shortcircuit geo → OSM tool');
      let osmRes = null;
      if (classification.intent === 'nearby' && typeof osmTool?.osmNearby === 'function') {
        osmRes = await osmTool.osmNearby({ query: qq });
      } else if (typeof osmTool?.osmGeocode === 'function') {
        osmRes = await osmTool.osmGeocode({ query: qq });
      }
      const snippet = osmRes?.ok ? formatOsmSnippet(osmRes) : `Location lookup failed for "${qq}".`;
      return makeToolFirstResult({ query: qq, intent: classification.intent, provider: 'osm', snippet, extra: { osm: osmRes }, startTime });
    }

    // ------------------------------------------------------------
    // Map options to V2 orchestrator
    // ------------------------------------------------------------
    const v2Options = {
      providers,
      maxResults,
      prefer,
      searchDepth,
      timeRange,
      // When provider does not support timeRange, we still add it as a hint in pipeline stage2.
      timeRangeHint: timeRangeHint(timeRange),
      enableContactProbe: true,
      enableSnippetExtraction: true,
      minTrustScore: 3.0,
    };

    const v2 = await webSearch(q, v2Options);

    const results = Array.isArray(v2?.results) ? v2.results : [];
    const meta = {
      ...(v2?.metadata || {}),
      total_latency_ms: Date.now() - startTime,
      searchDepth,
      timeRange: timeRange || null,
      prefer: prefer || 'auto',
      resultsCount: results.length,
    };

    const providerUsed = (v2?.metadata?.providers_used && v2.metadata.providers_used[0]) || prefer || 'auto';

    return {
      ok: true,
      results,
      provider: providerUsed,
      meta,
      // legacy fields (so existing chat logic doesn't break)
      metadata: { ...meta, totalResults: results.length, querySent: q },
      usedProviders: v2?.metadata?.providers_used || (providerUsed ? [providerUsed] : []),
      queryClassification: {
        intent: v2?.metadata?.intent || classification?.intent || 'unknown',
        freshness: v2?.metadata?.freshness || 'unknown',
        location: v2?.metadata?.location || null,
        confidence: v2?.metadata?.confidence || 0,
      },
      contactProbe: v2?.metadata?.contact_probe || { executed: false },
      snippets: v2?.snippets || [],
      formattedSnippets: v2?.formattedSnippets || null,
      keyFacts: v2?.keyFacts || null,
    };
  } catch (error) {
    console.warn('⚠️ [WEBSEARCH] failed:', error?.message || error);
    return {
      ok: false,
      reason: String(error?.message || 'websearch_failed'),
      results: [],
      provider: prefer || 'auto',
      meta: {
        total_latency_ms: Date.now() - startTime,
        searchDepth,
        timeRange: timeRange || null,
        prefer: prefer || 'auto',
      },
      // legacy
      metadata: {
        error: String(error?.message || 'websearch_failed'),
        totalResults: 0,
        querySent: q,
      },
      usedProviders: [],
    };
  }
}

// ------------------------------------------------------------
// Formatting helpers (kept small)
// ------------------------------------------------------------
function formatWeatherSnippet(wx) {
  const place = wx?.place || wx?.location || '';
  const current = wx?.current || wx?.now || null;
  if (!current) return `Weather data for ${place}.`;
  const temp = current?.temp ?? current?.temperature;
  const desc = current?.description || current?.summary || '';
  return `${place}: ${temp ?? ''}${temp != null ? '°C' : ''} ${desc}`.trim();
}

function formatOsmSnippet(osmRes) {
  const items = osmRes?.results || osmRes?.items || [];
  if (!Array.isArray(items) || items.length === 0) return 'No results.';
  const top = items.slice(0, 5).map((x) => x?.display_name || x?.name || '').filter(Boolean);
  return top.join(' | ');
}

module.exports = {
  webSearchV2Wrapper,
};
