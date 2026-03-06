'use strict';

/**
 * Accuracy guard for GPTNiX.
 *
 * Goal: reduce hallucinations by:
 *  - detecting high-risk factual queries
 *  - forcing extra grounding tools (wiki/wikidata/osm/web) when available
 *  - running a second "verify + rewrite" pass that removes unsupported claims
 *
 * IMPORTANT: This module never performs network calls itself.
 * It only provides heuristics, source indexing, and verifier prompt construction.
 */

function _norm(s) {
  return String(s || '').trim();
}

/**
 * 🔥 V5.1.1 - Small talk detection (TIER 0 check)
 * 
 * Detects casual conversation that should NOT trigger wiki/web search or accuracy guard.
 * 
 * WHY: Small talk queries like "kako si, šta radiš danas?" were triggering high-risk
 * accuracy guard because of "danas" keyword, causing unnecessary wiki/web searches.
 * 
 * STRATEGY: Conservative detection - only clear small talk patterns.
 * Better to miss some small talk (false negative) than block factual queries (false positive).
 * 
 * @param {string} text - Normalized lowercase text
 * @returns {boolean}
 */
function isSmallTalk(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 3) return false;

  // 1) Single-word affirmations/greetings (already handled by router, but for safety)
  if (/^(hi|hello|hey|yo|sup|hej|bok|zdravo|pozdrav|hvala|fala|ok|okay|da|ne|yes|no|bye|ciao|cao)$/i.test(t)) {
    return true;
  }

  // 2) Clear small talk patterns (multi-phrase casual chat)
  const smallTalkPatterns = [
    // "Kako si" family
    /\b(kako\s+si|kako\s+ti\s+je|kako\s+ide|kako\s+ste)\b/i,
    
    // "Šta radiš" family
    /\b(sta\s+radis|sto\s+radis|sta\s+radi[sš]|sto\s+radi[sš]|what\s+are\s+you\s+doing|whatcha\s+doing)\b/i,
    
    // "Je li sve ok" family
    /\b(je\s+li\s+(sve\s+)?(ok|u\s+redu)|jesi\s+(li\s+)?(dobro|ok)|sve\s+(ok|u\s+redu))\b/i,
    /\b(are\s+you\s+(ok|okay|alright|fine)|everything\s+(ok|okay|good|alright))\b/i,
    
    // "Šta ima" family
    /\b(sta\s+ima(\s+novo)?|sto\s+ima(\s+novo)?|ima\s+li\s+sta\s+novo)\b/i,
    /\b(what('?s| is)\s+up|what('?s| is)\s+new|how('?s| is)\s+it\s+going)\b/i,
    
    // Simple sentiment/state
    /\b(dobro|lose|loshe|lo[sš]e|super|odli[cč]no|fino|umoran|umorna|dosadno)\s*[.?!]*$/i,
  ];

  for (const pattern of smallTalkPatterns) {
    if (pattern.test(t)) {
      // ⚠️ GUARD: Check for factual indicators that override small talk detection
      // Example: "kako ide posao danas?" has "posao" (work) → NOT small talk
      const factualOverride = [
        /\b(posao|work|job|projekt|project|zadatak|task)\b/i,
        /\b(radno\s+vrijeme|working\s+hours|cijena|price|kontakt|contact)\b/i,
        /\b(na[cč]elnik|mayor|ministar|minister|direktor|director|predsjednik|president)\b/i,
        /\b(tko\s+je|ko\s+je|[sš]to\s+je|sta\s+je|gdje\s+je|kada\s+je)\b/i,
      ];
      
      const hasFactual = factualOverride.some(p => p.test(t));
      if (!hasFactual) {
        return true; // Clear small talk without factual override
      }
    }
  }

  // 3) Very short queries with question mark but no factual intent
  // Example: "kako?" or "dobro?" are small talk follow-ups
  if (t.length < 30 && /\?$/.test(t)) {
    const words = t.split(/\s+/);
    if (words.length <= 3) {
      const factualWords = /\b(tko|ko|[sš]to|sta|gdje|kada|koliko|za[sš]to|why|who|what|where|when|how\s+many)\b/i;
      const hasFactualWord = factualWords.test(t);
      const hasOnlyCasual = /^(kako|dobro|super|ok|sve|ti|te|you)\s*\??$/i.test(t);
      
      if (hasOnlyCasual && !hasFactualWord) {
        return true;
      }
    }
  }

  return false;
}

function assessRisk(message) {
  const text = _norm(message).toLowerCase();
  if (!text) {
    return { level: 'low', reasons: [] };
  }

  // 🔥 V5.1.1 FIX: Check for small talk FIRST (TIER 0)
  // Small talk should NEVER trigger accuracy guard or tool searches
  if (isSmallTalk(text)) {
    return { level: 'low', reasons: ['smalltalk'] };
  }

  const reasons = [];

  // 1) High-risk / volatile: anything time-sensitive, prices, schedules, legal/medical/finance, etc.
  // 🔥 V5.1.1 FIX: Time markers (danas/sutra/jučer) now require TARGET WORDS
  // 
  // WHY: "danas" alone in casual chat ("kako si danas?") was causing false positives.
  // NOW: We require time marker + target word combination:
  //   ✓ "radno vrijeme danas" → volatile=true (CORRECT)
  //   ✓ "cijena danas" → volatile=true (CORRECT)
  //   ✗ "kako si danas?" → volatile=false (FIX - this is small talk)
  //
  // Target words: radno vrijeme, otvoreno, zatvoreno, raspored, termin, cijena, akcija, 
  //               ponuda, dostupnost, najnovije, vijesti, prognoza, utakmica, tečaj
  const targetWords = /(radno\s+vrijeme|otvoreno|zatvoreno|raspored|program|termin|ulaznice|karte|cijena|cijene|akciz|trošarin|trosarin|porez|kazn|zakon|propisi|ponuda|akcija|popust|dostupnost|na\s+stanje|najnovije|vijesti|news|prognoz|utakmic|te[cč]aj)/i;
  const timeMarkers = /(danas|sutra|ju[cč]er|jucer|ovaj\s+tjedan|ovog\s+tjedna|ove\s+sedmice|this\s+week)/i;
  
  // Check: target + time marker (either order)
  const volatileTimeCombo = (targetWords.test(text) && timeMarkers.test(text));
  
  // Other volatile indicators (don't require time markers)
  const volatileAlways = /(akci[jz]|trošarin|trosarin|porez|kazn|zakon|propisi)/i.test(text);
  
  const volatile = volatileTimeCombo || volatileAlways;
  
  if (volatile) reasons.push('volatile/local');

  const medicalFinanceLegal =
    /(lijek|doza|simptom|bolest|terapij|interakcij|trudnoć|trudnoc|dijagnoz|kredit|kamata|rate\b|ulaganj|porez|zakon|ugovor|tužb|tuzb|kazna|odvjetnik|računovod|racunovod)/i.test(
      text,
    );
  if (medicalFinanceLegal) reasons.push('medical/finance/legal');

  // 2) Exact numbers/dates requests
  const numbers =
    /(stanovništvo|stanovnistvo|popis|demograf|broj\s+stanovnika|koliko\s+stanovnika|postotak|\b\d{3,}\b|\b19\d{2}\b|\b20\d{2}\b|koordinate|nadmorska|površina|povrsina|km\b|kilomet|metara|\bm\b|\b\d{1,3}\s*(%|posto)\b)/i.test(
      text,
    );
  if (numbers) reasons.push('exact numbers/dates');

  // 3) Encyclopedic / stable knowledge requests (cities, history, geography, biographies, definitions)
  // IMPORTANT: avoid false positives from substrings (e.g., "Tomislavgrad" contains "grad").
  const encyclopedic =
    /\b(napiši|napisi|opiši|opisi|objasni|sažmi|sazmi|tko\s+je|što\s+je|sta\s+je|povijest|historij|geografij|znamenitosti|biografij|enciklopedij|informacije\s+o|sve\s+o)\b/i.test(
      text,
    ) ||
    /\b(grad|općina|opcina|županij|zupanij|kanton|država|drzava)\b/i.test(text);

  if (encyclopedic) reasons.push('encyclopedic');

  // 4) Very short entity-only messages (often place/person/product) are risky.
  const shortEntity = text.length <= 40 && !/\s{2,}/.test(text) && /^[\p{L}0-9 .,'"-]+$/u.test(text);
  if (shortEntity) reasons.push('short entity');

  let level = 'low';
  if (medicalFinanceLegal) level = 'high';
  else if (volatile) level = 'high';
  else if (numbers && encyclopedic) level = 'high';
  else if (numbers || encyclopedic || shortEntity) level = 'medium';

  return { level, reasons };
}

function shouldForceGrounding(risk) {
  const lvl = (risk && risk.level) || 'low';
  return lvl === 'high' || lvl === 'medium';
}

function _pickSnippet(s, max = 220) {
  const t = _norm(s).replace(/\s+/g, ' ');
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

function buildSourcesIndex({ wikiSources = [], webResults = null, extraSources = [] } = {}) {
  const out = [];

  // Wiki sources (already structured)
  if (Array.isArray(wikiSources)) {
    for (const s of wikiSources) {
      const title = _norm(s.title || s.resolvedTitle || s.name || 'Wiki');
      const url = _norm(s.url || s.link || s.pageUrl || '');
      const snippet = _pickSnippet(s.snippet || s.extract || s.summary || '');
      if (!url && !snippet) continue;
      out.push({ kind: 'wiki', title, url, snippet });
    }
  }

  // Web results (merged includes direct url reads first)
  const results = Array.isArray(webResults?.results) ? webResults.results : [];
  for (const r of results) {
    const title = _norm(r.title || r.name || '');
    const url = _norm(r.url || r.link || '');
    const snippet = _pickSnippet(r.snippet || r.content || r.raw_content || '');
    if (!url && !snippet) continue;
    out.push({ kind: 'web', title, url, snippet });
  }

  // Extra (e.g. tool outputs that have a url)
  if (Array.isArray(extraSources)) {
    for (const s of extraSources) {
      const title = _norm(s.title || s.name || s.kind || 'Source');
      const url = _norm(s.url || s.link || '');
      const snippet = _pickSnippet(s.snippet || s.text || '');
      if (!url && !snippet) continue;
      out.push({ kind: _norm(s.kind) || 'tool', title, url, snippet });
    }
  }

  // De-dupe by url+title
  const seen = new Set();
  const deduped = [];
  for (const s of out) {
    const key = `${s.url}::${s.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  // Keep it tight. Prefer wiki first for stable facts, then web.
  const wiki = deduped.filter((x) => x.kind === 'wiki');
  const web = deduped.filter((x) => x.kind !== 'wiki');
  const limited = [...wiki.slice(0, 4), ...web.slice(0, 6)];

  return limited.map((s, idx) => ({ n: idx + 1, ...s }));
}

function makeSourcesBlock(indexedSources = []) {
  if (!Array.isArray(indexedSources) || indexedSources.length === 0) return '';
  const lines = [];
  lines.push('SOURCES INDEX (use ONLY for citations like [1], [2])');
  for (const s of indexedSources) {
    const head = `[${s.n}] ${s.title || s.kind || 'Source'}`;
    const url = s.url ? ` — ${s.url}` : '';
    lines.push(head + url);
    if (s.snippet) lines.push(`    ${_pickSnippet(s.snippet, 260)}`);
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────
// Citation validation + enforcement helpers
// ─────────────────────────────────────────

function _extractBracketCitations(text) {
  const t = String(text || '');
  const ids = [];
  const re = /\[(\d+)\]/g;
  let m;
  while ((m = re.exec(t))) {
    ids.push(String(m[1]));
  }
  // unique, preserve order
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function validateCitationsAgainstSources(text, indexedSources = []) {
  const cites = _extractBracketCitations(text);
  const allowed = new Set(
    (Array.isArray(indexedSources) ? indexedSources : []).map((s) => String(s?.n)).filter(Boolean),
  );
  const unknown = cites.filter((id) => !allowed.has(id));
  return {
    cites,
    unknown,
    ok: unknown.length === 0,
    hasAny: cites.length > 0,
  };
}

function defaultInsufficientEvidenceMessage(languageHint = '') {
  const lang = String(languageHint || '').toLowerCase();
  // Keep it short and practical; do NOT claim web search happened.
  if (lang.startsWith('hr') || lang.startsWith('bs') || lang.startsWith('sr')) {
    return 'Nemam dovoljno pouzdanih izvora u dostupnom kontekstu da ovo tvrdim. Ako želiš, pošalji link/dokument ili formuliraj upit preciznije pa ću odgovoriti uz citate.';
  }
  return "I don't have enough reliable sources in the available context to state this confidently. If you want, share a link/document or refine the question and I can answer with citations.";
}

function stripFollowupQuestions(text) {
  const t = _norm(text);
  if (!t) return '';

  // Remove trailing question blocks (last 1-3 lines) if they are questions.
  const lines = t.split(/\r?\n/);
  let i = lines.length - 1;
  while (i >= 0) {
    const line = lines[i].trim();
    if (!line) {
      i--;
      continue;
    }
    if (/[?？]\s*$/.test(line) || /^\s*(želiš|želite|hoćeš|hoćete|možeš|možete)\b/i.test(line)) {
      lines.pop();
      i = lines.length - 1;
      continue;
    }
    break;
  }
  return lines.join('\n').trim();
}

function postProcessFinalAnswer(text) {
  let out = _norm(text);
  if (!out) return '';

  // Drop common "analysis/assessment" headers from earlier drafts.
  out = out.replace(/^\*\*\s*procjena\s*:\s*\*\*/i, '').trim();
  out = out.replace(/^\s*procjena\s*:\s*/i, '').trim();
  out = out.replace(/^\*\*\s*odgovor\s*:\s*\*\*/i, '').trim();
  out = out.replace(/^\s*odgovor\s*:\s*/i, '').trim();

  out = stripFollowupQuestions(out);
  return out;
}

function _truncateBlockText(input, maxChars = 1800) {
  const t = String(input || '').trim();
  if (!t) return '';
  return t.length > maxChars ? t.slice(0, maxChars - 1) + '…' : t;
}

// Verifier benefit: give it a short view of the grounded context that produced the draft.
// Keep it small to avoid drowning the verifier in noise.
function _summarizeVerifierContextBlocks(blocks, maxChars = 1400) {
  const arr = Array.isArray(blocks) ? blocks : [];
  if (!arr.length) return '';

  const lines = [];
  for (let i = 0; i < Math.min(arr.length, 4); i++) {
    const raw = String(arr[i] || '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    lines.push(`- ${_truncateBlockText(raw, 360)}`);
    if (lines.join('\n').length >= maxChars) break;
  }
  let out = lines.join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars - 1) + '…';
  return out;
}

function buildVerifierMessages({ userMessage, draftAnswer, sourcesBlock = '', languageHint = '', toolBlocks = [] } = {}) {
  const toolCtx = _summarizeVerifierContextBlocks(toolBlocks, 1400);
  const sys =
    'You are an accuracy auditor. Rewrite the assistant draft to be maximally correct and non-hallucinated.\n' +
    'Rules (strict):\n' +
    '- DO NOT ask the user any questions.\n' +
    '- Do NOT add new facts. Remove any claim not directly supported by the provided context.\n' +
    '- If a requested detail is not supported, state a short limitation (e.g., "Ne mogu potvrditi iz dostupnog konteksta.") and move on.\n' +
    '- Do NOT mention tools, web search, browsing, or research.\n' +
    '- Keep the answer concise and practical.\n' +
    '- Language: match the user\'s language (hint: ' + (languageHint || 'auto') + ').\n' +
    (toolCtx ? '\nTRUSTED CONTEXT SNIPPETS (for grounding; do not mention as tools):\n' + toolCtx + '\n' : '') +
    (sourcesBlock ? '\n' + sourcesBlock + '\n\nCitation rule: only use [n] when that claim is supported by that source. No fake citations.\n' : '');

  const user =
    'USER QUESTION:\n' +
    _norm(userMessage) +
    '\n\nASSISTANT DRAFT (to audit):\n' +
    _norm(draftAnswer);

  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

/**
 * Extract structured facts from tool blocks (data minimization for copilot/verifier)
 * 
 * Instead of sending raw tool output (which may contain PII, tokens, internal URLs),
 * we extract only neutral, structured facts.
 * 
 * @param {Array<string>} toolBlocks - raw tool output blocks
 * @returns {string} - compact, sanitized facts string
 */
function extractStructuredFacts(toolBlocks = []) {
  // Produce a minimal, privacy-preserving context for the copilot/verifier.
  // NOTE: This is intentionally lossy; do NOT use it for primary answering.
  const maxBlocks = 4;
  const maxCharsPer = 360;

  const sanitize = (s) => {
    let out = String(s || '');
    // redact obvious sensitive patterns
    out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]');
    out = out.replace(/https?:\/\/[^\s)]+/gi, '[URL]');
    out = out.replace(/\b(sk-[A-Za-z0-9_-]{10,})\b/g, '[KEY]');
    out = out.replace(/\b(ghp_[A-Za-z0-9]{20,})\b/g, '[KEY]');
    // long IDs/tokens
    out = out.replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[ID]');
    // phone-ish
    out = out.replace(/\+?\d[\d\s().-]{8,}\d/g, '[PHONE]');
    // long digit sequences (order numbers, etc.)
    out = out.replace(/\b\d{7,}\b/g, '[NUM]');
    // collapse whitespace
    out = out.replace(/\s+/g, ' ').trim();
    return out;
  };

  const facts = [];
  for (const b of toolBlocks.slice(0, maxBlocks)) {
    const s = sanitize(b);
    if (!s) continue;
    facts.push(s.length > maxCharsPer ? s.slice(0, maxCharsPer) + '…' : s);
  }
  return facts.join('\n').slice(0, 1200);
}

function sanitizeToolBlocksForExternal(toolBlocks = [], opts = {}) {
  const maxBlocks = Number(opts.maxBlocks || 4);
  const maxChars = Number(opts.maxChars || 1400);

  const sanitize = (s) => {
    let out = String(s || '');
    out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]');
    out = out.replace(/https?:\/\/[^\s)]+/gi, '[URL]');
    out = out.replace(/\b(sk-[A-Za-z0-9_-]{10,})\b/g, '[KEY]');
    out = out.replace(/\b(ghp_[A-Za-z0-9]{20,})\b/g, '[KEY]');
    out = out.replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[ID]');
    out = out.replace(/\+?\d[\d\s().-]{8,}\d/g, '[PHONE]');
    out = out.replace(/\b\d{7,}\b/g, '[NUM]');
    out = out.replace(/\s+/g, ' ').trim();
    return out;
  };

  const out = [];
  for (const b of toolBlocks.slice(0, maxBlocks)) {
    const s = sanitize(b);
    if (!s) continue;
    out.push(s.length > maxChars ? s.slice(0, maxChars) + '…' : s);
  }
  return out;
}

module.exports = {
  assessRisk,
  shouldForceGrounding,
  buildSourcesIndex,
  makeSourcesBlock,
  validateCitationsAgainstSources,
  defaultInsufficientEvidenceMessage,
  buildVerifierMessages,
  postProcessFinalAnswer,
  stripFollowupQuestions,
  extractStructuredFacts,
  sanitizeToolBlocksForExternal,
  isSmallTalk, // 🔥 V5.1.1: Export for use in chat.js
};
