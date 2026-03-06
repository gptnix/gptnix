'use strict';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║         Article Input Detection — GPTNiX Article Safety      ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║  Detects when user input contains article-like content:      ║
 * ║  1) URL presence (http/https)                                ║
 * ║  2) Long pasted text (>1200 chars) with news/opinion markers ║
 * ║  3) Explicit article sharing phrases                         ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MIN_ARTICLE_LENGTH = 1200; // minimum characters for "long pasted text"
const VERY_LONG_TEXT_THRESHOLD = 3000; // very likely article/document

// ─────────────────────────────────────────────────────────────────────────────
// URL Detection
// ─────────────────────────────────────────────────────────────────────────────

const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;

/**
 * Extract all URLs from text
 * @param {string} text
 * @returns {string[]}
 */
function extractUrls(text) {
  const matches = text.match(URL_PATTERN);
  return matches || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// News/Opinion Markers
// ─────────────────────────────────────────────────────────────────────────────

const NEWS_OPINION_MARKERS = [
  // News keywords
  /\b(izvještaj|izvještava|izvijestio|izvjestio|report(s|ed)?|breaking|breaking news)\b/i,
  /\b(vijest|vijesti|news|novosti|article|članak|clanak)\b/i,
  /\b(objav(ljen|ljeno)|publish(ed)?|reported|announced)\b/i,
  
  // Opinion/editorial keywords
  /\b(koment(ar|ira)|comment(ary)?|opinion|mišljenje|misljenje|editorial|kolumna)\b/i,
  /\b(analiz(a|e)|analy(sis|ze)|kritik(a|e)|critic(ism)?)\b/i,
  
  // Attribution phrases (common in news)
  /\b(prema\s+(izvoru|izvještaju|studiji)|according\s+to|sources?\s+say|officials?\s+said)\b/i,
  /\b(izjav(io|ila|e)|statement|declared|announced)\b/i,
  
  // Media/publication references
  /\b(novine|časopis|magazin|newspaper|magazine|portal|portal\.ba|N1|index\.hr)\b/i,
  /\b(autor|author|written\s+by|pisao|napisao)\b/i,
  
  // Datelines (news-specific)
  /\b\d{1,2}\.\s*(siječanj|siječnja|veljača|ožujak|travanj|svibanj|lipanj|srpanj|kolovoz|rujan|listopad|studeni|prosinac)/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
];

/**
 * Check if text contains news/opinion markers
 * @param {string} text
 * @returns {boolean}
 */
function hasNewsOpinionMarkers(text) {
  let markerCount = 0;
  for (const pattern of NEWS_OPINION_MARKERS) {
    if (pattern.test(text)) {
      markerCount++;
      if (markerCount >= 2) return true; // 2+ markers = likely news/opinion
    }
  }
  return markerCount >= 1 && text.length > VERY_LONG_TEXT_THRESHOLD;
}

// ─────────────────────────────────────────────────────────────────────────────
// Explicit Article Sharing Phrases
// ─────────────────────────────────────────────────────────────────────────────

const ARTICLE_SHARING_PATTERNS = [
  /\b(pročitaj|read|analiziraj|analy[sz]e|sažmi|summar(ize)?)\s+(ovaj\s+)?(članak|clanak|tekst|article|text|link|URL)\b/i,
  /\b(što\s+misliš\s+o|what\s+do\s+you\s+think\s+(about|of))\s+(ovom\s+)?(članku|clanku|tekstu|article)\b/i,
  /\b(komentiraj|comment\s+on)\s+(ovaj\s+)?(članak|tekst|article)\b/i,
  /\b(evo\s+(ti\s+)?(članka|clanka|teksta|linka)|here('s|s)\s+(an\s+)?article)\b/i,
];

/**
 * Check if user explicitly shares/requests article analysis
 * @param {string} text
 * @returns {boolean}
 */
function hasExplicitArticleSharing(text) {
  return ARTICLE_SHARING_PATTERNS.some(p => p.test(text));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Detection Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ArticleDetectionResult
 * @property {boolean} detected - Whether article input was detected
 * @property {string} reason - Detection reason (URL, LONG_TEXT, EXPLICIT_SHARE, NONE)
 * @property {string[]} urls - Extracted URLs (if any)
 * @property {number} textLength - Length of input text
 * @property {number} confidence - Detection confidence (0-1)
 */

/**
 * Detect if user input contains article-like content
 * 
 * @param {string} userText - Raw user message
 * @returns {ArticleDetectionResult}
 */
function detectArticleInput(userText) {
  const text = String(userText || '').trim();
  
  if (!text) {
    return _log({
      detected: false,
      reason: 'EMPTY_MESSAGE',
      urls: [],
      textLength: 0,
      confidence: 0
    });
  }
  
  const urls = extractUrls(text);
  const textLength = text.length;
  
  // ── DETECTION 1: URL presence ─────────────────────────────────────────────
  if (urls.length > 0) {
    // URL present = high confidence article mode
    return _log({
      detected: true,
      reason: 'URL_PRESENT',
      urls,
      textLength,
      confidence: 0.95
    });
  }
  
  // ── DETECTION 2: Explicit article sharing phrases ─────────────────────────
  if (hasExplicitArticleSharing(text)) {
    return _log({
      detected: true,
      reason: 'EXPLICIT_ARTICLE_SHARE',
      urls: [],
      textLength,
      confidence: 0.90
    });
  }
  
  // ── DETECTION 3: Long pasted text with news/opinion markers ───────────────
  if (textLength >= MIN_ARTICLE_LENGTH) {
    if (hasNewsOpinionMarkers(text)) {
      return _log({
        detected: true,
        reason: 'LONG_TEXT_WITH_NEWS_MARKERS',
        urls: [],
        textLength,
        confidence: 0.85
      });
    }
    
    // Very long text (3000+) = likely article even without markers
    if (textLength >= VERY_LONG_TEXT_THRESHOLD) {
      return _log({
        detected: true,
        reason: 'VERY_LONG_TEXT',
        urls: [],
        textLength,
        confidence: 0.75
      });
    }
  }
  
  // ── NO DETECTION ──────────────────────────────────────────────────────────
  return _log({
    detected: false,
    reason: 'NONE',
    urls: [],
    textLength,
    confidence: 0
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

function _log(result) {
  console.log(
    `[ARTICLESAFE:DETECT] detected=${result.detected} reason=${result.reason} ` +
    `urls=${result.urls.length} len=${result.textLength} conf=${result.confidence.toFixed(2)}`
  );
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  detectArticleInput,
  extractUrls,
  hasNewsOpinionMarkers,
  hasExplicitArticleSharing,
  MIN_ARTICLE_LENGTH,
  VERY_LONG_TEXT_THRESHOLD,
};
