'use strict';

/**
 * chatHelpers — shared helper functions extracted from chat.js
 *
 * These were previously defined as local functions inside createChatRouter().
 * Now shared by handler.js and buildPrompt.js.
 */

/**
 * Extract 4-digit years (2000–2100) from a string.
 * @param {string} s
 * @returns {Set<number>}
 */
function _extractYears(s) {
  const text = String(s || '');
  const years = new Set();
  const re = /\b(20\d{2})\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const y = Number(m[1]);
    if (y >= 2000 && y <= 2100) years.add(y);
  }
  return years;
}

/**
 * Extract lines from text that contain both a place name and a time pattern,
 * plus surrounding lines for context.
 *
 * @param {string} text
 * @param {{ place?: string, around?: number, maxLines?: number }} opts
 * @returns {string[]}
 */
function _extractLinesWithPlaceAndTime(text, {
  place = '',
  around = 2,
  maxLines = 8,
} = {}) {
  const t = String(text || '');
  const p = String(place || '').trim();
  if (!t || !p) return [];

  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const reTime = /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s*(?:h|sati|sat)\b/i;
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.toLowerCase().includes(p.toLowerCase()) && reTime.test(l)) {
      hits.push(i);
    }
  }
  if (!hits.length) return [];

  const picked = new Set();
  for (const idx of hits.slice(0, 5)) {
    for (let j = Math.max(0, idx - around); j <= Math.min(lines.length - 1, idx + around); j++) {
      picked.add(j);
    }
  }
  return Array.from(picked)
    .sort((a, b) => a - b)
    .map((i) => lines[i])
    .slice(0, maxLines);
}

/**
 * Detect if user message asks for fresh/current info.
 * @param {string} userText
 * @returns {boolean}
 */
function _messageWantsFreshInfo(userText) {
  const t = String(userText || '').toLowerCase();

  if (
    /(danas|jučer|sutra|ovaj tjedan|ovog tjedna|ovaj mjesec|ove godine|ovogodi|najnov|recent|updated|update|breaking|trenutno|trenutni|sadašnji|aktualn|now|this year|today|this week|latest|current|as of)/i.test(t)
  ) {
    return true;
  }

  if (/(202[5-9]|2030)/.test(t)) return true;

  const who = /\b(tko|ko|who)\b/i;
  const office =
    /\b(predsjednik|predsjednica|načelnik|gradonačelnik|premijer|ministar|guverner|senator|zastupnik|župan|predsjedavajući|pope|papa|ceo|direktor|chief executive|prime minister|mayor)\b/i;
  if (who.test(t) && office.test(t)) return true;

  return false;
}

/**
 * Detect queries that likely need a Wikipedia lookup.
 * @param {string} userText
 * @returns {boolean}
 */
function _looksLikeWikiQuery(userText) {
  const t = String(userText || '').trim().toLowerCase();
  if (!t) return false;

  const instantExclusions = [
    /^(hi|hello|hey|yo|sup|hej|bok|zdravo|pozdrav|dobar dan|dobro jutro|dobra večer)$/i,
    /^(kako si|how are you|what's up|whats up)$/i,
    /^(bye|goodbye|see you|see ya|ciao|doviđenja|adio|ćao)$/i,
    /^(ok|okay|thanks|thank you|thx|hvala|fala|super|great|cool|nice)$/i,
    /^(da|yes|yeah|yep|yup|ne|no|nope)$/i,
  ];
  if (instantExclusions.some((pattern) => pattern.test(t))) return false;

  if (t.includes('wikipedia') || t.includes('wiki')) return true;

  if (/^(tko|ko)\s+je\b/.test(t)) return true;
  if (/^(što|sta)\s+je\b/.test(t)) return true;
  if (/^(definicija|biografija|povijest)\b/.test(t)) return true;
  if (/^(who)\s+is\b/.test(t)) return true;
  if (/^(what)\s+is\b/.test(t)) return true;

  const promo = /(akcij|snizen|popust|letak|katalog|ponud|cijen|sale|discount|flyer|promo|deal|facebook|instagram|tiktok|kup|narud)/i;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 4 && !promo.test(t) && !/[{}<>;=]/.test(t)) return true;

  return false;
}

/**
 * Extract wiki query (strip wiki/wikipedia tokens).
 * @param {string} userText
 * @returns {string}
 */
function _extractWikiQuery(userText) {
  let s = String(userText || '').trim();
  if (!s) return '';
  s = s.replace(/\b(wikipedia|wiki|wikipedija|vikipedija)\b/gi, ' ');
  s = s.replace(/\b(na|u|sa|s|iz)\s+(wikipedia|wiki|wikipedija|vikipedija)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Detect explicit web search intent.
 *
 * V5.3: Replaced broad regex with WebSearchGate to stop false positives like
 * "kad daješ izvore, stavi da su klikabilni" triggering web search.
 *
 * @param {string} userText
 * @returns {boolean}
 */
function _explicitlyRequestsWebSearch(userText) {
  const { isExplicitWebSearchRequest } = require('../../utils/webSearchGate');
  return isExplicitWebSearchRequest(userText);
}

/**
 * Check if message is very short (treat as follow-up to previous topic).
 * @param {string} text
 * @returns {boolean}
 */
function isVeryShortUserTurn(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  const tokens = t.split(/\s+/).filter(Boolean);
  return t.length <= 36 || tokens.length <= 6;
}

/**
 * Check if user query looks like a location/geo query.
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeLocationQuery(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  const geoHints = [
    'gdje', 'di je', 'lokacija', 'adresa', 'karta', 'mapa', 'koordinate',
    'najbli', 'blizu', 'u blizini', 'openstreetmap', 'nominatim', 'osm',
  ];
  if (geoHints.some((h) => t.includes(h))) return true;
  if (/\bu\s+[\p{L}]{3,}/u.test(t)) return true;
  if (/,\s*[\p{L}]{3,}/u.test(t)) return true;
  return false;
}

module.exports = {
  _extractYears,
  _extractLinesWithPlaceAndTime,
  _messageWantsFreshInfo,
  _looksLikeWikiQuery,
  _extractWikiQuery,
  _explicitlyRequestsWebSearch,
  isVeryShortUserTurn,
  looksLikeLocationQuery,
};
