'use strict';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║      Source Type Classification — GPTNiX Article Safety      ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║  Classifies URL sources into risk categories:                ║
 * ║  - gov/doc/academic/wiki → LOW RISK                          ║
 * ║  - mainstream news → MEDIUM RISK                             ║
 * ║  - blog/opinion/forum/social → HIGH RISK                     ║
 * ║  - satire → HIGH RISK                                        ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
// Source Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_TYPES = {
  GOVERNMENT: 'government',
  ACADEMIC: 'academic',
  DOCUMENTATION: 'documentation',
  WIKI: 'wiki',
  MAINSTREAM_NEWS: 'mainstream_news',
  BLOG: 'blog',
  OPINION: 'opinion',
  FORUM: 'forum',
  SOCIAL: 'social',
  SATIRE: 'satire',
  UNKNOWN: 'unknown',
};

// ─────────────────────────────────────────────────────────────────────────────
// Domain Patterns
// ─────────────────────────────────────────────────────────────────────────────

// LOW RISK: Government, Academic, Documentation
const LOW_RISK_PATTERNS = [
  // Government domains
  { pattern: /\.gov(\.|$)/i, type: SOURCE_TYPES.GOVERNMENT },
  { pattern: /\.gov\.ba$/i, type: SOURCE_TYPES.GOVERNMENT },
  { pattern: /\.gov\.hr$/i, type: SOURCE_TYPES.GOVERNMENT },
  { pattern: /\.gov\.rs$/i, type: SOURCE_TYPES.GOVERNMENT },
  { pattern: /\.(europa|ec)\.eu$/i, type: SOURCE_TYPES.GOVERNMENT },
  
  // Academic domains
  { pattern: /\.edu(\.|$)/i, type: SOURCE_TYPES.ACADEMIC },
  { pattern: /\.ac\.(uk|ba|hr|rs)$/i, type: SOURCE_TYPES.ACADEMIC },
  { pattern: /\.(mit|stanford|harvard|oxf(ord)?|cam(bridge)?)\.edu$/i, type: SOURCE_TYPES.ACADEMIC },
  { pattern: /pubmed|ncbi\.nlm\.nih\.gov/i, type: SOURCE_TYPES.ACADEMIC },
  { pattern: /scholar\.google/i, type: SOURCE_TYPES.ACADEMIC },
  { pattern: /arxiv\.org/i, type: SOURCE_TYPES.ACADEMIC },
  
  // Documentation sites
  { pattern: /docs\.(microsoft|google|aws|oracle|python|nodejs|mozilla)\.com/i, type: SOURCE_TYPES.DOCUMENTATION },
  { pattern: /(developer|api|doc)\.(mozilla|apple|android)\.com/i, type: SOURCE_TYPES.DOCUMENTATION },
  { pattern: /readthedocs\.io/i, type: SOURCE_TYPES.DOCUMENTATION },
  
  // Wikipedia & wikis
  { pattern: /wikipedia\.org/i, type: SOURCE_TYPES.WIKI },
  { pattern: /wikidata\.org/i, type: SOURCE_TYPES.WIKI },
  { pattern: /wikimedia\.org/i, type: SOURCE_TYPES.WIKI },
];

// MEDIUM RISK: Mainstream News
const MEDIUM_RISK_PATTERNS = [
  // International mainstream
  { pattern: /(bbc\.com|bbc\.co\.uk)/i, type: SOURCE_TYPES.MAINSTREAM_NEWS },
  { pattern: /(cnn\.com|reuters\.com|apnews\.com)/i, type: SOURCE_TYPES.MAINSTREAM_NEWS },
  { pattern: /(nytimes\.com|washingtonpost\.com|theguardian\.com)/i, type: SOURCE_TYPES.MAINSTREAM_NEWS },
  { pattern: /(aljazeera\.com|dw\.com)/i, type: SOURCE_TYPES.MAINSTREAM_NEWS },
  
  // Regional mainstream (Balkans)
  { pattern: /(index\.hr|jutarnji\.hr|vecernji\.hr|24sata\.hr)/i, type: SOURCE_TYPES.MAINSTREAM_NEWS },
  { pattern: /(n1info\.com|klix\.ba|avaz\.ba|dnevnik\.ba)/i, type: SOURCE_TYPES.MAINSTREAM_NEWS },
  { pattern: /(blic\.rs|kurir\.rs|novosti\.rs|telegraf\.rs)/i, type: SOURCE_TYPES.MAINSTREAM_NEWS },
  { pattern: /(radiosarajevo\.ba|slobodnabosna\.ba)/i, type: SOURCE_TYPES.MAINSTREAM_NEWS },
];

