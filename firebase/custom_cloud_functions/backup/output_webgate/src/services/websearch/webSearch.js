/* eslint-disable no-console */
'use strict';

/**
 * Web Search V2 - Main Orchestrator (CJS)
 */

const { classifyQuery } = require('./queryClassifier');
const { executeSearchPipeline } = require('./searchPipeline');
const { calculateTrustScore, filterByTrust, rankByTrust } = require('./trustScoring');
const { executeContactProbe, resultsHaveContactInfo } = require('./contactProbe');
const { extractSnippets, extractKeyFacts, formatSnippetsForLLM } = require('./snippetExtractor');

/**
 * Main web search function
 * 
 * @param {string} query - User query
 * @param {object} options - Search options
 * @returns {Promise<object>} Search results
 */
async function webSearch(query, options = {}) {
  const {
    providers = {},           // { serper, tavily, ddg, readWebPage }
    enableContactProbe = true,
    enableSnippetExtraction = true,
    maxResults = 10,
    minTrustScore = 3.0,
  } = options;
  
  const startTime = Date.now();
  
  console.log('🔍 [WEB_SEARCH_V2] =========================================');
  console.log('🔍 [WEB_SEARCH_V2] Query:', query);
  
  try {
    // ============================================================
    // STEP 1: QUERY CLASSIFICATION
    // ============================================================
    console.log('🧠 [STEP 1] Query Classification...');
    
    const classification = classifyQuery(query);
    
    console.log('🧠 [CLASSIFICATION]', JSON.stringify(classification, null, 2));
    
    // Early exit for casual chat
    if (classification.intent === 'casual') {
      console.log('💬 [WEB_SEARCH_V2] Casual chat detected - no search needed');
      return {
        results: [],
        metadata: {
          intent: 'casual',
          tools_used: [],
          total_latency_ms: Date.now() - startTime,
          message: 'Casual conversation - no web search needed',
        },
      };
    }
    
    // ============================================================
    // STEP 2: MULTI-STAGE SEARCH PIPELINE
    // ============================================================
    console.log('🚀 [STEP 2] Search Pipeline...');
    
    const pipelineResult = await executeSearchPipeline(
      query,
      classification,
      providers,
      {
        maxStages: 2,
        fastTimeout: 3000,
        enhancedTimeout: 6000,
        totalTimeout: 15000,
        minResults: 5,
      }
    );
    
    console.log(`✅ [PIPELINE] ${pipelineResult.merged.length} results from ${pipelineResult.metadata.stages_executed.join(', ')}`);
    
    // ============================================================
    // STEP 3: TRUST SCORING & FILTERING
    // ============================================================
    console.log('📊 [STEP 3] Trust Scoring...');
    
    // Calculate trust scores
    const resultsWithTrust = pipelineResult.merged.map(result => ({
      ...result,
      trustScore: calculateTrustScore(result, query, classification),
    }));
    
    // Filter by minimum trust
    const filtered = filterByTrust(resultsWithTrust, minTrustScore);
    
    // Rank by trust score
    const ranked = rankByTrust(filtered);
    
    console.log(`📊 [TRUST] Filtered: ${resultsWithTrust.length} → ${ranked.length} (min score: ${minTrustScore})`);
    
    // ============================================================
    // STEP 4: CONTACT PROBE (CONDITIONAL)
    // ============================================================
    let contactProbeResult = null;
    
    if (enableContactProbe &&
        classification.intent === 'contact' &&
        !resultsHaveContactInfo(ranked) &&
        ranked.length > 0) {
      
      console.log('📞 [STEP 4] Contact Probe...');
      
      // Get best seed URL
      const seedUrl = ranked[0].url;
      
      contactProbeResult = await executeContactProbe(seedUrl, query, {
        maxPages: 6,
        budgetMs: 9000,
        goal: 'contact',
        readWebPage: providers.readWebPage,
      });
      
      if (contactProbeResult.ok) {
        console.log(`✅ [CONTACT_PROBE] Found contact info: ${contactProbeResult.contactInfo.emails.length} emails, ${contactProbeResult.contactInfo.phones.length} phones`);
        
        // Add contact probe result to ranked results
        ranked.unshift({
          url: contactProbeResult.url,
          title: 'Contact Information',
          snippet: formatContactInfo(contactProbeResult.contactInfo),
          provider: 'contact_probe',
          trustScore: 10.0,  // Highest trust for contact probe
          contactInfo: contactProbeResult.contactInfo,
        });
      }
    }
    
    // ============================================================
    // STEP 5: SNIPPET EXTRACTION (OPTIONAL)
    // ============================================================
    let snippets = [];
    
    if (enableSnippetExtraction && ranked.length > 0) {
      console.log('✂️ [STEP 5] Snippet Extraction...');
      
      for (const result of ranked.slice(0, 5)) { // Top 5 results only
        const content = result.snippet || result.content || '';
        const resultSnippets = extractSnippets(content, query, {
          maxSnippets: 3,
          minLength: 100,
          maxLength: 400,
          minScore: 0.3,
        });
        
        snippets.push(...resultSnippets.map(s => ({
          ...s,
          source: result.url,
        })));
      }
      
      console.log(`✂️ [SNIPPETS] Extracted ${snippets.length} snippets`);
    }
    
    // ============================================================
    // STEP 6: FINAL FORMATTING
    // ============================================================
    console.log('📦 [STEP 6] Final Formatting...');
    
    // Limit to maxResults
    const finalResults = ranked.slice(0, maxResults);
    
    // Extract key facts
    const keyFacts = snippets.length > 0 ? extractKeyFacts(snippets) : null;
    
    // Format for LLM
    const formattedSnippets = snippets.length > 0 ? formatSnippetsForLLM(snippets, finalResults) : null;
    
    const totalLatency = Date.now() - startTime;
    
    console.log('🔍 [WEB_SEARCH_V2] =========================================');
    console.log(`✅ [WEB_SEARCH_V2] Complete: ${finalResults.length} results in ${totalLatency}ms`);
    console.log('🔍 [WEB_SEARCH_V2] =========================================');
    
    return {
      results: finalResults,
      snippets: snippets.length > 0 ? snippets : undefined,
      formattedSnippets: formattedSnippets || undefined,
      keyFacts: keyFacts || undefined,
      metadata: {
        intent: classification.intent,
        freshness: classification.freshness,
        location: classification.location,
        confidence: classification.confidence,
        tools_used: classification.tools,
        stages_executed: pipelineResult.metadata.stages_executed,
        providers_used: pipelineResult.metadata.providers_used,
        contact_probe: contactProbeResult ? {
          executed: true,
          success: contactProbeResult.ok,
          pages_probed: contactProbeResult.metadata.pages_probed,
        } : { executed: false },
        total_results: finalResults.length,
        total_snippets: snippets.length,
        total_latency_ms: totalLatency,
        pipeline_latency_ms: pipelineResult.metadata.total_latency_ms,
      },
    };
    
  } catch (error) {
    console.error('❌ [WEB_SEARCH_V2] Error:', error);
    
    return {
      results: [],
      metadata: {
        intent: 'unknown',
        tools_used: [],
        total_latency_ms: Date.now() - startTime,
        error: error.message,
        success: false,
      },
    };
  }
}

/**
 * Format contact information for display
 */
function formatContactInfo(contactInfo) {
  const parts = [];
  
  if (contactInfo.emails.length > 0) {
    parts.push(`Email: ${contactInfo.emails.join(', ')}`);
  }
  
  if (contactInfo.phones.length > 0) {
    parts.push(`Phone: ${contactInfo.phones.join(', ')}`);
  }
  
  if (contactInfo.addresses.length > 0) {
    parts.push(`Address: ${contactInfo.addresses.join(', ')}`);
  }
  
  return parts.join(' | ');
}

/**
 * Export all sub-modules for testing
 */

module.exports = {
  webSearch,
  // re-export for self-test / debugging
  classifyQuery,
  executeSearchPipeline,
  calculateTrustScore,
  executeContactProbe,
  extractSnippets,
};
