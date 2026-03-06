'use strict';

/**
 * OpenStreetMap tools (free, no key)
 *
 * Nominatim:
 *  - Place search / geocoding
 *  - Reverse geocoding
 *
 * Overpass:
 *  - Query POIs/features around a point
 */

const {
  OSM_USER_AGENT,
  OSM_CONTACT_EMAIL,
  OSM_CONTACT_URL,
  OSM_NOMINATIM_BASE,
  OSM_OVERPASS_BASE,
  OSM_TIMEOUT_MS,
} = require('../../config/env');

// Both Nominatim and public Overpass instances have strict usage policies.
// We keep it conservative: ~1 request / second per instance.
function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function _createThrottler(minIntervalMs) {
  let lastAt = 0;
  let chain = Promise.resolve();
  return (fn) => {
    const p = chain.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, minIntervalMs - (now - lastAt));
      if (waitMs) await _sleep(waitMs);
      lastAt = Date.now();
      return fn();
    });
    chain = p.catch(() => {});
    return p;
  };
}

const _throttleNominatim = _createThrottler(1100);
const _throttleOverpass = _createThrottler(1100);

function _contactHeaders({ lang } = {}) {
  const h = {
    'User-Agent': _buildUserAgent(),
    Accept: 'application/json; charset=utf-8',
  };

  if (lang) h['Accept-Language'] = lang;

  const emailRaw = String(OSM_CONTACT_EMAIL || '').trim();
  const looksFakeEmail = /example\.com$/i.test(emailRaw) || /\byou@/i.test(emailRaw);
  const email = looksFakeEmail ? '' : emailRaw;
  const urlRaw = String(OSM_CONTACT_URL || '').trim();
  const appUrl = String(process.env.APP_URL || process.env.PUBLIC_URL || '').trim();
  const url = urlRaw || appUrl || 'https://gptnix.app';
  if (email) h.From = email;
  if (url) h.Referer = url;

  return h;
}

function _normalizeNominatimBase(base) {
  let s = String(base || '').trim();
  if (!s) return '';
  s = s.replace(/\/+$/, '');
  // If someone accidentally pasted a full endpoint, normalize to base.
  s = s.replace(/\/(search|reverse)\/?$/i, '');
  return s;
}

function _normalizeOverpassBase(base) {
  let s = String(base || '').trim();
  if (!s) return '';
  s = s.replace(/\/+$/, '');
  // Public instances usually expose /api/interpreter.
  if (!/interpreter\b/i.test(s)) s = `${s}/api/interpreter`;
  return s;
}

function _isRetryable(err) {
  const status = Number(err?.status || 0);
  if ([408, 429, 500, 502, 503, 504, 522, 524].includes(status)) return true;
  if (String(err?.name || '').toLowerCase().includes('abort')) return true;
  // Node fetch throws TypeError on some network errors.
  if (err instanceof TypeError) return true;
  return false;
}

async function _fetchJsonWithRetry(url, opts, { retries = 1, backoffMs = 1600 } = {}) {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await _fetchJson(url, opts);
    } catch (e) {
      lastErr = e;
      if (i >= retries || !_isRetryable(e)) break;
      await _sleep(backoffMs + Math.floor(Math.random() * 250));
    }
  }
  throw lastErr;
}

