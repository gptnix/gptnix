'use strict';

// Public holidays (Nager.Date) — free, no key
// Docs / base: https://date.nager.at

const BASE_URL = 'https://date.nager.at/api/v3';

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

function _normCode(s) {
  return String(s || '').trim().toUpperCase();
}

function _inferCountryCode(text) {
  const t = String(text || '').toLowerCase();
  const map = [
    { re: /(bosn|bih|hercegov)/i, code: 'BA' },
    { re: /(hrvatsk|croatia)/i, code: 'HR' },
    { re: /(srbija|serbia)/i, code: 'RS' },
    { re: /(crna\s*gora|montenegro)/i, code: 'ME' },
    { re: /(slovenij|slovenia)/i, code: 'SI' },
    { re: /(austrij|austria)/i, code: 'AT' },
    { re: /(njemac|germany|deutschland)/i, code: 'DE' },
    { re: /(italij|italy)/i, code: 'IT' },
    { re: /(franc|france)/i, code: 'FR' },
    { re: /(spain|španj|spanj)/i, code: 'ES' },
    { re: /(usa|united\s*states|amerika)/i, code: 'US' },
    { re: /(uk|united\s*kingdom|britan)/i, code: 'GB' },
  ];
  for (const m of map) {
    if (m.re.test(t)) return m.code;
  }
  return '';
}

async function _fetchJson(path) {
  const url = BASE_URL + path;
  const resp = await fetch(url, { headers: { 'user-agent': 'gptnix-backend' } });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Nager ${resp.status}: ${txt}`);
  }
  return resp.json();
}

async function getPublicHolidays({ countryCode, year, hintText } = {}) {
  let cc = _normCode(countryCode);
  if (!cc) cc = _inferCountryCode(hintText);
  if (!cc) return { ok: false, error: 'Nedostaje countryCode (npr. BA, HR, DE)' };

  const y = Number(year || new Date().getFullYear());
  if (!Number.isFinite(y) || y < 1900 || y > 2100) {
    return { ok: false, error: 'Neispravna godina' };
  }

  const cacheKey = `holidays:${cc}:${y}`;
  const cached = _cacheGet(cacheKey);
  if (cached) {
    return { ok: true, countryCode: cc, year: y, holidays: cached, context: formatHolidaysContext(cc, y, cached) };
  }

  const json = await _fetchJson(`/PublicHolidays/${y}/${cc}`);
  const holidays = Array.isArray(json) ? json : [];
  _cacheSet(cacheKey, holidays, 12 * 60 * 60 * 1000); // 12h

  return { ok: true, countryCode: cc, year: y, holidays, context: formatHolidaysContext(cc, y, holidays) };
}

async function getNextPublicHolidays({ countryCode, hintText } = {}) {
  let cc = _normCode(countryCode);
  if (!cc) cc = _inferCountryCode(hintText);
  if (!cc) return { ok: false, error: 'Nedostaje countryCode (npr. BA, HR, DE)' };

  const cacheKey = `holidays:next:${cc}`;
  const cached = _cacheGet(cacheKey);
  if (cached) {
    return { ok: true, countryCode: cc, next: cached, context: formatNextHolidaysContext(cc, cached) };
  }

  const json = await _fetchJson(`/NextPublicHolidays/${cc}`);
  const next = Array.isArray(json) ? json : [];
  _cacheSet(cacheKey, next, 60 * 60 * 1000); // 1h

  return { ok: true, countryCode: cc, next, context: formatNextHolidaysContext(cc, next) };
}

function formatHolidaysContext(countryCode, year, holidays) {
  const list = Array.isArray(holidays) ? holidays : [];
  const lines = [];
  lines.push(`Država: ${countryCode}`);
  lines.push(`Godina: ${year}`);
  if (!list.length) {
    lines.push('Nema podataka za praznike.');
    return lines.join('\n');
  }

  lines.push('Praznici:');
  // keep it compact; include first 25 then cut
  list.slice(0, 25).forEach((h) => {
    const date = h?.date || '';
    const localName = h?.localName || '';
    const name = h?.name || '';
    const types = Array.isArray(h?.types) ? h.types.join(', ') : '';
    const flag = h?.global === true ? ' (global)' : '';
    const t = types ? ` [${types}]` : '';
    lines.push(`- ${date}: ${localName || name}${flag}${t}`);
  });

  if (list.length > 25) lines.push(`... (+${list.length - 25} još)`);
  return lines.join('\n');
}

function formatNextHolidaysContext(countryCode, next) {
  const list = Array.isArray(next) ? next : [];
  const lines = [];
  lines.push(`Država: ${countryCode}`);
  if (!list.length) {
    lines.push('Nema podataka za sljedeće praznike.');
    return lines.join('\n');
  }
  lines.push('Sljedeći praznici:');
  list.slice(0, 10).forEach((h) => {
    const date = h?.date || '';
    const localName = h?.localName || '';
    const name = h?.name || '';
    lines.push(`- ${date}: ${localName || name}`);
  });
  if (list.length > 10) lines.push(`... (+${list.length - 10} još)`);
  return lines.join('\n');
}

module.exports = {
  getPublicHolidays,
  getNextPublicHolidays,
  formatHolidaysContext,
  formatNextHolidaysContext,
};
