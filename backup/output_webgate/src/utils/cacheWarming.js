'use strict';

/**
 * 🚀 MEMORY CACHE WARMING
 * 
 * Pre-warm cache za common memory queries na app startup
 * Opciono - može se pozvati iz index.js ili admin endpoint-a
 */

const { getEmbedding } = require('./embeddings');

// Common memory queries u različitim jezicima
const COMMON_QUERIES = [
  // English
  'what is my name',
  'who am i',
  'what do you know about me',
  'where do i live',
  'my location',
  
  // Croatian/Bosnian
  'koje je moje ime',
  'ko sam ja',
  'što znaš o meni',
  'gdje živim',
  'moja lokacija',
  
  // Common variations
  'my name',
  'my family',
  'my job',
  'my work',
];

/**
 * Pre-cache embeddings za common queries
 * Pozovi pri app startup ili manual trigger
 */
async function warmEmbeddingCache() {
  console.log('🔥 [CACHE-WARM] Starting embedding cache warming...');
  
  let warmed = 0;
  let skipped = 0;
  
  for (const query of COMMON_QUERIES) {
    try {
      const embedding = await getEmbedding(query, { operation: 'cache_warming' });
      if (embedding) {
        warmed++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.warn(`⚠️ [CACHE-WARM] Failed to warm "${query}":`, err.message);
      skipped++;
    }
  }
  
  console.log(`✅ [CACHE-WARM] Complete: ${warmed} cached, ${skipped} skipped`);
  return { warmed, skipped, total: COMMON_QUERIES.length };
}

module.exports = {
  warmEmbeddingCache,
  COMMON_QUERIES,
};
