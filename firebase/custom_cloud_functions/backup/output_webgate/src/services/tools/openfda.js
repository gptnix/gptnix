'use strict';

// openFDA — Drug Label API (free, no key)
// Docs: https://open.fda.gov/apis/drug/label/
// NOTE: Label content is mostly English (official FDA label excerpts).

const OPENFDA_BASE = 'https://api.fda.gov/drug/label.json';

// tiny in-memory cache
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

function _asOneLine(x, { max = 240 } = {}) {
  const s = Array.isArray(x) ? x.join(' ') : String(x || '');
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

function _pickFirst(arr) {
  if (!arr) return '';
  if (Array.isArray(arr)) return _asOneLine(arr[0] || '');
  return _asOneLine(arr);
}

function _safeArr(x) {
  return Array.isArray(x) ? x : x ? [x] : [];
}

function _buildSearch(q) {
  const term = String(q || '').trim();
  if (!term) return '';

  // Prefer exact phrase match where possible.
  const esc = term.replace(/"/g, '\\"');

  // openFDA query syntax: field:"value" OR field:"value"
  // We include common fields.
  return [
    `openfda.generic_name:"${esc}"`,
    `openfda.brand_name:"${esc}"`,
    `openfda.substance_name:"${esc}"`,
    `openfda.product_ndc:"${esc}"`,
  ].join(' OR ');
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
      throw new Error(`openFDA ${res.status}: ${txt}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function formatOpenFdaContext({ query, result }) {
  const r = result || {};
  const openfda = r.openfda || {};

  const brand = _safeArr(openfda.brand_name).filter(Boolean).slice(0, 6).join(', ');
  const generic = _safeArr(openfda.generic_name).filter(Boolean).slice(0, 6).join(', ');
  const substance = _safeArr(openfda.substance_name).filter(Boolean).slice(0, 6).join(', ');
  const mfg = _safeArr(openfda.manufacturer_name).filter(Boolean).slice(0, 4).join(', ');
  const route = _safeArr(openfda.route).filter(Boolean).slice(0, 6).join(', ');
  const dosageForm = _safeArr(openfda.dosage_form).filter(Boolean).slice(0, 6).join(', ');

  const warnings = _pickFirst(r.warnings || r.boxed_warning || r.warnings_and_cautions);
  const indications = _pickFirst(r.indications_and_usage);
  const dosage = _pickFirst(r.dosage_and_administration);
  const contraindications = _pickFirst(r.contraindications);
  const interactions = _pickFirst(r.drug_interactions);
  const adverse = _pickFirst(r.adverse_reactions);

  const lines = [];
  lines.push(`Query: ${String(query || '').trim()}`);
  if (brand) lines.push(`Brand name(s): ${brand}`);
  if (generic) lines.push(`Generic name(s): ${generic}`);
  if (substance) lines.push(`Substance(s): ${substance}`);
  if (mfg) lines.push(`Manufacturer: ${mfg}`);
  if (dosageForm) lines.push(`Dosage form: ${dosageForm}`);
  if (route) lines.push(`Route: ${route}`);

  // Keep sections short — the assistant can ask for more.
  if (indications) lines.push(`Indications: ${indications}`);
  if (dosage) lines.push(`Dosage & administration: ${dosage}`);
  if (contraindications) lines.push(`Contraindications: ${contraindications}`);
  if (warnings) lines.push(`Warnings: ${warnings}`);
  if (interactions) lines.push(`Drug interactions: ${interactions}`);
  if (adverse) lines.push(`Adverse reactions: ${adverse}`);

  return lines.join('\n');
}

async function openFdaDrugLabel({ query, limit = 1 } = {}) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Nedostaje query (naziv lijeka)' };

  const lim = Math.max(1, Math.min(Number(limit) || 1, 3));
  const search = _buildSearch(q);
  if (!search) return { ok: false, error: 'Prazan query' };

  const cacheKey = `openfda:label:${q.toLowerCase()}:${lim}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const url = new URL(OPENFDA_BASE);
  url.searchParams.set('search', search);
  url.searchParams.set('limit', String(lim));

  let json;
  try {
    json = await _fetchJson(url.toString());
  } catch (e) {
    // openFDA returns 404/"No matches found!" for empty results.
    const msg = String(e?.message || e);
    if (msg.includes('No matches found') || msg.includes('404')) {
      return { ok: false, error: 'Nema openFDA label rezultata za taj upit' };
    }
    return { ok: false, error: msg };
  }

  const results = Array.isArray(json?.results) ? json.results : [];
  if (!results.length) return { ok: false, error: 'Nema openFDA label rezultata' };

  // Pick best match: prefer one where generic/brand contains query.
  const qLow = q.toLowerCase();
  const score = (r) => {
    const openfda = r?.openfda || {};
    const blob = [
      ..._safeArr(openfda.brand_name),
      ..._safeArr(openfda.generic_name),
      ..._safeArr(openfda.substance_name),
      r?.id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    let s = 0;
    if (blob.includes(qLow)) s += 5;
    if (_safeArr(openfda.generic_name).some((x) => String(x || '').toLowerCase() === qLow)) s += 4;
    if (_safeArr(openfda.brand_name).some((x) => String(x || '').toLowerCase() === qLow)) s += 3;
    return s;
  };

  const best = [...results].sort((a, b) => score(b) - score(a))[0];
  const context = formatOpenFdaContext({ query: q, result: best });
  const out = {
    ok: true,
    query: q,
    source: 'openfda:drug/label',
    fetchedAtIso: new Date().toISOString(),
    result: best,
    context,
  };

  _cacheSet(cacheKey, out, 10 * 60 * 1000); // 10 min
  return out;
}

module.exports = {
  openFdaDrugLabel,
  formatOpenFdaContext,
};
