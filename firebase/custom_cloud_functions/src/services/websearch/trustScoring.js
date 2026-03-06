/* eslint-disable no-console */
'use strict';

const OFFICIAL_DOMAINS_CFG = require('../../config/officialDomains');
/**
 * Trust Scoring System - V2.0
 * 
 * Industry best practices from Perplexity
 * 
 * Purpose:
 * - Score search results by trustworthiness
 * - Consider: domain authority, freshness, relevance
 * - Filter low-quality sources
 * 
 * Scoring factors:
 * +3: Official domains (.gov, .edu, known authorities)
 * +2: Recent content (today, this week)
 * +1-5: Query relevance match
 * -2: Social media (for non-social queries)
 * -3: Directory/aggregator sites
 * 
 * @module trustScoring
 */

const { getDomain } = require('../../utils/url');

/**
 * Calculate trust score for a search result
 * 
 * @param {object} result - Search result { url, title, snippet, ... }
 * @param {string} query - Original query
 * @param {object} classification - Query classification
 * @returns {number} Trust score (0-10+)
 */
function calculateTrustScore(result, query, classification) {
  let score = 5.0; // Base score (neutral)
  
  const domain = getDomain(result.url) || '';
  const url = result.url || '';
  const title = (result.title || '').toLowerCase();
  const snippet = (result.snippet || '').toLowerCase();
  const queryLower = query.toLowerCase();
  
  // =================================================================
  // DOMAIN AUTHORITY
  // =================================================================
  
  // Official domains (+3)
  if (isOfficialDomain(domain)) {
    score += 3.0;
    console.log(`📊 [TRUST] ${domain}: Official domain +3`);
  }
  
  // Educational/Research (+2)
  if (isEducationalDomain(domain)) {
    score += 2.0;
    console.log(`📊 [TRUST] ${domain}: Educational +2`);
  }
  
  // News organizations (+1.5)
  if (isNewsDomain(domain)) {
    score += 1.5;
    console.log(`📊 [TRUST] ${domain}: News org +1.5`);
  }
  
  // Social media (-2 for non-social queries)
  if (isSocialMedia(domain) && classification.intent !== 'social') {
    score -= 2.0;
    console.log(`📊 [TRUST] ${domain}: Social media -2`);
  }
  
  // Directory/aggregator sites (-3)
  if (isDirectorySite(domain)) {
    score -= 3.0;
    console.log(`📊 [TRUST] ${domain}: Directory site -3`);
  }
  
  // Low-quality domains (-2)
  if (isLowQualityDomain(domain)) {
    score -= 2.0;
    console.log(`📊 [TRUST] ${domain}: Low quality -2`);
  }
  
  // =================================================================
  // FRESHNESS — differentiated by dateType (published vs modified)
  // published date → full bonus/penalty
  // modified date  → dampened (page rebuild ≠ content update)
  // no date        → text heuristic fallback
  // =================================================================

  const publishedAt = result?.publishedAt || result?.publishedAtIso || result?.date || null;
  const dateType    = result?.dateType || 'unknown';
  const domainClass = result?.domain || 'general';

  // Domain-level trust overrides (before timestamp scoring)
  if (domainClass === 'wiki') {
    score -= 1.0;
    console.log(`📊 [TRUST] ${domain}: Wiki domain -1.0`);
  } else if (domainClass === 'gov') {
    score += 1.0;
    console.log(`📊 [TRUST] ${domain}: Gov domain +1.0`);
  }

  if (publishedAt) {
    const t = Date.parse(String(publishedAt));
    if (isFinite(t)) {
      const days = (Date.now() - t) / 86400000;
      // published date: full weight
      // modified date: half weight (less reliable for content age)
      const w = (dateType === 'published') ? 1.0 : 0.5;
      if (days <= 30) {
        const bonus = 2.5 * w;
        score += bonus;
        console.log(`📊 [TRUST] ${domain}: Fresh ≤30d +${bonus.toFixed(1)} (${dateType})`);
      } else if (days <= 180) {
        const bonus = 1.0 * w;
        score += bonus;
        console.log(`📊 [TRUST] ${domain}: Recent ≤6mo +${bonus.toFixed(1)} (${dateType})`);
      } else if (days <= 730) {
        const penalty = 0.5 * w;
        score -= penalty;
        console.log(`📊 [TRUST] ${domain}: Aging ≤2y -${penalty.toFixed(1)} (${dateType})`);
      } else {
        const penalty = 2.0 * w;
        score -= penalty;
        console.log(`📊 [TRUST] ${domain}: Stale >2y -${penalty.toFixed(1)} (${dateType})`);
      }
    }
  } else {
    // No date — weak text heuristic fallback
    if (hasRecentIndicators(title, snippet)) {
      score += 0.8;
      console.log(`📊 [TRUST] ${domain}: Text-fresh +0.8`);
    } else if (hasStaleIndicators(title, snippet)) {
      score -= 1.0;
      console.log(`📊 [TRUST] ${domain}: Text-stale -1.0`);
    }
  }
  
  // =================================================================
  // RELEVANCE
  // =================================================================
  
  // Query match in title (+2-5)
  const titleRelevance = calculateRelevance(title, queryLower);
  if (titleRelevance > 0) {
    const titleBoost = Math.min(titleRelevance * 2, 5);
    score += titleBoost;
    console.log(`📊 [TRUST] ${domain}: Title relevance +${titleBoost.toFixed(1)}`);
  }
  
  // Query match in snippet (+1-3)
  const snippetRelevance = calculateRelevance(snippet, queryLower);
  if (snippetRelevance > 0) {
    const snippetBoost = Math.min(snippetRelevance, 3);
    score += snippetBoost;
    console.log(`📊 [TRUST] ${domain}: Snippet relevance +${snippetBoost.toFixed(1)}`);
  }
  
  // Location match (+1.5)
  if (classification.location && hasLocationMatch(title, snippet, classification.location)) {
    score += 1.5;
    console.log(`📊 [TRUST] ${domain}: Location match +1.5`);
  }
  
  // =================================================================
  // INTENT-SPECIFIC SCORING
  // =================================================================
  
  // Contact queries: boost pages with contact signals
  if (classification.intent === 'contact') {
    if (hasContactSignals(url, title, snippet)) {
      score += 2.0;
      console.log(`📊 [TRUST] ${domain}: Contact signals +2`);
    }
  }
  
  // News queries: boost recent news
  if (classification.intent === 'news') {
    if (hasNewsSignals(title, snippet)) {
      score += 1.5;
      console.log(`📊 [TRUST] ${domain}: News signals +1.5`);
    }
  }
  
  // Clamp score to 0-10 range (allow exceeding 10 for exceptional sources)
  const finalScore = Math.max(0, score);
  
  console.log(`📊 [TRUST] ${domain}: Final score = ${finalScore.toFixed(1)}`);
  
  return finalScore;
}

