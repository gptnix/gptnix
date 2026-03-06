'use strict';

/**
 * 🔌 ROUTER INTEGRATION LAYER V4
 * 
 * Bridges the new V4 router with existing chat.js code
 * Maintains backwards compatibility while using new patterns
 */

const { routeRequest } = require('../lib/router');



// Normalize V4 router output to the legacy shape expected by chat.js
function _normalizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  const out = [];
  for (const c of toolCalls) {
    if (!c) continue;
    if (typeof c === 'string') {
      out.push({ name: c, args: {} });
      continue;
    }
    if (typeof c === 'object') {
      const name = String(c.name || c.tool || c.type || '').trim();
      if (!name) continue;
      const args = c.args && typeof c.args === 'object' ? c.args : {};
      out.push({ name, args });
    }
  }
  return out;
}

function _normalizeMemory(memory) {
  if (!memory) return { action: 'none' };
  if (typeof memory === 'string') return { action: memory };
  if (typeof memory === 'object') {
    if (typeof memory.action === 'string') return memory;
    if (typeof memory.type === 'string') return { action: memory.type };
  }
  return { action: 'none' };
}

function _normalizeResponse(response) {
  if (!response) return { type: 'text' };
  if (typeof response === 'string') return { type: response };
  if (typeof response === 'object') {
    if (typeof response.type === 'string') return response;
    if (typeof response.format === 'string') return { type: response.format };
  }
  return { type: 'text' };
}
/**
 * ✅ DEDUPLICATED: Legacy API that delegates to router.js
 * 
 * BEFORE: Duplicated instant patterns, memory patterns (DRY violation)
 * AFTER: Single source of truth in router.js, this just delegates
 * 
 * Used by chat.js for fast pattern matching
 */
function quickHeuristicRouter({ message, capabilities = {}, hasHistory = false }) {
  // Delegate to the actual router.js - no more duplication!
  // This is just a thin compatibility wrapper
  return routeRequest(message, {
    capabilities,
    hasHistory,
    fastMode: true, // Skip LLM routing, only use patterns
  });
}

/**
 * Legacy API: decideToolPlan
 * Used by chat.js for full LLM-based routing
 */
async function decideToolPlan({ message, smallHistory = [], capabilities = {} }) {
  try {
    // Use new V4 router
    const plan = await routeRequest({
      message,
      history: smallHistory,
      capabilities
    });
    

// Ensure compatibility with chat.js (expects {name,args} tool calls, and {action} memory)
const normalized = {
  ...plan,
  tool_calls: _normalizeToolCalls(plan?.tool_calls),
  memory: _normalizeMemory(plan?.memory),
  response: _normalizeResponse(plan?.response),
};

return normalized;
  } catch (error) {
    console.error('[ROUTER-COMPAT] Error in decideToolPlan:', error.message);
    
    // Fallback: no tools
    return {
      tool_calls: [],
      memory: { action: 'none' },
      response: { type: 'text' },
      confidence: 0.3,
      reason: 'Router error - fallback to chat'
    };
  }
}

module.exports = {
  quickHeuristicRouter,
  decideToolPlan
};
