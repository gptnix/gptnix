'use strict';

/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  Polish Rules — GPTNiX Response Polish System (Level 1)       ║
 * ╠════════════════════════════════════════════════════════════════╣
 * ║  Deterministic, zero-cost regex transformations.               ║
 * ║  Runs on EVERY answer regardless of POLISH_ENABLED.            ║
 * ║  Never touches code blocks, numbers, URLs, or citations.       ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────
// IMMUTABLES EXTRACTION
// ─────────────────────────────────────────────────────────────────

const PLACEHOLDER_PREFIX = '\x00IMMU_';
const PLACEHOLDER_SUFFIX = '\x00';

function placeholder(idx) {
  return `${PLACEHOLDER_PREFIX}${idx}${PLACEHOLDER_SUFFIX}`;
}

/**
 * Extract all "immutable" segments and replace with indexed placeholders.
 * @param {string} text
 * @returns {{ text: string, segments: Map<string,string> }}
 */
function extractImmutables(text) {
  const segments = new Map();
  let counter = 0;
  let result = String(text || '');

  // 1. Fenced code blocks  ``` ... ```
  result = result.replace(/```[\s\S]*?```/g, (m) => {
    const k = placeholder(counter++); segments.set(k, m); return k;
  });

  // 2. Inline code  `...`
  result = result.replace(/`[^`\n]+`/g, (m) => {
    const k = placeholder(counter++); segments.set(k, m); return k;
  });

  // 3. Citation markers  [1]  [1,2]
  result = result.replace(/\[\d+(?:,\s*\d+)*\]/g, (m) => {
    const k = placeholder(counter++); segments.set(k, m); return k;
  });

  // 4. URLs
  result = result.replace(/https?:\/\/[^\s\)>\]"']+/gi, (m) => {
    const k = placeholder(counter++); segments.set(k, m); return k;
  });

  // 5. ISO dates  2025-01-15 / 15.01.2025
  result = result.replace(/\b\d{4}[-./]\d{2}[-./]\d{2}\b|\b\d{2}[-./]\d{2}[-./]\d{4}\b/g, (m) => {
    const k = placeholder(counter++); segments.set(k, m); return k;
  });

  return { text: result, segments };
}

/**
 * Restore segments from placeholders.
 */
function restoreImmutables(text, segments) {
  let result = String(text || '');
  for (const [k, v] of segments) {
    result = result.split(k).join(v);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// DETERMINISTIC RULES (Level 1, always free)
// ─────────────────────────────────────────────────────────────────

const RULES = [
  {
    name: 'remove_ai_opener',
    fn: (t) => t.replace(
      /^(As (an? )?AI(?: assistant| language model)?[,;:]?\s*|Kao (AI|jezični model|asistent)[,;:]?\s*|I('m| am) just an AI[,;:]?\s*)/gim,
      ''
    ),
  },
  {
    name: 'remove_filler_opener',
    fn: (t) => t.replace(
      /^(Odli[cč]an\s+\w+[!,]?\s*|Naravno[!,]?\s*|Svakako[!,]?\s*|Certainly[!,]?\s*|Absolutely[!,]?\s*|Of course[!,]?\s*|Great question[!,]?\s*|Sure[!,]?\s*)\n*/gim,
      ''
    ),
  },
  {
    name: 'remove_vacuous_closer',
    fn: (t) => t.replace(
      /\n+\s*(Nadam se da (ovo|sam|je)\s+pomoglo?[!.]?\s*|Javi\s+(mi\s+)?(se\s+)?(ako|ukoliko)[^.\n]*[.!]\s*|Hope (this|that) helps[!.]?\s*|Let me know if[^.\n]*[!.]\s*|Feel free to (ask|reach out)[^.\n]*[!.]\s*)$/gim,
      ''
    ),
  },
  {
    name: 'fix_excessive_blank_lines',
    fn: (t) => t.replace(/\n{3,}/g, '\n\n'),
  },
  {
    name: 'fix_trailing_whitespace',
    fn: (t) => t.replace(/[ \t]+$/gm, ''),
  },
  {
    name: 'fix_double_spaces',
    fn: (t) => t.replace(/([^\n]) {2,}([^\n])/g, '$1 $2'),
  },
  {
    name: 'fix_heading_spacing',
    fn: (t) => t.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2'),
  },
  {
    name: 'fix_list_spacing',
    fn: (t) => t.replace(/([^\n])\n([-*•]\s)/g, '$1\n\n$2'),
  },
  {
    name: 'fix_orphan_punctuation',
    fn: (t) => t.replace(/\s+([.,;:!?])(?!\S)/g, '$1'),
  },
  {
    name: 'trim_edges',
    fn: (t) => t.trim(),
  },
];

// ─────────────────────────────────────────────────────────────────
// BYPASS DETECTION
// ─────────────────────────────────────────────────────────────────

function isPureCodeResponse(text) {
  const t = String(text || '');
  const codeChars = (t.match(/```[\s\S]*?```/g) || []).reduce((s, b) => s + b.length, 0);
  return codeChars / Math.max(t.length, 1) > 0.6;
}

function isTooShort(text, minChars = 120) {
  return String(text || '').replace(/\s+/g, '').length < minChars;
}

// ─────────────────────────────────────────────────────────────────
// MAIN RUNNER (Level 1)
// ─────────────────────────────────────────────────────────────────

function applyRules(text) {
  if (!text || typeof text !== 'string') return text || '';
  const { text: stripped, segments } = extractImmutables(text);
  let result = stripped;
  for (const rule of RULES) {
    try { result = rule.fn(result); }
    catch (e) { console.warn(`[POLISH-RULES] Rule "${rule.name}" failed:`, e.message); }
  }
  return restoreImmutables(result, segments);
}

// ─────────────────────────────────────────────────────────────────
// DIFF / SAFETY CHECKER
// ─────────────────────────────────────────────────────────────────

function diffCheck(original, polished) {
  const orig = String(original || '');
  const pol  = String(polished || '');
  const reasons = [];

  if (!pol.trim()) return { safe: false, reasons: ['polished_is_empty'] };

  // Code blocks must be identical
  const origCode = (orig.match(/```[\s\S]*?```/g) || []).slice().sort();
  const polCode  = (pol.match( /```[\s\S]*?```/g) || []).slice().sort();
  if (origCode.length !== polCode.length)
    reasons.push(`code_block_count: ${origCode.length}→${polCode.length}`);
  else origCode.forEach((b, i) => { if (b !== polCode[i]) reasons.push(`code_block_${i}_changed`); });

  // All citation markers preserved
  const origCit = orig.match(/\[\d+(?:,\s*\d+)*\]/g) || [];
  const polCit  = pol.match( /\[\d+(?:,\s*\d+)*\]/g) || [];
  const missCit = origCit.filter(c => !polCit.includes(c));
  if (missCit.length) reasons.push(`citations_missing: ${missCit.join(' ')}`);

  // URLs preserved
  const origUrls = orig.match(/https?:\/\/[^\s\)>\]"']+/gi) || [];
  const polUrls  = pol.match( /https?:\/\/[^\s\)>\]"']+/gi) || [];
  const missUrls = origUrls.filter(u => !polUrls.includes(u));
  if (missUrls.length) reasons.push(`urls_missing: ${missUrls.length}`);

  // Length sanity
  const ratio = pol.length / Math.max(orig.length, 1);
  if (ratio < 0.55) reasons.push(`too_short: ratio=${ratio.toFixed(2)}`);
  if (ratio > 2.2)  reasons.push(`too_long: ratio=${ratio.toFixed(2)}`);

  return { safe: reasons.length === 0, reasons };
}

module.exports = {
  extractImmutables,
  restoreImmutables,
  applyRules,
  isPureCodeResponse,
  isTooShort,
  diffCheck,
  RULES,
};
