'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// extractPublishDate.js — FIX12 Universal
//
// Podržava sve uobičajene formate datuma bez vanjskih dependencija.
//
// PARSER CHAIN (po pouzdanosti):
//   1. ISO 8601 / RFC 2822 (god-first ili RFC header) — unambiguous
//   2. Kompaktni ISO: 20240517
//   3. Višejezični nazivi mjeseci (HR/BS/SR/EN/DE/FR/IT/ES/PT/PL/TR/RU + 20 jezika)
//   4. Numerički EU (DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY) — day>12 = siguran
//   5. Numerički US (MM/DD/YYYY) — samo ako dan>12 nije moguć, explicit label
//   6. Parcijalni (YYYY-MM, samo god = fallback)
//   7. Unix timestamp u HTML/meta
//
// DISAMBIGUATION DD/MM vs MM/DD:
//   - Ako prvi broj > 12 → definitivno DD/MM
//   - Ako oba ≤ 12 → pazi na URL/kontekst; default EU (DD/MM) osim na .com/.us domeni
//   - US format prihvaća samo uz expl. labela "Published: MM/DD/YYYY"
//
// dateType: 'published' | 'modified' | 'unknown'
// confidence: 'high' | 'med' | 'low' | 'none'
// ═══════════════════════════════════════════════════════════════════════════════

