'use strict';

const {
  TAVILY_API_KEY,
  TAVILY_API_BASE,
  WEBSEARCH_DEFAULT_MAX_RESULTS,
} = require('../../../config/env');
const { fetchJson } = require('../http');
const { logUsageEvent } = require('../../../billing/logger');
const { usdFromTavily } = require('../../../billing/cost');

function tavilyAvailable() {
  return Boolean(TAVILY_API_KEY);
}

/**
 * Helper: Determine if images should be included based on query
 * @param {string} query - Search query
 * @returns {boolean}
 */
function shouldIncludeImages(query) {
  if (!query || typeof query !== 'string') return false;
  
  const normalized = query.trim().toLowerCase();
  
  // Always include for visual queries
  const visualKeywords = [
    /\b(slika|slike|photo|photos|image|images|picture|fotografija)\b/i,
    /\b(video|videos|film|filmovi)\b/i,
    /\b(izgled|appearance|pogledaj|show\s+me)\b/i,
  ];
  
  if (visualKeywords.some(p => p.test(normalized))) {
    return true;
  }
  
  // Include for product/location queries
  const productLocationKeywords = [
    /\b(proizvod|product|kupiti|buy|shop|hotel|restoran|restaurant)\b/i,
    /\b(mjesto|place|lokacija|location)\b/i,
  ];
  
  if (productLocationKeywords.some(p => p.test(normalized))) {
    return true;
  }
  
  // Skip for news (text-focused)
  const newsKeywords = [
    /\b(vijesti|novosti|vesti|news|latest|najnovije)\b/i,
  ];
  
  if (newsKeywords.some(p => p.test(normalized))) {
    return false;
  }
  
  // Skip for contact (text-focused)
  const contactKeywords = [
    /\b(kontakt|kontakti|contact|contacts|telefon|email|adresa)\b/i,
  ];
  
  if (contactKeywords.some(p => p.test(normalized))) {
    return false;
  }
  
  // Default: skip images (text queries are more common)
  return false;
}

async function tavilySearch({
  query,
  maxResults = WEBSEARCH_DEFAULT_MAX_RESULTS,
  topic = 'general', // general|news|finance
  searchDepth = 'basic', // basic|advanced
  timeRange,
  includeAnswer = false,
  includeRawContent = false, // false|true|'markdown'|'text'
  includeFavicon = true,
  includeImages, // V5.2.0: Now optional, auto-detected if not provided
  country,
  billing,
  timeout = 6000, // V5.2.0: 6s timeout (down from 12s)
} = {}) {
  if (!tavilyAvailable()) {
    const err = new Error('Tavily API key missing');
    err.code = 'TAVILY_KEY_MISSING';
    throw err;
  }

  if (!query || typeof query !== 'string') {
    throw new Error('query required');
  }

  const url = `${TAVILY_API_BASE.replace(/\/$/, '')}/search`;
  
  // V5.2.0: Conditional images based on query if not explicitly set
  const shouldInclude = includeImages !== undefined 
    ? Boolean(includeImages) 
    : shouldIncludeImages(query);
  
  const payload = {
    query,
    topic,
    search_depth: searchDepth,
    max_results: Math.max(1, Math.min(20, Number(maxResults) || 5)),
    include_answer: includeAnswer,
    include_raw_content: includeRawContent,
    include_favicon: includeFavicon,
    include_images: shouldInclude, // V5.2.0: Conditional!
    include_image_descriptions: shouldInclude, // V5.2.0: Conditional!
  };

  if (timeRange) payload.time_range = timeRange;
  if (country) payload.country = country;

  console.log('🔍 [TAVILY] Request payload:', {
    query,
    timeout,
    include_images: payload.include_images,
    include_image_descriptions: payload.include_image_descriptions,
  });

  const json = await fetchJson(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TAVILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    timeout, // V5.2.0: Pass timeout to fetchJson
  });


// 💸 billing: Tavily credits
try {
  const depth = String(searchDepth || 'basic');
  const credits = depth === 'advanced' ? 2 : 1;
  const { usd } = usdFromTavily({ credits });
  await logUsageEvent({
    userId: billing?.userId || null,
    conversationId: billing?.conversationId || null,
    requestId: billing?.requestId || null,
    kind: 'websearch',
    provider: 'tavily',
    model: null,
    operation: 'search',
    units: { credits, searchDepth: depth, maxResults: payload.max_results },
    costUsd: usd,
    meta: { queryLen: String(query || '').length },
  });
} catch (_) {}

  const results = Array.isArray(json?.results) ? json.results : [];
  const images = Array.isArray(json?.images) ? json.images : []; // ✅ Parse images array

  // ✅ DEBUG: Log what Tavily returned
  console.log('🖼️ [TAVILY] Response:', {
    resultsCount: results.length,
    hasImagesField: 'images' in json,
    imagesType: Array.isArray(json?.images) ? 'array' : typeof json?.images,
    imagesCount: images.length,
    firstImage: images[0] || null,
    rawKeys: Object.keys(json || {}),
  });

  return {
    provider: 'tavily',
    query: json?.query || query,
    answer: json?.answer || null,
    responseTime: json?.response_time ? Number(json.response_time) : null,
    requestId: json?.request_id || null,
    images: images.map((img, idx) => ({
      rank: idx + 1,
      url: typeof img === 'string' ? img : (img?.url || ''),
      description: typeof img === 'object' ? (img?.description || '') : '',
    })), // ✅ Return images array
    results: results.map((r, idx) => ({
      rank: idx + 1,
      title: r?.title || '',
      url: r?.url || '',
      snippet: r?.content || '',
      publishedAt: r?.published_date || r?.published_time || r?.date || null,
      score: typeof r?.score === 'number' ? r.score : null,
      rawContent: r?.raw_content || null,
      favicon: r?.favicon || null,
      imageUrl: images[idx] ? (typeof images[idx] === 'string' ? images[idx] : images[idx]?.url) : null, // ✅ Match result with image
    })),
    raw: json,
  };
}

module.exports = {
  tavilyAvailable,
  tavilySearch,
};

// Compatibility helper for WebSearch V2 providerWrappers
async function searchTavily(query, options = {}) {
  const max_results = options.max_results || options.maxResults || 10;
  const out = await tavilySearch({ query, max_results });
  const results = Array.isArray(out?.results) ? out.results : [];
  return results.slice(0, max_results).map(r => ({
    url: r.url || '',
    title: r.title || '',
    snippet: r.content || r.snippet || '',
  }));
}

module.exports.searchTavily = searchTavily;
