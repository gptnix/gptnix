'use strict';

// Car / vehicle data tools (NO API KEY)
// - NHTSA vPIC (VIN decoding, makes/models): https://vpic.nhtsa.dot.gov/api/
// - NHTSA Recalls + SafetyRatings: https://api.nhtsa.gov/
// - CarQuery (trims/specs): https://www.carqueryapi.com/

const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api';
const NHTSA_BASE = 'https://api.nhtsa.gov';
const CARQUERY_BASE = 'https://www.carqueryapi.com/api/0.3/';

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

function _normStr(s, max = 120) {
  return String(s || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function _normVin(v) {
  const vin = String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  // VIN is typically 17 chars, but we keep it tolerant (some APIs accept partial)
  return vin;
}

async function _fetchJson(url, { cacheKey, ttlMs = 5 * 60 * 1000, timeoutMs = 9000 } = {}) {
  const key = cacheKey || `json:${url}`;
  const cached = _cacheGet(key);
  if (cached) return cached;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { 'user-agent': 'gptnix-backend' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${txt}`);
    }
    const json = await resp.json();
    _cacheSet(key, json, ttlMs);
    return json;
  } finally {
    clearTimeout(t);
  }
}

async function _fetchCarQuery(params = {}, { cacheKey, ttlMs = 30 * 60 * 1000 } = {}) {
  // CarQuery examples are JSONP-style, but server-to-server we can safely strip the wrapper.
  const url = new URL(CARQUERY_BASE);
  // We intentionally do NOT send callback=? to try to get plain JSON;
  // if the API still returns JSONP, we'll strip it.
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || String(v).trim() === '') continue;
    url.searchParams.set(k, String(v));
  }

  const key = cacheKey || `carquery:${url.toString()}`;
  const cached = _cacheGet(key);
  if (cached) return cached;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 9000);
  try {
    const resp = await fetch(url.toString(), {
      headers: { 'user-agent': 'gptnix-backend' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`CarQuery ${resp.status}: ${txt}`);
    }

    const txt = await resp.text();
    const cleaned = String(txt || '').trim();

    // Try plain JSON first.
    try {
      const j = JSON.parse(cleaned);
      _cacheSet(key, j, ttlMs);
      return j;
    } catch (_) {
      // Strip JSONP wrapper: ?({ ... });  OR  callback123({...});
      const firstObj = cleaned.indexOf('{');
      const lastObj = cleaned.lastIndexOf('}');
      const firstArr = cleaned.indexOf('[');
      const lastArr = cleaned.lastIndexOf(']');

      let body = '';
      if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
        body = cleaned.slice(firstObj, lastObj + 1);
      } else if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
        body = cleaned.slice(firstArr, lastArr + 1);
      }
      if (!body) throw new Error('CarQuery: unable to parse response');

      const j2 = JSON.parse(body);
      _cacheSet(key, j2, ttlMs);
      return j2;
    }
  } finally {
    clearTimeout(t);
  }
}

function _pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== '') out[k] = obj[k];
  }
  return out;
}

function formatVinContext({ vin, data }) {
  const d = data || {};
  const lines = [];
  lines.push(`VIN: ${vin}`);
  const head = [d.ModelYear, d.Make, d.Model].filter(Boolean).join(' ');
  if (head) lines.push(`Vozilo: ${head}`);
  const extra = _pick(d, [
    'VehicleType',
    'BodyClass',
    'DriveType',
    'EngineCylinders',
    'DisplacementL',
    'FuelTypePrimary',
    'TransmissionStyle',
    'TransmissionSpeeds',
    'PlantCountry',
    'PlantCompanyName',
    'Manufacturer',
  ]);

  const map = {
    VehicleType: 'Tip vozila',
    BodyClass: 'Karoserija',
    DriveType: 'Pogon',
    EngineCylinders: 'Cilindri',
    DisplacementL: 'Zapremina (L)',
    FuelTypePrimary: 'Gorivo',
    TransmissionStyle: 'Mjenjač',
    TransmissionSpeeds: 'Brzina mjenjača',
    PlantCountry: 'Država proizvodnje',
    PlantCompanyName: 'Tvornica',
    Manufacturer: 'Proizvođač',
  };

  for (const [k, v] of Object.entries(extra)) {
    lines.push(`- ${map[k] || k}: ${v}`);
  }
  return lines.join('\n');
}

function formatModelsContext({ make, year, vehicleType, models }) {
  const lines = [];
  lines.push(
    `Modeli (${models.length}) za marku: ${make}` +
      (year ? `, godina: ${year}` : '') +
      (vehicleType ? `, tip: ${vehicleType}` : ''),
  );
  const list = models.slice(0, 60);
  for (const m of list) lines.push(`- ${m}`);
  if (models.length > list.length) lines.push(`… (+${models.length - list.length} više)`);
  return lines.join('\n');
}

function formatRecallsContext({ make, model, year, count, items }) {
  const lines = [];
  lines.push(`Opozivi (recalls) za: ${year} ${make} ${model}`);
  lines.push(`Ukupno: ${count}`);
  const list = (items || []).slice(0, 6);
  for (const r of list) {
    const comp = r.Component || r.ComponentDescription || '';
    const sum = String(r.Summary || r.Conequence || r.ConequenceSummary || '').replace(/\s+/g, ' ').slice(0, 180);
    const num = r.NHTSACampaignNumber || r.NHTSACampaignId || '';
    const date = r.ReportReceivedDate || r.ReportDate || '';
    lines.push(`- ${num}${date ? ` (${date})` : ''}${comp ? ` — ${comp}` : ''}`);
    if (sum) lines.push(`  - ${sum}`);
  }
  if ((items || []).length > list.length) lines.push(`… (+${(items || []).length - list.length} više)`);
  return lines.join('\n');
}

function formatComplaintsContext({ make, model, year, count, items }) {
  const lines = [];
  lines.push(`Prijave kvarova (complaints) za: ${year} ${make} ${model}`);
  lines.push(`Ukupno: ${count}`);
  const list = (items || []).slice(0, 6);
  for (const r of list) {
    const comp = r.Component || r.ComponentDescription || '';
    const desc = String(r.Description || '').replace(/\s+/g, ' ').slice(0, 180);
    const date = r.DateOfIncident || r.ReportDate || '';
    lines.push(`- ${date || 'datum?'}${comp ? ` — ${comp}` : ''}`);
    if (desc) lines.push(`  - ${desc}`);
  }
  if ((items || []).length > list.length) lines.push(`… (+${(items || []).length - list.length} više)`);
  return lines.join('\n');
}

function formatTrimsContext({ make, model, year, count, trims }) {
  const lines = [];
  lines.push(`Trims/spec (CarQuery) za: ${year || ''} ${make || ''} ${model || ''}`.trim());
  lines.push(`Ukupno trimova: ${count}`);
  const list = (trims || []).slice(0, 6);
  for (const t of list) {
    const trim = _normStr(t.model_trim || t.model_trim_id || '', 80);
    const body = _normStr(t.model_body || '', 60);
    const fuel = _normStr(t.model_engine_fuel || '', 60);
    const drive = _normStr(t.model_drive || '', 40);
    const power = t.model_engine_power_hp || t.model_engine_power_kw || t.model_engine_power_ps;
    const cyl = t.model_engine_cyl || '';
    const engL = t.model_engine_l || '';
    const trans = _normStr(t.model_transmission_type || '', 40);
    lines.push(
      `- ${t.model_year || year || ''} ${t.make_display || make || ''} ${t.model_name || model || ''}` +
        (trim ? ` ${trim}` : ''),
    );
    const bits = [];
    if (body) bits.push(body);
    if (fuel) bits.push(fuel);
    if (drive) bits.push(drive);
    if (cyl) bits.push(`${cyl} cyl`);
    if (engL) bits.push(`${engL} L`);
    if (power) bits.push(`${power}${t.model_engine_power_hp ? ' hp' : t.model_engine_power_kw ? ' kW' : ' PS'}`);
    if (trans) bits.push(trans);
    if (bits.length) lines.push(`  - ${bits.join(' | ')}`);
  }
  if ((trims || []).length > list.length) lines.push(`… (+${(trims || []).length - list.length} više)`);
  return lines.join('\n');
}

function formatSafetyContext({ make, model, year, vehicles, detail }) {
  const lines = [];
  lines.push(`Sigurnosne ocjene (NHTSA) za: ${year} ${make} ${model}`);
  if (Array.isArray(vehicles) && vehicles.length) {
    lines.push(`Varijante: ${vehicles.length}`);
    for (const v of vehicles.slice(0, 6)) {
      lines.push(`- VehicleId ${v.VehicleId}: ${_normStr(v.VehicleDescription || '', 140)}`);
    }
    if (vehicles.length > 6) lines.push(`… (+${vehicles.length - 6} više)`);
  }
  if (detail) {
    lines.push('');
    lines.push(`Detalj (VehicleId ${detail.VehicleId}):`);
    const keys = [
      ['OverallRating', 'Overall'],
      ['OverallFrontCrashRating', 'Front crash'],
      ['OverallSideCrashRating', 'Side crash'],
      ['RolloverRating', 'Rollover'],
    ];
    for (const [k, label] of keys) {
      if (detail[k] != null && String(detail[k]).trim() !== '') lines.push(`- ${label}: ${detail[k]}`);
    }
    if (detail.NHTSAComplaintCount != null) lines.push(`- Complaint count: ${detail.NHTSAComplaintCount}`);
    if (detail.VehicleDescription) lines.push(`- Opis: ${_normStr(detail.VehicleDescription, 200)}`);
  }
  return lines.join('\n');
}

async function decodeVin({ vin, modelYear } = {}) {
  const v = _normVin(vin);
  if (!v) return { ok: false, error: 'Nedostaje VIN' };

  const url = new URL(`${VPIC_BASE}/vehicles/DecodeVinValuesExtended/${encodeURIComponent(v)}`);
  url.searchParams.set('format', 'json');
  if (modelYear) url.searchParams.set('modelyear', String(modelYear));

  const json = await _fetchJson(url.toString(), {
    cacheKey: `vin:${v}:${modelYear || ''}`,
    ttlMs: 12 * 60 * 60 * 1000,
  });

  const row = Array.isArray(json?.Results) ? json.Results[0] : null;
  if (!row) return { ok: false, error: 'NHTSA vPIC: nema rezultata' };

  const context = formatVinContext({ vin: v, data: row });
  return { ok: true, vin: v, data: row, context };
}

async function getModelsForMake({ make, modelYear, vehicleType } = {}) {
  const mk = _normStr(make, 80);
  const year = modelYear != null ? Number(modelYear) : null;
  const vt = _normStr(vehicleType, 60);
  if (!mk) return { ok: false, error: 'Nedostaje make (marka)' };

  let path = '';
  if (year && vt) {
    path = `/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(mk)}/modelyear/${encodeURIComponent(String(year))}/vehicletype/${encodeURIComponent(vt)}`;
  } else if (year) {
    path = `/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(mk)}/modelyear/${encodeURIComponent(String(year))}`;
  } else if (vt) {
    path = `/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(mk)}/vehicletype/${encodeURIComponent(vt)}`;
  } else {
    path = `/vehicles/GetModelsForMake/${encodeURIComponent(mk)}`;
  }

  const url = new URL(`${VPIC_BASE}${path}`);
  url.searchParams.set('format', 'json');

  const json = await _fetchJson(url.toString(), {
    cacheKey: `models:${mk}:${year || ''}:${vt || ''}`,
    ttlMs: 24 * 60 * 60 * 1000,
  });

  const results = Array.isArray(json?.Results) ? json.Results : [];
  const models = Array.from(
    new Set(
      results
        .map((r) => r?.Model_Name || r?.Model || r?.ModelName)
        .filter(Boolean)
        .map((s) => String(s).trim()),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const context = formatModelsContext({ make: mk, year, vehicleType: vt || null, models });
  return { ok: true, make: mk, year, vehicleType: vt || null, models, context };
}

async function getTrimsCarQuery({ make, model, year, keyword, full_results } = {}) {
  const mk = _normStr(make, 50);
  const md = _normStr(model, 60);
  const yr = year != null ? Number(year) : null;
  const kw = _normStr(keyword, 80);

  if (!mk && !md && !yr && !kw) {
    return { ok: false, error: 'Nedostaju kriteriji (make/model/year/keyword)' };
  }

  const json = await _fetchCarQuery(
    {
      cmd: 'getTrims',
      make: mk || undefined,
      model: md || undefined,
      year: yr || undefined,
      keyword: kw || undefined,
      full_results: full_results != null ? String(full_results) : undefined,
    },
    { cacheKey: `cq:trims:${mk}:${md}:${yr || ''}:${kw}` },
  );

  const trims = Array.isArray(json?.Trims) ? json.Trims : [];
  const context = formatTrimsContext({ make: mk, model: md, year: yr, count: trims.length, trims });
  return { ok: true, make: mk || null, model: md || null, year: yr || null, trims, count: trims.length, context };
}

async function getRecallsByVehicle({ make, model, year } = {}) {
  const mk = _normStr(make, 60);
  const md = _normStr(model, 80);
  const yr = Number(year);
  if (!mk || !md || !Number.isFinite(yr)) return { ok: false, error: 'Treba make, model i year' };

  const url = new URL(`${NHTSA_BASE}/recalls/recallsByVehicle`);
  url.searchParams.set('make', mk);
  url.searchParams.set('model', md);
  url.searchParams.set('modelYear', String(yr));

  const json = await _fetchJson(url.toString(), { cacheKey: `recalls:${mk}:${md}:${yr}`, ttlMs: 24 * 60 * 60 * 1000 });
  const count = Number(json?.Count || 0);
  const results = Array.isArray(json?.results) ? json.results : [];
  const context = formatRecallsContext({ make: mk, model: md, year: yr, count, items: results });
  return { ok: true, make: mk, model: md, year: yr, count, results, context };
}

async function getComplaintsByVehicle({ make, model, year } = {}) {
  const mk = _normStr(make, 60);
  const md = _normStr(model, 80);
  const yr = Number(year);
  if (!mk || !md || !Number.isFinite(yr)) return { ok: false, error: 'Treba make, model i year' };

  // NHTSA complaints endpoint sometimes differs; keep tolerant.
  const url = new URL(`${NHTSA_BASE}/complaints/complaintsByVehicle`);
  url.searchParams.set('make', mk);
  url.searchParams.set('model', md);
  url.searchParams.set('modelYear', String(yr));

  const json = await _fetchJson(url.toString(), {
    cacheKey: `complaints:${mk}:${md}:${yr}`,
    ttlMs: 24 * 60 * 60 * 1000,
  });
  const count = Number(json?.Count || 0);
  const results = Array.isArray(json?.results) ? json.results : [];
  const context = formatComplaintsContext({ make: mk, model: md, year: yr, count, items: results });
  return { ok: true, make: mk, model: md, year: yr, count, results, context };
}

async function getSafetyRatings({ make, model, year, includeDetail = true } = {}) {
  const mk = _normStr(make, 60);
  const md = _normStr(model, 80);
  const yr = Number(year);
  if (!mk || !md || !Number.isFinite(yr)) return { ok: false, error: 'Treba make, model i year' };

  const listUrl = new URL(`${NHTSA_BASE}/SafetyRatings/modelyear/${encodeURIComponent(String(yr))}/make/${encodeURIComponent(mk)}/model/${encodeURIComponent(md)}`);
  listUrl.searchParams.set('format', 'json');
  const list = await _fetchJson(listUrl.toString(), { cacheKey: `safety:list:${mk}:${md}:${yr}`, ttlMs: 24 * 60 * 60 * 1000 });
  const vehicles = Array.isArray(list?.Results) ? list.Results : [];
  let detail = null;

  if (includeDetail && vehicles.length && vehicles[0]?.VehicleId) {
    const id = vehicles[0].VehicleId;
    const detUrl = new URL(`${NHTSA_BASE}/SafetyRatings/VehicleId/${encodeURIComponent(String(id))}`);
    detUrl.searchParams.set('format', 'json');
    const det = await _fetchJson(detUrl.toString(), { cacheKey: `safety:detail:${id}`, ttlMs: 24 * 60 * 60 * 1000 });
    detail = det || null;
  }

  const context = formatSafetyContext({ make: mk, model: md, year: yr, vehicles, detail });
  return { ok: true, make: mk, model: md, year: yr, vehicles, detail, context };
}

module.exports = {
  decodeVin,
  getModelsForMake,
  getTrimsCarQuery,
  getRecallsByVehicle,
  getComplaintsByVehicle,
  getSafetyRatings,
  // context helpers (sometimes handy)
  formatVinContext,
  formatModelsContext,
  formatRecallsContext,
  formatComplaintsContext,
  formatTrimsContext,
  formatSafetyContext,
};
