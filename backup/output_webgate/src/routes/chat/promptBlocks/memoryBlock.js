'use strict';

/**
 * memoryBlock — injects long-term user memory into system prompt.
 *
 * state.memoryBlock = string already formatted by memoryInjector
 * (built in handler.js via buildMemoryBlock + formatForSystemPrompt)
 *
 * @param {object} state
 * @param {string|null} state.memoryBlock
 * @returns {string}
 */
module.exports = function memoryBlock(state) {
  const block = (state && state.memoryBlock) ? String(state.memoryBlock).trim() : '';
  return block ? `\n${block}\n` : '';
};