// ─── MULTI-LANGUAGE MONTH TABLE ────────────────────────────────────────────────
// Normalized keys (lowercase, no diacritics/umlauts)
// Format: normalized_name → month_number
const MONTH_MAP = {
  // EN
  january:1,  february:2,  march:3,    april:4,   may:5,      june:6,
  july:7,     august:8,    september:9,october:10, november:11,december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,

  // HR/BS/SR
  sijecanj:1, sijechnja:1, sijecnja:1,
  veljaca:2,  veljache:2,  veljacha:2,
  ozujak:3,   ozujka:3,
  travanj:4,  travnja:4,
  svibanj:5,  svibnja:5,
  lipanj:6,   lipnja:6,
  srpanj:7,   srpnja:7,
  kolovoz:8,  kolovoza:8,
  rujan:9,    rujna:9,
  listopad:10,listopada:10,
  studeni:11, studenog:11,
  prosinac:12,prosinca:12,
  // BS (alternativni)
  januar:1,   januara:1,
  februar:2,  februara:2,
  mart:3,     aprila:4,
  maj:5,      maja:5,
  juni:6,     juna:6,
  juli:7,     jula:7,
  septembar:9,oktobra:10,oktobar:10,
  novembar:11,decembar:12,

  // DE (umlauts normalized: ä→a ö→o ü→u)
  januar_de:1, // already 'januar' above
  februar_de:2,
  marz:3,  maerz:3,
  // april same
  mai:5,
  // juni/juli same
  // august same
  // september same
  oktober:10,
  // november same
  dezember:12,

  // FR
  janvier:1, fevrier:2, mars_fr:3, avril:4, mai_fr:5, juin:6,
  juillet:7, aout:8, septembre:9, octobre:10, novembre:11, decembre:12,
  // (mars/mai/juin covered by EN/DE already after normalization)

  // IT
  gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6,
  luglio:7,  agosto:8,   settembre:9, ottobre:10, novembre_it:11, dicembre:12,

  // ES
  enero:1, febrero:2, marzo_es:3, abril_es:4, mayo:5, junio:6,
  julio:7, agosto_es:8, septiembre:9, octubre_es:10, noviembre:11, diciembre_es:12,

  // PT
  janeiro:1, fevereiro:2, marco:3, abril_pt:4, maio_pt:5, junho:6,
  julho:7, agosto_pt:8, setembro:9, outubro:10, novembro:11, dezembro:12,

  // PL
  stycznia:1, styczen:1, lutego:2, luty:2, marca:3, marzec:3,
  kwietnia:4, kwiecien:4, maja_pl:5, czerwca:6, czerwiec:6,
  lipca:7, lipiec:7, sierpnia:8, sierpien:8, wrzesnia:9, wrzesien:9,
  pazdziernika:10, pazdziernik:10, listopada_pl:11, grudzien:12, grudnia:12,

  // TR (normalize ı→i, ş→s, ğ→g, ç→c, ö→o, ü→u)
  ocak:1, subat:2, mart_tr:3, nisan:4, mayis:5, haziran:6,
  temmuz:7, agustos:8, eylul:9, ekim:10, kasim:11, aralik:12,

  // RU (transliterated)
  yanvarya:1, yanvar:1, fevralya:2, fevral:2,
  marta_ru:3, aprelya:4, aprel:4, maya:5, iyunya:6, iyun:6,
  iyulya:7, iyul:7, avgusta:8, avgust:8, sentyabrya:9, sentyabr:9,
  oktyabrya:10, oktyabr:10, noyabrya:11, noyabr:11, dekabrya:12, dekabr:12,
  // Cyrillic (direct)
  января:1, февраля:2, марта:3, апреля:4, мая:5, июня:6,
  июля:7, августа:8, сентября:9, октября:10, ноября:11, декабря:12,
  январь:1, февраль:2, март:3, апрель:4, май_ru:5, июнь:6,
  июль:7, август:8, сентябрь:9, октябрь:10, ноябрь:11, декабрь:12,

  // NL
  januari:1, februari:2, maart:3, mei:5, juni_nl:6, juli_nl:7,
  augustus:8, september_nl:9, oktober_nl:10, november_nl:11, december_nl:12,

  // SV/NO/DA
  januari_sv:1, februari_sv:2, mars_sv:3, april_sv:4, maj_sv:5, juni_sv:6,
  juli_sv:7, augusti:8, september_sv:9, oktober_sv:10, november_sv:11, december_sv:12,

  // FI
  tammikuuta:1, helmikuuta:2, maaliskuuta:3, huhtikuuta:4, toukokuuta:5, kesakuuta:6,
  heinakuuta:7, elokuuta:8, syyskuuta:9, lokakuuta:10, marraskuuta:11, joulukuuta:12,

  // CS/SK
  ledna:1, unor:2, unora:2, brezna:3, dubna:4, kvetna:5, cervna:6,
  cervence:7, srpna:8, zari:9, rijna:10, listopadu:11, prosince:12,

  // HU
  januar_hu:1, februar_hu:2, marcius:3, aprilis:4, majus:5, junius:6,
  julius:7, augusztus_hu:8, szeptember:9, oktober_hu:10, november_hu:11, december_hu:12,

  // RO
  ianuarie:1, februarie:2, martie:3, aprilie:4, mai_ro:5, iunie:6,
  iulie:7, august_ro:8, septembrie:9, octombrie:10, noiembrie:11, decembrie_ro:12,
};