function _buildUserAgent() {
  const version = String(process.env.APP_VERSION || process.env.npm_package_version || '1.0').trim();
  const uaBase = String(OSM_USER_AGENT || '').trim() || `GPTNiX/${version}`;

  // If the user already provided contact info in UA, don't touch it.
  if (uaBase.includes('@') || uaBase.includes('http')) return uaBase;

  const emailRaw = String(OSM_CONTACT_EMAIL || '').trim();
  const looksFakeEmail = /example\.com$/i.test(emailRaw) || /\byou@/i.test(emailRaw);
  const email = looksFakeEmail ? '' : emailRaw;
  const url = String(OSM_CONTACT_URL || '').trim();

  // Append contact info only if the deployment provided it.
  // Avoid inventing fake domains (some instances will block that).
  if (email || url) {
    const parts = [];
    if (url) parts.push(url);
    if (email) parts.push(`contact: ${email}`);
    return `${uaBase} (${parts.join('; ')})`;
  }

  // FALLBACK: If no contact provided, still identify the application with a stable URL.
  // NOTE: For public Nominatim you should set OSM_CONTACT_URL and/or OSM_CONTACT_EMAIL.
  const appUrl = String(process.env.APP_URL || '').trim() || 'https://gptnix.app';
  return `${uaBase} (+${appUrl})`;
}

function _isPublicNominatim(base) {
  const b = String(base || '').toLowerCase();
  return b.includes('nominatim.openstreetmap.org');
}

function _validatePublicNominatimContact(base) {
  if (!_isPublicNominatim(base)) return;
  const emailRaw = String(OSM_CONTACT_EMAIL || '').trim();
  const url = String(OSM_CONTACT_URL || '').trim();
  // Public Nominatim requires an identifying UA. We can safely build one even if
  // env var isn't set, but we must have a real contact (email or url).
  const ua = _buildUserAgent();
  const looksFakeEmail = /example\.com$/i.test(emailRaw) || /\byou@/i.test(emailRaw);
  const email = looksFakeEmail ? '' : emailRaw;

  if ((!email && !url) || !ua) {
    throw new Error(
      'OSM Nominatim (public) requires a real contact + custom User-Agent. Set OSM_USER_AGENT and OSM_CONTACT_EMAIL or OSM_CONTACT_URL.',
    );
  }
}

function _splitBases(raw, fallbacks = []) {
  const list = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : fallbacks;
}

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

function _asOneLine(s, max = 260) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function _fetchJson(
  url,
  { method = 'GET', headers = {}, body, timeoutMs = Number(OSM_TIMEOUT_MS || 9000) } = {},
) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_e) {
      json = null;
    }

    if (!res.ok) {
      const msg = (json && (json.error || json.message)) || text || `HTTP ${res.status}`;
      const err = new Error(`OSM ${res.status} (${url}): ${msg}`);
      err.status = res.status;
      err.payload = json;
      err.bodyText = text;
      throw err;
    }

    if (json == null) {
      const err = new Error(`OSM invalid JSON (${url}): ${text?.slice(0, 300) || 'empty'}`);
      err.status = res.status;
      err.bodyText = text;
      throw err;
    }

    return json;
  } finally {
    clearTimeout(t);
  }
}