/**
 * Filter results by trust score
 * 
 * @param {array} results - Search results
 * @param {number} minScore - Minimum trust score (default: 3.0)
 * @returns {array} Filtered results
 */
function filterByTrust(results, minScore = 3.0) {
  const filtered = results.filter(r => (r.trustScore || 0) >= minScore);
  
  console.log(`📊 [TRUST] Filtered: ${results.length} → ${filtered.length} (min score: ${minScore})`);
  
  return filtered;
}

/**
 * Rank results by trust score
 * 
 * @param {array} results - Search results with trust scores
 * @returns {array} Ranked results (highest score first)
 */
function rankByTrust(results) {
  return [...results].sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0));
}

// =================================================================
// DOMAIN CLASSIFICATION HELPERS
// =================================================================

/**
 * Check if domain is official (government, known authorities)
 */
function isOfficialDomain(domain) {
  const d = String(domain || '').toLowerCase();
  const cfg = OFFICIAL_DOMAINS_CFG;

  // Tier A: .gov TLD + EU/international
  if (cfg.govTldPatterns.some(re => re.test(d))) return true;

  // Tier B: exact whitelist
  if (cfg.exact.some(e => d === e || d.endsWith('.' + e))) return true;

  // Tier C: prefix match (must start domain, not appear mid-domain)
  if (cfg.prefixes.some(p => d.startsWith(p) || d.includes('.' + p) || d.includes('//' + p))) return true;

  // Tier D: suffix match
  if (cfg.suffixes.some(s => d.endsWith(s) || d.includes(s + '/'))) return true;

  return false;
}
/**
 * Check if domain is educational/research
 */
function isEducationalDomain(domain) {
  const educational = [
    /\.edu$/i,
    /unsa\.ba/i,  // University Sarajevo
    /unmo\.ba/i,  // University Mostar
    /unibl\.org/i, // University Banja Luka
    /wikipedia\.org/i,
  ];
  
  return educational.some(pattern => pattern.test(domain));
}

/**
 * Check if domain is news organization
 */
function isNewsDomain(domain) {
  const news = [
    // BiH news
    /klix\.ba/i,
    /avaz\.ba/i,
    /bljesak\.info/i,
    /hercegovina\.info/i,
    /oslobodjenje\.ba/i,
    /source\.ba/i,
    
    // Regional news
    /index\.hr/i,
    /vecernji\.hr/i,
    /jutarnji\.hr/i,
    /24sata\.hr/i,
    
    // International
    /bbc\.com|bbc\.co\.uk/i,
    /cnn\.com/i,
    /reuters\.com/i,
    /apnews\.com/i,
  ];
  
  return news.some(pattern => pattern.test(domain));
}

