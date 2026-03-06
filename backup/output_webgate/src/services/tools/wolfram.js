'use strict';

// Wolfram|Alpha — powerful general knowledge/computation API
// Requires WOLFRAM_APP_ID env var (aka "appid").
// Docs: https://products.wolframalpha.com/api/documentation/

const { WOLFRAM_APP_ID } = require('../../config/env');

const WOLFRAM_BASE = 'https://api.wolframalpha.com/v2/query';

const _cache = new Map();

function _now() {
  return Date.now();
}

function _cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (e.exp <= _now()) {
    _cache.delete(key);
    return null;
  }
  return e.val;
}

function _cacheSet(key, val, ttlMs) {
  _cache.set(key, { val, exp: _now() + ttlMs });
}

function _asOneLine(s, max = 220) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function _fetchJson(url, { timeoutMs = 9000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'user-agent': 'gptnix-backend',
        accept: 'application/json; charset=utf-8',
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Wolfram ${res.status}: ${txt}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function formatWolframContext({ input, pods }) {
  const lines = [];
  lines.push(`Input: ${String(input || '').trim()}`);
  if (!Array.isArray(pods) || !pods.length) {
    lines.push('No pods returned.');
    return lines.join('\n');
  }

  lines.push('Pods (selected):');
  for (let i = 0; i < Math.min(6, pods.length); i++) {
    const p = pods[i];
    const title = _asOneLine(p?.title || '', 80);
    const text = _asOneLine(p?.text || '', 320);
    if (!text) continue;
    lines.push(`- ${title || `Pod ${i + 1}`}: ${text}`);
  }
  return lines.join('\n');
}

async function wolframQuery({ input, units = 'metric' } = {}) {
  const q = String(input || '').trim();
  if (!q) return { ok: false, error: 'Nedostaje input' };
  if (!WOLFRAM_APP_ID) return { ok: false, error: 'WOLFRAM_APP_ID nije postavljen (tool nije dostupan)' };

  const cacheKey = `wolfram:${units}:${q.toLowerCase()}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const url = new URL(WOLFRAM_BASE);
  url.searchParams.set('appid', WOLFRAM_APP_ID);
  url.searchParams.set('input', q);
  url.searchParams.set('output', 'JSON');
  url.searchParams.set('format', 'plaintext');
  url.searchParams.set('units', units === 'imperial' ? 'imperial' : 'metric');

  let json;
  try {
    json = await _fetchJson(url.toString());
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }

  const queryResult = json?.queryresult;
  if (!queryResult?.success) {
    const msg = queryResult?.error ? 'Wolfram error' : 'No Wolfram result';
    return { ok: false, error: msg };
  }

  const podsRaw = Array.isArray(queryResult?.pods) ? queryResult.pods : [];
  // Prefer primary pods first.
  const podsOrdered = [...podsRaw].sort((a, b) => Number(Boolean(b?.primary)) - Number(Boolean(a?.primary)));

  const pods = [];
  for (const p of podsOrdered) {
    const subs = Array.isArray(p?.subpods) ? p.subpods : [];
    const txt = subs.map((sp) => sp?.plaintext).filter(Boolean).join(' | ');
    pods.push({ title: p?.title || '', text: txt });
    if (pods.length >= 10) break;
  }

  const context = formatWolframContext({ input: q, pods });
  const out = {
    ok: true,
    input: q,
    units: units === 'imperial' ? 'imperial' : 'metric',
    source: 'wolframalpha',
    fetchedAtIso: new Date().toISOString(),
    pods,
    context,
  };

  _cacheSet(cacheKey, out, 10 * 60 * 1000);
  return out;
}

module.exports = {
  wolframQuery,
  formatWolframContext,
};