function _toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function _haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _osmMapUrl(lat, lon, zoom = 18) {
  if (lat == null || lon == null) return '';
  const la = Number(lat).toFixed(6);
  const lo = Number(lon).toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=${zoom}/${la}/${lo}`;
}

function _guessFilter(text) {
  const t = String(text || '').toLowerCase();

  // Hr/Bs/Sr quick intents (plus English)
  if (/(ljekarn|apoteka|pharmacy)/i.test(t)) return { key: 'amenity', value: 'pharmacy' };
  if (/(bolnic|hospital)/i.test(t)) return { key: 'amenity', value: 'hospital' };
  if (/(ambulant|clinic)/i.test(t)) return { key: 'amenity', value: 'clinic' };
  if (/(bankomat|atm)/i.test(t)) return { key: 'amenity', value: 'atm' };
  if (/(restoran|restaurant)/i.test(t)) return { key: 'amenity', value: 'restaurant' };
  if (/(kafi[cć]|cafe|coffee)/i.test(t)) return { key: 'amenity', value: 'cafe' };
  if (/(benzinsk|pumpa|fuel|petrol)/i.test(t)) return { key: 'amenity', value: 'fuel' };
  if (/(po[sš]t|post office)/i.test(t)) return { key: 'amenity', value: 'post_office' };
  if (/(policij|police)/i.test(t)) return { key: 'amenity', value: 'police' };
  if (/parking/i.test(t)) return { key: 'amenity', value: 'parking' };
  if (/(hotel|smje[sš]taj|apartman|apartmani|rooms)/i.test(t)) return { key: 'tourism', value: 'hotel' };
  if (/(du[ćc]an|trgovin|market|supermarket|shop)/i.test(t)) return { key: 'shop', value: 'supermarket' };

  return null;
}

function formatNominatimContext({ query, results }) {
  const lines = [];
  lines.push(`Query: ${String(query || '').trim()}`);

  const list = Array.isArray(results) ? results : [];
  if (!list.length) {
    lines.push('No results.');
    return lines.join('\n');
  }

  for (let i = 0; i < Math.min(list.length, 5); i++) {
    const r = list[i];
    const name = r?.namedetails?.name || r?.display_name || '';
    const lat = _toNum(r?.lat);
    const lon = _toNum(r?.lon);
    const clazz = r?.class || '';
    const type = r?.type || '';
    lines.push(`\n#${i + 1} ${_asOneLine(name, 220)}`);
    if (clazz || type) lines.push(`Type: ${clazz}${type ? `/${type}` : ''}`);
    if (lat != null && lon != null) {
      lines.push(`Lat,Lon: ${lat}, ${lon}`);
      lines.push(`OSM Map: ${_osmMapUrl(lat, lon)}`);
    }
    if (r?.address) {
      const addr = Object.entries(r.address)
        .slice(0, 10)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      if (addr) lines.push(`Address: ${_asOneLine(addr, 320)}`);
    }
  }

  return lines.join('\n');
}

async function nominatimSearch({ query, limit = 5, languageHint, countrycodes } = {}) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Nedostaje query (mjesto/adresa)' };

  const lang = _pickLang(languageHint);
  const lim = Math.max(1, Math.min(Number(limit) || 5, 10));

  const cacheKey = `nominatim:search:${lang}:${countrycodes || ''}:${q.toLowerCase()}:${lim}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const emailRaw = String(OSM_CONTACT_EMAIL || '').trim();
  const looksFakeEmail = /example\.com$/i.test(emailRaw) || /\byou@/i.test(emailRaw);
  const email = looksFakeEmail ? '' : emailRaw;
  const bases = _splitBases(OSM_NOMINATIM_BASE, ['https://nominatim.openstreetmap.org'])
    .map(_normalizeNominatimBase)
    .filter(Boolean);

  console.log(`🗺️ [OSM] Nominatim search: "${q}"`);

  let json = null;
  let lastErr = null;

  for (const base of bases) {
    _validatePublicNominatimContact(base);
    const url = new URL(`${base}/search`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(lim));
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('namedetails', '1');
    if (countrycodes) url.searchParams.set('countrycodes', String(countrycodes));
    // Public Nominatim sometimes blocks requests that include placeholder emails.
    // We only send the email parameter when it's a real contact.
    // Public Nominatim may block requests when a placeholder email is sent.
    // Only include this param when it's a real contact email.
    if (email) url.searchParams.set('email', email);

    try {
      console.log(`🗺️ [OSM] Trying: ${base}`);
      json = await _throttleNominatim(() =>
        _fetchJsonWithRetry(
          url.toString(),
          { headers: _contactHeaders({ lang }) },
          { retries: 1, backoffMs: 1600 },
        ),
      );
      console.log(`✅ [OSM] Success: ${json?.length || 0} results`);
      lastErr = null;
      break;
    } catch (e) {
      console.error(`❌ [OSM] Error from ${base}:`, e.message);
      lastErr = e;
    }
  }

  if (lastErr) {
    const errorMsg = `OSM Nominatim error: ${String(lastErr?.message || lastErr)}`;
    console.error(`❌ [OSM] Final error: ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }

  const results = Array.isArray(json) ? json : [];
  const out = {
    ok: true,
    query: q,
    results,
    context: formatNominatimContext({ query: q, results }),
  };

  _cacheSet(cacheKey, out, 10 * 60 * 1000);
  return out;
}

