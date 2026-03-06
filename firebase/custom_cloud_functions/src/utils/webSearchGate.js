'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              WebSearch Gate — GPTNiX v5.3                   ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Purpose: deterministic 2-level gate that stops unnecessary  ║
 * ║  web searches BEFORE the router and accuracy guard run.      ║
 * ║                                                              ║
 * ║  LEVEL 1 — HARD_BLOCK  (≈ 0 ms, no web search allowed)      ║
 * ║  LEVEL 2 — SOFT_ALLOW  (normal routing continues)           ║
 * ║                                                              ║
 * ║  Logs every decision:                                        ║
 * ║    [WEBGATE] decision=BLOCK reason=FORMAT_REQUEST            ║
 * ║    [WEBGATE] decision=ALLOW reason=FRESHNESS_REQUEST         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
// HARD BLOCK — patterns that NEVER warrant a web search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Patterns for format/style/UI change requests.
 * "kad daješ izvore, stavi da su klikabilni" → FORMAT_REQUEST (block web)
 * "klikabilni linkovi", "napiši s bullet točkama" etc.
 */
const FORMAT_STYLE_PATTERNS = [
  // Format / style directive keywords
  /\b(formati|formatira|formatiranje|formatiraj|format(ting)?|stil\b|style|prepiši|rewrite|prepise|refaktor|refactor)\b/i,

  // Output style: clickable, markdown, bullet points, headers
  /\b(klikabiln|clickable|klikable|markdown|bullet|točk(e|ama)|zaglavlje|header|podeblaj|podebla[j]?|bold|italic|kurziv|podcrtan|underline)\b/i,

  // "stavi da su klikabilni" / "make links clickable" style
  /\b(stavi\s+(da\s+su|ih\s+kao)|neka\s+budu|učini\s+ih|make\s+(them|it|links?)\s+(clickable|bold|italic|bigger|smaller))\b/i,

  // "promijeni stil / format odgovora"
  /\b(promijeni\s+(stil|format|izgled|ton|boju|veličinu)|change\s+(style|format|tone|font|size))\b/i,

  // "dodaj dugme / boje / ikonu / animaciju"
  /\b(dodaj\s+(dugme|button|ikonu|icon|boju|color|animacij|link|emoji))\b/i,

  // UI/UX and code style requests (no fresh data needed)
  /\b(ux|ui\b|design|dizajn|layout|raspored|visual|vizualn)\b/i,
];

/**
 * Patterns for requests about HOW Claude formats its own responses.
 * "kad daješ izvore / kad navediš izvore" → source FORMAT request, not real source request.
 */
const SOURCE_FORMAT_PATTERNS = [
  // "kad daješ izvore" / "when you give sources" — this is a format instruction
  /\b(kad\s+(daješ|navodiš|pišeš|prikazuješ|dodaješ)\s+(izvore|linkove|reference|izvore|citations?))\b/i,
  /\b(when\s+you\s+(give|provide|show|add|write)\s+(sources?|links?|references?|citations?))\b/i,

  // "neka izvori budu klikabilni / neka linkovi budu klikabilni"
  /\b(neka\s+(izvori|linkovi|reference)\s+(budu|su)\s+(klikabilni|linkabilni|aktivni))\b/i,
  /\b(make\s+(sources?|links?|references?)\s+(clickable|active|hyperlink))\b/i,

  // "stavi klikabilne linkove" / "dodaj klikabilne linkove"
  /\b(stavi|dodaj|ubaci|prikaži)\s+.*\b(klikabiln|clickable|hyperlink)\b/i,

  // "formatiraj izvore kao / prikazi izvore kao"
  /\b(formatiraj|prikaži|prikaz|display)\s+.*\b(izvore|linkove|sources?|links?)\b/i,
];

/**
 * Patterns for pure concept / educational requests without freshness need.
 * "objasni kako radi DNS", "što je JWT", "razlika između X i Y"
 */
const CONCEPT_EDUCATION_PATTERNS = [
  // Explanation requests for stable knowledge
  /^\s*(objasni|explain|što\s+je\s+(to\s+)?|sta\s+je\s+(to\s+)?|što\s+znači|sta\s+znači|what\s+is\s+(a\s+)?|define\b|definicija|what\s+does\s+\w+\s+mean)\b/i,

  // Comparison / difference (stable knowledge)
  /\b(razlika\s+između|razlika\s+izmedju|difference\s+between|usporedi|compare\b|vs\b|versus)\b/i,
];

/**
 * Patterns for coding / debug / architecture requests.
 * These should use model knowledge, not web search (usually).
 */
