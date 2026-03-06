'use strict';

/**
 * 🧠 TWO-TIER MEMORY INJECTION - PRODUCTION GOLD VERSION
 * 
 * Tier 1: CORE facts (strict whitelist, always cached)
 * Tier 2: CONTEXTUAL memories (relevance + keyword match)
 */

// ✅ FIX #1: STRICT CORE WHITELIST with priority weights
// Priority order: name > location > language > profession > family
const CORE_FIELD_PATTERNS = {
  name: /\b(user'?s? name is|called|known as|zove se|ime je|naziv|nam)\b/i,
  location: /\b(lives? in|based in|from|located in|resident of|živi u|iz|lokacija)\b/i,
  language: /\b(speaks?|primary language|native|jezik|govori|maternji)\b/i,
  profession: /\b(works? as|employed as|profession|occupation|job title|radi kao|posao|zanimanje)\b/i,
  family: /\b(has \d+ (child|kid|son|daughter)|married|spouse|family size|obitelj|djeca|bračni)\b/i,
};

const CORE_FIELD_PRIORITY = {
  name: 100,
  location: 80,
  language: 60,
  profession: 40,
  family: 20,
};

const CORE_CATEGORIES = ['personal', 'identity', 'family'];
const CORE_MIN_IMPORTANCE = 0.80; // Lowered from 0.88 (more permissive for core facts)

// TIER 2: Contextual
const CONTEXTUAL_MIN_SCORE = 0.40; // Lowered from 0.72 (Qdrant scores often 0.4-0.5)
const CONTEXTUAL_MAX_AGE_DAYS = 90; // Increased from 60
const CONTEXTUAL_MIN_KEYWORD_OVERLAP = 0.15; // Lowered from 0.3

/**
 * ✅ FIX #1: Validacija + prioritet za CORE memory
 */
function isValidCoreMemory(memoryItem) {
  const payload = memoryItem.payload || {};
  const content = String(payload.content || '').toLowerCase();
  const category = String(payload.category || '').toLowerCase();
  const importance = payload.importance || 0;
  
  // Must be high importance + correct category
  if (importance < CORE_MIN_IMPORTANCE) return false;
  if (!CORE_CATEGORIES.includes(category)) return false;
  
  // Prefer structured field if available
  if (payload.field && CORE_FIELD_PATTERNS[payload.field]) {
    console.log(`🧠 [CORE-VALID] Structured field: ${payload.field}, Memory: ${content.slice(0, 50)}`);
    return payload.field;
  }
  
  // Fallback to pattern matching
  for (const [field, pattern] of Object.entries(CORE_FIELD_PATTERNS)) {
    if (pattern.test(content)) {
      console.log(`🧠 [CORE-VALID] Pattern match: ${field}, Memory: ${content.slice(0, 50)}`);
      return field;
    }
  }
  
  console.log(`🧠 [CORE-REJECT] No field match: ${content.slice(0, 50)}`);
  return false;
}

/**
 * ✅ FIX #2: Keyword overlap sa caching msgWords (O(n) umjesto O(n²))
 */
let cachedMsgWords = null;
let cachedMsgText = null;

function calculateKeywordOverlap(memoryContent, userMessage) {
  // Cache msgWords per request (reset se u buildMemoryBlock)
  if (cachedMsgText !== userMessage) {
    cachedMsgText = userMessage;
    cachedMsgWords = new Set(
      String(userMessage || '')
        .toLowerCase()
        .match(/\b\w{4,}\b/g) || []
    );
  }
  
  const memWords = new Set(
    String(memoryContent || '')
      .toLowerCase()
      .match(/\b\w{4,}\b/g) || []
  );
  
  if (memWords.size === 0 || cachedMsgWords.size === 0) return 0;
  
  let overlap = 0;
  for (const word of memWords) {
    if (cachedMsgWords.has(word)) overlap++;
  }
  
  return overlap / Math.max(memWords.size, cachedMsgWords.size);
}

/**
 * ✅ FIX #2: Contextual memory validation (score + keyword)
 */
function isRelevantContextualMemory(memoryItem, userMessage, options = {}) {
  const payload = memoryItem.payload || {};
  const content = payload.content || '';
  const score = memoryItem.score || 0;
  const importance = payload.importance || 0;
  const category = String(payload.category || '').toLowerCase();
  
  const {
    minScore = CONTEXTUAL_MIN_SCORE,
    minKeywordOverlap = CONTEXTUAL_MIN_KEYWORD_OVERLAP,
    maxAgeDays = CONTEXTUAL_MAX_AGE_DAYS,
  } = options;
  
  // Skip if it's already in core
  if (CORE_CATEGORIES.includes(category) && importance >= CORE_MIN_IMPORTANCE) {
    return false;
  }
  
  // Age check
  if (payload.timestamp) {
    const age = (Date.now() - new Date(payload.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (age > maxAgeDays) {
      console.log(`🧠 [CONTEXT-REJECT] Too old (${Math.floor(age)}d): ${content.slice(0, 40)}`);
      return false;
    }
  }
  
  // Score check
  if (score < minScore) {
    console.log(`🧠 [CONTEXT-REJECT] Low score (${score.toFixed(3)}): ${content.slice(0, 40)}`);
    return false;
  }
  
  // Keyword overlap check
  const overlap = calculateKeywordOverlap(content, userMessage);
  if (overlap < minKeywordOverlap && score < 0.85) {
    // Allow high-score memories even with low overlap
    console.log(`🧠 [CONTEXT-REJECT] Low overlap (${overlap.toFixed(2)}): ${content.slice(0, 40)}`);
    return false;
  }
  
  console.log(`🧠 [CONTEXT-ACCEPT] Score: ${score.toFixed(3)}, Overlap: ${overlap.toFixed(2)}, Content: ${content.slice(0, 40)}`);
  return true;
}

/**
 * Build memory block sa production-grade validation
 */
function buildMemoryBlock(memoryResults, userMessage, options = {}) {
  // Reset keyword cache for this request
  cachedMsgWords = null;
  cachedMsgText = null;
  
  if (!memoryResults || memoryResults.length === 0) {
    return { coreBlock: '', contextualBlock: '', totalInjected: 0, stats: {} };
  }

  const msgLower = String(userMessage || '').toLowerCase();
  
  // 🔹 TIER 1: Core facts (strict validation + priority sorting)
  const coreMemories = memoryResults
    .map(item => {
      const field = isValidCoreMemory(item);
      return field ? { ...item, _coreField: field } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Sort by priority (name > location > rest)
      const prioA = CORE_FIELD_PRIORITY[a._coreField] || 0;
      const prioB = CORE_FIELD_PRIORITY[b._coreField] || 0;
      if (prioA !== prioB) return prioB - prioA;
      
      // Secondary: importance
      return (b.payload?.importance || 0) - (a.payload?.importance || 0);
    });

  // ⚡ SMART DEDUPLICATION: Remove near-duplicate core memories (keep only best)
  const dedupedCore = [];
  const seenFields = new Map();
  
  for (const mem of coreMemories) {
    const field = mem._coreField;
    const content = (mem.payload?.content || '').toLowerCase().trim();
    
    // Check if we already have a similar memory for this field
    const existing = seenFields.get(field);
    if (existing) {
      // Keep only if this one is significantly better (higher score)
      if ((mem.score || 0) > (existing.score || 0) + 0.05) {
        // Replace with better one
        const idx = dedupedCore.indexOf(existing);
        if (idx !== -1) dedupedCore[idx] = mem;
        seenFields.set(field, mem);
      }
      // Otherwise skip this duplicate
    } else {
      // First memory for this field
      dedupedCore.push(mem);
      seenFields.set(field, mem);
    }
  }
  
  const finalCore = dedupedCore.slice(0, 3); // Max 3 core facts

  // 🔹 TIER 2: Contextual memories (score + keyword)
  const contextualMemories = memoryResults
    .filter(item => isRelevantContextualMemory(item, userMessage, options))
    .sort((a, b) => {
      // Sort by composite: score * (1 + keyword_overlap)
      const scoreA = (a.score || 0) * (1 + calculateKeywordOverlap(a.payload?.content, userMessage));
      const scoreB = (b.score || 0) * (1 + calculateKeywordOverlap(b.payload?.content, userMessage));
      return scoreB - scoreA;
    })
    .slice(0, 5); // Max 5 contextual

  // 🎯 Check if user is asking about themselves
  const isPersonalQuery = /\b(my|moje|moj|moja|me|meni|ja|sam|who am i|ko sam|što znaš o meni|what do you know)\b/i.test(msgLower);
  
  // Build blocks
  let coreBlock = '';
  if (finalCore.length > 0) {
    const coreText = finalCore.map((item, idx) => {
      const content = item.payload?.content || '';
      const field = item._coreField || 'other';
      return `${idx + 1}. ${content}`;
    }).join('\n');
    
    coreBlock = `<core_identity>
${coreText}
</core_identity>`;
  }

  let contextualBlock = '';
  // Inject contextual if: personal query OR high relevance (3+ memories)
  if (contextualMemories.length > 0 && (isPersonalQuery || contextualMemories.length >= 3)) {
    const contextText = contextualMemories.map((item, idx) => {
      const content = item.payload?.content || '';
      const score = item.score || 0;
      return `${idx + 1}. ${content} [confidence: ${score.toFixed(2)}]`;
    }).join('\n');
    
    contextualBlock = `<contextual_memory>
${contextText}
</contextual_memory>`;
  }

  const totalInjected = finalCore.length + (contextualBlock ? contextualMemories.length : 0);
  
  const stats = {
    total: memoryResults.length,
    core: finalCore.length,
    contextual: contextualBlock ? contextualMemories.length : 0,
    rejected: memoryResults.length - totalInjected,
    personalQuery: isPersonalQuery,
    deduped: coreMemories.length - finalCore.length, // How many duplicates were removed
  };
  
  console.log(`🧠 [MEMORY-INJECT] Total: ${stats.total}, Core: ${stats.core}, Context: ${stats.contextual}, Rejected: ${stats.rejected}, Deduped: ${stats.deduped}`);
  
  return { coreBlock, contextualBlock, totalInjected, stats };
}

/**
 * ✅ FIX #3: Advisory instructions (allow AI to ask for confirmation)
 */
function formatForSystemPrompt({ coreBlock, contextualBlock }) {
  if (!coreBlock && !contextualBlock) return '';
  
  let result = '';
  
  if (coreBlock) {
    result += `\n${coreBlock}\n`;
  }
  
  if (contextualBlock) {
    result += `\n${contextualBlock}\n`;
  }
  
  if (result) {
    result = `
<user_memories>
${result.trim()}

MEMORY USAGE RULES:
- CORE IDENTITY: These are verified facts about the user. Always respect them, never contradict.
- CONTEXTUAL MEMORY: Additional context that may be relevant. Use naturally when it fits the current topic.
- If memory seems outdated or conflicts with user's current message, politely ask for confirmation instead of asserting it.
- If user corrects a memory, acknowledge the update gracefully.
- Never force-fit memories into unrelated responses just to show you "remember".
</user_memories>`.trim();
  }
  
  return result;
}

module.exports = {
  buildMemoryBlock,
  formatForSystemPrompt,
  calculateKeywordOverlap, // Export for testing
  isValidCoreMemory, // Export for testing
};
