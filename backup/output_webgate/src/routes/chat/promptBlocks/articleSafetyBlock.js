'use strict';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║    Article Safety Prompt Block — Attribution Lock            ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║  System prompt block that enforces:                          ║
 * ║  1) MANDATORY ATTRIBUTION (prema tekstu, autor navodi...)    ║
 * ║  2) NO AMPLIFICATION (preserve source hedging)               ║
 * ║  3) CLAIM vs OPINION SEPARATION                              ║
 * ║  4) DEFAMATION-SAFE OUTPUT                                   ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

/**
 * Build article safety system prompt block
 * 
 * @param {object} articleContext - Article safety context from evaluateArticleSafety
 * @returns {string} - System prompt block
 */
function buildArticleSafetyBlock(articleContext) {
  if (!articleContext || !articleContext.enabled) {
    return ''; // No block if article safety not enabled
  }
  
  const { riskLevel, defamation, safetyFlags } = articleContext;
  
  // ── BASE BLOCK: MANDATORY for all article modes ───────────────────────────
  let block = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️  ARTICLE SAFETY MODE — Attribution Lock Active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The user has shared an article/text. Follow these MANDATORY rules:

1. ATTRIBUTION LOCK (CRITICAL):
   ✅ ALWAYS attribute claims to the source:
      • Use phrases: "prema tekstu...", "autor navodi...", "članak tvrdi..."
      • English: "according to the article...", "the author claims...", "the text states..."
   
   ❌ NEVER make claims in AI's own voice as if they are facts
   ❌ NEVER say things like "X je korumpiran" — instead say "članak optužuje X za korupciju"

2. NO AMPLIFICATION (CRITICAL):
   • If source says "možda" → you CANNOT say "sigurno"
   • If source says "navodno" → you CANNOT state it as fact
   • If source implies → you CANNOT make explicit
   • Preserve ALL hedging language from the source

3. STRUCTURE YOUR RESPONSE:
   Your response MUST have these sections (short & clear):
   
   📋 SAŽETAK (Neutral Summary)
   - Neutralno predstavi o čemu tekst govori (bez zaključaka)
   
   📝 ŠTO AUTOR TVRDI (What Author Claims)
   - Lista tvrdnji s atribucijom: "Autor navodi da..."
   - Razlikuj činjenice od mišljenja
   
   💭 MIŠLJENJA/RETORIKA (Opinion/Rhetoric in Text)
   - Što je interpretacija/mišljenje autora (ne činjenica)
   
   ❓ ŠTO PROVJERITI (What to Verify)
   - Što bi trebalo neovisno provjeriti
   - Pitanja bez jasnog odgovora u tekstu

4. FORBIDDEN OUTPUT:
   ❌ Do NOT draw analytical conclusions
   ❌ Do NOT make value judgments
   ❌ Do NOT amplify accusations
   ❌ Do NOT speak in AI's voice about people/accusations
`;

  // ── HIGH/CRITICAL RISK: Add defamation-specific rules ──────────────────────
  if (riskLevel === 'high' || riskLevel === 'critical') {
    block += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  HIGH DEFAMATION RISK DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ADDITIONAL RULES (STRICTLY ENFORCED):

5. DEFAMATION-SAFE MODE:
   ⚠️  Text contains person names + accusations
   
   ✅ ALLOWED:
      • Informative summary (neutral facts only)
      • "Tekst optužuje X za Y" (attributed)
      • "Autor navodi da..." (attributed)
   
   ❌ FORBIDDEN:
      • "X je kriv" / "X je korumpiran" (unattributed conclusion)
      • Any strong conclusion about person's guilt/character
      • Analytical statements about person's actions
   
   🛡️ SAFE OUTPUT FORMAT:
      Instead of analysis, provide:
      - Neutral summary of claims
      - "Što bi trebalo provjeriti neovisno"
      - Questions for further investigation

6. WHEN IN DOUBT → INFORMATIVE MODE:
   If unsure whether claim is safe → present it informationally:
   • "Tekst tvrdi X, što bi trebalo neovisno provjeriti"
   • "Autor iznosi optužbe Y, bez priloženih dokaza"
`;
  }

  // ── CRITICAL RISK: Severely restrict output ────────────────────────────────
  if (riskLevel === 'critical') {
    block += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL DEFAMATION RISK — Severe Restrictions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL MODE ACTIVE:
• Severe accusations detected (corruption, crime, abuse, etc.)
• Person names present

YOUR OUTPUT MUST BE:
1. INFORMATIVE ONLY (no conclusions)
2. HEAVILY ATTRIBUTED (every claim sourced)
3. QUESTIONS-FOCUSED ("što provjeriti")

Example good response:
"Tekst iznosi ozbiljne optužbe protiv [osoba]. Autor tvrdi da [X], što bi trebalo 
neovisno provjeriti kroz službene izvore. Ključna pitanja: [lista pitanja za provjeru]"

Example bad response (FORBIDDEN):
"[Osoba] je korumpiran i umiješan u aferu. Dokazi jasno pokazuju..."
`;
  }

  // ── CLOSE BLOCK ────────────────────────────────────────────────────────────
  block += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REMEMBER: You are a NEUTRAL INFORMATION ASSISTANT, not an opinion analyst.
Your role is to help user understand WHAT THE TEXT SAYS, not to make judgments.
`;

  return block.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  buildArticleSafetyBlock,
};
