/**
 * Query Classification Engine - V2.0
 * 
 * Industry best practices from Perplexity, ChatGPT, Claude
 * 
 * Purpose:
 * - Classify query BEFORE tools execute
 * - Detect intent, freshness, entities
 * - Determine optimal tool selection
 * - Return confidence score
 * 
 * @module queryClassifier
 */

/**
 * Main classification function
 * 
 * @param {string} query - User query
 * @param {object} options - Classification options
 * @returns {object} Classification result
 */
function classifyQuery(query, options = {}) {
  const normalized = normalizeQuery(query);
  
  // Multi-faceted classification
  const intent = detectIntent(normalized);
  const freshness = detectFreshness(normalized);
  const location = extractLocation(normalized);
  const entities = extractEntities(normalized);
  const tools = selectTools(intent, freshness);
  const confidence = calculateConfidence(intent, freshness, normalized);
  
  return {
    intent,           // 'news' | 'contact' | 'factual' | 'weather' | 'casual'
    freshness,        // 'realtime' | 'recent' | 'static'
    location,         // string | null
    entities,         // string[]
    tools,            // string[] - ['web_search', 'contact_probe', etc.]
    confidence,       // 0.0-1.0
    normalized,       // Normalized query text
    original: query,  // Original query
  };
}

/**
 * Normalize query text
 */