// HIGH RISK: Blogs, Opinion, Forums, Social
const HIGH_RISK_PATTERNS = [
  // Blog platforms
  { pattern: /(medium\.com|substack\.com|blogspot\.com|wordpress\.com)/i, type: SOURCE_TYPES.BLOG },
  { pattern: /\/blog\//i, type: SOURCE_TYPES.BLOG },
  
  // Opinion/Editorial sites
  { pattern: /(huffpost\.com|vox\.com|salon\.com|slate\.com)/i, type: SOURCE_TYPES.OPINION },
  { pattern: /\/(opinion|komentar|editorial)\//i, type: SOURCE_TYPES.OPINION },
  
  // Forums
  { pattern: /(reddit\.com|quora\.com|stackexchange\.com|stackoverflow\.com)/i, type: SOURCE_TYPES.FORUM },
  { pattern: /forum\./i, type: SOURCE_TYPES.FORUM },
  
  // Social media
  { pattern: /(twitter\.com|x\.com|facebook\.com|instagram\.com)/i, type: SOURCE_TYPES.SOCIAL },
  { pattern: /(tiktok\.com|linkedin\.com|youtube\.com)/i, type: SOURCE_TYPES.SOCIAL },
  
  // Satire
  { pattern: /(theonion\.com|clickhole\.com|newtral\.ba)/i, type: SOURCE_TYPES.SATIRE },
];

// ─────────────────────────────────────────────────────────────────────────────
// Risk Scoring
// ─────────────────────────────────────────────────────────────────────────────

const RISK_SCORES = {
  [SOURCE_TYPES.GOVERNMENT]: 0.1,
  [SOURCE_TYPES.ACADEMIC]: 0.15,
  [SOURCE_TYPES.DOCUMENTATION]: 0.1,
  [SOURCE_TYPES.WIKI]: 0.25,
  [SOURCE_TYPES.MAINSTREAM_NEWS]: 0.50,
  [SOURCE_TYPES.BLOG]: 0.75,
  [SOURCE_TYPES.OPINION]: 0.80,
  [SOURCE_TYPES.FORUM]: 0.85,
  [SOURCE_TYPES.SOCIAL]: 0.90,
  [SOURCE_TYPES.SATIRE]: 0.95,
  [SOURCE_TYPES.UNKNOWN]: 0.60, // default medium-high
};

// ─────────────────────────────────────────────────────────────────────────────
// Classification Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SourceClassification
 * @property {string} sourceType - Type of source (government, news, blog, etc.)
 * @property {number} riskScore - Risk score 0-1 (0=safe, 1=highest risk)
 * @property {string[]} reasons - Classification reasons
 * @property {string} domain - Extracted domain
 */

/**
 * Classify URL source type and risk level
 * 
 * @param {string} url - URL to classify
 * @returns {SourceClassification}
 */
function classifySourceType(url) {
  if (!url || typeof url !== 'string') {
    return {
      sourceType: SOURCE_TYPES.UNKNOWN,
      riskScore: RISK_SCORES[SOURCE_TYPES.UNKNOWN],
      reasons: ['INVALID_URL'],
      domain: '',
    };
  }
  
  // Extract domain
  const domain = _extractDomain(url);
  if (!domain) {
    return {
      sourceType: SOURCE_TYPES.UNKNOWN,
      riskScore: RISK_SCORES[SOURCE_TYPES.UNKNOWN],
      reasons: ['NO_DOMAIN'],
      domain: '',
    };
  }
  
  const reasons = [];
  
  // ── PASS 1: LOW RISK (government, academic, docs, wiki) ───────────────────
  for (const { pattern, type } of LOW_RISK_PATTERNS) {
    if (pattern.test(url)) {
      reasons.push(`MATCHED:${type.toUpperCase()}`);
      return _log({
        sourceType: type,
        riskScore: RISK_SCORES[type],
        reasons,
        domain,
      });
    }
  }
  
  // ── PASS 2: MEDIUM RISK (mainstream news) ─────────────────────────────────
  for (const { pattern, type } of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(url)) {
      reasons.push(`MATCHED:${type.toUpperCase()}`);
      return _log({
        sourceType: type,
        riskScore: RISK_SCORES[type],
        reasons,
        domain,
      });
    }
  }
  
  // ── PASS 3: HIGH RISK (blog, opinion, forum, social, satire) ──────────────
  for (const { pattern, type } of HIGH_RISK_PATTERNS) {
    if (pattern.test(url)) {
      reasons.push(`MATCHED:${type.toUpperCase()}`);
      return _log({
        sourceType: type,
        riskScore: RISK_SCORES[type],
        reasons,
        domain,
      });
    }
  }
  
  // ── FALLBACK: UNKNOWN ──────────────────────────────────────────────────────
  reasons.push('NO_PATTERN_MATCH');
  return _log({
    sourceType: SOURCE_TYPES.UNKNOWN,
    riskScore: RISK_SCORES[SOURCE_TYPES.UNKNOWN],
    reasons,
    domain,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Extract domain from URL
// ─────────────────────────────────────────────────────────────────────────────

function _extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    // Fallback: simple regex
    const match = url.match(/^https?:\/\/([^/]+)/i);
    return match ? match[1].toLowerCase() : '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

function _log(result) {
  console.log(
    `[ARTICLESAFE:CLASSIFY] type=${result.sourceType} risk=${result.riskScore.toFixed(2)} ` +
    `domain=${result.domain} reasons=${result.reasons.join(',')}`
  );
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  classifySourceType,
  SOURCE_TYPES,
  RISK_SCORES,
};
