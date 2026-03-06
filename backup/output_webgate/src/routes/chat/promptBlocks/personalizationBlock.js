'use strict';

/**
 * personalizationBlock — FIX19c
 *
 * Injects user style/tone/nickname/occupation/custom instructions
 * from getUserPersonalization() into the system prompt.
 *
 * Block position: #3 in buildPrompt order (after memoryBlock, before timeBlock).
 *
 * @param {object} state
 * @param {object|null} state.userPersonalization  — from getUserPersonalization()
 * @returns {string}
 */

const STYLE_MAP = {
  // Flutter style values
  default:      '',
  concise:      'Be maximally concise. Short answers unless detail is explicitly requested.',
  detailed:     'Provide thorough, in-depth explanations. Cover edge cases and context.',
  creative:     'Be imaginative and expressive. Use vivid language and creative framing.',
  professional: 'Use a formal, business-like tone. Avoid slang and contractions.',
  casual:       'Be friendly and relaxed. Conversational tone, like texting a friend.',
  // Legacy / backwards-compat values
  funny:        'Use a humorous, witty tone. Jokes and wordplay are welcome.',
  formal:       'Use a professional, formal tone. Avoid slang.',
  friendly:     'Use a warm, friendly, conversational tone.',
};

module.exports = function personalizationBlock(state) {
  const p = state && state.userPersonalization;
  if (!p) return '';

  const lines = [];

  if (p.nickname)
    lines.push(`- Address the user as "${p.nickname}".`);

  if (p.occupation)
    lines.push(`- User's occupation: ${p.occupation}.`);

  const styleLine = STYLE_MAP[p.styleTone] || (p.styleTone ? `Tone: ${p.styleTone}.` : '');
  if (styleLine)
    lines.push(`- ${styleLine}`);

  if (Array.isArray(p.characteristics) && p.characteristics.length)
    lines.push(`- Style traits: ${p.characteristics.join(', ')}.`);

  if (p.customInstructions)
    lines.push(`\nUSER CUSTOM INSTRUCTIONS (follow strictly):\n${p.customInstructions}`);

  if (p.about)
    lines.push(`\nUSER BACKGROUND:\n${p.about}`);

  return lines.length ? `\nPERSONALIZATION:\n${lines.join('\n')}` : '';
};