// ─── TEXT NORMALIZATION ────────────────────────────────────────────────────────
function normStr(s) {
  return String(s || '')
    .toLowerCase()
    // DE umlauts
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    // TR
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c')
    // FI/Scandinavian
    .replace(/å/g, 'a').replace(/ø/g, 'o').replace(/æ/g, 'ae')
    // Balkan
    .replace(/đ/g, 'd')
    // NFD diacritics (covers FR é, PL ą, HR č etc.)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── BUILD MONTH NAMES for regex ──────────────────────────────────────────────
// Returns sorted by length desc (longer names match first, avoid partial match)
function buildMonthNames() {
  const byMon = Array.from({ length: 12 }, (_, i) => ({ mon: i + 1, names: [] }));
  const seen = new Set();
  for (const [raw, mon] of Object.entries(MONTH_MAP)) {
    // Strip language suffix (_de, _fr, etc.)
    const name = raw.replace(/_[a-z]+$/, '');
    if (!seen.has(name)) {
      seen.add(name);
      byMon[mon - 1].names.push(name);
    }
  }
  // Also include Cyrillic months directly
  const CYR = {
    'января':1,'февраля':2,'марта':3,'апреля':4,'мая':5,'июня':6,
    'июля':7,'августа':8,'сентября':9,'октября':10,'ноября':11,'декабря':12,
    'январь':1,'февраль':2,'март':3,'апрель':4,'май':5,'июнь':6,
    'июль':7,'август':8,'сентябрь':9,'октябрь':10,'ноябрь':11,'декабрь':12,
  };
  return { normalized: byMon, cyrillic: CYR };
}
const MONTHS = buildMonthNames();

// ─── CORE PARSERS ──────────────────────────────────────────────────────────────

// Validates a YYYY-MM-DD triple
const NOW_MS = Date.now();
const MAX_FUTURE_MS = NOW_MS + 48 * 3600000; // max 48h in future (scheduled articles ok)
const MIN_DATE_MS   = Date.parse('1990-01-01T00:00:00Z');

function makeDate(y, m, d) {
  const yi = parseInt(y), mi = parseInt(m), di = parseInt(d);
  if (yi < 1990 || yi > 2099) return null;
  if (mi < 1 || mi > 12) return null;
  if (di < 1 || di > 31) return null;
  const dt = new Date(Date.UTC(yi, mi - 1, di));
  // Check date didn't overflow (e.g. Feb 31)
  if (dt.getUTCMonth() !== mi - 1) return null;
  const ms = dt.getTime();
  // Guard: reject future dates beyond 48h and dates before 1990
  if (ms > MAX_FUTURE_MS || ms < MIN_DATE_MS) return null;
  return dt;
}

// Only year + month
function makeDateYM(y, m) {
  const yi = parseInt(y), mi = parseInt(m);
  if (yi < 1990 || yi > 2099 || mi < 1 || mi > 12) return null;
  return new Date(Date.UTC(yi, mi - 1, 1));
}

// P1: ISO 8601 year-first + RFC 2822
function parseIsoOrRfc(s) {
  const t = String(s || '').trim();
  if (!t) return null;
  // Accept year-first: 2024-05-17 or 2024/05/17 or 2024.05.17
  const isoFull = t.match(/^(20\d{2})[-\/.]([01]\d)[-\/.]([0-3]\d)/);
  if (isoFull) return makeDate(isoFull[1], isoFull[2], isoFull[3]);
  // ISO partial: 2024-05
  const isoPartial = t.match(/^(20\d{2})[-\/]([01]\d)$/);
  if (isoPartial) return makeDateYM(isoPartial[1], isoPartial[2]);
  // RFC 2822: Mon, 17 May 2024 ...
  if (/^\w{3},\s*\d/.test(t)) {
    const ms = Date.parse(t);
    if (isFinite(ms)) return new Date(ms);
  }
  // Full ISO datetime (with T or space separator)
  if (/^20\d{2}/.test(t)) {
    const ms = Date.parse(t);
    if (isFinite(ms)) return new Date(ms);
  }
  return null;
}

// P2: Compact YYYYMMDD
function parseCompact(s) {
  const m = String(s || '').match(/\b(20\d{2})([01]\d)([0-3]\d)\b/);
  if (!m) return null;
  return makeDate(m[1], m[2], m[3]);
}

// P3: Month names (all languages)
function parseMonthName(s) {
  const raw = String(s || '');

  // Try normalized (latin-based)
  const n = normStr(raw);
  for (const { mon, names } of MONTHS.normalized) {
    for (const name of names) {
      const re = new RegExp(
        // DD [de] MonthName Year
        `(?:^|\\b)(\\d{1,2})(?:\\s+de)?[.,\\s]+${name}[a-z]*(?:\\s+de)?[.,\\s]+(20\\d{2})` +
        // MonthName DD, Year  (EN format)
        `|(^|\\b)${name}[a-z]*[.,\\s]+(\\d{1,2})(?:st|nd|rd|th)?[.,\\s]+(20\\d{2})` +
        // Year MonthName DD
        `|(20\\d{2})\\s+${name}[a-z]*[.,\\s]+(\\d{1,2})`,
        'i'
      );
      const mm = n.match(re);
      if (mm) {
        const day  = mm[1] || mm[4] || mm[6];
        const year = mm[2] || mm[5] || mm[3];
        if (day && year) return makeDate(year, mon, day);
      }
      // "Month Year" without day — use day=1
      const re2 = new RegExp(`(?:^|\\b)${name}[a-z]*\\s+(20\\d{2})`, 'i');
      const mm2 = n.match(re2);
      if (mm2) return makeDateYM(mm2[1], mon);
    }
  }

  // Try Cyrillic directly
  for (const [cyrName, mon] of Object.entries(MONTHS.cyrillic)) {
    const re = new RegExp(`(\\d{1,2})\\s+${cyrName}\\s+(20\\d{2})`);
    const mm = raw.match(re);
    if (mm) return makeDate(mm[2], mon, mm[1]);
  }
  return null;
}

// P4: Numeric EU: DD.MM.YYYY / DD-MM-YYYY / DD/MM/YYYY
// Disambiguation: if first number > 12, must be day
// If both ≤ 12 and domain is non-US, assume DD/MM
function parseNumericEU(s, { forceDay = false } = {}) {
  // Match: 17.05.2024 / 17-05-2024 / 17/05/2024 / 17. 05. 2024 (dot-space)
  const m = String(s || '').match(/\b([0-3]?\d)[.\-\/]\s*([01]?\d)[.\-\/]\s*(20\d{2})\b/);
  if (!m) return null;
  const a = parseInt(m[1]), b = parseInt(m[2]);
  // If a > 12 — definitive DD/MM
  if (a > 12) return makeDate(m[3], m[2], m[1]);
  // If b > 12 — definitive MM/DD (US-like)
  if (b > 12) return makeDate(m[3], m[1], m[2]);
  // Both ≤ 12 — ambiguous
  // forceDay=true (EU context) → DD/MM, forceDay=false → still prefer DD/MM (European default)
  return makeDate(m[3], m[2], m[1]); // EU default: first=day
}

// P5: Numeric US: MM/DD/YYYY — only when first part > 12 is impossible for EU
// Used only as explicit override when label says "Updated:" on .com domain etc.
function parseNumericUS(s) {
  const m = String(s || '').match(/\b([01]?\d)\/([0-3]?\d)\/(20\d{2})\b/);
  if (!m) return null;
  const mo = parseInt(m[1]), d = parseInt(m[2]);
  if (mo > 12 || mo < 1) return null;
  if (d < 1 || d > 31) return null;
  // Only interpret as MM/DD if day value makes sense and first is ≤ 12
  return makeDate(m[3], m[1], m[2]);
}

// P6: Unix timestamp (10-digit number in content)
function parseUnixTs(s) {
  const m = String(s || '').match(/\b(1[3-9]\d{8}|[2-9]\d{8})\b/);
  if (!m) return null;
  const ts = parseInt(m[1]) * 1000;
  if (ts < Date.parse('2000-01-01') || ts > Date.now() + 86400000) return null;
  return new Date(ts);
}

// ─── UNIVERSAL PARSER ─────────────────────────────────────────────────────────
// Tries all parsers in priority order. Returns { date, method } or null.
function parseAnyDate(s) {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  if (!t || t.length < 4) return null;

  let d;
  if ((d = parseIsoOrRfc(t)))    return { date: d, method: 'iso_rfc' };
  if ((d = parseCompact(t)))     return { date: d, method: 'compact_iso' };
  if ((d = parseMonthName(t)))   return { date: d, method: 'month_name' };
  if ((d = parseNumericEU(t)))   return { date: d, method: 'numeric_eu' };
  // URL path: /2024/03/15/ embedded in URL string
  const pathM = t.match(/\/(20\d{2})\/([01]?\d)\/([0-3]?\d)\//);
  if (pathM && (d = makeDate(pathM[1], pathM[2], pathM[3]))) return { date: d, method: 'url_path' };
  if ((d = parseUnixTs(t)))      return { date: d, method: 'unix_ts' };
  return null;
}

// ─── HTML EXTRACTION HELPERS ──────────────────────────────────────────────────

// Walk a JSON-LD object recursively, collecting all datePublished/dateCreated/dateModified values.
// Supports @graph arrays, mainEntity, nested objects, up to depth 6.
function* walkJsonLd(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return;
  if (Array.isArray(obj)) {
    for (const item of obj) yield* walkJsonLd(item, depth + 1);
    return;
  }
  yield obj;
  // Recurse into known nesting keys
  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'hasPart', 'isPartOf', 'author', 'publisher', 'about']) {
    if (obj[key]) yield* walkJsonLd(obj[key], depth + 1);
  }
}

