/**
 * Snippet Extractor - V2.0
 * 
 * Industry best practices from Perplexity (sub-document processing)
 * 
 * Purpose:
 * - Extract relevant snippets from full pages
 * - Score snippets by relevance
 * - Return atomic units (not full pages) for LLM context
 * 
 * Benefits:
 * - Better context engineering
 * - Reduced token usage
 * - Higher relevance per snippet
 * - Clearer citations
 * 
 * @module snippetExtractor
 */

/**
 * Extract top snippets from page content
 * 
 * @param {string} content - Full page content
 * @param {string} query - Original query
 * @param {object} options - Extraction options
 * @returns {array} Top N snippets
 */
function extractSnippets(content, query, options = {}) {
  const {
    maxSnippets = 5,      // Max snippets to return
    minLength = 50,       // Min snippet length (chars)
    maxLength = 500,      // Max snippet length (chars)
    minScore = 0.3,       // Min relevance score (0-1)
  } = options;
  
  if (!content || !query) {
    return [];
  }
  
  // Split into paragraphs
  const paragraphs = splitIntoParagraphs(content);
  
  // Score each paragraph
  const scored = paragraphs
    .map(para => ({
      text: para,
      score: scoreSnippetRelevance(para, query),
      length: para.length,
    }))
    .filter(s => s.length >= minLength && s.length <= maxLength)
    .filter(s => s.score >= minScore);
  
  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);
  
  // Take top N
  const topSnippets = scored.slice(0, maxSnippets);
  
  console.log(`✂️ [SNIPPET] Extracted ${topSnippets.length} snippets from ${paragraphs.length} paragraphs`);
  
  return topSnippets.map(s => ({
    text: s.text,
    score: s.score,
    length: s.length,
  }));
}

/**
 * Split content into paragraphs
 * 
 * Strategy:
 * - Split by double newline
 * - Clean up whitespace
 * - Remove empty paragraphs
 * - Remove very short paragraphs (< 50 chars)
 */
function splitIntoParagraphs(content) {
  return content
    .split(/\n\n+/)                      // Split by double newline
    .map(para => para.trim())            // Trim whitespace
    .filter(para => para.length >= 50)   // Remove short paragraphs
    .map(para => para.replace(/\s+/g, ' ')) // Normalize whitespace
    .filter(para => para.length > 0);    // Remove empty
}

/**
 * Score snippet relevance
 * 
 * Scoring factors:
 * - Query term frequency (TF)
 * - Query term coverage (% of query terms)
 * - Position (earlier = higher score)
 * - Length (optimal ~200 chars)
 * - Sentence completeness
 */
function scoreSnippetRelevance(snippet, query) {
  let score = 0;
  
  const snippetLower = snippet.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 3);
  
  // =================================================================
  // TERM FREQUENCY (TF)
  // =================================================================
  
  // Exact phrase match (+0.5)
  if (snippetLower.includes(queryLower)) {
    score += 0.5;
  }
  
  // Word matches (+0.05 per match, max +0.3)
  let wordMatches = 0;
  for (const word of queryWords) {
    if (snippetLower.includes(word)) {
      wordMatches++;
    }
  }
  const tfScore = Math.min(wordMatches * 0.05, 0.3);
  score += tfScore;
  
  // =================================================================
  // QUERY COVERAGE
  // =================================================================
  
  // What % of query words are in snippet?
  const coverage = queryWords.length > 0 ? wordMatches / queryWords.length : 0;
  score += coverage * 0.2; // Max +0.2
  
  // =================================================================
  // LENGTH SCORE
  // =================================================================
  
  // Optimal length ~200 chars
  const length = snippet.length;
  if (length >= 150 && length <= 300) {
    score += 0.1; // Optimal length
  } else if (length >= 100 && length <= 400) {
    score += 0.05; // Acceptable length
  }
  
  // =================================================================
  // SENTENCE COMPLETENESS
  // =================================================================
  
  // Ends with sentence terminator (+0.05)
  if (/[.!?]$/.test(snippet.trim())) {
    score += 0.05;
  }
  
  // Starts with capital letter (+0.05)
  if (/^[A-ZČĆŠĐŽ]/.test(snippet.trim())) {
    score += 0.05;
  }
  
  return score;
}

/**
 * Extract key facts from snippets
 * 
 * Looks for:
 * - Dates
 * - Numbers
 * - Names (proper nouns)
 * - Locations
 */
function extractKeyFacts(snippets) {
  const facts = {
    dates: [],
    numbers: [],
    names: [],
    locations: [],
  };
  
  for (const snippet of snippets) {
    const text = snippet.text || snippet;
    
    // Dates
    const dateRegex = /\d{1,2}\.\s?\d{1,2}\.\s?\d{4}|\d{4}-\d{2}-\d{2}/g;
    const dates = text.match(dateRegex) || [];
    facts.dates.push(...dates);
    
    // Numbers (with context)
    const numberRegex = /\d+[\d\s,.]*\s*(km|m|kg|€|KM|USD|%)/g;
    const numbers = text.match(numberRegex) || [];
    facts.numbers.push(...numbers);
    
    // Proper nouns (capitalized words)
    const words = text.split(/\s+/);
    const properNouns = words.filter(w => /^[A-ZČĆŠĐŽ][a-zčćšđž]+/.test(w));
    facts.names.push(...properNouns);
    
    // Locations (BiH cities)
    const cities = ['Tomislavgrad', 'Sarajevo', 'Mostar', 'Banja Luka', 'Tuzla'];
    for (const city of cities) {
      if (text.includes(city)) {
        facts.locations.push(city);
      }
    }
  }
  
  // Deduplicate
  facts.dates = [...new Set(facts.dates)];
  facts.numbers = [...new Set(facts.numbers)];
  facts.names = [...new Set(facts.names)];
  facts.locations = [...new Set(facts.locations)];
  
  return facts;
}

/**
 * Format snippets for LLM context
 * 
 * Output format:
 * [Source 1] snippet text here...
 * [Source 2] another snippet...
 */
function formatSnippetsForLLM(snippets, sources) {
  const formatted = snippets.map((snippet, index) => {
    const sourceNumber = index + 1;
    const sourceUrl = sources[index]?.url || 'Unknown';
    const sourceDomain = sourceUrl ? new URL(sourceUrl).hostname : 'Unknown';
    
    return `[Source ${sourceNumber} - ${sourceDomain}]\n${snippet.text}\n`;
  });
  
  return formatted.join('\n');
}

/**
 * Summarize snippets into key points
 * 
 * Groups related snippets by topic
 */
function summarizeSnippets(snippets) {
  // Simple heuristic: group by first sentence
  const groups = new Map();
  
  for (const snippet of snippets) {
    const text = snippet.text || snippet;
    const firstSentence = text.split(/[.!?]/)[0].trim();
    const key = firstSentence.substring(0, 50); // First 50 chars as key
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(text);
  }
  
  // Return summary
  const summary = [];
  for (const [key, texts] of groups) {
    if (texts.length === 1) {
      summary.push(texts[0]);
    } else {
      // Multiple snippets with similar start - merge
      const merged = texts.join(' ');
      summary.push(merged.substring(0, 500) + '...'); // Cap at 500 chars
    }
  }
  
  return summary;
}

/**
 * Export helpers for testing
 */
const _internal = {
  splitIntoParagraphs,
  scoreSnippetRelevance,
};

module.exports = {
  extractSnippets,
  extractKeyFacts,
  formatSnippetsForLLM,
  _internal,
};
