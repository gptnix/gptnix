'use strict';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║      Article Safety Layer — GPTNiX Main Orchestrator         ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║  Global article safety layer that:                           ║
 * ║  1) Detects article-like input (URL, long text, etc.)        ║
 * ║  2) Classifies source type & risk                            ║
 * ║  3) Scans for defamation risk                                ║
 * ║  4) Enforces attribution lock in system prompt               ║
 * ║  5) Post-checks for amplification                            ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const { detectArticleInput } = require('./detectArticleInput');
const { classifySourceType } = require('./classifySourceType');
const { scanDefamationRisk } = require('./defamationRisk');
const { checkAmplification, hasUnattributedClaims } = require('./noAmplify');

// ─────────────────────────────────────────────────────────────────────────────
// Main Article Safety Evaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ArticleSafetyContext
 * @property {boolean} enabled - Whether article safety layer is active
 * @property {string} reason - Detection reason
 * @property {number} riskScore - Overall risk score 0-1
 * @property {string} riskLevel - Overall risk level (low, medium, high, critical)
 * @property {object} detection - Article detection result
 * @property {object|null} sourceClassification - Source classification (if URL)
 * @property {object} defamation - Defamation risk scan result
 * @property {string[]} safetyFlags - List of safety flags
 */

/**
 * Evaluate article safety for user input
 * 
 * @param {string} userText - Raw user message
 * @returns {ArticleSafetyContext}
 */
function evaluateArticleSafety(userText) {
  const text = String(userText || '').trim();
  
  // ── STEP 1: Detect article input ──────────────────────────────────────────
  const detection = detectArticleInput(text);
  
  if (!detection.detected) {
    return _logDisabled('NO_ARTICLE_DETECTED');
  }
  
  // ── STEP 2: Classify source type (if URL present) ─────────────────────────
  let sourceClassification = null;
  if (detection.urls.length > 0) {
    // Classify first URL (primary source)
    sourceClassification = classifySourceType(detection.urls[0]);
  }
  
  // ── STEP 3: Scan for defamation risk ──────────────────────────────────────
  const defamation = scanDefamationRisk(text);
  
  // ── STEP 4: Calculate overall risk ────────────────────────────────────────
  const risks = [
    detection.confidence,
    sourceClassification ? sourceClassification.riskScore : 0.5,
    defamation.score,
  ];
  
  const riskScore = Math.max(...risks); // take highest risk
  const riskLevel = _calculateRiskLevel(riskScore, defamation.level);
  
  // ── STEP 5: Determine safety flags ────────────────────────────────────────
  const safetyFlags = [];
  
  if (detection.urls.length > 0) {
    safetyFlags.push('URL_PRESENT');
  }
  
  if (sourceClassification && sourceClassification.riskScore > 0.7) {
    safetyFlags.push('HIGH_RISK_SOURCE');
  }
  
  if (defamation.level === 'high' || defamation.level === 'critical') {
    safetyFlags.push('DEFAMATION_RISK');
  }
  
  if (defamation.personCount > 0 && defamation.accusationCount > 0) {
    safetyFlags.push('PERSON+ACCUSATION');
  }
  
  // ── RESULT ─────────────────────────────────────────────────────────────────
  const context = {
    enabled: true,
    reason: detection.reason,
    riskScore,
    riskLevel,
    detection,
    sourceClassification,
    defamation,
    safetyFlags,
  };
  
  _logEnabled(context);
  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Level Calculation
// ─────────────────────────────────────────────────────────────────────────────

function _calculateRiskLevel(riskScore, defamationLevel) {
  // Defamation level overrides score-based level if critical/high
  if (defamationLevel === 'critical') return 'critical';
  if (defamationLevel === 'high') return 'high';
  
  // Score-based levels
  if (riskScore >= 0.85) return 'critical';
  if (riskScore >= 0.70) return 'high';
  if (riskScore >= 0.40) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

function _logEnabled(ctx) {
  console.log(
    `[ARTICLESAFE] enabled=true reason=${ctx.reason} ` +
    `riskLevel=${ctx.riskLevel} riskScore=${ctx.riskScore.toFixed(2)} ` +
    `flags=${ctx.safetyFlags.join(',')}`
  );
}

function _logDisabled(reason) {
  console.log(`[ARTICLESAFE] enabled=false reason=${reason}`);
  return {
    enabled: false,
    reason,
    riskScore: 0,
    riskLevel: 'low',
    detection: null,
    sourceClassification: null,
    defamation: null,
    safetyFlags: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  evaluateArticleSafety,
  checkAmplification,
  hasUnattributedClaims,
  
  // Re-export submodules for direct access if needed
  detectArticleInput,
  classifySourceType,
  scanDefamationRisk,
};
