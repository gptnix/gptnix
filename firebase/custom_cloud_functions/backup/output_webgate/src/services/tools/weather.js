'use strict';

/**
 * Weather tool — multi-provider with safe fallbacks.
 * Providers:
 *  - OpenWeather (optional, requires OPENWEATHER_API_KEY)
 *  - MET Norway (yr.no) Locationforecast (free, but strict User-Agent policy)
 *  - Open-Meteo (free fallback)
 */

const {
  OPENWEATHER_API_KEY,
  OPENWEATHER_API_BASE,
  OPENWEATHER_TIMEOUT_MS,
  METNO_USER_AGENT,
  METNO_LOCATIONFORECAST_BASE,
  METNO_TIMEOUT_MS,
  OSM_USER_AGENT,
} = require('../../config/env');

// Reuse hardened Nominatim client (throttle + proper UA + caching)
const { nominatimSearch } = require('./osm');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createThrottler(minIntervalMs) {
  let lastAt = 0;
  let chain = Promise.resolve();
  return (fn) => {
    const p = chain.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, minIntervalMs - (now - lastAt));
      if (waitMs) await sleep(waitMs);
      lastAt = Date.now();
      return fn();
    });
    // keep chain alive even if fn throws
    chain = p.catch(() => {});
    return p;
  };
}

// MET.no is strict; keep it conservative (≈1 req/sec per instance)
const throttleMetNo = createThrottler(1100);

function withTimeoutFetch(url, { timeoutMs, headers } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs || 9000);
  return fetch(url, { headers, signal: controller.signal }).finally(() => clearTimeout(t));
}

async function fetchJson(url, { timeoutMs, headers } = {}) {
  const res = await withTimeoutFetch(url, { timeoutMs, headers });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = null;
  }
  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || text || res.statusText;
    const err = new Error(String(msg || `HTTP ${res.status}`));
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return json;
}

function pickLang(languageHint) {
  const raw = String(languageHint || 'en').trim().toLowerCase();
  const lang = raw.split(/[-_]/)[0] || 'en';
  // OpenWeather supports many languages; keep it explicit but flexible.
  const allow = new Set([
    'en', 'hr', 'de', 'fr', 'it', 'es', 'pt', 'nl', 'pl', 'cs', 'sk', 'sl', 'hu', 'ro', 'bg', 'el', 'tr',
    'ru', 'uk',
    'sv', 'no', 'da', 'fi',
    'ar', 'he', 'fa',
    'zh', 'ja', 'ko',
  ]);
  return allow.has(lang) ? lang : 'en';
}

function cleanPlaceQuery(place) {
  const raw = String(place || '').trim();
  if (!raw) return raw;

  // Remove common "weather/forecast" prefixes in multiple languages.
  let s = raw;

  // Examples: "vrijeme Tomislavgrad", "weather London", "الطقس دبي"
  s = s.replace(
    /^(?:weather|forecast|temperature|temp|meteo|clima|tiempo|wetter|tempo|vrijeme|vremenska\s+prognoza|prognoza|temps|météo|الطقس|طقس)\b[\s:\-–—]+/i,
    '',
  );

  // Remove leading prepositions left after stripping, e.g. "u Zagreb", "in Paris"
  s = s.replace(/^(?:u|u\s+gradu|in|at|na|za)\b\s+/i, '');

  // If we stripped everything by accident, fall back.
  s = s.trim();
  return s || raw;
}


function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeProviderResult(res) {
  if (!res || typeof res !== 'object') return res;
  const provider = res.provider || res.providerUsed || res.provider_used || null;

  // Try to extract a representative "current temp" for logging + snippets.
  const tempC =
    (res.current && (res.current.temperatureC ?? res.current.temperature_c ?? res.current.tempC ?? res.current.temp)) ??
    res.temperature_celsius ??
    res.temperatureC ??
    res.tempC ??
    null;

  return {
    ...res,
    provider,
    temperature_celsius: Number.isFinite(Number(tempC)) ? Number(tempC) : (res.temperature_celsius ?? null),
  };
}


function buildUserAgent(primary) {
  const base = String(primary || '').trim() || String(OSM_USER_AGENT || '').trim();
  const ua = base || 'GPTNiX/1.0';
  // MET.no + Nominatim both want a *unique* UA and recommend contact info.
  // If user didn't provide anything useful, attach a .invalid contact.
  if (ua.includes('@') || ua.includes('http')) return ua;
  return `${ua} (+https://gptnix.invalid; contact: admin@gptnix.invalid)`;
}

