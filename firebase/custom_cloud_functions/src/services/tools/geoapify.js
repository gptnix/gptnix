'use strict';

const { GEOAPIFY_API_KEY, GEOAPIFY_API_BASE } = require('../../config/env');
const { nominatimSearch, nominatimReverse } = require('./osm');

function _base() {
  const base = (GEOAPIFY_API_BASE || 'https://api.geoapify.com').replace(/\/$/, '');
  return base;
}

function _withApiKey(params) {
  const p = new URLSearchParams(params || {});
  if (GEOAPIFY_API_KEY) p.set('apiKey', GEOAPIFY_API_KEY);
  return p;
}

async function _getJson(url, { timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      const err = new Error(`Geoapify error ${res.status}: ${text || res.statusText}`);
      err.statusCode = res.status;
      err.body = text;
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch (_) {
      return { raw: text };
    }
  } finally {
    clearTimeout(timer);
  }
}

async function geoapifyGeocode({ text, limit = 10, lang = 'en', filter, bias, format = 'json' } = {}) {
  if (!text || !String(text).trim()) throw new Error('Missing text');
  if (!GEOAPIFY_API_KEY) {
    // Fallback to OSM Nominatim (no key required)
    return nominatimSearch({ q: String(text), limit: Number(limit) || 10, acceptLanguage: lang });
  }

  const params = _withApiKey({ text: String(text), limit: String(limit), lang: String(lang || 'en'), format: String(format) });
  if (filter) params.set('filter', String(filter));
  if (bias) params.set('bias', String(bias));

  const url = `${_base()}/v1/geocode/search?${params.toString()}`;
  return _getJson(url);
}

async function geoapifyReverse({ lat, lon, lang = 'en', limit = 1, format = 'json' } = {}) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) throw new Error('Invalid lat/lon');

  if (!GEOAPIFY_API_KEY) {
    // Fallback to OSM Nominatim (no key required)
    return nominatimReverse({ lat: la, lon: lo, acceptLanguage: lang });
  }

  const params = _withApiKey({ lat: String(la), lon: String(lo), lang: String(lang || 'en'), limit: String(limit), format: String(format) });
  const url = `${_base()}/v1/geocode/reverse?${params.toString()}`;
  return _getJson(url);
}

async function geoapifyAutocomplete({ text, limit = 10, lang = 'en', filter, bias, format = 'json' } = {}) {
  if (!text || !String(text).trim()) throw new Error('Missing text');
  if (!GEOAPIFY_API_KEY) {
    // Best-effort fallback: Nominatim search behaves like autocomplete for many cases
    return nominatimSearch({ q: String(text), limit: Number(limit) || 10, acceptLanguage: lang });
  }

  const params = _withApiKey({ text: String(text), limit: String(limit), lang: String(lang || 'en'), format: String(format) });
  if (filter) params.set('filter', String(filter));
  if (bias) params.set('bias', String(bias));

  const url = `${_base()}/v1/geocode/autocomplete?${params.toString()}`;
  return _getJson(url);
}

async function geoapifyPlaces({ categories, filter, bias, limit = 20, lang = 'en' } = {}) {
  if (!GEOAPIFY_API_KEY) {
    const err = new Error('Geoapify API key missing (places)');
    err.statusCode = 500;
    throw err;
  }
  const params = _withApiKey({ categories: String(categories || ''), limit: String(limit), lang: String(lang || 'en') });
  if (filter) params.set('filter', String(filter));
  if (bias) params.set('bias', String(bias));
  const url = `${_base()}/v2/places?${params.toString()}`;
  return _getJson(url);
}

async function geoapifyRoute({ waypoints, mode = 'drive', lang = 'en' } = {}) {
  if (!GEOAPIFY_API_KEY) {
    const err = new Error('Geoapify API key missing (routing)');
    err.statusCode = 500;
    throw err;
  }
  if (!waypoints || !String(waypoints).includes('|')) {
    throw new Error('Missing waypoints. Expected "lat,lon|lat,lon|..."');
  }
  const params = _withApiKey({ waypoints: String(waypoints), mode: String(mode || 'drive'), lang: String(lang || 'en') });
  const url = `${_base()}/v1/routing?${params.toString()}`;
  return _getJson(url);
}

module.exports = {
  geoapifyGeocode,
  geoapifyReverse,
  geoapifyAutocomplete,
  geoapifyPlaces,
  geoapifyRoute,
};
