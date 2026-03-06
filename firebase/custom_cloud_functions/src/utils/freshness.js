'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// freshness.js — Multilingual "dynamic fact" detection (FIX8)
//
// Detects queries requiring web search because the answer changes over time.
// Zero LLM calls, <1ms latency. Handles 40+ languages.
//
// LAYERS:
//   L0   Universal tokens   : FC, BTC, vs, %, CEO, transfer, season... all langs
//   L1   Domain patterns    : sports/prices/news/schedule/standings/company/officials
//   L1b  Entity+Affiliation : proper name (capitalised) + plays/club/joue/spielt
//   L1c  Lowercase fallback : "modric nastupa" (no capitals) + affiliation cue
//   L2   Router signal      : called AFTER router decides web_search (0ms extra)
//
// UNICODE NORMALISATION (complete, beyond NFD):
//   ı→i  đ→d  ł→l  ß→ss  ø→o  æ→ae  œ→oe
//   NFD handles: č,š,ž,ü,ö,é,ő,ã,ç and 100+ others automatically
// ═══════════════════════════════════════════════════════════════════════════════

function _norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0131/g, 'i')
    .replace(/[đÐ]/gi, 'd')
    .replace(/ł/gi, 'l')
    .replace(/ß/g, 'ss')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// L0: universal tokens (test on normalized text)
const UNIVERSAL_TOKENS =
  /\b(fc|cf|ac|sc|fk|nk|hnk|bk|btc|eth|usd|eur|gbp|chf|jpy|nft|crypto|nasdaq|ceo|cto|cfo|coo|vs|live|score|goals?|season|match|fixture|transfer|standings|lineup|champion|league|borse|bourse|borsa)\b|[€$£¥%]/i;

// L1b/L1c cues
const AFFILIATION_CUE =
  /\b(igra|nastupa|klub|team|club|plays|playing|verein|spielt|joue|equipe|squadra|gioca|equipo|juega|clube|joga|klubi)\b/i;

function hasNamedEntity(original) {
  const tokens = String(original || '').trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/[^a-zA-ZÀ-ÿ\u0100-\u024F]/g, '');
    if (t.length >= 2 && /^[A-ZÀÁÂÃÄÇÈÉÊËÎÏÔÙÚÛÜ]/u.test(t)) return true;
  }
  return false;
}

function hasLowercaseFallback(normalized) {
  const words = normalized.split(' ').filter((w) => w.length >= 4);
  return words.length >= 2 && AFFILIATION_CUE.test(normalized);
}