function normalizeQuery(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Detect query intent
 * 
 * Intent categories:
 * - news: Recent news, events, updates
 * - contact: Contact information (phone, email, address)
 * - factual: Factual questions (who, what, when, where)
 * - weather: Weather information
 * - casual: Casual conversation (small talk)
 */
function detectIntent(query) {
  // TIER 0: Casual conversation (small talk)
  if (isCasualChat(query)) {
    return 'casual';
  }
  
  // TIER 1: Specific intent patterns
  
  // Contact intent
  if (/(kontakt|kontakti|contact|contacts)\b/i.test(query)) return 'contact';
  if (/(telefon|broj\s+telefona|mobitel|tel\b|pozovi|call\b)/i.test(query)) return 'contact';
  if (/(email|e-mail|mail\b|adresa|address|lokacija|location)/i.test(query)) return 'contact';
  if (/(radno\s+vrijeme|radno\s+vreme|working\s+hours|otvoreno)/i.test(query)) return 'contact';
  
  // News intent
  if (/(vijesti|news|najnovije|latest|breaking|aktualno)/i.test(query)) return 'news';
  if (/(danas|today|jucer|yesterday|ovaj\s+tjedan|this\s+week)/i.test(query)) return 'news';
  if (/(dogadaj|event|incident|slucaj|case)/i.test(query)) return 'news';
  
  // Weather intent
  if (/(vrijeme|weather|prognoza|forecast|temperatura|temp)/i.test(query)) return 'weather';
  if (/(kisa|sunce|snijeg|rain|snow|sun|облачно|cloudy)/i.test(query)) return 'weather';
  
  // TIER 2: Factual questions (default)
  if (/(tko\s+je|ko\s+je|who\s+is|sta\s+je|sto\s+je|what\s+is)/i.test(query)) return 'factual';
  if (/(kada|when|gdje|where|zasto|why|kako|how)/i.test(query)) return 'factual';
  
  // Default: factual
  return 'factual';
}

/**
 * Detect freshness requirement
 * 
 * Freshness categories:
 * - realtime: Need real-time data (today, now)
 * - recent: Need recent data (this week, this month)
 * - static: Historical/static data (any time)
 */
function detectFreshness(query) {
  // Real-time indicators
  const realtimePatterns = [
    /\b(danas|today|sada|now|trenutno|currently|upravo|just\s+now)\b/i,
    /\b(ovu\s+večer|tonight|ovo\s+jutro|this\s+morning)\b/i,
    /\b(najnovije|latest|breaking|live)\b/i,
  ];
  
  for (const pattern of realtimePatterns) {
    if (pattern.test(query)) return 'realtime';
  }
  
  // Recent indicators
  const recentPatterns = [
    /\b(jucer|yesterday|prekjucer|day\s+before)\b/i,
    /\b(ovaj\s+tjedan|this\s+week|prosli\s+tjedan|last\s+week)\b/i,
    /\b(ovaj\s+mjesec|this\s+month|nedavno|recently)\b/i,
  ];
  
  for (const pattern of recentPatterns) {
    if (pattern.test(query)) return 'recent';
  }
  
  // Static (default)
  return 'static';
}

/**
 * Extract location from query
 * 
 * Looks for:
 * - Cities in BiH (Tomislavgrad, Sarajevo, Mostar, etc.)
 * - General location keywords
 */
function extractLocation(query) {
  // BiH cities
  const cities = [
    'tomislavgrad', 'sarajevo', 'mostar', 'banja luka', 'tuzla',
    'zenica', 'bijeljina', 'prijedor', 'trebinje', 'cazin',
    'bihac', 'livno', 'kiseljak', 'kupres', 'posusje'
  ];
  
  for (const city of cities) {
    if (query.includes(city)) {
      // Return capitalized
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  
  // Generic location keywords
  if (/\b(lokacija|location|adresa|address|gdje|where)\b/i.test(query)) {
    return 'generic';
  }
  
  return null;
}

/**
 * Extract entities from query
 * 
 * Returns array of entities (people, organizations, places)
 */
function extractEntities(query) {
  const entities = [];
  
  // Proper nouns (capitalized words)
  const words = query.split(/\s+/);
  const properNouns = words.filter(w => /^[A-ZČĆŠĐŽ]/.test(w));
  entities.push(...properNouns);
  
  // Organizations (generic patterns)
  if (/\b(općina|opština|municipality|grad|city|county)\b/i.test(query)) {
    entities.push('organization');
  }
  
  // Remove duplicates
  return [...new Set(entities)];
}

/**
 * Select optimal tools based on intent and freshness
 * 
 * Tool options:
 * - web_search: General web search
 * - contact_probe: Contact information probe
 * - wiki: Wikipedia lookup
 * - weather: Weather API
 * - none: No tools needed (casual chat)
 */
function selectTools(intent, freshness) {
  const tools = [];
  
  // Intent-based selection
  switch (intent) {
    case 'casual':
      // No tools for casual chat
      return [];
      
    case 'contact':
      // Contact probe for contact queries
      tools.push('web_search');
      tools.push('contact_probe');
      break;
      
    case 'weather':
      // Weather API for weather queries
      tools.push('weather');
      break;
      
    case 'news':
      // Web search for news
      tools.push('web_search');
      break;
      
    case 'factual':
      // Wiki + web for factual queries
      if (freshness === 'static') {
        tools.push('wiki');
      }
      tools.push('web_search');
      break;
      
    default:
      tools.push('web_search');
  }
  
  return tools;
}

/**
 * Calculate confidence score
 * 
 * Based on:
 * - Intent clarity (strong patterns = high confidence)
 * - Query length (longer = more context = higher confidence)
 * - Entity presence (entities = higher confidence)
 */
function calculateConfidence(intent, freshness, query) {
  let confidence = 0.5; // Base confidence
  
  // Intent confidence
  if (intent === 'contact' && /kontakt|telefon|email|adresa/i.test(query)) {
    confidence += 0.3; // Strong contact intent
  } else if (intent === 'news' && /vijesti|najnovije|danas/i.test(query)) {
    confidence += 0.25; // Strong news intent
  } else if (intent === 'weather' && /vrijeme|prognoza|temperatura/i.test(query)) {
    confidence += 0.3; // Strong weather intent
  } else if (intent === 'casual') {
    confidence += 0.35; // Strong casual intent
  } else {
    confidence += 0.1; // Weak intent
  }
  
  // Query length confidence
  const words = query.split(/\s+/).length;
  if (words >= 3 && words <= 10) {
    confidence += 0.15; // Optimal length
  } else if (words > 10) {
    confidence += 0.05; // Long but OK
  }
  
  // Freshness confidence
  if (freshness === 'realtime') {
    confidence += 0.1; // Clear freshness indicator
  }
  
  // Cap at 1.0
  return Math.min(confidence, 1.0);
}

/**
 * Check if query is casual chat (small talk)
 * 
 * Reuses logic from accuracyGuard.js for consistency
 */
function isCasualChat(query) {
  const text = String(query || '').toLowerCase().trim();
  
  // Single-word affirmations
  if (/^(hi|hello|bok|hvala|ok|da|ne|bye|super|cool)$/i.test(text)) {
    return true;
  }
  
  // Clear small talk patterns
  const smallTalkPatterns = [
    /\b(kako\s+si|kako\s+ti\s+je|kako\s+ide)\b/i,
    /\b(sta\s+radis|sto\s+radis|what.*doing)\b/i,
    /\b(je\s+li\s+(sve\s+)?(ok|u\s+redu)|jesi\s+dobro|are\s+you\s+ok)\b/i,
    /\b(sta\s+ima(\s+novo)?|what('?s| is)\s+up)\b/i,
    /\b(kako\s+se\s+zoves|what.*name)\b/i,
  ];
  
  for (const pattern of smallTalkPatterns) {
    if (pattern.test(text)) {
      // Factual override guard
      const factualOverride = [
        /\b(posao|work|projekt|radno\s+vrijeme|cijena|kontakt|price|job)\b/i,
        /\b(tko\s+je|ko\s+je|sto\s+je|gdje\s+je|who|what|where)\b/i,
      ];
      
      // If no factual override, it's small talk
      if (!factualOverride.some(p => p.test(text))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Export helper for testing
 */
const _internal = {
  detectIntent,
  detectFreshness,
  extractLocation,
  extractEntities,
  selectTools,
  calculateConfidence,
  isCasualChat,
};

module.exports = {
  classifyQuery,
  _internal,
};
