'use strict';

// DBpedia Lookup API (no key). This is a nice free fallback/enrichment for encyclopedic queries.
// Primary endpoint: https://lookup.dbpedia.org/api/search/KeywordSearch?QueryString=...

const DBPEDIA_LOOKUP_BASE = 'https://lookup.dbpedia.org/api/search/KeywordSearch';

const DEFAULT_TIMEOUT_MS = Number(process.env.DBPEDIA_TIMEOUT_MS || 6500);
const USER_AGENT =
  process.env.DBPEDIA_USER_AGENT || process.env.WIKI_USER_AGENT || 'gptnix-backend';

// Tiny in-memory cache (Cloud Run friendly)
const _cache = new Map();
const _CACHE_MAX = 250;

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);

    Promise.resolve(promise)
      .then((v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      })
      .catch(() => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(fallback);
      });
  });
}

function _cacheGet(key) {
  try {
    const v = _cache.get(key);
    if (!v) return null;
    if (v.exp && v.exp < Date.now()) {
      _cache.delete(key);
      return null;
    }
    return v.val;
  } catch {
    return null;
  }
}

function _cacheSet(key, val, ttlMs) {
  try {
    if (_cache.size > _CACHE_MAX) {
      const it = _cache.keys();
      for (let i = 0; i < 25; i++) {
        const k = it.next().value;
        if (!k) break;
        _cache.delete(k);
      }
    }
    _cache.set(key, { val, exp: Date.now() + (ttlMs || 10 * 60 * 1000) });
  } catch {}
}

async function _fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        ...headers,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`DBpedia HTTP ${res.status}`);
      err.statusCode = res.status;
      err.body = text;
      throw err;
    }

    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function _normQuery(q) {
  return String(q || '').trim().replace(/\s+/g, ' ');
}

function _pickBestDoc(docs, q) {
  const query = _normQuery(q).toLowerCase();
  if (!Array.isArray(docs) || !docs.length) return null;

  const scored = docs
    .map((d) => {
      const label = (d?.label || d?.Label || d?.title || '').toString().trim();
      const desc = (d?.description || d?.Description || d?.comment || '').toString().trim();
      const uri = (d?.resource || d?.URI || d?.uri || d?.ref || '').toString().trim();

      let s = 0;
      const l = label.toLowerCase();
      if (l === query) s += 10;
      if (l.includes(query)) s += 4;
      if (query.includes(l) && l.length > 2) s += 2;
      if (desc && desc.length > 40) s += 1;
      if (uri.includes('dbpedia.org/resource/')) s += 1;
      return { label, desc, uri, score: s };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

async function _keywordSearch(q) {
  const url = `${DBPEDIA_LOOKUP_BASE}?QueryString=${encodeURIComponent(q)}`;
  const json = await _fetchJson(url);

  // Depending on version, this may be {docs:[...]} or similar.
  const docs =
    (Array.isArray(json?.docs) && json.docs) ||
    (Array.isArray(json?.results) && json.results) ||
    (Array.isArray(json?.Result) && json.Result) ||
    [];

  const best = _pickBestDoc(docs, q);
  if (!best) return null;

  return {
    label: best.label,
    description: best.desc,
    uri: best.uri,
    source: 'dbpedia',
  };
}

function formatDbpediaContext(hit) {
  if (!hit) return '';
  const lines = [];
  lines.push('=== DBPEDIA (free knowledge graph) ===');
  if (hit.label) lines.push(`- Label: ${hit.label}`);
  if (hit.description) lines.push(`- Description: ${hit.description}`);
  if (hit.uri) lines.push(`- URL: ${hit.uri}`);
  return lines.join('\n');
}

async function dbpediaLookup({ query, title } = {}) {
  const q = _normQuery(title || query);
  if (!q) return { ok: false, error: 'missing query' };

  const cacheKey = `dbpedia:${q.toLowerCase()}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const hit = await withTimeout(_keywordSearch(q), DEFAULT_TIMEOUT_MS + 500, null);
  if (!hit || !hit.uri) {
    const out = { ok: false, query: q, error: 'no_hit' };
    _cacheSet(cacheKey, out, 6 * 60 * 1000);
    return out;
  }

  const out = {
    ok: true,
    query: q,
    hit,
    source: 'dbpedia',
    fetchedAtIso: new Date().toISOString(),
    context: formatDbpediaContext(hit),
    sources: [
      {
        title: hit.label ? `DBpedia: ${hit.label}` : 'DBpedia',
        url: hit.uri,
        snippet: hit.description || '',
        domain: 'dbpedia.org',
        provider: 'dbpedia',
        iconUrl: 'https://dbpedia.org/favicon.ico',
      },
    ],
  };

  _cacheSet(cacheKey, out, 24 * 60 * 60 * 1000);
  return out;
}

module.exports = {
  dbpediaLookup,
  formatDbpediaContext,
};