function formatPlace(place, lat, lon) {
  const p = String(place || '').trim();
  const coords = `(${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  return p ? `${p} ${coords}` : coords;
}

// ─────────────────────────────────────────────────────────────
// Geocoding (Open-Meteo)
// ─────────────────────────────────────────────────────────────

const geoCache = new Map(); // key -> {ts, value}
const wxCache = new Map(); // key -> {ts, value}

function cacheGet(map, key, ttlMs) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ttlMs) return null;
  return hit.value;
}

function cacheSet(map, key, value) {
  map.set(key, { ts: Date.now(), value });
}

function parseLatLonFromText(text) {
  const s = String(text || '');
  // Examples: "43.92, 17.24" or "lat=43.92 lon=17.24" or "43.92 17.24"
  const m = s.match(/(-?\d{1,3}(?:\.\d+)?)\s*(?:,|\s)\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = toNum(m[1]);
  const lon = toNum(m[2]);
  if (lat === null || lon === null) return null;
  // rough bounds
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function normalizePlaceText(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.replace(/[?!.]+$/g, '').trim();

  // If user message is something like: "vrijeme Tomislavgrad" or "Weather in Split"
  // try to isolate the location part.
  const reAfter = /\b(?:vrijeme|vreme|prognoza|vremenska\s+prognoza|temperature|temperatura|weather|forecast)\b\s*(?:u|za|na|in|at)?\s*(.+)$/i;
  const reBefore = /^(.+?)\s*\b(?:vrijeme|vreme|prognoza|weather|forecast)\b/i;
  let m = s.match(reAfter);
  if (m && m[1]) s = String(m[1]).trim();
  else {
    m = s.match(reBefore);
    if (m && m[1]) s = String(m[1]).trim();
  }

  // Remove common time qualifiers at the end
  s = s
    .replace(
      /\b(danas|sutra|preksutra|ve[čc]eras|jutros|ovaj\s+tjedan|sljede[ćc]i\s+tjedan|vikend|today|tomorrow|tonight|this\s+week|next\s+week|weekend)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  // Remove leading prepositions
  s = s.replace(/^(u|za|na|in|at)\s+/i, '').trim();
  // Trim punctuation
  s = s.replace(/^[,;:\-–—]+|[,;:\-–—]+$/g, '').trim();

  return s;
}

async function geocodeOpenMeteo(q, languageHint) {
  const lang = pickLang(languageHint);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q,
  )}&count=1&language=${encodeURIComponent(lang)}&format=json`;
  const data = await fetchJson(url, { timeoutMs: 7000 });
  const r = data?.results?.[0];
  if (!r) return null;
  return {
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    provider: 'open-meteo-geocoding',
  };
}

async function geocodeOpenWeather(q, languageHint) {
  if (!OPENWEATHER_API_KEY) return null;
  const lang = owLang(languageHint);
  const base = String(OPENWEATHER_API_BASE || 'https://api.openweathermap.org').replace(/\/$/, '');
  const url = `${base}/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${encodeURIComponent(
    OPENWEATHER_API_KEY,
  )}&lang=${encodeURIComponent(lang)}`;
  const data = await fetchJson(url, { timeoutMs: OPENWEATHER_TIMEOUT_MS });
  const r = Array.isArray(data) ? data[0] : null;
  if (!r) return null;
  return {
    name: r.name,
    country: r.country,
    admin1: r.state,
    latitude: r.lat,
    longitude: r.lon,
    timezone: null,
    provider: 'openweather-geo',
  };
}

async function geocodeNominatim(q, languageHint) {
  const uaOk = String(OSM_USER_AGENT || '').trim();
  if (!uaOk) {
    // still try; osm.js will add a fallback UA
  }
  const res = await nominatimSearch({ query: q, limit: 1, languageHint });
  const r = res?.ok && Array.isArray(res.results) ? res.results[0] : null;
  if (!r) return null;
  const lat = toNum(r.lat);
  const lon = toNum(r.lon);
  return {
    name: r?.namedetails?.name || r?.display_name || q,
    country: r?.address?.country_code ? String(r.address.country_code).toUpperCase() : (r?.address?.country || null),
    admin1: r?.address?.state || r?.address?.county || r?.address?.region || null,
    latitude: lat,
    longitude: lon,
    timezone: null,
    provider: 'osm-nominatim',
  };
}