async function nominatimReverse({ latitude, longitude, languageHint, zoom = 18 } = {}) {
  const lat = _toNum(latitude);
  const lon = _toNum(longitude);
  if (lat == null || lon == null) return { ok: false, error: 'Nedostaje lat/lon' };

  const lang = _pickLang(languageHint);
  const z = Math.max(3, Math.min(Number(zoom) || 18, 20));

  const cacheKey = `nominatim:reverse:${lang}:${lat.toFixed(5)}:${lon.toFixed(5)}:${z}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const email = String(OSM_CONTACT_EMAIL || '').trim();
  const bases = _splitBases(OSM_NOMINATIM_BASE, ['https://nominatim.openstreetmap.org'])
    .map(_normalizeNominatimBase)
    .filter(Boolean);

  let json = null;
  let lastErr = null;

  for (const base of bases) {
    _validatePublicNominatimContact(base);
    const url = new URL(`${base}/reverse`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('zoom', String(z));
    url.searchParams.set('addressdetails', '1');
    if (email) url.searchParams.set('email', email);

    try {
      json = await _throttleNominatim(() =>
        _fetchJsonWithRetry(
          url.toString(),
          { headers: _contactHeaders({ lang }) },
          { retries: 1, backoffMs: 1600 },
        ),
      );
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (lastErr) return { ok: false, error: String(lastErr?.message || lastErr) };

  const name = json?.name || json?.display_name || '';
  const context = [
    `Lat,Lon: ${lat}, ${lon}`,
    name ? `Place: ${_asOneLine(name, 260)}` : '',
    `OSM Map: ${_osmMapUrl(lat, lon)}`,
    json?.address
      ? `Address: ${_asOneLine(
          Object.entries(json.address)
            .slice(0, 10)
            .map(([k, v]) => `${k}=${v}`)
            .join(', '),
          320,
        )}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const out = { ok: true, latitude: lat, longitude: lon, result: json, context };
  _cacheSet(cacheKey, out, 10 * 60 * 1000);
  return out;
}

