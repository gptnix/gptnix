'use strict';

/**
 * officialsBlock — OFFICIALS STRICT MODE grounding.
 *
 * Only active when officialsHardWeb=true.
 * Forces model to use VERIFIED FACTS only, with citations.
 *
 * @param {object} state
 * @param {boolean} state.officialsHardWeb
 * @param {string}  state.verifiedFactsBlock
 * @returns {string}
 */
module.exports = function officialsBlock(state) {
  if (!state || !state.officialsHardWeb) return '';

  const vfb = (state.verifiedFactsBlock && String(state.verifiedFactsBlock).trim())
    ? state.verifiedFactsBlock
    : 'VERIFIED FACTS: (none extracted — state uncertainty clearly, do not invent)';

  return `
OFFICIALS STRICT MODE (NON-NEGOTIABLE):
- This question asks about a CURRENT office holder / official role.
- You MUST answer ONLY using the VERIFIED FACTS block below.
- If a detail is not present there, say you cannot confirm from sources.
- Do NOT use prior knowledge or wiki for office-holder identity/party/role.
- Every concrete claim MUST include a citation [n] matching SOURCES.

CONFLICT RULE (critical — Wikipedia is often stale for current officials):
- If VERIFIED FACTS shows a SOURCE CONFLICT, use ONLY the non-disputed (✓) facts.
- Do NOT blend: never take a person's name from source A and their party from source B.
- If you mention a discrepancy, say: "Stariji izvori navode X, ali prema službenim stranicama Y je točno."
- Wikipedia party/role data for office holders is unreliable — always prefer official/government domains.

${vfb}
`;
};