async function geocodePlace(place, languageHint) {
  const raw = String(place || '').trim();
  if (!raw) return null;

  const q = normalizePlaceText(raw) || raw;
  const lang = pickLang(languageHint);
  const key = `geo:${lang}:${q.toLowerCase()}`;
  const cached = cacheGet(geoCache, key, 6 * 60 * 60 * 1000);
  if (cached) return cached;

  // 0) Direct coordinates in text
  const coords = parseLatLonFromText(q);
  if (coords) {
    const out = {
      name: q,
      country: null,
      admin1: null,
      latitude: coords.lat,
      longitude: coords.lon,
      timezone: null,
      provider: 'inline-coords',
    };
    cacheSet(geoCache, key, out);
    return out;
  }

  // 1) Open-Meteo geocoding (fast, free)
  let out = null;
  try {
    out = await geocodeOpenMeteo(q, languageHint);
  } catch {
    out = null;
  }
  if (!out && lang !== 'hr') {
    // If client accidentally sends languageHint=en but query is local, a second try with hr can help.
    try {
      out = await geocodeOpenMeteo(q, 'hr');
    } catch {
      out = null;
    }
  }

  // 2) OpenWeather direct geocode (if key present)
  if (!out) {
    try {
      out = await geocodeOpenWeather(q, languageHint);
    } catch {
      out = null;
    }
  }

  // 3) OSM Nominatim (best coverage for small places)
  if (!out) {
    try {
      out = await geocodeNominatim(q, languageHint);
    } catch {
      out = null;
    }
  }

  // 4) Small hint for Balkan queries (only if still not found)
  if (!out && !q.includes(',')) {
    const hinted = `${q}, Bosnia and Herzegovina`;
    try {
      out = await geocodeNominatim(hinted, languageHint);
    } catch {
      out = null;
    }
  }

  if (!out) return null;
  cacheSet(geoCache, key, out);
  return out;
}

// ─────────────────────────────────────────────────────────────
// Provider: Open-Meteo (fallback)
// ─────────────────────────────────────────────────────────────