async function _overpassQuery(queryText, { timeoutMs = Number(OSM_TIMEOUT_MS || 9000) + 6000 } = {}) {
  const bases = _splitBases(OSM_OVERPASS_BASE, [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
  ])
    .map(_normalizeOverpassBase)
    .filter(Boolean);
  const body = new URLSearchParams({ data: String(queryText || '') }).toString();

  let lastErr = null;
  for (const base of bases) {
    try {
      return await _throttleOverpass(() =>
        _fetchJsonWithRetry(
          String(base).trim(),
          {
          method: 'POST',
          timeoutMs,
          headers: {
            ..._contactHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          },
          body,
          },
          { retries: 1, backoffMs: 1700 },
        ),
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Overpass: neuspjelo');
}

function formatOverpassContext({ center, filter, radius, items }) {
  const lines = [];
  const cName = center?.displayName ? _asOneLine(center.displayName, 220) : '';
  lines.push(`Center: ${cName || `${center?.lat}, ${center?.lon}`}`);
  lines.push(`Filter: ${filter?.key}=${filter?.value}`);
  lines.push(`Radius: ${radius}m`);

  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    lines.push('No results.');
    return lines.join('\n');
  }

  for (let i = 0; i < Math.min(list.length, 12); i++) {
    const it = list[i];
    lines.push(`\n#${i + 1} ${_asOneLine(it?.name || '(no name)', 200)}`);
    if (typeof it?.distanceM === 'number') lines.push(`Distance: ${Math.round(it.distanceM)}m`);
    if (it?.lat != null && it?.lon != null) {
      lines.push(`Lat,Lon: ${it.lat}, ${it.lon}`);
      lines.push(`OSM Map: ${_osmMapUrl(it.lat, it.lon)}`);
    }
    if (it?.tags) {
      const t = it.tags;
      const small = ['operator', 'phone', 'website', 'opening_hours', 'addr:street', 'addr:housenumber']
        .filter((k) => t[k])
        .map((k) => `${k}=${t[k]}`)
        .join(', ');
      if (small) lines.push(`Tags: ${_asOneLine(small, 320)}`);
    }
  }

  return lines.join('\n');
}

async function overpassNearby({
  place,
  latitude,
  longitude,
  radius = 2000,
  key,
  value,
  query,
  languageHint,
  limit = 12,
} = {}) {
  const lat = _toNum(latitude);
  const lon = _toNum(longitude);
  const qText = String(query || place || '').trim();

  let center = null;
  if (lat != null && lon != null) {
    center = { lat, lon, displayName: '' };
  } else {
    const geo = await nominatimSearch({ query: qText, limit: 1, languageHint });
    if (!geo?.ok || !Array.isArray(geo.results) || !geo.results.length) {
      return { ok: false, error: 'OSM: ne mogu geokodirati centar (mjesto/adresa)' };
    }
    const r0 = geo.results[0];
    const clat = _toNum(r0?.lat);
    const clon = _toNum(r0?.lon);
    if (clat == null || clon == null) return { ok: false, error: 'OSM: geokodiranje bez lat/lon' };
    center = { lat: clat, lon: clon, displayName: r0?.display_name || '' };
  }

  const guessed = !key || !value ? _guessFilter(qText) : null;
  const filt = {
    key: String(key || guessed?.key || 'amenity'),
    value: String(value || guessed?.value || 'pharmacy'),
  };

  const rad = Math.max(200, Math.min(Number(radius) || 2000, 20000));
  const lim = Math.max(1, Math.min(Number(limit) || 12, 25));

  const cacheKey = `overpass:nearby:${center.lat.toFixed(4)}:${center.lon.toFixed(4)}:${rad}:${filt.key}:${filt.value}:${lim}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const q = `
[out:json][timeout:25];
(
  node["${filt.key}"="${filt.value}"](around:${rad},${center.lat},${center.lon});
  way["${filt.key}"="${filt.value}"](around:${rad},${center.lat},${center.lon});
  relation["${filt.key}"="${filt.value}"](around:${rad},${center.lat},${center.lon});
);
out center;
`;

  let json;
  try {
    json = await _overpassQuery(q);
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }

  const els = Array.isArray(json?.elements) ? json.elements : [];
  const items = [];

  for (const el of els) {
    const tags = el?.tags || {};
    const name = tags?.name || tags?.brand || tags?.operator || '';
    const la = el?.type === 'node' ? _toNum(el?.lat) : _toNum(el?.center?.lat);
    const lo = el?.type === 'node' ? _toNum(el?.lon) : _toNum(el?.center?.lon);
    if (la == null || lo == null) continue;

    const d = _haversineMeters(center.lat, center.lon, la, lo);
    items.push({
      id: `${el.type}/${el.id}`,
      name: name || '(no name)',
      lat: la,
      lon: lo,
      distanceM: d,
      tags,
    });
  }

  items.sort((a, b) => (a.distanceM || 0) - (b.distanceM || 0));
  const sliced = items.slice(0, lim);

  const out = {
    ok: true,
    center,
    filter: filt,
    radius: rad,
    items: sliced,
    rawCount: items.length,
    context: formatOverpassContext({ center, filter: filt, radius: rad, items: sliced }),
  };

  _cacheSet(cacheKey, out, 8 * 60 * 1000);
  return out;
}

module.exports = {
  // Friendly aliases for SmartRouter tool names
  osmGeocode: nominatimSearch,
  osmNearby: overpassNearby,
  nominatimSearch,
  nominatimReverse,
  overpassNearby,
  formatNominatimContext,
  formatOverpassContext,
};
