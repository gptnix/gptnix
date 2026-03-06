'use strict';

/**
 * formatBlock — injects length/format instructions into system prompt.
 *
 * state.lengthInstructionAddon = string computed by handler from message
 *   (e.g. "FORMAT REQUIREMENT: Output MUST be a numbered list from 1 to N.")
 *
 * @param {object} state
 * @param {string}  state.lengthInstructionAddon
 * @returns {string}
 */
module.exports = function formatBlock(state) {
  const addon = (state && state.lengthInstructionAddon) ? String(state.lengthInstructionAddon).trim() : '';
  return addon ? `\n${addon}` : '';
};