function fromJsonLdPublished(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      for (const node of walkJsonLd(JSON.parse(m[1]))) {
        const r = parseAnyDate(node?.datePublished) || parseAnyDate(node?.dateCreated);
        if (r) return { date: r.date, confidence: 'high', source: `jsonld(${r.method})`, dateType: 'published' };
      }
    } catch (_) {}
  }
  return null;
}

function fromJsonLdModified(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      for (const node of walkJsonLd(JSON.parse(m[1]))) {
        const r = parseAnyDate(node?.dateModified);
        if (r) return { date: r.date, confidence: 'med', source: `jsonld_mod(${r.method})`, dateType: 'modified' };
      }
    } catch (_) {}
  }
  return null;
}

function fromMetaPublished(html) {
  const SELECTORS = [
    /property=["']article:published_time["'][^>]+content=["']([^"']+)/i,
    /content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /itemprop=["']datePublished["'][^>]+(?:content|datetime)=["']([^"']+)/i,
    /(?:content|datetime)=["']([^"']+)["'][^>]+itemprop=["']datePublished["']/i,
    /name=["']pubdate["'][^>]+content=["']([^"']+)/i,
    /name=["']publishdate["'][^>]+content=["']([^"']+)/i,
    /name=["']DC\.date[^"']*["'][^>]+content=["']([^"']+)/i,
    /name=["']dc\.date[^"']*["'][^>]+content=["']([^"']+)/i,
  ];
  for (const re of SELECTORS) {
    const m = html.match(re);
    if (!m) continue;
    const r = parseAnyDate(m[1]);
    if (r) return { date: r.date, confidence: 'high', source: `meta_pub(${r.method})`, dateType: 'published' };
  }
  // Generic name="date" — risky: many CMSes set this to today's date on every render
  const genericPatterns = [
    /name=["']date["'][^>]+content=["']([^"']+)/i,
    /property=["']article:published["'][^>]+content=["']([^"']+)/i,
  ];
  for (const gp of genericPatterns) {
    const gm = html.match(gp);
    if (!gm) continue;
    const r = parseAnyDate(gm[1]);
    if (!r) continue;
    // "Today" heuristic: if the extracted date is today, it's likely a CMS render
    // timestamp updated on every page rebuild — downgrade to 'low' confidence.
    // Compare as ISO date strings (not ms) because makeDate normalises to UTC midnight,
    // so ageHours would be 0–23h and a 6h threshold would miss afternoon renders.
    const todayStr = new Date().toISOString().slice(0, 10);  // 'YYYY-MM-DD'
    const isToday  = r.date.toISOString().slice(0, 10) === todayStr;
    const conf     = isToday ? 'low' : 'med';
    const src      = isToday ? `meta_date_today(${r.method})` : `meta_date_generic(${r.method})`;
    // "Today" date from generic meta = CMS render timestamp, treat as modified (not publish date)
    const dType    = isToday ? 'modified' : 'published';
    return { date: r.date, confidence: conf, source: src, dateType: dType };
  }
  return null;
}

function fromMetaModified(html) {
  const SELECTORS = [
    /property=["']article:modified_time["'][^>]+content=["']([^"']+)/i,
    /content=["']([^"']+)["'][^>]+property=["']article:modified_time["']/i,
    /property=["']og:updated_time["'][^>]+content=["']([^"']+)/i,
    /name=["']timestamp["'][^>]+content=["']([^"']+)/i,
  ];
  for (const re of SELECTORS) {
    const m = html.match(re);
    if (!m) continue;
    const r = parseAnyDate(m[1]);
    if (r) return { date: r.date, confidence: 'low', source: `meta_mod(${r.method})`, dateType: 'modified' };
  }
  return null;
}

function fromTimeTag(html) {
  // All <time datetime="..."> tags, take first valid
  const re = /<time[^>]+datetime=["']([^"']+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const r = parseAnyDate(m[1]);
    if (r) return { date: r.date, confidence: 'med', source: `time_tag(${r.method})`, dateType: 'published' };
  }
  return null;
}

function fromUrl(url) {
  const u = String(url || '');
  // First try ISO-like path segment: /2024/03/15/ or -2024-03-15-
  const pathIso = u.match(/[/-_](20\d{2})[/-_.]([01]\d)[/-_.]([0-3]\d)(?:[/-_.]|$)/);
  if (pathIso) {
    const d = makeDate(pathIso[1], pathIso[2], pathIso[3]);
    if (d) return { date: d, confidence: 'low', source: 'url(path_iso)', dateType: 'published' };
  }
  // Fallback: try full parseAnyDate on URL string
  const r = parseAnyDate(u);
  if (r) return { date: r.date, confidence: 'low', source: `url(${r.method})`, dateType: 'published' };
  return null;
}

// Extract date-bearing "byline zone": first N chars where publish dates appear
// (headline, author block, article header — not footer, sidebar, copyright)
function extractBylineZone(html) {
  const full = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  // Primary: first 4000 chars (article headers, bylines)
  // Secondary: search for date-label keyword and grab ±200 char window
  const zones = [full.slice(0, 4000)];
  // Find label positions anywhere in text and extract 200-char windows
  const LABEL_RE = /(?:Objavljeno|Datum(?:\s+objave)?|Published|Posted|Ver\u00f6ffentlicht|Stand|Erschienen|Publi\u00e9|Pubblicato|Publicado|\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043e)/gi;
  let lm;
  while ((lm = LABEL_RE.exec(full)) !== null && zones.length < 6) {
    const start = Math.max(0, lm.index - 10);
    zones.push(full.slice(start, start + 200));
  }
  return zones;
}

function fromBodyText(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 16000);

  const PROXIMITY = 140; // label must be within 140 chars of the date

  // Label definitions: regex to find label, then look for date within PROXIMITY chars
  const LABEL_RE = [
    // HR/BS — published
    { re: /Objavljeno/i,              type: 'published' },
    { re: /Datum\s+objave/i,          type: 'published' },
    { re: /Datum/i,                   type: 'published' },
    // EN — published
    { re: /Published/i,               type: 'published' },
    { re: /Posted/i,                  type: 'published' },
    // DE — published
    { re: /Ver\u00f6ffentlicht/i,      type: 'published' },
    { re: /Veroffentlicht/i,          type: 'published' },
    { re: /\bStand\b/i,               type: 'published' },
    { re: /Erschienen/i,              type: 'published' },
    { re: /Erstellt/i,                type: 'published' },
    // FR — published
    { re: /Publi\u00e9/i,             type: 'published' },
    { re: /Date\s+de\s+publication/i, type: 'published' },
    // IT — published
    { re: /Pubblicato/i,              type: 'published' },
    // ES — published
    { re: /Publicado/i,               type: 'published' },
    // RU — published
    { re: /\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043e/i, type: 'published' },
    { re: /\u0414\u0430\u0442\u0430\s+\u043f\u0443\u0431\u043b\u0438\u043a\u0430\u0446\u0438\u0438/i, type: 'published' },
    // Modified labels
    { re: /Aktualisiert/i,            type: 'modified' },
    { re: /Zuletzt\s+(?:aktualisiert|ge.ndert)/i, type: 'modified' },
    { re: /Last\s+updated?/i,         type: 'modified' },
    { re: /\bUpdated?\b/i,            type: 'modified' },
    { re: /Mis\s+\u00e0\s+jour/i,     type: 'modified' },
    { re: /Aggiornato/i,              type: 'modified' },
    { re: /Actualizado/i,             type: 'modified' },
    { re: /\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e/i, type: 'modified' },
  ];

  for (const { re, type } of LABEL_RE) {
    const lm = re.exec(text);
    if (!lm) continue;
    // Proximity window: from label start to label end + PROXIMITY
    const windowStart = lm.index;
    const windowEnd   = Math.min(text.length, lm.index + lm[0].length + PROXIMITY);
    const afterLabel  = text.slice(lm.index + lm[0].length, windowEnd).trim().slice(0, 60);
    const r = parseAnyDate(afterLabel);
    if (!r) continue;
    const conf = type === 'published' ? 'med' : 'low';
    return { date: r.date, confidence: conf, source: `body_${type}(${r.method})`, dateType: type };
  }

  // Generic month-name scan in first 8k chars (no label, low confidence)
  const r = parseMonthName(text.slice(0, 8000));
  if (r) return { date: r, confidence: 'low', source: 'body_month', dateType: 'published' };

  return null;
}

// ─── FRESHNESS SCORE ──────────────────────────────────────────────────────────
function freshnessScore(publishedAtMs, dateType = 'published', domainClass = 'general') {
  if (!publishedAtMs) return 0.5;
  const days = (Date.now() - publishedAtMs) / 86400000;
  let s;
  if (days <= 30)  s = 0.0;
  else if (days <= 180) s = 0.3;
  else if (days <= 730) s = 0.6;
  else s = 1.0;
  // modified date = less reliable for content age
  if (dateType === 'modified' || dateType === 'wiki_modified') {
    s = Math.min(s + 0.2, 1.0);
    // Non-authoritative modified (wiki/general) = extra penalty
    // because CDN/template "today" dates pollute here most
    if (domainClass === 'wiki' || domainClass === 'general') {
      s = Math.min(s + 0.15, 1.0);
    }
  }
  return s;
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
// Domain classification
const WIKI_DOMAINS    = /\b(wikipedia|wikimedia|wikidata|fandom\.com|wikia\.com)\b/i;
const ARCHIVE_DOMAINS = /\b(web\.archive\.org|archive\.org|waybackmachine)\b/i;
// GOV detection uses same config as trustScoring (single source of truth)
const _officialCfg = require('../config/officialDomains');
function _isGovDomain(url) {
  const d = String(url || '').toLowerCase();
  const cfg = _officialCfg;
  if (cfg.govTldPatterns.some(re => re.test(d))) return true;
  if (cfg.exact.some(e => d.includes(e)))         return true;
  if (cfg.prefixes.some(p => {
    // Extract hostname from URL for prefix matching
    const host = d.replace(/^https?:\/\//, '').split('/')[0];
    return host.startsWith(p) || host.includes('.' + p);
  })) return true;
  if (cfg.suffixes.some(s => d.includes(s))) return true;
  return false;
}

function classifyDomain(url) {
  const u = String(url || '');
  if (WIKI_DOMAINS.test(u))    return 'wiki';
  if (ARCHIVE_DOMAINS.test(u)) return 'archive';
  if (_isGovDomain(u))         return 'gov';
  return 'general';
}

// Domain date reliability rules
// For encyclopedic/wiki sites: article date ≠ fact recency
// Returns 'unreliable' | 'standard' | 'authoritative'
function getDomainDateReliability(url) {
  const u = String(url || '').toLowerCase();
  const WIKI_LIKE = [
    'wikipedia.org', 'wikimedia.org', 'wikidata.org',
    'britannica.com', 'enciklopedija.hr', 'enciklopedija.ba',
    'fandom.com', 'wikia.com', 'wiki.', 'mediawiki',
  ];
  const AUTHORITATIVE = [
    '.gov.', '.gov/', '.hr/vlada', 'vlada-', '.ba/vlada', '.hr/sabor',
    '.ba/sabor', 'parlament.', 'predsjednistvo.', 'mfa.', 'mvp.',
    'kanton.', 'opcina.', 'grad.', 'mup.',
  ];
  for (const p of WIKI_LIKE)       if (u.includes(p)) return 'unreliable';
  for (const p of AUTHORITATIVE)   if (u.includes(p)) return 'authoritative';
  return 'standard';
}

function extractPublishDate({ url = '', html = '', httpHeaders = {} }) {
  const h = String(html || '');
  const u = String(url || '');
  const domainRel = getDomainDateReliability(u);

  // Published-first chain
  const published =
    fromJsonLdPublished(h) ||
    fromMetaPublished(h)   ||
    fromTimeTag(h)         ||
    fromUrl(u)             ||
    fromBodyText(h);

  // Modified fallbacks (only if no published date found)
  const modified = !published
    ? (fromJsonLdModified(h) || fromMetaModified(h))
    : null;

  // HTTP Last-Modified — always modified, always low
  const httpFallback = (!published && !modified)
    ? (() => {
        const lm = httpHeaders['last-modified'] || httpHeaders['Last-Modified'];
        const r = parseAnyDate(String(lm || ''));
        return r ? { date: r.date, confidence: 'low', source: 'http_last_modified', dateType: 'modified' } : null;
      })()
    : null;

  const result = published || modified || httpFallback;

  if (!result) {
    return { publishedAtMs: null, publishedAtIso: null, freshnessScore: 0.5, confidence: 'none', dateType: 'unknown', source: 'none', domain: 'general' };
  }

  const ms = result.date.getTime();
  const domainClass = classifyDomain(u);

  // Domain-specific overrides
  let { confidence, dateType } = result;
  if (domainClass === 'wiki') {
    // Wikipedia dates are "last edited", not "fact as of date" for office holders
    // → confidence always 'low', mark as wiki_modified for trustScoring extra penalty
    confidence = 'low';
    dateType   = 'wiki_modified';
  } else if (domainClass === 'archive') {
    // Archive.org dates = crawl date, not article date
    confidence = 'low';
    dateType   = 'modified';
  } else if (domainClass === 'gov') {
    // Government domains: official source, boost confidence if published
    if (dateType === 'published' && confidence === 'med') confidence = 'high';
  } else if (dateType === 'modified' || dateType === 'wiki_modified') {
    // General domain + modified date = often CDN/rebuild timestamp, not article publish
    // Downgrade: high→med, med→low (low stays low)
    if      (confidence === 'high') confidence = 'med';
    else if (confidence === 'med')  confidence = 'low';
  }

  return {
    publishedAtMs:  ms,
    publishedAtIso: result.date.toISOString().slice(0, 10),
    freshnessScore: freshnessScore(ms, dateType, domainClass),
    confidence,
    dateType,
    source:         result.source,
    domain:         domainClass,  // 'wiki' | 'archive' | 'gov' | 'general'
  };
}

function publishedAgeLabel(publishedAtIso) {
  if (!publishedAtIso) return 'unknown date';
  const days = (Date.now() - Date.parse(publishedAtIso)) / 86400000;
  if (days < 1)   return 'today';
  if (days < 7)   return `${Math.round(days)}d ago`;
  if (days < 60)  return `${Math.round(days / 7)}w ago`;
  if (days < 730) return `${Math.round(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

// Export parseAnyDate for testing / reuse
module.exports = { extractPublishDate, publishedAgeLabel, freshnessScore, parseAnyDate };
