/**
 * Multi-Stage Search Pipeline - V2.0
 * 
 * Industry best practices from Perplexity, ChatGPT
 * 
 * Architecture:
 * - Stage 1: FAST Search (Serper 2-3s)
 * - Stage 2: ENHANCED Search (Tavily 6s) - CONDITIONAL
 * - Stage 3: CONTACT Probe (9s) - ONLY for contact intent
 * 
 * Features:
 * - Cascading timeouts
 * - Provider fallbacks
 * - Smart stage triggering
 * - Result merging & deduplication
 * 
 * @module searchPipeline
 */

'use strict';

const { getDomain } = require('../../utils/url');

/**
 * Execute multi-stage search pipeline
 * 
 * @param {string} query - Search query
 * @param {object} classification - Query classification result
 * @param {object} providers - Provider instances { serper, tavily, ddg }
 * @param {object} options - Pipeline options
 * @returns {Promise<object>} Search results
 */
async function executeSearchPipeline(query, classification, providers, options = {}) {
  const {
    maxStages = 2,           // Max stages to execute (1-3)
    fastTimeout = 3000,      // Stage 1 timeout (ms)
    enhancedTimeout = 6000,  // Stage 2 timeout (ms)
    totalTimeout = 15000,    // Total pipeline timeout (ms)
    minResults = 5,          // Min results to skip Stage 2
  } = options;
  
  const startTime = Date.now();
  const results = {
    stage1: null,  // Fast search results
    stage2: null,  // Enhanced search results
    stage3: null,  // Contact probe results
    merged: [],    // Final merged results
    metadata: {
      stages_executed: [],
      providers_used: [],
      total_latency_ms: 0,
      success: false,
    },
  };
  
  try {
    // =================================================================
    // STAGE 1: FAST SEARCH (Serper or DDG - 2-3s)
    // =================================================================
    console.log('🚀 [PIPELINE] Stage 1: Fast Search');
    
    results.stage1 = await executeFastSearch(
      query,
      classification,
      providers,
      { timeout: fastTimeout }
    );
    
    results.metadata.stages_executed.push('fast_search');
    results.metadata.providers_used.push(results.stage1.provider);
    
    console.log(`✅ [PIPELINE] Stage 1 complete: ${results.stage1.results.length} results in ${results.stage1.latency_ms}ms`);
    
    // Check if we need Stage 2
    const needsEnhancement = shouldEnhanceSearch(
      results.stage1,
      classification,
      { minResults, maxStages }
    );
    
    if (!needsEnhancement || maxStages < 2) {
      // Stage 1 sufficient - return early
      results.merged = results.stage1.results;
      results.metadata.success = true;
      results.metadata.total_latency_ms = Date.now() - startTime;
      return results;
    }
    
    // Check timeout budget
    const elapsed = Date.now() - startTime;
    if (elapsed >= totalTimeout - 1000) {
      console.log('⚠️ [PIPELINE] Timeout budget exhausted, skipping Stage 2');
      results.merged = results.stage1.results;
      results.metadata.success = true;
      results.metadata.total_latency_ms = elapsed;
      return results;
    }
    
    // =================================================================
    // STAGE 2: ENHANCED SEARCH (Tavily - 6s) - CONDITIONAL
    // =================================================================
    console.log('🔍 [PIPELINE] Stage 2: Enhanced Search (Tavily)');
    
    const remainingTimeout = Math.min(
      enhancedTimeout,
      totalTimeout - elapsed - 500 // Leave 500ms buffer
    );
    
    results.stage2 = await executeEnhancedSearch(
      query,
      classification,
      providers,
      { timeout: remainingTimeout }
    );
    
    results.metadata.stages_executed.push('enhanced_search');
    results.metadata.providers_used.push(results.stage2.provider);
    
    console.log(`✅ [PIPELINE] Stage 2 complete: ${results.stage2.results.length} results in ${results.stage2.latency_ms}ms`);
    
    // Merge Stage 1 + Stage 2
    results.merged = mergeResults(
      results.stage1.results,
      results.stage2.results
    );
    
    results.metadata.success = true;
    results.metadata.total_latency_ms = Date.now() - startTime;
    
    return results;
    
  } catch (error) {
    console.error('❌ [PIPELINE] Error:', error.message);
    
    // Return whatever we got
    results.merged = results.stage1?.results || [];
    results.metadata.success = false;
    results.metadata.total_latency_ms = Date.now() - startTime;
    results.metadata.error = error.message;
    
    return results;
  }
}