async function fetchOpenMeteo(lat, lon, languageHint) {
  const lang = pickLang(languageHint);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
    lat,
  )}&longitude=${encodeURIComponent(
    lon,
  )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`;

  const data = await fetchJson(url, { timeoutMs: 9000 });

  const current = data?.current || {};
  const daily = data?.daily || {};
  const placeLine = formatPlace(null, lat, lon);

  const phrases = {
    hr: {
      title: `Vrijeme za ${placeLine}`,
      now: 'Trenutno',
      temp: 'Temperatura',
      feels: 'Osjećaj',
      humidity: 'Vlaga',
      wind: 'Vjetar',
      precip: 'Oborine',
      nextDays: 'Sljedeći dani',
    },
    en: {
      title: `Weather for ${placeLine}`,
      now: 'Now',
      temp: 'Temperature',
      feels: 'Feels like',
      humidity: 'Humidity',
      wind: 'Wind',
      precip: 'Precipitation',
      nextDays: 'Next days',
    },
  };
  const phr = phrases[lang] || phrases.en;

  const fmt = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);
  const lineNow = `${phr.now}: ${phr.temp} ${fmt(current.temperature_2m, '°C')}, ${phr.feels} ${fmt(
    current.apparent_temperature,
    '°C',
  )}, ${phr.humidity} ${fmt(current.relative_humidity_2m, '%')}, ${phr.wind} ${fmt(
    current.wind_speed_10m,
    ' km/h',
  )}, ${phr.precip} ${fmt(current.precipitation, ' mm')}`;

  const rows = [];
  const dates = Array.isArray(daily.time) ? daily.time : [];
  for (let i = 0; i < Math.min(dates.length, 7); i++) {
    rows.push(
      `${dates[i]}: ${fmt(daily.temperature_2m_min?.[i], '°C')}…${fmt(daily.temperature_2m_max?.[i], '°C')}, ` +
        `${phr.precip} ${fmt(daily.precipitation_sum?.[i], ' mm')}, ${phr.wind} ${fmt(
          daily.wind_speed_10m_max?.[i],
          ' km/h',
        )}`,
    );
  }

  const context = `${phr.title}\n${lineNow}${rows.length ? `\n${phr.nextDays}:\n- ${rows.join('\n- ')}` : ''}`;

  return {
    ok: true,
    providerUsed: 'open-meteo',
    latitude: lat,
    longitude: lon,
    current: {
      temperatureC: current.temperature_2m,
      apparentTemperatureC: current.apparent_temperature,
      humidityPercent: current.relative_humidity_2m,
      windSpeedKmh: current.wind_speed_10m,
      precipitationMm: current.precipitation,
    },
    daily: {
      dates: dates.slice(0, 7),
      temperatureMax: (daily.temperature_2m_max || []).slice(0, 7),
      temperatureMin: (daily.temperature_2m_min || []).slice(0, 7),
      precipitationSum: (daily.precipitation_sum || []).slice(0, 7),
      windSpeedMax: (daily.wind_speed_10m_max || []).slice(0, 7),
    },
    raw: null,
    context,
  };
}

// ─────────────────────────────────────────────────────────────
// Provider: OpenWeather
// ─────────────────────────────────────────────────────────────

function owLang(languageHint) {
  // OpenWeather supports many langs; keep it simple.
  const l = pickLang(languageHint);
  if (l === 'hr') return 'hr';
  return l;
}

async function fetchOpenWeatherOneCall(lat, lon, languageHint) {
  if (!OPENWEATHER_API_KEY) {
    return { ok: false, error: 'OPENWEATHER_API_KEY nije postavljen.' };
  }
  const lang = owLang(languageHint);
  const url = `${OPENWEATHER_API_BASE}/data/3.0/onecall?lat=${encodeURIComponent(
    lat,
  )}&lon=${encodeURIComponent(lon)}&units=metric&lang=${encodeURIComponent(lang)}&appid=${encodeURIComponent(
    OPENWEATHER_API_KEY,
  )}`;

  const data = await fetchJson(url, { timeoutMs: OPENWEATHER_TIMEOUT_MS });
  if (!data?.current) {
    return { ok: false, error: 'OpenWeather: neočekivan odgovor.' };
  }

  const current = data.current;
  const daily = Array.isArray(data.daily) ? data.daily : [];
  const dates = daily.map((d) => new Date((d.dt || 0) * 1000).toISOString().slice(0, 10));
  const tMax = daily.map((d) => d?.temp?.max ?? null);
  const tMin = daily.map((d) => d?.temp?.min ?? null);
  const precip = daily.map((d) => {
    const p = (d?.rain ?? 0) + (d?.snow ?? 0);
    return Number.isFinite(p) ? p : null;
  });
  const windMax = daily.map((d) => d?.wind_speed ?? null);

  const desc = current?.weather?.[0]?.description || current?.weather?.[0]?.main || '';
  const placeLine = formatPlace(null, lat, lon);

  const phrases = {
    hr: {
      title: `Vrijeme (OpenWeather) za ${placeLine}`,
      now: 'Trenutno',
      temp: 'Temperatura',
      feels: 'Osjećaj',
      humidity: 'Vlaga',
      wind: 'Vjetar',
      precip: 'Oborine',
      nextDays: 'Sljedeći dani',
      desc: 'Opis',
    },
    en: {
      title: `Weather (OpenWeather) for ${placeLine}`,
      now: 'Now',
      temp: 'Temperature',
      feels: 'Feels like',
      humidity: 'Humidity',
      wind: 'Wind',
      precip: 'Precipitation',
      nextDays: 'Next days',
      desc: 'Description',
    },
  };
  const phr = phrases[pickLang(languageHint)] || phrases.en;
  const fmt = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

  const lineNow = `${phr.now}: ${phr.temp} ${fmt(current.temp, '°C')}, ${phr.feels} ${fmt(
    current.feels_like,
    '°C',
  )}, ${phr.humidity} ${fmt(current.humidity, '%')}, ${phr.wind} ${fmt(current.wind_speed, ' m/s')}, ${
    phr.precip
  } ${fmt((current.rain && current.rain['1h']) || 0, ' mm/h')}${desc ? `, ${phr.desc}: ${desc}` : ''}`;

  const rows = [];
  for (let i = 0; i < Math.min(dates.length, 7); i++) {
    rows.push(
      `${dates[i]}: ${fmt(tMin[i], '°C')}…${fmt(tMax[i], '°C')}, ${phr.precip} ${fmt(precip[i], ' mm')}, ${
        phr.wind
      } ${fmt(windMax[i], ' m/s')}`,
    );
  }

  const context = `${phr.title}\n${lineNow}${rows.length ? `\n${phr.nextDays}:\n- ${rows.join('\n- ')}` : ''}`;

  return {
    ok: true,
    providerUsed: 'openweather-onecall',
    latitude: lat,
    longitude: lon,
    current: {
      temperatureC: current.temp,
      apparentTemperatureC: current.feels_like,
      humidityPercent: current.humidity,
      windSpeedMs: current.wind_speed,
      description: desc,
    },
    daily: {
      dates: dates.slice(0, 7),
      temperatureMax: tMax.slice(0, 7),
      temperatureMin: tMin.slice(0, 7),
      precipitationSum: precip.slice(0, 7),
      windSpeedMax: windMax.slice(0, 7),
    },
    raw: null,
    context,
  };
}

async function fetchOpenWeatherForecast5(lat, lon, languageHint) {
  if (!OPENWEATHER_API_KEY) {
    return { ok: false, error: 'OPENWEATHER_API_KEY nije postavljen.' };
  }
  const lang = owLang(languageHint);
  const base = OPENWEATHER_API_BASE;
  const currentUrl = `${base}/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(
    lon,
  )}&units=metric&lang=${encodeURIComponent(lang)}&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}`;
  const forecastUrl = `${base}/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(
    lon,
  )}&units=metric&lang=${encodeURIComponent(lang)}&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}`;

  try {
    const [cur, fc] = await Promise.all([
      fetchJson(currentUrl, { timeoutMs: OPENWEATHER_TIMEOUT_MS }).catch(e => {
        console.warn('⚠️ [OPENWEATHER] Current weather failed:', e?.message || e);
        return null;
      }),
      fetchJson(forecastUrl, { timeoutMs: OPENWEATHER_TIMEOUT_MS }).catch(e => {
        console.warn('⚠️ [OPENWEATHER] Forecast failed:', e?.message || e);
        return null;
      }),
    ]);
    
    if (!cur) {
      return { ok: false, error: 'OpenWeather current weather API failed' };
    }

  const list = Array.isArray(fc?.list) ? fc.list : [];
  const byDate = new Map();
  for (const item of list) {
    const dtTxt = item?.dt_txt;
    const date = dtTxt ? String(dtTxt).slice(0, 10) : new Date((item?.dt || 0) * 1000).toISOString().slice(0, 10);
    if (!byDate.has(date)) {
      byDate.set(date, { min: null, max: null, precip: 0, windMax: null });
    }
    const agg = byDate.get(date);
    const t = item?.main?.temp;
    if (Number.isFinite(t)) {
      agg.min = agg.min === null ? t : Math.min(agg.min, t);
      agg.max = agg.max === null ? t : Math.max(agg.max, t);
    }
    const rain = (item?.rain && (item.rain['3h'] || 0)) || 0;
    const snow = (item?.snow && (item.snow['3h'] || 0)) || 0;
    const p = Number(rain) + Number(snow);
    if (Number.isFinite(p)) agg.precip += p;
    const w = item?.wind?.speed;
    if (Number.isFinite(w)) agg.windMax = agg.windMax === null ? w : Math.max(agg.windMax, w);
  }

  const dates = Array.from(byDate.keys()).slice(0, 5);
  const tMin = dates.map((d) => byDate.get(d)?.min ?? null);
  const tMax = dates.map((d) => byDate.get(d)?.max ?? null);
  const precip = dates.map((d) => byDate.get(d)?.precip ?? null);
  const windMax = dates.map((d) => byDate.get(d)?.windMax ?? null);

  const desc = cur?.weather?.[0]?.description || cur?.weather?.[0]?.main || '';
  const placeLine = formatPlace(null, lat, lon);
  const phr = (pickLang(languageHint) === 'hr')
    ? {
        title: `Vrijeme (OpenWeather 5d) za ${placeLine}`,
        now: 'Trenutno',
        temp: 'Temperatura',
        feels: 'Osjećaj',
        humidity: 'Vlaga',
        wind: 'Vjetar',
        precip: 'Oborine',
        nextDays: 'Sljedeći dani',
        desc: 'Opis',
      }
    : {
        title: `Weather (OpenWeather 5d) for ${placeLine}`,
        now: 'Now',
        temp: 'Temperature',
        feels: 'Feels like',
        humidity: 'Humidity',
        wind: 'Wind',
        precip: 'Precipitation',
        nextDays: 'Next days',
        desc: 'Description',
      };
  const fmt = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

  const lineNow = `${phr.now}: ${phr.temp} ${fmt(cur?.main?.temp, '°C')}, ${phr.feels} ${fmt(
    cur?.main?.feels_like,
    '°C',
  )}, ${phr.humidity} ${fmt(cur?.main?.humidity, '%')}, ${phr.wind} ${fmt(cur?.wind?.speed, ' m/s')}${
    desc ? `, ${phr.desc}: ${desc}` : ''
  }`;

  const rows = [];
  for (let i = 0; i < dates.length; i++) {
    rows.push(
      `${dates[i]}: ${fmt(tMin[i], '°C')}…${fmt(tMax[i], '°C')}, ${phr.precip} ${fmt(precip[i], ' mm')}, ${
        phr.wind
      } ${fmt(windMax[i], ' m/s')}`,
    );
  }

  const context = `${phr.title}\n${lineNow}${rows.length ? `\n${phr.nextDays}:\n- ${rows.join('\n- ')}` : ''}`;

  return {
    ok: true,
    providerUsed: 'openweather-forecast5',
    latitude: lat,
    longitude: lon,
    current: {
      temperatureC: cur?.main?.temp,
      apparentTemperatureC: cur?.main?.feels_like,
      humidityPercent: cur?.main?.humidity,
      windSpeedMs: cur?.wind?.speed,
      description: desc,
    },
    daily: {
      dates,
      temperatureMax: tMax,
      temperatureMin: tMin,
      precipitationSum: precip,
      windSpeedMax: windMax,
    },
    raw: null,
    context,
  };
  } catch (err) {
    console.error('⚠️ [OPENWEATHER] fetchOpenWeatherForecast5 error:', err?.message || err);
    return { 
      ok: false, 
      error: `OpenWeather API error: ${err?.message || String(err)}` 
    };
  }
}

async function fetchOpenWeather(lat, lon, languageHint) {
  // Try One Call 3.0 first (if subscribed), otherwise fall back to free 5-day/3-hour.
  try {
    return await fetchOpenWeatherOneCall(lat, lon, languageHint);
  } catch (e) {
    // OneCall is often 401/404 if not subscribed.
    try {
      return await fetchOpenWeatherForecast5(lat, lon, languageHint);
    } catch (e2) {
      return { ok: false, error: `OpenWeather: ${e2.message || e.message}` };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Provider: MET Norway (yr.no) Locationforecast
// ─────────────────────────────────────────────────────────────

function symbolToHr(symbol) {
  const s = String(symbol || '').toLowerCase();
  if (!s) return '';
  const base = s
    .replace(/_(day|night|polarday)$/i, '')
    .replace(/_/g, ' ')
    .trim();
  // small, pragmatic mapping
  const map = {
    clearsky: 'vedro',
    fair: 'pretežno vedro',
    partlycloudy: 'djelomično oblačno',
    cloudy: 'oblačno',
    fog: 'magla',
    lightrain: 'slaba kiša',
    rain: 'kiša',
    heavyrain: 'jaka kiša',
    lightsleet: 'slaba susnježica',
    sleet: 'susnježica',
    heavysleet: 'jaka susnježica',
    lightsnow: 'slab snijeg',
    snow: 'snijeg',
    heavysnow: 'jak snijeg',
    rainshowers: 'pljuskovi',
    snowshowers: 'snježni pljuskovi',
    sleetshowers: 'pljuskovi susnježice',
    thunderstorm: 'grmljavina',
  };
  // find first token that matches
  const key = base.split(' ').join('');
  return map[key] || base;
}

async function fetchMetNo(lat, lon, languageHint) {
  const ua = buildUserAgent(METNO_USER_AGENT);
  const url = `${METNO_LOCATIONFORECAST_BASE}/compact?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const data = await throttleMetNo(() =>
    fetchJson(url, {
      timeoutMs: METNO_TIMEOUT_MS,
      headers: {
        'User-Agent': ua,
        Accept: 'application/json',
      },
    }),
  );

  const ts = data?.properties?.timeseries;
  if (!Array.isArray(ts) || !ts.length) {
    return { ok: false, error: 'MET.no: nema timeseries podataka.' };
  }

  const first = ts[0];
  const d0 = first?.data || {};
  const instant = d0?.instant?.details || {};
  const next1 = d0?.next_1_hours || {};
  const next1Details = next1?.details || {};
  const next1Summary = next1?.summary || {};

  const curTemp = instant?.air_temperature;
  const curHum = instant?.relative_humidity;
  const curWind = instant?.wind_speed;
  const curWindDir = instant?.wind_from_direction;
  const curPrecip = next1Details?.precipitation_amount;
  const symbol = next1Summary?.symbol_code || '';

  // Aggregate daily from the next ~48-72h worth of timeseries.
  const byDate = new Map();
  for (const item of ts) {
    const time = String(item?.time || '');
    if (!time) continue;
    const date = time.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, { min: null, max: null, precip: 0, windMax: null });
    const agg = byDate.get(date);

    const inst = item?.data?.instant?.details || {};
    const t = inst?.air_temperature;
    if (Number.isFinite(t)) {
      agg.min = agg.min === null ? t : Math.min(agg.min, t);
      agg.max = agg.max === null ? t : Math.max(agg.max, t);
    }

    const w = inst?.wind_speed;
    if (Number.isFinite(w)) agg.windMax = agg.windMax === null ? w : Math.max(agg.windMax, w);

    const p1 = item?.data?.next_1_hours?.details?.precipitation_amount;
    if (Number.isFinite(p1)) agg.precip += p1;
  }

  const dates = Array.from(byDate.keys()).slice(0, 7);
  const tMin = dates.map((d) => byDate.get(d)?.min ?? null);
  const tMax = dates.map((d) => byDate.get(d)?.max ?? null);
  const precip = dates.map((d) => byDate.get(d)?.precip ?? null);
  const windMax = dates.map((d) => byDate.get(d)?.windMax ?? null);

  const lang = pickLang(languageHint);
  const placeLine = formatPlace(null, lat, lon);
  const phr = lang === 'hr'
    ? {
        title: `Vrijeme (YR/MET Norway) za ${placeLine}`,
        now: 'Trenutno',
        temp: 'Temperatura',
        humidity: 'Vlaga',
        wind: 'Vjetar',
        precip1h: 'Oborine (slj. 1h)',
        nextDays: 'Sljedeći dani',
        desc: 'Opis',
        windDir: 'smjer',
      }
    : {
        title: `Weather (YR/MET Norway) for ${placeLine}`,
        now: 'Now',
        temp: 'Temperature',
        humidity: 'Humidity',
        wind: 'Wind',
        precip1h: 'Precip (next 1h)',
        nextDays: 'Next days',
        desc: 'Summary',
        windDir: 'dir',
      };
  const fmt = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

  const desc = lang === 'hr' ? symbolToHr(symbol) : String(symbol || '').replace(/_/g, ' ');
  const lineNow = `${phr.now}: ${phr.temp} ${fmt(curTemp, '°C')}, ${phr.humidity} ${fmt(curHum, '%')}, ${
    phr.wind
  } ${fmt(curWind, ' m/s')} (${phr.windDir} ${fmt(curWindDir, '°')}), ${phr.precip1h} ${fmt(curPrecip, ' mm')}${
    desc ? `, ${phr.desc}: ${desc}` : ''
  }`;

  const rows = [];
  for (let i = 0; i < Math.min(dates.length, 7); i++) {
    rows.push(
      `${dates[i]}: ${fmt(tMin[i], '°C')}…${fmt(tMax[i], '°C')}, ${lang === 'hr' ? 'oborine' : 'precip'} ${fmt(
        precip[i],
        ' mm',
      )}, ${phr.wind} ${fmt(windMax[i], ' m/s')}`,
    );
  }

  const context = `${phr.title}\n${lineNow}${rows.length ? `\n${phr.nextDays}:\n- ${rows.join('\n- ')}` : ''}`;

  return {
    ok: true,
    providerUsed: 'metno-locationforecast',
    latitude: lat,
    longitude: lon,
    current: {
      temperatureC: curTemp,
      humidityPercent: curHum,
      windSpeedMs: curWind,
      windDirectionDeg: curWindDir,
      precipitationNext1hMm: curPrecip,
      symbolCode: symbol,
    },
    daily: {
      dates,
      temperatureMax: tMax,
      temperatureMin: tMin,
      precipitationSum: precip,
      windSpeedMax: windMax,
    },
    raw: null,
    context,
  };
}

