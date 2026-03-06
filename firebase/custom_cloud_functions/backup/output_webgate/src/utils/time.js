'use strict';

/**
 * Time utilities for building stable, explicit "time context" blocks in prompts.
 *
 * Goals:
 * - No external deps (Luxon/moment)
 * - Accept optional client-provided time + timezone/offset (FlutterFlow)
 * - Avoid stale production time if FIXED_NOW_ISO is accidentally set
 */

const { DEFAULT_TIMEZONE, DEFAULT_LOCALE, FIXED_NOW_ISO, ALLOW_FIXED_NOW } = require('../config/env');

function getNow() {
  // Safety: only honor FIXED_NOW_ISO when explicitly enabled (intended for debugging)
  if (ALLOW_FIXED_NOW && FIXED_NOW_ISO && typeof FIXED_NOW_ISO === 'string') {
    const d = new Date(FIXED_NOW_ISO);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function _safeTz(tz) {
  return (tz && typeof tz === 'string' && tz.trim()) ? tz.trim() : DEFAULT_TIMEZONE;
}

function _safeLocale(locale) {
  return (locale && typeof locale === 'string' && locale.trim()) ? locale.trim() : DEFAULT_LOCALE;
}

function _isValidIanaTimeZone(tz) {
  const s = String(tz || '').trim();
  if (!s) return false;
  try {
    // Throws RangeError for invalid TZ names.
    new Intl.DateTimeFormat('en-GB', { timeZone: s }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function _parseOffsetMinutes(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  const s = String(v).trim();
  if (!s) return null;

  // Accept plain minute offsets too: "60", "-120"
  if (/^-?\d{1,4}$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isFinite(n)) return n;
  }

  // Accept: "+01:00", "-0600", "UTC+1", "GMT+02:00"
  const m = s.match(/([+-])\s*(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return null;

  const sign = (m[1] === '-') ? -1 : 1;
  const hh = parseInt(m[2], 10);
  const mm = m[3] ? parseInt(m[3], 10) : 0;

  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh > 23 || mm > 59) return null;

  return sign * (hh * 60 + mm);
}

function _offsetNameFromMinutes(mins) {
  if (!Number.isFinite(mins)) return null;
  const sign = mins < 0 ? '-' : '+';
  const a = Math.abs(mins);
  const hh = String(Math.floor(a / 60)).padStart(2, '0');
  const mm = String(a % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

function formatWithOffset(now, offsetMinutes) {
  const mins = _parseOffsetMinutes(offsetMinutes);
  if (!Number.isFinite(mins)) return null;

  // Shift "now" by offset and read as UTC fields to avoid host timezone.
  const local = new Date(now.getTime() + mins * 60 * 1000);

  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const ss = String(local.getUTCSeconds()).padStart(2, '0');

  return `${d}.${mo}.${y}, ${hh}:${mm}:${ss}`;
}

function getDatePartsWithOffset(now, offsetMinutes) {
  const mins = _parseOffsetMinutes(offsetMinutes);
  if (!Number.isFinite(mins)) {
    return { year: null, month: null, day: null, ddmmyyyy: null };
  }
  const local = new Date(now.getTime() + mins * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return { year: y, month: m, day: d, ddmmyyyy: `${dd}.${mm}.${y}` };
}

function getOffsetName(now, timeZone) {
  try {
    // Example: "GMT+1" or "UTC+01:00" depending on runtime.
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = fmt.formatToParts(now);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value || null;
  } catch {
    return null;
  }
}

function formatLocalHuman(now, { timeZone, locale } = {}) {
  const tz = _safeTz(timeZone);
  const loc = _safeLocale(locale);

  // Output example: "21.12.2025, 09:14:32" (depends on locale)
  const fmt = new Intl.DateTimeFormat(loc, {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return fmt.format(now);
}

function getLocalDateParts(now, { timeZone, locale } = {}) {
  const tz = _safeTz(timeZone);
  const loc = _safeLocale(locale);

  const fmt = new Intl.DateTimeFormat(loc, {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;

  return {
    year: y ? Number(y) : null,
    month: m ? Number(m) : null,
    day: d ? Number(d) : null,
    ddmmyyyy: (d && m && y) ? `${d}.${m}.${y}` : null,
  };
}

function normalizeClientTimeInfo(clientTimeInfo) {
  const ti = (clientTimeInfo && typeof clientTimeInfo === 'object') ? clientTimeInfo : {};

  const iso =
    ti.iso ||
    ti.clientIso ||
    ti.localIso ||
    ti.utcIso ||
    ti.now ||
    null;

  const timeZone =
    ti.timeZone ||
    ti.tz ||
    ti.timezone ||
    ti.ianaTimeZone ||
    ti.iana ||
    null;

  const offsetMinutes =
    (typeof ti.offsetMinutes === 'number' && Number.isFinite(ti.offsetMinutes)) ? ti.offsetMinutes :
    (typeof ti.timezoneOffsetMinutes === 'number' && Number.isFinite(ti.timezoneOffsetMinutes)) ? ti.timezoneOffsetMinutes :
    (typeof ti.timezoneOffset === 'number' && Number.isFinite(ti.timezoneOffset)) ? ti.timezoneOffset :
    _parseOffsetMinutes(ti.timezoneOffset || ti.utcOffset || ti.offset || null);

  return {
    iso: iso ? String(iso) : null,
    timeZone: timeZone ? String(timeZone).trim() : null,
    offsetMinutes: Number.isFinite(offsetMinutes) ? offsetMinutes : null,
  };
}

function _parseClientIsoMaybe(iso, offsetMinutes) {
  const s = String(iso || '').trim();
  if (!s) return null;

  // ISO already includes a timezone (Z or +/-HH:mm or +/-HHmm)
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // If we have an offset, interpret the ISO as a local "wall clock" at that offset.
  if (Number.isFinite(offsetMinutes)) {
    // Parse as UTC at same clock time, then subtract the offset to get the real UTC instant.
    const d = new Date(s + 'Z');
    if (!Number.isNaN(d.getTime())) return new Date(d.getTime() - offsetMinutes * 60 * 1000);
  }

  // Fallback: runtime parse (may assume server TZ; avoid when possible)
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildTimeContext({ clientTimeInfo, languageHint } = {}) {
  // Base now from server (or FIXED_NOW_ISO in debug)
  let now = getNow();

  const norm = normalizeClientTimeInfo(clientTimeInfo);

  // Prefer client-provided "now" if present
  if (norm.iso) {
    const d = _parseClientIsoMaybe(norm.iso, norm.offsetMinutes);
    if (d && !Number.isNaN(d.getTime())) now = d;
  }

  const serverIso = now.toISOString();

  const locale = (languageHint && typeof languageHint === 'string' && languageHint.trim())
    ? languageHint.trim()
    : DEFAULT_LOCALE;

  // Preferred: a valid IANA timezone from the client
  let tz = (norm.timeZone && _isValidIanaTimeZone(norm.timeZone)) ? norm.timeZone : null;

  // Second-best: client offset minutes
  const offsetMinutes = Number.isFinite(norm.offsetMinutes) ? norm.offsetMinutes : null;

  let offsetName = null;
  let localHuman = null;
  let parts = { ddmmyyyy: null, year: null };

  if (tz) {
    localHuman = formatLocalHuman(now, { timeZone: tz, locale });
    offsetName = getOffsetName(now, tz);
    parts = getLocalDateParts(now, { timeZone: tz, locale });
  } else if (Number.isFinite(offsetMinutes)) {
    localHuman = formatWithOffset(now, offsetMinutes);
    offsetName = _offsetNameFromMinutes(offsetMinutes);
    parts = getDatePartsWithOffset(now, offsetMinutes);
    tz = offsetName ? `${offsetName} (offset)` : 'UTC (offset)';
  } else {
    tz = _safeTz(DEFAULT_TIMEZONE);
    localHuman = formatLocalHuman(now, { timeZone: tz, locale });
    offsetName = getOffsetName(now, tz);
    parts = getLocalDateParts(now, { timeZone: tz, locale });
  }

  return {
    serverIso,
    timeZone: tz,
    locale,
    offsetName,
    localHuman,
    localDate: parts.ddmmyyyy,
    localYear: parts.year,
  };
}

module.exports = {
  getNow,
  buildTimeContext,
  formatLocalHuman,
  getLocalDateParts,
  getOffsetName,
  normalizeClientTimeInfo,
  formatWithOffset,
};
