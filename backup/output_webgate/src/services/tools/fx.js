'use strict';

// Frankfurter (free, no key) — https://frankfurter.dev/ (public API: api.frankfurter.dev/v1)

const BASE_URL = 'https://api.frankfurter.dev/v1';

// tiny in-memory cache to keep it snappy
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

function _normCcy(s) {
  return String(s || '').trim().toUpperCase();
}

async function convertCurrency({ amount = 1, from = 'EUR', to, symbols, date } = {}) {
  const a = Number(amount);
  if (!Number.isFinite(a)) throw new Error('Invalid amount');
  const base = _normCcy(from || 'EUR');

  const targets = Array.isArray(symbols)
    ? symbols.map(_normCcy).filter(Boolean)
    : String(to || '')
        .split(',')
        .map(_normCcy)
        .filter(Boolean);

  if (!targets.length) throw new Error('Missing target currency (to/symbols)');

  const cacheKey = `fx:${date || 'latest'}:${base}:${targets.join(',')}`;
  const cached = _cacheGet(cacheKey);
  if (cached) {
    return {
      ok: true,
      base: cached.base,
      date: cached.date,
      amount: a,
      rates: cached.rates,
      converted: Object.fromEntries(
        targets.map((ccy) => [ccy, Number((a * (cached.rates?.[ccy] ?? NaN)).toFixed(4))])
      ),
      context: formatFxContext({ amount: a, base: cached.base, date: cached.date, rates: cached.rates }),
    };
  }

  const path = date ? `/${encodeURIComponent(date)}` : '/latest';
  const url = new URL(BASE_URL + path);
  url.searchParams.set('base', base);
  url.searchParams.set('symbols', targets.join(','));

  const resp = await fetch(url.toString(), {
    headers: { 'user-agent': 'gptnix-backend' },
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Frankfurter ${resp.status}: ${txt}`);
  }

  const json = await resp.json();
  const rates = json?.rates || {};
  const out = {
    base: json.base || base,
    date: json.date || date || 'latest',
    rates,
  };

  _cacheSet(cacheKey, out, 10 * 60 * 1000); // 10 min (rates are daily)

  const converted = Object.fromEntries(
    targets.map((ccy) => [ccy, Number((a * (rates?.[ccy] ?? NaN)).toFixed(4))])
  );

  return {
    ok: true,
    base: out.base,
    date: out.date,
    amount: a,
    rates,
    converted,
    context: formatFxContext({ amount: a, base: out.base, date: out.date, rates }),
  };
}

function formatFxContext({ amount, base, date, rates } = {}) {
  const lines = [];
  lines.push(`Datum tečaja: ${date}`);
  lines.push(`Bazna valuta: ${base}`);
  if (Number.isFinite(amount)) lines.push(`Iznos: ${amount}`);
  lines.push('Tečajevi (1 ' + base + ' = ...):');
  const keys = Object.keys(rates || {}).sort();
  for (const k of keys) {
    lines.push(`- ${k}: ${rates[k]}`);
  }
  return lines.join('\n');
}

module.exports = {
  convertCurrency,
  formatFxContext,
};
