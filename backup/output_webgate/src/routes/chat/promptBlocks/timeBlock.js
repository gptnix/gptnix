'use strict';

/**
 * timeBlock — current date/time context injected into system prompt.
 * state.timeInfo = { localHuman, iso, timezoneOffset } from client
 * state.languageHint = 'hr' | 'en' | ...
 */

const { buildTimeContext } = require('../../../utils/time');

/**
 * @param {object} state
 * @param {object|null} state.timeInfo
 * @param {string}       state.languageHint
 * @returns {string}
 */
module.exports = function timeBlock(state) {
  try {
    const { timeInfo, languageHint } = state || {};
    const tctx = buildTimeContext({ clientTimeInfo: timeInfo, languageHint });

    const clientLocal  = timeInfo && typeof timeInfo.localHuman     === 'string' ? timeInfo.localHuman     : null;
    const clientIso    = timeInfo && typeof timeInfo.iso            === 'string' ? timeInfo.iso            : null;
    const clientOffset = timeInfo && typeof timeInfo.timezoneOffset === 'string' ? timeInfo.timezoneOffset : null;

    return (
      '\nCURRENT TIME CONTEXT (CRITICAL):\n' +
      `- TODAY (local): ${tctx.localDate || tctx.localHuman}\n` +
      `- CURRENT LOCAL TIME: ${tctx.localHuman}${tctx.offsetName ? ` (${tctx.offsetName})` : ''}\n` +
      `- CURRENT YEAR (local): ${tctx.localYear || ''}\n` +
      `- Timezone used: ${tctx.timeZone}\n` +
      `- Server ISO (UTC): ${tctx.serverIso}\n` +
      (clientLocal  ? `- User device local time (as sent): ${clientLocal}\n`     : '') +
      (clientIso    ? `- User device ISO time (as sent): ${clientIso}\n`         : '') +
      (clientOffset ? `- User timezone offset (as sent): ${clientOffset}\n`      : '') +
      '\nTIME INTERPRETATION RULES:\n' +
      '- Interpret phrases like "danas", "sutra", "ovaj tjedan", "ovaj mjesec", "ove godine" relative to TODAY (local) above.\n' +
      '- If web sources mention only past years and do not explicitly confirm the current year, say you cannot confirm for the current year.\n'
    );
  } catch (err) {
    console.error('[timeBlock] error:', err);
    return '';
  }
};