// ─────────────────────────────────────────────────────────────
// Public API: getWeather
// ─────────────────────────────────────────────────────────────

async function getWeather({ place, latitude, longitude, provider = 'auto', languageHint = 'en' } = {}) {
  const latIn = toNum(latitude);
  const lonIn = toNum(longitude);
  let lat = latIn;
  let lon = lonIn;
  let geo = null;

  console.log(`🌦️ [WEATHER] Request: place="${place}", lat=${latitude}, lon=${longitude}, provider=${provider}`);

  if (lat === null || lon === null) {
    const cleanedPlace = cleanPlaceQuery(place);
    console.log(`🌦️ [WEATHER] Geocoding: "${cleanedPlace}"`);
    geo = await geocodePlace(cleanedPlace, languageHint);
    if (!geo) {
      console.error(`❌ [WEATHER] Geocoding failed for: "${cleanedPlace}"`);
      return { ok: false, error: 'Could not find the location. Please send a clearer city name or lat/lon.' };
    }
    lat = toNum(geo.latitude);
    lon = toNum(geo.longitude);
    console.log(`✅ [WEATHER] Geocoded to: lat=${lat}, lon=${lon}`);
  }

  if (lat === null || lon === null) {
    return { ok: false, error: 'Neispravne koordinate (lat/lon).' };
  }

  const prov = String(provider || 'auto').toLowerCase();
  const cacheKey = `wx:${prov}:${pickLang(languageHint)}:${lat.toFixed(4)}:${lon.toFixed(4)}`;
  const cached = cacheGet(wxCache, cacheKey, 5 * 60 * 1000);
  if (cached) {
    console.log(`✅ [WEATHER] Cached result for lat=${lat}, lon=${lon}`);
    return { ...cached, geocoding: geo || null, cached: true };
  }

  const providersTried = [];
  let lastErr = null;

  const runProvider = async (name, fn) => {
    providersTried.push(name);
    console.log(`🌦️ [WEATHER] Trying provider: ${name}`);
    try {
      const out = await fn();
      if (out?.ok) {
        console.log(`✅ [WEATHER] Success with provider: ${name}`);
        return out;
      }
      console.warn(`⚠️ [WEATHER] Provider ${name} returned error: ${out?.error || 'unknown'}`);
      lastErr = out?.error ? new Error(out.error) : lastErr;
      return null;
    } catch (e) {
      console.error(`❌ [WEATHER] Provider ${name} threw error:`, e.message);
      lastErr = e;
      return null;
    }
  };

  let order = [];
  if (prov === 'auto') {
    if (OPENWEATHER_API_KEY) order.push('openweather');
    order.push('yr');
    order.push('openmeteo');
  } else if (prov === 'openweather') {
    order = ['openweather'];
  } else if (prov === 'yr' || prov === 'metno' || prov === 'met') {
    order = ['yr'];
  } else if (prov === 'openmeteo') {
    order = ['openmeteo'];
  } else {
    order = [prov];
  }

  console.log(`🌦️ [WEATHER] Provider order: ${order.join(' → ')}`);

  let result = null;
  for (const p of order) {
    if (p === 'openweather') {
      if (!OPENWEATHER_API_KEY) {
        console.warn(`⚠️ [WEATHER] OPENWEATHER_API_KEY not set, skipping`);
        lastErr = new Error('OPENWEATHER_API_KEY nije postavljen.');
        continue;
      }
      result = await runProvider('openweather', () => fetchOpenWeather(lat, lon, languageHint));
    } else if (p === 'yr') {
      result = await runProvider('yr', () => fetchMetNo(lat, lon, languageHint));
    } else if (p === 'openmeteo') {
      result = await runProvider('open-meteo', () => fetchOpenMeteo(lat, lon, languageHint));
    }
    if (result) break;
  }

  if (!result) {
    const msg = lastErr?.message || 'Neuspješno dohvaćanje prognoze.';
    const errorMsg = `${msg} (pokušani: ${providersTried.join(', ') || '—'})`;
    console.error(`❌ [WEATHER] All providers failed: ${errorMsg}`);
    return {
      ok: false,
      error: errorMsg,
    };
  }

  const out = {
    ...normalizeProviderResult(result),
    place: geo?.name ? `${geo.name}${geo.country ? `, ${geo.country}` : ''}` : (place || null),
    geocoding: geo || null,
    providersTried,
  };
  cacheSet(wxCache, cacheKey, out);
  console.log(`✅ [WEATHER] Final result: provider=${out.provider}, temp=${out.temperature_celsius}°C`);
  return out;
}

module.exports = { getWeather };
