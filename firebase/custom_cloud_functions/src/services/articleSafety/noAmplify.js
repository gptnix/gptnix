'use strict';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║        No-Amplify Checker — GPTNiX Article Safety            ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║  Post-processing checker that detects amplification:         ║
 * ║  - Source says "možda" → AI says "sigurno"                   ║
 * ║  - Source implies → AI states as fact                        ║
 * ║  - Weak claim → Strong claim                                 ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
// Amplification Detection Patterns
// ─────────────────────────────────────────────────────────────────────────────

// Weak/hedged language (source uses this)
const WEAK_LANGUAGE_PATTERNS = [
  /\b(možda|moguće|vjerojatno|možda|potentially|possibly|likely|presumably)\b/i,
  /\b(čini\s+se|izgleda|appears?|seems?|suggests?)\b/i,
  /\b(navodno|allegedly|reportedly|claimed|purportedly)\b/i,
  /\b(mogao\s+bi|mogla\s+bi|could|might|may)\b/i,
];

// Strong/definitive language (AI should NOT use this if source was hedged)
const STRONG_LANGUAGE_PATTERNS = [
  /\b(sigurno|definitivno|certainly|definitely|clearly|obviously)\b/i,
  /\b(je\s+dokazano|is\s+proven|dokazan|confirmed)\b/i,
  /\b(bez\s+sumnje|without\s+(a\s+)?doubt|undoubtedly)\b/i,
  /\b(je\s+činjenica|is\s+(a\s+)?fact|faktički|factually)\b/i,
];

// Implicit → Explicit amplification
// Source: "optužbe za korupciju" → AI: "korumpiran je" (bad)
const ACCUSATION_AMPLIFICATION = [
  { weak: /optužb(e|a)\s+za/i, strong: /\b(je\s+)?(korumpiran|kriv|guilty|corrupt)\b/i },
  { weak: /sumnja\s+u/i, strong: /\b(sigurno|definitely|clearly)\b/i },
  { weak: /istraga/i, strong: /\b(kriminala?c|criminal|prekršio)\b/i },
];

// ─────────────────────────────────────────────────────────────────────────────
// Checker Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} AmplificationCheckResult
 * @property {boolean} detected - Whether amplification was detected
 * @property {string[]} triggers - Detected amplification patterns
 * @property {number} confidence - Detection confidence 0-1
 * @property {string} suggestion - Rewrite suggestion (if amplified)
 */

/**
 * Check if AI response amplifies source claims
 * 
 * @param {string} sourceText - Original source/article text
 * @param {string} aiResponse - AI-generated response
 * @returns {AmplificationCheckResult}
 */
function checkAmplification(sourceText, aiResponse) {
  const source = String(sourceText || '').toLowerCase();
  const response = String(aiResponse || '').toLowerCase();
  
  if (!source || !response) {
    return {
      detected: false,
      triggers: [],
      confidence: 0,
      suggestion: '',
    };
  }
  
  const triggers = [];
  let detected = false;
  
  // ── CHECK 1: Source has weak language, AI uses strong language ────────────
  const sourceHasWeak = WEAK_LANGUAGE_PATTERNS.some(p => p.test(source));
  const responseHasStrong = STRONG_LANGUAGE_PATTERNS.some(p => p.test(response));
  
  if (sourceHasWeak && responseHasStrong) {
    triggers.push('WEAK→STRONG');
    detected = true;
  }
  
  // ── CHECK 2: Accusation amplification ─────────────────────────────────────
  for (const { weak, strong } of ACCUSATION_AMPLIFICATION) {
    if (weak.test(source) && strong.test(response)) {
      triggers.push('ACCUSATION_AMPLIFIED');
      detected = true;
    }
  }
  
  // ── RESULT ─────────────────────────────────────────────────────────────────
  const confidence = detected ? 0.75 : 0.0;
  const suggestion = detected
    ? 'Rewrite to match source hedging (use "prema tekstu", "autor navodi", "mogućno", etc.)'
    : '';
  
  return _log({
    detected,
    triggers,
    confidence,
    suggestion,
  });
}

/**
 * Simple heuristic: detect if response contains unattributed strong claims
 * (Claims that sound like AI's own conclusion rather than citing source)
 * 
 * @param {string} aiResponse - AI-generated response
 * @returns {boolean}
 */
function hasUnattributedClaims(aiResponse) {
  const response = String(aiResponse || '');
  
  // Check for strong claims without attribution phrases
  const hasStrongClaim = STRONG_LANGUAGE_PATTERNS.some(p => p.test(response));
  
  // Check for attribution phrases
  const ATTRIBUTION_PHRASES = [
    /\b(prema\s+(tekstu|članku|autoru)|according\s+to)\b/i,
    /\b(autor\s+(navodi|tvrdi|kaže)|author\s+(says|claims|states))\b/i,
    /\b(tekst\s+(navodi|sugerira)|text\s+(states|suggests))\b/i,
    /\b(u\s+članku|in\s+the\s+article)\b/i,
  ];
  
  const hasAttribution = ATTRIBUTION_PHRASES.some(p => p.test(response));
  
  // Strong claim without attribution = problematic
  return hasStrongClaim && !hasAttribution;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

function _log(result) {
  if (result.detected) {
    console.log(
      `[ARTICLESAFE:NOAMPLIFY] detected=${result.detected} ` +
      `triggers=${result.triggers.join(',')} conf=${result.confidence.toFixed(2)}`
    );
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  checkAmplification,
  hasUnattributedClaims,
};
