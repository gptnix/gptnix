'use strict';

// Wikidata (free, no key)
// API: https://www.wikidata.org/w/api.php?action=help
// Use for: structured entity facts (birth date, occupation, official website, social links, IDs).

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

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

function _pickLang(languageHint) {
  const raw = String(languageHint || '').trim().toLowerCase();
  const lang = raw.split(/[-_]/)[0];
  const allow = new Set(['hr', 'bs', 'sr', 'en', 'de', 'fr', 'it', 'es', 'pt', 'nl', 'pl', 'cs', 'sk', 'sl', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'sv', 'no', 'da', 'fi', 'ar', 'he', 'fa', 'zh', 'ja', 'ko']);
  return allow.has(lang) ? lang : 'en';
}

async function _fetchJson(url, { timeoutMs = 8000 } = {}) {
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
      throw new Error(`Wikidata ${res.status}: ${txt}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function _asOneLine(s, max = 220) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function _getEntityLabel(ent, lang) {
  return ent?.labels?.[lang]?.value || ent?.labels?.en?.value || '';
}

function _getEntityDescription(ent, lang) {
  return ent?.descriptions?.[lang]?.value || ent?.descriptions?.en?.value || '';
}

function _pickSitelink(ent, lang) {
  const sl = ent?.sitelinks || {};
  const prefer = [
    `${lang}wiki`,
    lang === 'bs' ? 'hrwiki' : '',
    lang === 'sr' ? 'hrwiki' : '',
    'enwiki',
    'hrwiki',
  ].filter(Boolean);
  for (const key of prefer) {
    if (sl?.[key]?.url) return sl[key].url;
  }
  // fall back to any wiki sitelink
  for (const k of Object.keys(sl)) {
    if (k.endsWith('wiki') && sl?.[k]?.url) return sl[k].url;
  }
  return '';
}

function _snakValueToSimple(snak) {
  const dv = snak?.datavalue;
  const type = dv?.type;
  const val = dv?.value;
  if (!type) return null;
  if (type === 'string') return String(val || '').trim();
  if (type === 'time') {
    const t = String(val?.time || '').trim();
    // time looks like +1965-02-01T00:00:00Z
    const m = t.match(/[+-]?(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return t;
  }
  if (type === 'wikibase-entityid') return String(val?.id || val?.numeric-id || '').trim();
  if (type === 'monolingualtext') return String(val?.text || '').trim();
  if (type === 'quantity') return val?.amount != null ? String(val.amount) : null;
  if (type === 'globecoordinate') {
    if (val?.latitude != null && val?.longitude != null) return `${val.latitude},${val.longitude}`;
    return null;
  }
  return null;
}

function _firstClaim(ent, pid) {
  const claims = ent?.claims?.[pid];
  if (!Array.isArray(claims) || !claims.length) return null;
  const mainsnak = claims?.[0]?.mainsnak;
  return _snakValueToSimple(mainsnak);
}

function _allClaims(ent, pid, limit = 6) {
  const claims = ent?.claims?.[pid];
  if (!Array.isArray(claims) || !claims.length) return [];
  const out = [];
  for (const c of claims) {
    const v = _snakValueToSimple(c?.mainsnak);
    if (!v) continue;
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

async function _labelsForIds(ids, lang) {
  const unique = Array.from(new Set((ids || []).filter(Boolean))).slice(0, 40);
  if (!unique.length) return {};

  const url = new URL(WIKIDATA_API);
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', unique.join('|'));
  url.searchParams.set('props', 'labels');
  url.searchParams.set('languages', `${lang}|en`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const json = await _fetchJson(url.toString(), { timeoutMs: 8000 });
  const ents = json?.entities || {};
  const map = {};
  for (const [id, ent] of Object.entries(ents)) {
    map[id] = _getEntityLabel(ent, lang) || id;
  }
  return map;
}

function formatWikidataContext({ query, entityId, label, description, wikiUrl, facts }) {
  const lines = [];
  lines.push(`Query: ${String(query || '').trim()}`);
  lines.push(`Wikidata: ${entityId}${label ? ` — ${label}` : ''}`);
  if (description) lines.push(`Description: ${_asOneLine(description, 260)}`);
  if (wikiUrl) lines.push(`Wikipedia: ${wikiUrl}`);

  const f = facts || {};
  const push = (k, v) => {
    if (!v) return;
    if (Array.isArray(v) && !v.length) return;
    const val = Array.isArray(v) ? v.join(', ') : String(v);
    lines.push(`${k}: ${_asOneLine(val, 340)}`);
  };

  push('Born', f.born);
  push('Died', f.died);
  push('Occupation', f.occupation);
  push('Citizenship', f.citizenship);
  push('Official website', f.website);
  push('Facebook', f.facebook);
  push('Instagram', f.instagram);
  push('X/Twitter', f.twitter);

  return lines.join('\n');
}

async function wikidataLookup({ query, languageHint, limit = 5 } = {}) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Nedostaje query (entitet)' };

  const lang = _pickLang(languageHint);
  const lim = Math.max(1, Math.min(Number(limit) || 5, 10));
  const cacheKey = `wikidata:lookup:${lang}:${q.toLowerCase()}:${lim}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  // 1) Search entities
  const sUrl = new URL(WIKIDATA_API);
  sUrl.searchParams.set('action', 'wbsearchentities');
  sUrl.searchParams.set('search', q);
  sUrl.searchParams.set('language', lang);
  sUrl.searchParams.set('limit', String(lim));
  sUrl.searchParams.set('format', 'json');
  sUrl.searchParams.set('origin', '*');

  let search;
  try {
    search = await _fetchJson(sUrl.toString());
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }

  const hits = Array.isArray(search?.search) ? search.search : [];
  if (!hits.length) return { ok: false, error: 'Wikidata: nema rezultata' };

  // Pick best: exact label match > startsWith > first
  const qLow = q.toLowerCase();
  const score = (h) => {
    const lbl = String(h?.label || '').toLowerCase();
    let s = 0;
    if (lbl === qLow) s += 10;
    if (lbl.startsWith(qLow)) s += 6;
    if (lbl.includes(qLow)) s += 3;
    return s;
  };
  const best = [...hits].sort((a, b) => score(b) - score(a))[0];
  const id = String(best?.id || '').trim();
  if (!id) return { ok: false, error: 'Wikidata: nepoznat entity id' };

  // 2) Fetch entity data
  const eUrl = new URL(WIKIDATA_API);
  eUrl.searchParams.set('action', 'wbgetentities');
  eUrl.searchParams.set('ids', id);
  eUrl.searchParams.set('props', 'labels|descriptions|claims|sitelinks');
  eUrl.searchParams.set('languages', `${lang}|en`);
  eUrl.searchParams.set('format', 'json');
  eUrl.searchParams.set('origin', '*');

  let entJson;
  try {
    entJson = await _fetchJson(eUrl.toString());
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }

  const ent = entJson?.entities?.[id];
  if (!ent) return { ok: false, error: 'Wikidata: entity nije pronađen' };

  // Extract a few common facts
  const born = _firstClaim(ent, 'P569');
  const died = _firstClaim(ent, 'P570');
  const occupationIds = _allClaims(ent, 'P106', 6);
  const citizenIds = _allClaims(ent, 'P27', 6);
  const website = _firstClaim(ent, 'P856');
  const twitter = _firstClaim(ent, 'P2002');
  const instagram = _firstClaim(ent, 'P2003');
  const facebook = _firstClaim(ent, 'P2013');

  // Resolve Q-ids to readable labels (occupation/citizenship)
  const toResolve = [];
  for (const x of [...occupationIds, ...citizenIds]) {
    if (String(x).startsWith('Q')) toResolve.push(String(x));
  }
  let labels = {};
  try {
    labels = await _labelsForIds(toResolve, lang);
  } catch {
    labels = {};
  }

  const occupation = occupationIds
    .map((x) => (String(x).startsWith('Q') ? labels?.[x] || x : x))
    .filter(Boolean);
  const citizenship = citizenIds
    .map((x) => (String(x).startsWith('Q') ? labels?.[x] || x : x))
    .filter(Boolean);

  const label = _getEntityLabel(ent, lang) || String(best?.label || '').trim();
  const description = _getEntityDescription(ent, lang) || String(best?.description || '').trim();
  const wikiUrl = _pickSitelink(ent, lang);

  const facts = {
    born,
    died,
    occupation,
    citizenship,
    website,
    twitter,
    instagram,
    facebook,
  };

  const context = formatWikidataContext({ query: q, entityId: id, label, description, wikiUrl, facts });
  const out = {
    ok: true,
    query: q,
    language: lang,
    entityId: id,
    label,
    description,
    wikiUrl,
    facts,
    source: 'wikidata',
    fetchedAtIso: new Date().toISOString(),
    context,
    candidates: hits.slice(0, lim).map((h) => ({
      id: h.id,
      label: h.label,
      description: h.description,
      url: h.concepturi,
    })),
  };

  _cacheSet(cacheKey, out, 12 * 60 * 1000);
  return out;
}

module.exports = {
  wikidataLookup,
  formatWikidataContext,
};
