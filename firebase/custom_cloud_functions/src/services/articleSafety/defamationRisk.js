'use strict';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║    Defamation Risk Scanner — GPTNiX Article Safety           ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║  Detects potential defamation risk by identifying:           ║
 * ║  1) Person names (public figures, officials, etc.)           ║
 * ║  2) Accusatory language (corruption, crime, fraud, etc.)     ║
 * ║  3) Combination of both → HIGH RISK                          ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
// Person Detection Patterns
// ─────────────────────────────────────────────────────────────────────────────

// Titles that indicate person names
const PERSON_TITLE_PATTERNS = [
  // Political
  /\b(predsjednik|predsjednica|president|premijer|premijerka|prime\s+minister)\b/i,
  /\b(ministar|ministrica|minister|državni\s+sekretar|secretary\s+of\s+state)\b/i,
  /\b(gradonačelnik|gradonačelnica|mayor|načelnik|načelnica)\b/i,
  /\b(zastupnik|zastupnica|poslanik|poslanica|senator|senatorica|congressman|congresswoman)\b/i,
  
  // Business
  /\b(CEO|CFO|CTO|direktor|direktorica|director|izvršni\s+direktor)\b/i,
  /\b(vlasnik|vlasnica|owner|osnivač|osnivačica|founder)\b/i,
  /\b(predsjednik\s+uprave|chairman|chairwoman)\b/i,
  
  // Law enforcement / Judicial
  /\b(sudac|sutkinja|sudija|judge|tužitelj|tužiteljica|prosecutor)\b/i,
  /\b(policaj(ac|ka)|police\s+(chief|commissioner)|načelnik\s+policije)\b/i,
  
  // Academic / Medical
  /\b(prof(esor)?|doktor|dr\.|professor|akademik|academician)\b/i,
];

// Social media handles (@username)
const SOCIAL_HANDLE_PATTERN = /@\w+/g;

// Capitalized name pattern (heuristic: 2+ consecutive capitalized words)
// "Marko Marković" → likely a person name
const CAPITALIZED_NAME_PATTERN = /\b[A-ZŠĐČĆŽ][a-zšđčćž]+\s+[A-ZŠĐČĆŽ][a-zšđčćž]+\b/g;

// ─────────────────────────────────────────────────────────────────────────────
// Accusatory Language Patterns
// ─────────────────────────────────────────────────────────────────────────────

const ACCUSATORY_PATTERNS = [
  // Corruption
  /\b(korupcij(a|e|om)|corrupt(ion)?|mito|podmićivanje|bribe|bribery|podmitio|podmićen)\b/i,
  /\b(malverzacij(a|e)|nepotizam|nepotism|kronizam|cronyism)\b/i,
  /\b(pranje\s+novca|pranje\s+para|money\s+laundering)\b/i,
  
  // Crime
  /\b(kriminal(ac)?|criminal|zločin|crime|prekršaj|krađa|theft|pljačka|robbery)\b/i,
  /\b(prevara|fraud|kriminalna\s+radnja|kriminalno\s+djelo|felony)\b/i,
  /\b(uhićen|uhapšen|arrest(ed)?|optužen|optužnica|indictment|sued)\b/i,
  
  // Fraud / Deception
  /\b(laž|lažov|lažirao|lied|lying|obmanjivao|deceiv(ed|ing)|manipulacij(a|e))\b/i,
  /\b(prevar(io|ila|a)|defraud|krao|stole|stealing)\b/i,
  
  // Abuse of power
  /\b(zloupotreb(a|io|ila)|abuse\s+of\s+power|zlouporaba|nasilj(e|a))\b/i,
  /\b(pogodov(ao|ala|anje)|favoritism|protežiranje)\b/i,
  
  // Scandals
  /\b(skandal|scandal|afera|affair|kontroverzn(o|a|i)|controversial)\b/i,
  /\b(prikrivao|prikrivala|cover(-| )up|zataškavanje)\b/i,
];