/**
 * Check if domain is social media
 */
function isSocialMedia(domain) {
  const social = [
    /facebook\.com/i,
    /instagram\.com/i,
    /twitter\.com|x\.com/i,
    /t\.co/i,
    /linkedin\.com/i,
    /tiktok\.com/i,
    /youtube\.com/i,
    /reddit\.com/i,
  ];
  
  return social.some(pattern => pattern.test(domain));
}

/**
 * Check if domain is directory/aggregator
 */
function isDirectorySite(domain) {
  const directories = [
    /lokal\.ba/i,
    /akta\.ba/i,
    /poslovnenovine\.ba/i,
    /posao\.ba/i,
    /yellowpages/i,
    /11811|11888/i,
    /moj-?biznis/i,
    /telefonski-?imenik/i,
    /katalog/i,
    /business-?directory/i,
  ];
  
  return directories.some(pattern => pattern.test(domain));
}

/**
 * Check if domain is low-quality
 */
function isLowQualityDomain(domain) {
  const lowQuality = [
    /blogspot\.com/i,
    /wordpress\.com/i,
    /wix\.com/i,
    /weebly\.com/i,
    /medium\.com/i,  // Unless verified publication
  ];
  
  return lowQuality.some(pattern => pattern.test(domain));
}

// =================================================================
// CONTENT ANALYSIS HELPERS
// =================================================================

/**
 * Check for recent content indicators
 */
function hasRecentIndicators(title, snippet) {
  const recentPatterns = [
    /\b(danas|today|upravo|just|sada|now)\b/i,
    /\b(ovu\s+večer|tonight|ovo\s+jutro|this\s+morning)\b/i,
    /\b(najnovije|latest|breaking|live|aktualno)\b/i,
    /2025|2026/i, // Current years
  ];
  
  const text = `${title} ${snippet}`;
  return recentPatterns.some(pattern => pattern.test(text));
}

/**
 * Check for stale content indicators
 */
function hasStaleIndicators(title, snippet) {
  const stalePatterns = [
    /201[0-8]/i, // Old years
    /archived|arhiv/i,
    /outdated|zastarjelo/i,
  ];
  
  const text = `${title} ${snippet}`;
  return stalePatterns.some(pattern => pattern.test(text));
}

/**
 * Check for contact signals
 */
function hasContactSignals(url, title, snippet) {
  const contactPatterns = [
    /kontakt|contact/i,
    /telefon|phone|tel\b/i,
    /email|e-mail/i,
    /adresa|address/i,
    /radno\s+vrijeme|working\s+hours/i,
    /o\s+nama|about\s+us/i,
  ];
  
  const text = `${url} ${title} ${snippet}`;
  return contactPatterns.some(pattern => pattern.test(text));
}

/**
 * Check for news signals
 */
function hasNewsSignals(title, snippet) {
  const newsPatterns = [
    /vijesti|news/i,
    /objavljeno|published/i,
    /saopštenje|press\s+release/i,
    /izvještaj|report/i,
  ];
  
  const text = `${title} ${snippet}`;
  return newsPatterns.some(pattern => pattern.test(text));
}

/**
 * Check for location match
 */
function hasLocationMatch(title, snippet, location) {
  if (!location || location === 'generic') return false;
  
  const text = `${title} ${snippet}`.toLowerCase();
  return text.includes(location.toLowerCase());
}

/**
 * Calculate relevance score
 * 
 * Based on:
 * - Exact phrase match (high score)
 * - Word match (medium score)
 * - Partial match (low score)
 */
function calculateRelevance(text, query) {
  let score = 0;
  
  // Exact phrase match (+3)
  if (text.includes(query)) {
    score += 3;
  }
  
  // Word match (+1 per word, max 3)
  const queryWords = query.split(/\s+/).filter(w => w.length >= 3);
  const matchedWords = queryWords.filter(word => text.includes(word)).length;
  score += Math.min(matchedWords, 3);
  
  return score;
}

/**
 * Export helpers for testing
 */
const _internal = {
  isOfficialDomain,
  isEducationalDomain,
  isNewsDomain,
  isSocialMedia,
  isDirectorySite,
  isLowQualityDomain,
  hasRecentIndicators,
  hasStaleIndicators,
  hasContactSignals,
  hasNewsSignals,
  hasLocationMatch,
  calculateRelevance,
};

module.exports = {
  calculateTrustScore,
  filterByTrust,
  rankByTrust,
  _internal,
};
