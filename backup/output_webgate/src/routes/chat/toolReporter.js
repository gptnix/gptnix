'use strict';

/**
 * Tool Status Reporter
 * 
 * Sends real-time tool execution status via SSE
 * Allows frontend to show progress indicators
 * 
 * Extracted from chat.js
 */

/**
 * Create tool reporter instance
 * 
 * @param {Function} sendEvent - SSE sendEvent function (or null to disable)
 * @returns {Object} { enabled, start, progress, done, error }
 */
function createToolReporter(sendEvent) {
  const enabled = typeof sendEvent === 'function';
  let seq = 0;

  const _emit = (payload) => {
    if (!enabled) return;
    sendEvent('tool_status', { ts: new Date().toISOString(), ...payload });
  };

  /**
   * Start tool execution
   * 
   * @param {string} tool - Tool name (e.g. 'web_search', 'movie_lookup')
   * @param {string} title - Display title
   * @param {string} message - Status message
   * @param {Object} extra - Additional data
   * @returns {string|null} Tool execution ID (for progress/done/error calls)
   */
  const start = (tool, title, message, extra = {}) => {
    if (!enabled) return null;
    const id = `${tool}-${Date.now()}-${++seq}`;
    _emit({ id, tool, status: 'start', title, message, ...extra });
    return id;
  };

  /**
   * Report progress
   * 
   * @param {string} id - Tool execution ID from start()
   * @param {string} message - Progress message
   * @param {Object} extra - Additional data
   */
  const progress = (id, message, extra = {}) => {
    if (!enabled || !id) return;
    _emit({ id, status: 'progress', message, ...extra });
  };

  /**
   * Report completion
   * 
   * @param {string} id - Tool execution ID from start()
   * @param {string} message - Completion message
   * @param {Object} extra - Additional data (e.g. results count)
   */
  const done = (id, message, extra = {}) => {
    if (!enabled || !id) return;
    _emit({ id, status: 'done', message, ...extra });
  };

  /**
   * Report error
   * 
   * @param {string} id - Tool execution ID from start()
   * @param {string} message - Error message
   * @param {Object} extra - Additional data
   */
  const error = (id, message, extra = {}) => {
    if (!enabled || !id) return;
    _emit({ id, status: 'error', message, ...extra });
  };

  return { enabled, start, progress, done, error };
}

module.exports = { createToolReporter };
