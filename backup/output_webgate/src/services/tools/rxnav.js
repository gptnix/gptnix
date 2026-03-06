'use strict';

// RxNav / RxNorm (NLM/NIH) — free, no key
// Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/
// Useful for: brand/generic normalization + drug interaction groups.

const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST';

// tiny cache
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

async function _fetchJson(url, { timeoutMs = 7000 } = {}) {
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
      throw new Error(`RxNav ${res.status}: ${txt}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function _asOneLine(s, max = 220) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function formatRxNavLookupContext({ query, candidates }) {
  const list = Array.isArray(candidates) ? candidates : [];
  const lines = [];
  lines.push(`Query: ${String(query || '').trim()}`);
  if (!list.length) {
    lines.push('No RxNav candidates found.');
    return lines.join('\n');
  }

  lines.push('Top RxNorm candidates:');
  for (let i = 0; i < Math.min(5, list.length); i++) {
    const c = list[i];
    lines.push(`- ${i + 1}) ${_asOneLine(c.name)} (rxcui=${c.rxcui || 'n/a'})`);
  }
  return lines.join('\n');
}

async function rxNavDrugLookup({ query, max = 5 } = {}) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Nedostaje query (naziv lijeka)' };

  const lim = Math.max(1, Math.min(Number(max) || 5, 10));
  const cacheKey = `rxnav:lookup:${q.toLowerCase()}:${lim}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const url = new URL(`${RXNAV_BASE}/drugs.json`);
  url.searchParams.set('name', q);

  let json;
  try {
    json = await _fetchJson(url.toString());
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }

  const groups = json?.drugGroup;
  const concepts = Array.isArray(groups?.conceptGroup) ? groups.conceptGroup : [];

  const out = [];
  for (const g of concepts) {
    const props = Array.isArray(g?.conceptProperties) ? g.conceptProperties : [];
    for (const p of props) {
      if (!p) continue;
      const name = p.name || p.synonym || p.rxcui;
      const rxcui = p.rxcui;
      if (!name || !rxcui) continue;
      out.push({ name: String(name), rxcui: String(rxcui) });
      if (out.length >= lim) break;
    }
    if (out.length >= lim) break;
  }

  const context = formatRxNavLookupContext({ query: q, candidates: out });
  const res = {
    ok: true,
    query: q,
    source: 'rxnav:drugs',
    fetchedAtIso: new Date().toISOString(),
    candidates: out,
    context,
  };
  _cacheSet(cacheKey, res, 30 * 60 * 1000);
  return res;
}

function formatRxNavInteractionsContext({ query, rxcui, interactions }) {
  const lines = [];
  lines.push(`Query: ${String(query || '').trim()}`);
  lines.push(`rxcui: ${String(rxcui || '').trim()}`);

  const list = Array.isArray(interactions) ? interactions : [];
  if (!list.length) {
    lines.push('No interaction pairs returned by RxNav.');
    return lines.join('\n');
  }

  lines.push('Interaction pairs (short list):');
  for (let i = 0; i < Math.min(12, list.length); i++) {
    const it = list[i];
    const a = it?.a || '';
    const b = it?.b || '';
    const desc = _asOneLine(it?.description || '', 260);
    lines.push(`- ${i + 1}) ${a} × ${b}${desc ? ` — ${desc}` : ''}`);
  }
  return lines.join('\n');
}

async function rxNavInteractions({ query, rxcui } = {}) {
  const q = String(query || '').trim();
  let id = String(rxcui || '').trim();

  if (!id) {
    const lk = await rxNavDrugLookup({ query: q, max: 3 });
    const first = lk?.candidates?.[0];
    if (!first?.rxcui) return { ok: false, error: 'RxNav: ne mogu odrediti rxcui za taj upit' };
    id = String(first.rxcui);
  }

  if (!id) return { ok: false, error: 'Nedostaje rxcui' };

  const cacheKey = `rxnav:interaction:${id}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const url = new URL(`${RXNAV_BASE}/interaction/interaction.json`);
  url.searchParams.set('rxcui', id);

  let json;
  try {
    json = await _fetchJson(url.toString(), { timeoutMs: 9000 });
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }

  // Flatten a few interaction pairs.
  const groups = Array.isArray(json?.interactionTypeGroup) ? json.interactionTypeGroup : [];
  const pairs = [];
  for (const g of groups) {
    const types = Array.isArray(g?.interactionType) ? g.interactionType : [];
    for (const t of types) {
      const ip = Array.isArray(t?.interactionPair) ? t.interactionPair : [];
      for (const p of ip) {
        const desc = p?.description || '';
        const concepts = Array.isArray(p?.interactionConcept) ? p.interactionConcept : [];
        const a = concepts?.[0]?.minConceptItem?.name || concepts?.[0]?.sourceConceptItem?.name || '';
        const b = concepts?.[1]?.minConceptItem?.name || concepts?.[1]?.sourceConceptItem?.name || '';
        pairs.push({ a: String(a || '').trim(), b: String(b || '').trim(), description: String(desc || '').trim() });
        if (pairs.length >= 40) break;
      }
      if (pairs.length >= 40) break;
    }
    if (pairs.length >= 40) break;
  }

  // Dedupe by a×b
  const seen = new Set();
  const deduped = [];
  for (const p of pairs) {
    const k = `${(p.a || '').toLowerCase()}|${(p.b || '').toLowerCase()}`;
    if (!p.a || !p.b) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(p);
  }

  const context = formatRxNavInteractionsContext({ query: q || id, rxcui: id, interactions: deduped });
  const res = {
    ok: true,
    query: q || id,
    rxcui: id,
    source: 'rxnav:interaction',
    fetchedAtIso: new Date().toISOString(),
    interactions: deduped,
    context,
  };
  _cacheSet(cacheKey, res, 15 * 60 * 1000);
  return res;
}

module.exports = {
  rxNavDrugLookup,
  rxNavInteractions,
  formatRxNavLookupContext,
  formatRxNavInteractionsContext,
};
