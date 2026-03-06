'use strict';

const { WEB_QUERY_REWRITE_ENABLED, WEB_QUERY_REWRITE_MODEL } = require('../config/env');
const { callDeepSeek } = require('./providers/deepseek');

function _clean(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _tokenize(s) {
  const t = _clean(s);
  if (!t) return [];
  return t.split(' ').filter(Boolean);
}

function _looksLikeObituaryIntent(text) {
  const t = (text || '').toLowerCase();
  return (
    t.includes('osmrtn') ||
    t.includes('smrt') ||
    t.includes('pok.') ||
    t.includes('pok ') ||
    t.includes('premin') ||
    t.includes('sahran') ||
    t.includes('pogreb') ||
    t.includes('posljednji ispra') ||
    t.includes('ispraćaj')
  );
}

function _extractLikelyNameAndPlace(text) {
  const raw = String(text || '');
  const nicknameMatch = raw.match(/nadimak\s+([\p{L}0-9"'\-]+)|\(([^)]+)\)/iu);
  const nickname = nicknameMatch ? _clean(nicknameMatch[1] || nicknameMatch[2] || '') : '';

  // crude place extraction: "u <Place>" or "iz <Place>"
  const placeMatch = raw.match(/\b(?:u|iz)\s+([A-ZČĆĐŠŽ][\p{L}\-]+(?:\s+[A-ZČĆĐŠŽ][\p{L}\-]+)*)/u);
  const place = placeMatch ? _clean(placeMatch[1]) : '';

  // name: collect capitalized tokens, excluding common sentence starters
  const tokens = raw
    .replace(/[“”"']/g, '')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const stop = new Set([
    'Bio',
    'Danas',
    'Jučer',
    'Jucer',
    'U',
    'Iz',
    'Na',
    'Za',
    'Sahrani',
    'Sahrana',
    'Pogreb',
    'Osmrtnica',
    'Osmrtnice',
    'Pok',
    'Pok.',
  ]);

  const caps = [];
  for (const tok of tokens) {
    const cleanTok = tok.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    if (!cleanTok) continue;
    if (stop.has(cleanTok)) continue;
    if (/^[A-ZČĆĐŠŽ][\p{L}\-]{1,}$/u.test(cleanTok)) caps.push(cleanTok);
  }

  // Heuristic: first 2-3 capitalized tokens are usually name/surname.
  const name = _clean(caps.slice(0, 3).join(' '));

  return { name, nickname, place };
}

function _buildObituaryQuery(userText) {
  const { name, nickname, place } = _extractLikelyNameAndPlace(userText);
  const siteHint = (userText || '').toLowerCase().includes('slobodna') ? 'Slobodna Dalmacija osmrtnice' : '';

  const parts = [];
  if (name) parts.push(name);
  if (nickname) parts.push(`"${nickname}"`);
  if (place) parts.push(place);
  parts.push('osmrtnica');
  if (siteHint) parts.push(siteHint);

  return _clean(parts.join(' '));
}


function _asciiVariant(q) {
  const map = { 'č':'c','ć':'c','đ':'d','š':'s','ž':'z','Č':'C','Ć':'C','Đ':'D','Š':'S','Ž':'Z' };
  return String(q || '').split('').map((c) => map[c] || c).join('');
}

async function _llmEnglishRewriteIfHelpful({ baseQuery, userMessage }) {
  if (!WEB_QUERY_REWRITE_ENABLED) return null;

  const q = _clean(baseQuery);
  const um = _clean(userMessage);
  // Only do this when the query looks local (BHS letters or common local question words)
  const looksLocal = /[čćđšž]/i.test(q) || /\b(tko\s+je|ko\s+je|što\s+je|sta\s+je|kada\s+je|gdje\s+je)\b/i.test(um);
  if (!looksLocal) return null;

  const sys =
    'You are a web search query rewriter. Output ONLY ONE English Google search query line. ' +
    'No explanations. Keep it under 12 words. Keep names as-is.';

  const user =
    'Rewrite into English query for better recall.\n' +
    'User message: ' + um + '\n' +
    'Base query: ' + q;

  try {
    const out = await callDeepSeek({
      model: WEB_QUERY_REWRITE_MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ],
      temperature: 0.2,
      max_tokens: 48,
      stream: false
    });

    const text = _clean(out?.text || out?.content || out);
    if (!text) return null;
    // Avoid returning the same thing
    if (text.toLowerCase() === q.toLowerCase()) return null;
    return text;
  } catch {
    return null;
  }
}

function _isLowContext(q) {
  const t = _clean(q);
  if (!t) return true;
  const toks = _tokenize(t);
  if (toks.length < 3) return true;
  if (/^\d+(x\d+)?$/i.test(t)) return true;
  if (/^(ok|okej|da|ne|znači|znaci|dakle|ajde|a|i|ali)$/i.test(t)) return true;
  return false;
}

async function _llmRewriteIfNeeded({ baseQuery, userMessage, hint }) {
  if (!WEB_QUERY_REWRITE_ENABLED) return baseQuery;
  const short = _isLowContext(baseQuery) || _looksLikeObituaryIntent(userMessage);
  if (!short) return baseQuery;

  const sys =
    'You are a query rewriting engine. Output ONLY ONE web search query line. ' +
    'No explanations, no quotes unless quoting a nickname, no markdown. ' +
    'Keep it under 14 words. Include key entities (name/place) and intent keywords.';

  const prompt =
    `User intent: ${hint || 'general'}\n` +
    `User message: ${_clean(userMessage)}\n` +
    `Current query: ${_clean(baseQuery)}\n` +
    'Rewrite the query for high-precision retrieval. Use Croatian keywords when relevant (e.g., osmrtnica, preminuo, posljednji ispraćaj).';

  try {
    const out = await callDeepSeek(
      {
        model: WEB_QUERY_REWRITE_MODEL,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: prompt },
        ],
      },
      0.0,
      120,
    );

    const text = _clean(out?.text || out?.answer || out?.content || out);
    if (!text) return baseQuery;
    // Strip accidental quoting and multi-lines
    const oneLine = _clean(text.split('\n')[0]);
    // Avoid overly generic rewrites
    if (_isLowContext(oneLine)) return baseQuery;
    return oneLine;
  } catch (_) {
    return baseQuery;
  }
}

/**
 * Plan a better web search query given the user message and the router/base query.
 * Returns { query, reason }
 */
async function planWebQuery({ userMessage, baseQuery }) {
  const um = _clean(userMessage);
  const bq = _clean(baseQuery);

  // Special intent: obituaries / funerals.
  if (_looksLikeObituaryIntent(um)) {
    const heuristic = _buildObituaryQuery(um);
    const rewritten = await _llmRewriteIfNeeded({ baseQuery: heuristic || bq, userMessage: um, hint: 'obituary' });
    return { query: rewritten || heuristic || bq, reason: 'obituary_intent' };
  }

  // If query is too generic, try an LLM rewrite using the full user message.
  const rewritten = await _llmRewriteIfNeeded({ baseQuery: bq, userMessage: um, hint: 'general' });
  
  const primary = _clean(rewritten || bq);
  const queries = [];
  if (primary) queries.push(primary);

  // add original as fallback
  if (_clean(bq) && _clean(bq).toLowerCase() !== primary.toLowerCase()) queries.push(_clean(bq));

  // add ASCII variant (helps when user types without diacritics / or the opposite)
  const ascii = _clean(_asciiVariant(primary));
  if (ascii && ascii.toLowerCase() !== primary.toLowerCase()) queries.push(ascii);

  // optional English variant for broader recall
  const en = await _llmEnglishRewriteIfHelpful({ baseQuery: primary, userMessage: um });
  if (en && en.toLowerCase() !== primary.toLowerCase()) queries.push(_clean(en));

  return {
    query: primary,
    queries,
    reason: rewritten && rewritten !== bq ? 'llm_rewrite' : 'as_is'
  };

}

module.exports = { planWebQuery };