const CODE_DEV_PATTERNS = [
  /\b(napišemi|napiši\s+(kod|function|klasu|modul|script|widget)|write\s+(code|function|class|module|script|widget))\b/i,
  /\b(debag|debug|stack\s*trace|greška\s+u\s+kodu|code\s+error|fix\s+(this|the|my)\s+(code|bug|error))\b/i,
  /\b(refaktor(iraj)?|refactor|optimiz|kod\s+review|code\s+review)\b/i,
  /\b(flutter|flutterflow|dart|firebase|firestore|node\.?js|javascript|typescript|python|react|vue|angular|html|css)\b/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// SOFT ALLOW — patterns that explicitly want real web search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Explicit freshness / real-time request signals.
 */
const FRESHNESS_PATTERNS = [
  /\b(trenutno|sada|danas|jučer|jucer|sutra|ovaj\s+(tjedan|mjesec)|ove\s+godine|najnov|latest|today|now|current|breaking|2025|2026)\b/i,
  /\b(vijesti|news|report\b|breaking)\b/i,
];

/**
 * Explicit source / verification requests (user WANTS real web sources).
 * "daj mi izvore za", "linkaj studije", "provjeri tvrdnju", "napiši s citatima"
 */
const EXPLICIT_SOURCE_REQUEST_PATTERNS = [
  // "daj mi izvore za X" / "give sources for X" — user wants actual sources
  /\b(daj\s+(mi\s+)?(izvore|linkove|reference)\s+(za|o|vezano)\b|give\s+(me\s+)?(sources?|links?)\s+(for|about|on)\b)\b/i,

  // "linkaj" / "linkai" / "napiši s citatima"
  /\b(linkaj|linkai|napiši\s+s\s+citatima|write\s+with\s+citations?|cited\s+sources?)\b/i,

  // "provjeri ovu tvrdnju" / "verify this claim"
  /\b(provjeri\s+(ovu\s+)?(tvrdnju|claim|informacij|podatak)|verify\s+(this|the)\s+(claim|fact|information))\b/i,

  // "potraži na webu" / "nađi na internetu"
  /\b(potraži\s+(na\s+)?(webu|internetu|googlu)|nađi\s+(na\s+)?(webu|internetu)|search\s+(the\s+)?(web|internet|online))\b/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// Main gate function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'BLOCK'|'ALLOW'} GateDecision
 * @typedef {{ decision: GateDecision, reason: string, confidence: number }} GateResult
 */

/**
 * Evaluate whether web search should be gated for the given user message.
 *
 * @param {string} userText  — raw user message (before URL stripping)
 * @returns {GateResult}
 */
function evaluateWebSearchGate(userText) {
  const text = String(userText || '').trim();
  if (!text) {
    return _log({ decision: 'BLOCK', reason: 'EMPTY_MESSAGE', confidence: 1.0 });
  }

  // ── PASS 1: SOFT_ALLOW early exits (explicit freshness / source / web intent) ─────────────
  // These patterns beat everything else — if user explicitly wants freshness/sources/web, allow.

  for (const p of EXPLICIT_SOURCE_REQUEST_PATTERNS) {
    if (p.test(text)) {
      return _log({ decision: 'ALLOW', reason: 'EXPLICIT_SOURCE_REQUEST', confidence: 0.95 });
    }
  }

  for (const p of FRESHNESS_PATTERNS) {
    if (p.test(text)) {
      return _log({ decision: 'ALLOW', reason: 'FRESHNESS_REQUEST', confidence: 0.90 });
    }
  }

  // ── PASS 2: HARD_BLOCK checks ───────────────────────────────────────────────────────────────

  // Source FORMAT requests come before source CONTENT requests.
  // "kad daješ izvore, stavi da su klikabilni" → FORMAT, not CONTENT.
  for (const p of SOURCE_FORMAT_PATTERNS) {
    if (p.test(text)) {
      return _log({ decision: 'BLOCK', reason: 'SOURCE_FORMAT_REQUEST', confidence: 0.97 });
    }
  }

  for (const p of FORMAT_STYLE_PATTERNS) {
    if (p.test(text)) {
      return _log({ decision: 'BLOCK', reason: 'FORMAT_REQUEST', confidence: 0.95 });
    }
  }

  for (const p of CONCEPT_EDUCATION_PATTERNS) {
    if (p.test(text)) {
      // Only block if message is short/clear-cut (no recency cue)
      const hasRecency = FRESHNESS_PATTERNS.some(fp => fp.test(text));
      if (!hasRecency) {
        return _log({ decision: 'BLOCK', reason: 'CONCEPT_EDUCATION', confidence: 0.88 });
      }
    }
  }

  for (const p of CODE_DEV_PATTERNS) {
    if (p.test(text)) {
      const hasRecency = FRESHNESS_PATTERNS.some(fp => fp.test(text));
      if (!hasRecency) {
        return _log({ decision: 'BLOCK', reason: 'CODE_DEV_REQUEST', confidence: 0.90 });
      }
    }
  }

  // ── PASS 3: Default — ALLOW (let router decide) ────────────────────────────────────────────
  return _log({ decision: 'ALLOW', reason: 'DEFAULT_ALLOW', confidence: 0.60 });
}

/**
 * Convenience: returns true if web search is hard-blocked for this message.
 * @param {string} userText
 * @returns {boolean}
 */
function isWebSearchBlocked(userText) {
  return evaluateWebSearchGate(userText).decision === 'BLOCK';
}

/**
 * Convenience: returns true if user explicitly requests web-sourced content.
 * Replaces (and narrows) the old `_explicitlyRequestsWebSearch`.
 * @param {string} userText
 * @returns {boolean}
 */
function isExplicitWebSearchRequest(userText) {
  const text = String(userText || '').trim();
  if (!text) return false;

  // Explicit source content requests
  for (const p of EXPLICIT_SOURCE_REQUEST_PATTERNS) {
    if (p.test(text)) return true;
  }

  // Explicit "search web" verb
  if (/(na\s+internetu|web\s*search|googlaj|pretraži\s+web|search\s+the\s+(web|internet|online))/i.test(text)) return true;

  // Freshness + question (not just freshness word alone)
  const hasFreshness = FRESHNESS_PATTERNS.some(p => p.test(text));
  if (hasFreshness) {
    // If there is a question/request structure alongside the freshness cue, allow
    const hasQuestion = /[?]/.test(text) || /\b(što|sta|tko|ko|gdje|kada|koliko|who|what|where|when|how)\b/i.test(text);
    if (hasQuestion) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal logger
// ─────────────────────────────────────────────────────────────────────────────
function _log(result) {
  console.log(`[WEBGATE] decision=${result.decision} reason=${result.reason} confidence=${result.confidence}`);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test vectors (run with: node -e "require('./webSearchGate').selfTest()")
// ─────────────────────────────────────────────────────────────────────────────
function selfTest() {
  const cases = [
    // ── EXPECTED: BLOCK ───────────────────────────────────────────────
    { text: 'kad daješ izvore, stavi da su klikabilni',           want: 'BLOCK' },
    { text: 'make links clickable when you give sources',         want: 'BLOCK' },
    { text: 'neka izvori budu klikabilni',                        want: 'BLOCK' },
    { text: 'promijeni format odgovora u bullet liste',           want: 'BLOCK' },
    { text: 'objasni što je JWT token',                           want: 'BLOCK' },
    { text: 'razlika između REST i GraphQL',                      want: 'BLOCK' },
    { text: 'napiši mi Flutter widget za search bar',             want: 'BLOCK' },
    { text: 'refaktoriraj ovaj Node.js kod',                      want: 'BLOCK' },
    { text: 'dodaj dugme za pretragu u UI',                       want: 'BLOCK' },
    { text: 'podeblaj sve naslove u odgovoru',                    want: 'BLOCK' },
    // ── EXPECTED: ALLOW ───────────────────────────────────────────────
    { text: 'tko je trenutni predsjednik Hrvatske',               want: 'ALLOW' },
    { text: 'što se desilo danas u politici',                     want: 'ALLOW' },
    { text: 'najnovije vijesti o AI',                             want: 'ALLOW' },
    { text: 'daj mi izvore za klimatske promjene',                want: 'ALLOW' },
    { text: 'verify this claim about inflation',                  want: 'ALLOW' },
    { text: 'linkaj studije o vitaminu D',                        want: 'ALLOW' },
    { text: 'cijena bitcoina sada',                               want: 'ALLOW' },
    { text: 'koji Flutter paketi postoje za kameru 2025',         want: 'ALLOW' },
  ];

  let pass = 0, fail = 0;
  for (const c of cases) {
    const result = evaluateWebSearchGate(c.text);
    const ok = result.decision === c.want;
    console.log(`${ok ? '✅' : '❌'} [${result.decision}/${c.want}] "${c.text.slice(0, 60)}" (${result.reason})`);
    ok ? pass++ : fail++;
  }
  console.log(`\n📊 Results: ${pass}/${pass + fail} passed`);
}

module.exports = {
  evaluateWebSearchGate,
  isWebSearchBlocked,
  isExplicitWebSearchRequest,
  selfTest,
};