// L1: domain patterns (ASCII; _norm makes them match accented originals)
const PATTERNS = {
  sports: [
    // HR/BS/SR
    /gdje\s+(igra|nastupa|trenira)/,
    /u\s+ko(m|jem)\s+klub/,
    /za\s+ko(g|ji|ga)\s+(klub|tim|nastupa|igra)/,
    /(tko|koji)\s+je\s+trener/,

    // EN
    /where\s+does\s+\w+.*play/,
    /which\s+(club|team)\s+is/,
    /(what|which)\s+club\s+does/,
    /who\s+is\s+the\s+(coach|manager)\s+of/,
    /current\s+(club|team)\s+of/,

    // DE
    /wo\s+spielt/,
    /bei\s+welchem\s+verein/,
    /wer\s+ist\s+(der\s+)?(trainer|coach)/,

    // FR
    /ou\s+joue/,
    /dans\s+quel\s+club/,
    /qui\s+est\s+(l\s+|le\s+|la\s+)?(entraineur|coach)/,

    // IT
    /dove\s+gioca/,
    /in\s+quale\s+(squadra|club)/,
    /chi\s+e\s+(il\s+|l\s+)?allenatore/,

    // ES
    /donde\s+juega/,
    /en\s+que\s+(equipo|club)/,
    /quien\s+es\s+el\s+(entrenador|tecnico)/,

    // PT
    /onde\s+joga/,
    /em\s+que\s+(clube|equipa)/,

    // NL
    /bij\s+welke\s+(club|team)/,

    // PL
    /w\s+(jakim\s+)?(klubie|zespole)\s+(gra|jest)/,
    /kto\s+jest\s+(trenerem|menedzerem)/,
  ],

  prices: [
    /\b(bitcoin|btc|ethereum|eth|crypto|nft)\b/,
    /\b(cijena|cena|price|prix|preis|prezzo|precio|preco|kaina)\b/,
    /\b(tecaj|exchange\s+rate|wechselkurs|taux\s+de\s+change)\b/,
    /\b(burza|stock|borse|bourse|borsa|bolsa|gielda)\b/,
    /\b(dionica|share|aktie|action)\b/,
    /\b(kamata|interest\s+rate|zinsen)\b/,
    /\b(gorivo|nafta|benzin|diesel|fuel|petrol|essence)\b/,
    /\b(zlato|srebro|gold|silver)\b/,
    /\b(dolar|euro|funta|usd|eur|gbp|chf|jpy|rub)\b/,
    /koliko\s+kosta/,
    /how\s+much\s+(is|does|cost)/,
    /was\s+kostet/,
    /combien\s+(coute|vaut)/,
    /cuanto\s+(cuesta|vale)/,
    /hoeveel\s+kost/,
    /ile\s+kosztuje/,
  ],

  news: [
    /\b(najnovije|novosti|vijesti)\b/,
    /sto\s+se\s+(dogada|desava|zbiva|dogodilo)/,
    /\b(danas|jucer|ovaj\s+tjedan)\b/,

    /\b(breaking|latest)\b.*\b(news|events?)\b/,
    /\b(today|yesterday|this\s+week|right\s+now)\b/,
    /what.?s\s+(happening|going\s+on)/,

    /\b(aktuell|neueste|heute|gestern|nachrichten)\b/,
    /\b(actuellement|aujourd\s+hui|hier|dernieres\s+nouvelles)\b/,
    /\b(oggi|ieri|ultime\s+notizie)\b/,
    /\b(hoy|ayer|ultimas\s+noticias)\b/,
    /\b(bugun|dun|son\s+haberler)\b/,
  ],

  schedule: [
    /kada\s+(igra|je\s+utakmica|pocinje)/,
    /\b(raspored|sljedeca\s+utakmica)\b/,
    /when\s+(is|does|are).*(next|upcoming|match|game)/,
    /next\s+(match|game|round|race|event|fixture)/,
    /\b(schedule|fixture|upcoming)\s+(match|game|event)\b/,
    /wann\s+(spielt|ist\s+das)/,
    /quand\s+(joue|est|a\s+lieu)/,
  ],

  standings: [
    /ljestvic/,
    /tablic/,
    /klasifikacij/,
    /(ko|tko|who|wer|chi|qui|quien)\s+(vodi|leitet|fuhrt|leads|tops)/,
    /\b(standings|league\s+table|rankings?)\b/,
    /\b(tabelle|platzierung|rangliste)\b/,
    /\b(classement|classifica)\b/,
    /\b(clasificacion|classificacao)\b/,
  ],

  company: [
    /\b(ceo|chief\s+executive|predsjednik\s+uprave)\b/,
    /\b(osnivac|suosnivac|founder)\b/,
    /(tko|ko|who|wer|qui|chi|quien)\s+(vodi|runs|leads|leitet|dirige)\b/,
    /who\s+(runs|leads|heads|is\s+in\s+charge)\b/,
    /wer\s+(leitet|fuhrt)\b/,
    /qui\s+(dirige|est\s+a\s+la\s+tete\s+de)\b/,
  ],

  officials: [
    /(tko|ko)\s+je\s+(predsjednik|predsjednica|premijer|ministar|nacelnik|zupan|gradonacelnik)/,
    /who\s+is\s+(the\s+)?(current\s+)?(president|prime\s+minister|minister|governor|mayor)\b/,
    /wer\s+ist\s+(der\s+)?(kanzler|ministerpraesident|burgermeister)\b/,
    /(qui\s+est|quel\s+est)\s+(le\s+|la\s+)?(president|premier\s+ministre|maire)\b/,
    /chi\s+e\s+(il\s+|la\s+)?(presidente|sindaco)\b/,
    /quien\s+es\s+(el\s+|la\s+)?(presidente|alcalde)\b/,
    /kto\s+(jest|bedzie)\s+(prezydentem|burmistrzem)\b/,
    /(кто|хто)\s+(является|е|є)\s+(президентом|премьером|мэром)\b/,
  ],
};

