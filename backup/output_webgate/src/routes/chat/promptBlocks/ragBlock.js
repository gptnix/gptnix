'use strict';

/**
 * ragBlock — builds RAG data content string.
 *
 * In buildPrompt, RAG context is injected into mustUseBlocks (not systemBlock directly),
 * matching original chat.js behavior.
 *
 * state.ragContext = RAG retrieved context string
 *
 * @param {object} state
 * @param {string}  state.ragContext
 * @returns {string}  cleaned RAG content, or '' if none
 */

const { stripToolFormat } = require('../utils');

module.exports = function ragBlock(state) {
  const ragContext = (state && state.ragContext && String(state.ragContext).trim()) ? state.ragContext : '';
  if (!ragContext) return '';
  const clean = stripToolFormat(ragContext);
  return clean ? `RAG DATA (trusted):\n${clean}` : '';
};