/**
 * Execute FAST search (Stage 1)
 * 
 * Providers: Serper (primary) → DDG (fallback)
 * Timeout: 3s
 */
async function executeFastSearch(query, classification, providers, options) {
  const startTime = Date.now();
  const { timeout = 3000 } = options;
  
  try {
    // Try Serper first (fastest)
    if (providers.serper) {
      try {
        const results = await Promise.race([
          providers.serper.search(query, { max_results: 10 }),
          timeoutPromise(timeout, 'Serper timeout'),
        ]);
        
        return {
          provider: 'serper',
          results: normalizeResults(results, 'serper'),
          latency_ms: Date.now() - startTime,
          success: true,
        };
      } catch (serperError) {
        console.warn('⚠️ [PIPELINE] Serper failed:', serperError.message);
        // Fall through to DDG
      }
    }
    
    // Fallback to DDG
    if (providers.ddg) {
      const results = await Promise.race([
        providers.ddg.search(query, { max_results: 10 }),
        timeoutPromise(timeout, 'DDG timeout'),
      ]);
      
      return {
        provider: 'ddg',
        results: normalizeResults(results, 'ddg'),
        latency_ms: Date.now() - startTime,
        success: true,
      };
    }
    
    throw new Error('No fast search providers available');
    
  } catch (error) {
    console.error('❌ [PIPELINE] Fast search failed:', error.message);
    return {
      provider: 'none',
      results: [],
      latency_ms: Date.now() - startTime,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute ENHANCED search (Stage 2)
 * 
 * Provider: Tavily (high-quality, slower)
 * Timeout: 6s
 */
async function executeEnhancedSearch(query, classification, providers, options) {
  const startTime = Date.now();
  const { timeout = 6000 } = options;
  
  try {
    if (!providers.tavily) {
      throw new Error('Tavily provider not available');
    }
    
    // Rewrite query for better results (optional)
    const enhancedQuery = enhanceQuery(query, classification);
    
    const results = await Promise.race([
      providers.tavily.search(enhancedQuery, {
        max_results: 10,
        include_images: shouldIncludeImages(classification),
      }),
      timeoutPromise(timeout, 'Tavily timeout'),
    ]);
    
    return {
      provider: 'tavily',
      results: normalizeResults(results, 'tavily'),
      latency_ms: Date.now() - startTime,
      success: true,
    };
    
  } catch (error) {
    console.error('❌ [PIPELINE] Enhanced search failed:', error.message);
    return {
      provider: 'tavily',
      results: [],
      latency_ms: Date.now() - startTime,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Decide if Stage 2 (Enhanced Search) is needed
 * 
 * Triggers if:
 * - Stage 1 returned < minResults
 * - OR classification confidence < 0.7
 * - OR query is complex (needs depth)
 */
function shouldEnhanceSearch(stage1Result, classification, options) {
  const { minResults = 5, maxStages = 2 } = options;
  
  // Stage 2 disabled
  if (maxStages < 2) return false;
  
  // Too few results from Stage 1
  if (stage1Result.results.length < minResults) {
    console.log(`📊 [PIPELINE] Stage 1 has ${stage1Result.results.length} < ${minResults} results → Enhance`);
    return true;
  }
  
  // Low confidence classification
  if (classification.confidence < 0.7) {
    console.log(`📊 [PIPELINE] Low confidence (${classification.confidence}) → Enhance`);
    return true;
  }
  
  // Complex query (multi-entity)
  if (classification.entities.length >= 3) {
    console.log(`📊 [PIPELINE] Complex query (${classification.entities.length} entities) → Enhance`);
    return true;
  }
  
  // News queries with realtime requirement
  if (classification.intent === 'news' && classification.freshness === 'realtime') {
    console.log(`📊 [PIPELINE] Realtime news → Enhance`);
    return true;
  }
  
  console.log('📊 [PIPELINE] Stage 1 sufficient → Skip Stage 2');
  return false;
}

/**
 * Enhance query for better Stage 2 results
 * 
 * Strategies:
 * - Add freshness indicators ("latest", "today")
 * - Add location context if present
 * - Expand with synonyms
 */
function enhanceQuery(query, classification) {
  let enhanced = query;
  
  // Add freshness
  if (classification.freshness === 'realtime' && !/(danas|today|latest)/i.test(query)) {
    enhanced += ' latest';
  }
  
  // Add location context
  if (classification.location && !query.includes(classification.location)) {
    enhanced += ` ${classification.location}`;
  }
  
  console.log(`🔄 [PIPELINE] Query enhanced: "${query}" → "${enhanced}"`);
  return enhanced;
}

/**
 * Decide if images should be included
 * 
 * Include images for:
 * - News queries (events, photos)
 * - Visual topics (products, places)
 * 
 * Skip images for:
 * - Contact queries (not visual)
 * - Text-heavy queries
 */
function shouldIncludeImages(classification) {
  // Include for news and visual topics
  if (classification.intent === 'news') return true;
  if (classification.intent === 'weather') return true;
  
  // Skip for contact and factual
  if (classification.intent === 'contact') return false;
  if (classification.intent === 'factual') return false;
  
  // Default: no images
  return false;
}

/**
 * Merge results from multiple stages
 * 
 * Strategy:
 * - Deduplicate by domain
 * - Keep highest-scored per domain
 * - Preserve order (Stage 1 first, then Stage 2)
 * - Limit to top 10-12 results
 */
function mergeResults(stage1Results, stage2Results) {
  const seenDomains = new Set();
  const merged = [];
  
  // Add Stage 1 results first (prioritized)
  for (const result of stage1Results) {
    const domain = getDomain(result.url);
    if (!seenDomains.has(domain)) {
      merged.push({ ...result, stage: 1 });
      seenDomains.add(domain);
    }
  }
  
  // Add Stage 2 results (if not duplicate domain)
  for (const result of stage2Results) {
    const domain = getDomain(result.url);
    if (!seenDomains.has(domain)) {
      merged.push({ ...result, stage: 2 });
      seenDomains.add(domain);
    }
  }
  
  // Limit to top 10-12
  const limited = merged.slice(0, 12);
  
  console.log(`🔀 [PIPELINE] Merged: ${stage1Results.length} + ${stage2Results.length} → ${limited.length} unique`);
  
  return limited;
}

/**
 * Normalize results from different providers
 * 
 * Ensures consistent format:
 * {
 *   url: string,
 *   title: string,
 *   snippet: string,
 *   score: number,
 *   provider: string,
 * }
 */
function normalizeResults(rawResults, provider) {
  if (!rawResults || !Array.isArray(rawResults)) {
    return [];
  }
  
  return rawResults.map((result, index) => ({
    url: result.url || result.link || '',
    title: result.title || '',
    snippet: result.snippet || result.description || result.content || '',
    score: result.score || (10 - index), // Default score based on position
    provider,
    rank: index + 1,
  })).filter(r => r.url); // Remove empty URLs
}

/**
 * Create a timeout promise
 */
function timeoutPromise(ms, message = 'Timeout') {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Export helpers for testing
 */
const _internal = {
  executeFastSearch,
  executeEnhancedSearch,
  shouldEnhanceSearch,
  enhanceQuery,
  shouldIncludeImages,
  mergeResults,
  normalizeResults,
};

module.exports = {
  executeSearchPipeline,
  _internal,
};