// Severe accusations (highest risk)
const SEVERE_ACCUSATORY_PATTERNS = [
  /\b(ubio|ubila|ubistvo|murder|killed|ubojstvo)\b/i,
  /\b(silov(ao|ala)|silovatelj|rape|rapist|seksualno\s+zlostavljanje|sexual\s+assault)\b/i,
  /\b(terorista|terrorist|ekstremist|extremist)\b/i,
  /\b(izdaja|izdajnik|treason|traitor)\b/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// Risk Levels
// ─────────────────────────────────────────────────────────────────────────────

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Detection Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} DefamationRiskResult
 * @property {string} level - Risk level (low, medium, high, critical)
 * @property {number} score - Risk score 0-1
 * @property {string[]} triggers - List of detected triggers
 * @property {number} personCount - Number of person references detected
 * @property {number} accusationCount - Number of accusatory patterns detected
 */

/**
 * Scan text for defamation risk
 * 
 * @param {string} text - Text to scan
 * @returns {DefamationRiskResult}
 */
function scanDefamationRisk(text) {
  const content = String(text || '').trim();
  
  if (!content) {
    return {
      level: RISK_LEVELS.LOW,
      score: 0,
      triggers: [],
      personCount: 0,
      accusationCount: 0,
    };
  }
  
  const triggers = [];
  let personCount = 0;
  let accusationCount = 0;
  let severeAccusationDetected = false;
  
  // ── SCAN 1: Detect person references ──────────────────────────────────────
  
  // Check for titles
  for (const pattern of PERSON_TITLE_PATTERNS) {
    if (pattern.test(content)) {
      triggers.push('PERSON_TITLE');
      personCount++;
      break; // count only once
    }
  }
  
  // Check for social handles
  const handles = content.match(SOCIAL_HANDLE_PATTERN);
  if (handles && handles.length > 0) {
    triggers.push(`SOCIAL_HANDLE:${handles.length}`);
    personCount += handles.length;
  }
  
  // Check for capitalized names (heuristic)
  const names = content.match(CAPITALIZED_NAME_PATTERN);
  if (names && names.length > 0) {
    triggers.push(`CAPITALIZED_NAME:${names.length}`);
    personCount += names.length;
  }
  
  // ── SCAN 2: Detect accusatory language ────────────────────────────────────
  
  // Check severe accusations first
  for (const pattern of SEVERE_ACCUSATORY_PATTERNS) {
    if (pattern.test(content)) {
      triggers.push('SEVERE_ACCUSATION');
      accusationCount++;
      severeAccusationDetected = true;
      break;
    }
  }
  
  // Check regular accusations
  for (const pattern of ACCUSATORY_PATTERNS) {
    if (pattern.test(content)) {
      accusationCount++;
      if (accusationCount <= 3) { // log first 3 only
        triggers.push('ACCUSATION');
      }
    }
  }
  
  // ── RISK SCORING ───────────────────────────────────────────────────────────
  
  let level = RISK_LEVELS.LOW;
  let score = 0.0;
  
  // CRITICAL: Severe accusation + person name
  if (severeAccusationDetected && personCount > 0) {
    level = RISK_LEVELS.CRITICAL;
    score = 0.95;
  }
  // HIGH: Multiple accusations + person name
  else if (accusationCount >= 2 && personCount > 0) {
    level = RISK_LEVELS.HIGH;
    score = 0.85;
  }
  // HIGH: Single accusation + person name
  else if (accusationCount >= 1 && personCount > 0) {
    level = RISK_LEVELS.HIGH;
    score = 0.75;
  }
  // MEDIUM: Multiple accusations without person name
  else if (accusationCount >= 2) {
    level = RISK_LEVELS.MEDIUM;
    score = 0.55;
  }
  // MEDIUM: Person names without accusations (informational only)
  else if (personCount > 0) {
    level = RISK_LEVELS.MEDIUM;
    score = 0.40;
  }
  // LOW: No triggers
  else {
    level = RISK_LEVELS.LOW;
    score = 0.10;
  }
  
  return _log({
    level,
    score,
    triggers,
    personCount,
    accusationCount,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

function _log(result) {
  console.log(
    `[ARTICLESAFE:DEFAMATION] level=${result.level} score=${result.score.toFixed(2)} ` +
    `persons=${result.personCount} accusations=${result.accusationCount} ` +
    `triggers=${result.triggers.join(',')}`
  );
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  scanDefamationRisk,
  RISK_LEVELS,
};
