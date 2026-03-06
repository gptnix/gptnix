'use strict';

/**
 * freshnessBlock — FRESHNESS WEB-GROUNDED MODE.
 *
 * Only active when freshnessHardWeb=true AND officialsHardWeb=false
 * (officials take precedence and have their own stricter block).
 *
 * @param {object} state
 * @param {boolean} state.freshnessHardWeb
 * @param {boolean} state.officialsHardWeb
 * @param {string}  state.verifiedFactsBlock
 * @returns {string}
 */
module.exports = function freshnessBlock(state) {
  if (!state || !state.freshnessHardWeb || state.officialsHardWeb) return '';

  const vfb = (state.verifiedFactsBlock && String(state.verifiedFactsBlock).trim())
    ? `\n${state.verifiedFactsBlock}`
    : '';

  return `
FRESHNESS WEB-GROUNDED MODE:
This question asks about a time-sensitive fact (sports, prices, standings, schedules, company roles, or news).
- Use ONLY information from WEB SEARCH RESULTS and VERIFIED FACTS below.
- If a specific detail is NOT supported in sources → say "prema dostupnim izvorima ne mogu potvrditi".
- Do NOT fill gaps from training data — training data may be 6-24 months out of date.
- For every concrete fact, cite the source with [n].
- If sources conflict: say "Stariji izvori navode X, ali prema novijim izvorima Y je točno."
${vfb}`.trim();
};