// ── Date-only early exit ──────────────────────────────────────────────────────
// Language-agnostic: ≤6 words, date/day token, no freshness-sensitive signal
// → answered from system-injected context, skip web search
const _DATE_TOKENS = /\b(dan|datum|danas|day|date|today|jour|journee|tag|heute|giorno|oggi|dia|hoy|dzien|dzisiaj|dag|idag|dnes|nap|paiva|gun|bugun|zi|astazi|hoje|den|dagen)\b/i;
const _DATE_DISQUALIFY = /\b(vijesti|news|scor|rezultat|cijena|pric|tko|who|wer|qui|quien|predsjedn|president|premier|ministar|izbor|election|vote|wahl|ergebnis|match|utakmic|prognoz|forecast|weather|vremen|sport|liga|tablic)\w*/i;

function _isPureDateQuery(msg) {
  const t = _norm(msg);
  if (t.split(/\s+/).filter(Boolean).length > 6) return false;
  if (!_DATE_TOKENS.test(t)) return false;
  if (UNIVERSAL_TOKENS.test(t)) return false;
  if (_DATE_DISQUALIFY.test(t)) return false;
  return true;
}

function needsWebSearchFast(message) {
  const t = _norm(message);

  // Early-exit: pure date/time → system context, no web search needed
  if (_isPureDateQuery(message)) return { fresh: false, category: 'date_only_skip', layer: -1 };

  // L0
  if (UNIVERSAL_TOKENS.test(t)) return { fresh: true, category: 'universal', layer: 0 };

  // L1
  for (const [category, patterns] of Object.entries(PATTERNS)) {
    for (const re of patterns) {
      if (re.test(t)) return { fresh: true, category, layer: 1 };
    }
  }

  // L1b
  if (hasNamedEntity(message) && AFFILIATION_CUE.test(t)) {
    return { fresh: true, category: 'entity+affiliation', layer: '1b' };
  }

  // L1c
  if (hasLowercaseFallback(t)) {
    return { fresh: true, category: 'lowercase+affiliation', layer: '1c' };
  }

  return { fresh: false };
}

// L2: called after router decides web_search (0ms extra)
function isFreshnessSignalFromRouter(text) {
  const s = String(text || '').trim();
  const t = _norm(s);

  const hasQmark = /[?\u061F\uff1f\u3002]/u.test(s);
  const hasQword =
    /\b(who|qui|quel|quelle|quien|quem|chi|wie|kto|kdo|vem|hvem|kuka|ki|cine|kim|tko|ko|gdje|kada|when|what|where|was|wann|ou|dove|donde|onde)\b/i.test(
      t
    );
  const hasCJK = /谁|誰|누구|누가|何|どこ|いつ/.test(s);
  const hasCyrillic = /(^|\s)(кто|хто|ко|ким|де|коли|яке|какой|какая)(\s|$)/i.test(s);

  const titlecaseWords =
    s.match(/\b[A-ZÀÁÂÃÄÇÈÉÊËÎÏÔÙÚÛÜ][a-zA-Zà-ÿ\u0100-\u024F]{1,}/gu) || [];
  const hasTwoEntities = titlecaseWords.length >= 2;

  return hasQmark || hasQword || hasCJK || hasCyrillic || hasTwoEntities;
}

module.exports = { needsWebSearchFast, isFreshnessSignalFromRouter };
