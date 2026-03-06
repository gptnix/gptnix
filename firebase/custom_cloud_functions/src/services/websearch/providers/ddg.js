'use strict';

const { fetchJson } = require('../http');

function ddgAvailable() {
  // Free endpoint (Instant Answer). No API key.
  return true;
}

function buildUrl(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_redirect: '1',
    no_html: '1',
    skip_disambig: '1',
  });
  return `https://api.duckduckgo.com/?${params.toString()}`;
}

function extractRelated(related) {
  const out = [];
  if (!Array.isArray(related)) return out;
  for (const item of related) {
    if (item && item.Text && item.FirstURL) {
      out.push({ title: item.Text, url: item.FirstURL });
    }
    if (Array.isArray(item?.Topics)) {
      for (const sub of item.Topics) {
        if (sub && sub.Text && sub.FirstURL) {
          out.push({ title: sub.Text, url: sub.FirstURL });
        }
      }
    }
  }
  return out;
}

async function ddgInstantAnswer({ query } = {}) {
  if (!query || typeof query !== 'string') {
    throw new Error('query required');
  }

  const json = await fetchJson(buildUrl(query), { method: 'GET' });

  const heading = json?.Heading || '';
  const abstractText = json?.AbstractText || '';
  const abstractUrl = json?.AbstractURL || '';
  const related = extractRelated(json?.RelatedTopics).slice(0, 6);

  const results = [];
  if (abstractText) {
    results.push({
      rank: 1,
      title: heading || query,
      url: abstractUrl || '',
      snippet: abstractText,
      source: json?.AbstractSource || null,
    });
  }

  for (let i = 0; i < related.length; i++) {
    results.push({
      rank: results.length + 1,
      title: related[i].title,
      url: related[i].url,
      snippet: '',
      source: 'DuckDuckGo',
    });
  }

  return {
    provider: 'ddg',
    query,
    results,
    raw: json,
  };
}

module.exports = {
  ddgAvailable,
  ddgInstantAnswer,
};

// ESM wrapper expects named export-like function. Provide CJS helper.
async function searchDDG(query, options = {}) {
  const max = options.max_results || options.maxResults || 10;
  const out = await ddgInstantAnswer({ query });
  const results = Array.isArray(out?.results) ? out.results : [];
  return results.slice(0, max).map(r => ({
    url: r.url || '',
    title: r.title || '',
    snippet: r.snippet || '',
  }));
}

module.exports.searchDDG = searchDDG;
