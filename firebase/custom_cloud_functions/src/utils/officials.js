'use strict';

// Time-sensitive "office holder" questions must be grounded on web sources.
// Keep heuristics simple and multilingual (HR/EN/DE) and bias toward triggering.

function _norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0131/g, 'i')      // Turkish dotless ı
    .replace(/[đÐ]/gi, 'd')        // Croatian đ/Đ (no NFD decomp)
    .replace(/ł/gi, 'l')           // Polish ł (no NFD decomp)
    .replace(/ß/g, 'ss')           // German ß (no NFD decomp)
    .replace(/ø/gi, 'o')           // ø
    .replace(/æ/gi, 'ae')          // æ
    .replace(/œ/gi, 'oe')          // œ
    // remove punctuation so tokens like "SAD-a" become "sad a"
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function isOfficialsQuestion(text) {
  const t = _norm(text);
  if (!t) return false;

  // "who is" intent
  const who = /(\b(tko je|ko je|who is|wer ist|wer ist der|wer ist die)\b)/.test(t);

  // roles (HR/EN/DE)
  const roles = [
    // HR
    'predsjednik', 'predsjednica', 'premijer', 'predsjednik vlade', 'ministar', 'ministrica',
    'guverner', 'gradonacelnik', 'gradonačelnik', 'nacelnik', 'načelnik', 'nacelnik opcine', 'načelnik općine',
    'zupan', 'župan', 'predsjednik stranke', 'predsjednica stranke',
    // EN
    'president', 'prime minister', 'minister', 'governor', 'mayor', 'ceo', 'chief executive',
    'party leader',
    // DE
    'prasident', 'präsident', 'kanzler', 'ministerprasident', 'ministerpräsident', 'burgermeister', 'bürgermeister',
  ];

  const hasRole = roles.some((k) => t.includes(k));
  if (!hasRole) return false;

  // entities (broad: country/region markers)
  const entities = [
    'sad', 'sadinjenih drzava', 'sjedinjenih drzava', 'u s a', 'usa', 'u.s.', 'united states',
    'hrvatske', 'croatia', 'bih', 'bosne i hercegovine', 'bosnia',
    'njemacke', 'njemačke', 'germany', 'deutschland',
    'hbz', 'hbž', 'kanton', 'zupanija', 'županija', 'opcine', 'općine', 'opcina', 'općina',
  ];
  const hasEntity = entities.some((k) => t.includes(k));

  // Treat as time-sensitive if role was mentioned AND it looks like a "who/office-holder" query.
  // We bias toward triggering grounding (better to web_search than to hallucinate), even for local offices
  // where the location name might not appear in the hardcoded entities list.
  const questionish = who || t.includes('?') || /(\b(tko|ko|who|wer)\b)/.test(t);
  const timeSensitiveHint = /(\b(trenutni|current|sada\s*šnji|sadasnji|trenutna|currently)\b)/.test(t);
  return Boolean(hasRole && (questionish || timeSensitiveHint));
}

function buildOfficialsQueryVariants(userText) {
  const q = String(userText || '').trim();
  if (!q) return [];

  const currentYear = new Date().getFullYear();
  const variants = [q];

  // ── 1. Year suffix (for "who is currently" type queries) ──────────────────
  // Helps search engines surface fresh results for office-holder queries.
  if (!/\b(20\d{2})\b/.test(q)) {
    variants.push(`${q} ${currentYear}`);
  }

  // ── 2. Acronym expansions (HBŽ/HBZ) ─────────────────────────────────────
  if (/\bhbž\b/i.test(q) || /\bhbz\b/i.test(q)) {
    variants.push(q.replace(/\bhbž\b/gi, 'Hercegbosanska župania').replace(/\bhbz\b/gi, 'Herceg-Bosna'));
    variants.push(`vlada Hercegbosanske županije predsjednik ${currentYear}`);
  }

  // ── 3. Canonical local-official term expansions ───────────────────────────
  // "načelnik" without "općine" → add it
  if (/\b(načelnik|nacelnik)\b/i.test(q) && !/\b(općine|opcine|opštine)\b/i.test(q)) {
    variants.push(`${q} općina`);
  }
  // "predsjednik vlade" → add "premijer" as synonym
  if (/predsjednik\s+vlade/i.test(q)) {
    variants.push(q.replace(/predsjednik\s+vlade/i, 'premijer'));
  }

  // ── 4. English variant (only for short queries or when person name is present) ─
  // Long HR/BS questions about local BiH/HR officials don't benefit from EN translation
  // because official sources are in Croatian/Bosnian anyway.
  // We add EN variant only when: short query (≤6 words) OR person name detected.
  const wordCount = q.split(/\s+/).length;
  const hasPersonName = /\b([A-ZČĆŽŠĐ][\p{L}]+\s+[A-ZČĆŽŠĐ][\p{L}]+)\b/u.test(q);
  if (wordCount <= 6 || hasPersonName) {
    const enVariant = q
      .replace(/tko je/i, 'who is')
      .replace(/ko je/i, 'who is')
      .replace(/predsjednik vlade/i, 'prime minister')
      .replace(/predsjedniku vlade/i, 'prime minister')
      .replace(/načelnik općine/i, 'mayor of')
      .replace(/načelnik opštine/i, 'mayor of')
      .replace(/ministar/i, 'minister')
      .replace(/\bžupan\b/i, 'county head')
      .replace(/predsjednik skupštine/i, 'assembly president')
      .replace(/gradonačelnik\s+/i, 'mayor of ')
      .trim();
    if (enVariant !== q && enVariant.includes('who is')) variants.push(enVariant);
  }

  // ── 5. Quoted name if capitalized person name detected ────────────────────
  const m = String(userText || '').match(/\b([A-ZČĆŽŠĐ][\p{L}]+\s+[A-ZČĆŽŠĐ][\p{L}]+)\b/u);
  if (m && m[1]) variants.push(`"${m[1]}" stranka BiH`);

  return Array.from(new Set(variants)).slice(0, 5);
}

module.exports = { isOfficialsQuestion, buildOfficialsQueryVariants };
