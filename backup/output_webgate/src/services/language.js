'use strict';

function normalizeLangCode(input, fallback = 'en') {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return fallback;
  const base = raw.split(/[-_]/)[0];
  return base || fallback;
}

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

const LANG_NAME = {
  en: 'English',
  hr: 'Croatian',
  bs: 'Bosnian',
  sr: 'Serbian',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  es: 'Spanish',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  cs: 'Czech',
  sk: 'Slovak',
  sl: 'Slovenian',
  hu: 'Hungarian',
  ro: 'Romanian',
  bg: 'Bulgarian',
  el: 'Greek',
  tr: 'Turkish',
  ru: 'Russian',
  uk: 'Ukrainian',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  he: 'Hebrew',
  fa: 'Persian',
};

function langMeta(code) {
  const c = normalizeLangCode(code, 'en');
  return {
    code: c,
    name: LANG_NAME[c] || c,
    rtl: RTL_LANGS.has(c),
  };
}

/**
 * Language instruction for SYSTEM prompt.
 * IMPORTANT: Always answer in the selected UI language.
 */
function buildLanguageInstruction(languageCode) {
  const meta = langMeta(languageCode);
  const lang = meta.code;

  const extra =
    lang === 'ar'
      ? `- Use Modern Standard Arabic (فصحى) unless the user clearly writes in a dialect.\n- Keep punctuation and formatting clean; it's OK to use Arabic numerals (٠١٢٣٤٥٦٧٨٩) when natural.\n`
      : '';

  return (
    `LANGUAGE MODE (STRICT):\n` +
    `- The user's selected UI language is "${meta.name}" (code: ${lang}).\n` +
    `- ALWAYS write ALL user-facing text in this language, even if the user writes in another language.\n` +
    `- Translate/summarize any tool outputs or quotes into this language before presenting them.\n` +
    `- Do NOT translate code, file paths, URLs, API names, identifiers, or product/brand names.\n` +
    `- If the user explicitly asks: "answer in <other language>" for THIS message, follow that request only.\n` +
    (meta.rtl ? `- Note: This is an RTL language. Output should be natural for RTL reading.\n` : '') +
    extra
  );
}

/**
 * Choose the language used for the current request.
 * Preference (profile) wins over client hint.
 */
function pickLanguage({ preferenceCode, clientHint }) {
  const pref = normalizeLangCode(preferenceCode || '');
  const hint = normalizeLangCode(clientHint || '');
  if (preferenceCode && pref) return pref;
  if (clientHint && hint) return hint;
  return 'en';
}

module.exports = {
  normalizeLangCode,
  langMeta,
  buildLanguageInstruction,
  pickLanguage,
};
