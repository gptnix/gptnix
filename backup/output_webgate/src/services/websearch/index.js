'use strict';

/**
 * WebSearch public API (CommonJS)
 *
 * Compatible with existing handlers:
 *   const { webSearch, makeWebContextBlock } = require('../services/websearch');
 */

const { webSearchV2Wrapper } = require('./integrationWrapper');

async function webSearch(query, options = {}) {
  const t0 = Date.now();
  console.log('[WEB] search start', { query: String(query || '').slice(0, 120), mode: options.mode });
  const result = await webSearchV2Wrapper(query, options);
  const n = Array.isArray(result?.results) ? result.results.length : 0;
  console.log('[WEB] search done', { results: n, latency_ms: Date.now() - t0, providers: result?.usedProviders });
  return result;
}

/**
 * Convert websearch results to a compact, deterministic context block for the LLM.
 * Keep it small to avoid prompt bloat.
 */
function makeWebContextBlock(searchResult) {
  const results = Array.isArray(searchResult?.results) ? searchResult.results : [];
  if (!results.length) return '';

  const meta = searchResult?.meta || searchResult?.metadata || {};
  const provider =
    searchResult?.provider ||
    (Array.isArray(searchResult?.usedProviders) && searchResult.usedProviders[0]) ||
    'auto';

  const escapeXml = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const maxItems = Math.min(results.length, 8);
  const lines = [];
  lines.push(`<WEB_SEARCH provider="${escapeXml(provider)}" results="${maxItems}">`);

  for (let i = 0; i < maxItems; i++) {
    const r = results[i] || {};
    const title = escapeXml(r.title || '');
    const url = escapeXml(r.url || '');
    const snippet = escapeXml(String(r.snippet || '').slice(0, 420));
    const trust =
      r.trustScore != null
        ? Number(r.trustScore)
        : r.trust_score != null
          ? Number(r.trust_score)
          : null;
    const published = r.publishedDate || r.published_at || r.date || null;

    const attrs = [
      `rank="${i + 1}"`,
      trust != null && Number.isFinite(trust) ? `trust="${trust.toFixed(1)}"` : null,
      published ? `published="${escapeXml(published)}"` : null,
    ].filter(Boolean);

    lines.push(`  <RESULT ${attrs.join(' ')}>`);
    lines.push(`    <TITLE>${title}</TITLE>`);
    lines.push(`    <URL>${url}</URL>`);
    if (snippet) lines.push(`    <SNIPPET>${snippet}</SNIPPET>`);
    lines.push('  </RESULT>'); // FIX: was </r> — broken XML closing tag
  }

  const latency = meta.total_latency_ms || meta.totalLatencyMs || null;
  const intent = meta.intent || null;
  lines.push(
    `  <META${latency != null ? ` latency_ms="${escapeXml(latency)}"` : ''}${intent ? ` intent="${escapeXml(intent)}"` : ''} />`,
  );
  lines.push('</WEB_SEARCH>');
  return lines.join('\n');
}

module.exports = {
  webSearch,
  makeWebContextBlock,
};
