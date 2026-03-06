'use strict';

/**
 * languageBlock — injects language preference instruction.
 *
 * state.userLanguage = 'hr' | 'en' | 'bs' | ... | '' (unset)
 *
 * @param {object} state
 * @param {string}  state.userLanguage
 * @returns {string}
 */

const INSTRUCTIONS = {
  en: 'Respond in English.',
  hr: 'Odgovaraj na hrvatskom jeziku. Koristi latinicu.',
  bs: 'Odgovaraj na bosanskom jeziku. Koristi latinicu.',
  sr: 'Odgovaraj na srpskom jeziku. Koristi latinicu.',
  de: 'Antworte auf Deutsch.',
  es: 'Responde en español.',
  fr: 'Répondez en français.',
  it: 'Rispondi in italiano.',
  pt: 'Responda em português.',
  pl: 'Odpowiedz po polsku.',
  nl: 'Antwoord in het Nederlands.',
  ru: 'Отвечай на русском языке.',
  tr: 'Türkçe yanıt ver.',
  ja: '日本語で回答してください。',
  zh: '请用中文回答。',
  ko: '한국어로 답변하세요.',
  ar: 'أجب بالعربية.',
};

function getLanguageInstruction(lang) {
  const key = String(lang || '').toLowerCase().slice(0, 2);
  return INSTRUCTIONS[key] || INSTRUCTIONS['en'];
}

module.exports = function languageBlock(state) {
  const lang = String((state && state.userLanguage) || '').trim().toLowerCase();

  if (lang) {
    return (
      '\nLANGUAGE PREFERENCE:\n' +
      `- The user's preferred language is: ${getLanguageInstruction(lang)}\n` +
      '- Answer in this language.\n' +
      '- If the latest user message is clearly in another language, follow the language of the latest user message instead.'
    );
  }

  return (
    '\nLANGUAGE PREFERENCE:\n' +
    '- Answer in the same language as the user\'s latest message.\n' +
    '- If the language is unclear, default to English.'
  );
};

module.exports.getLanguageInstruction = getLanguageInstruction;
