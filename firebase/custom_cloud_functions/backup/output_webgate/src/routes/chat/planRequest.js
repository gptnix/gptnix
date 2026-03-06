'use strict';

/**
 * planRequest — routing heuristics
 *
 * Decides:
 *  - which plan (tool_calls) to execute
 *  - whether officialsHardWeb grounding is needed
 *  - whether freshnessHardWeb grounding is needed
 *
 * ⚠️  BUG GUARDS (must stay correct):
 *  D1 — Officials check BEFORE freshness plan (officials override freshness).
 *  D5 — date_only_skip → freshnessHardWeb stays false (needsWebSearchFast returns fresh:false).
 *
 * Zero behavior change from original chat.js.
 */

const { isOfficialsQuestion, buildOfficialsQueryVariants } = require('../../utils/officials');
const { needsWebSearchFast, isFreshnessSignalFromRouter } = require('../../utils/freshness');
const { translateToEnglish } = require('../../services/translate');
const { decideToolPlan, quickHeuristicRouter } = require('../../services/smartRouter');
const { isWebSearchBlocked } = require('../../utils/webSearchGate');
const {
  SMART_ROUTING_ENABLED,
  QUICK_HEURISTIC_ROUTER,
  ROUTER_TIMEOUT_MS,
} = require('../../config/env');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (local to this module)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect explicit image-generation request (hr/en/de keywords).
 * @param {string} userText
 * @returns {boolean}
 */
function isExplicitImageRequest(userText) {
  const t = String(userText || '').toLowerCase().trim();
  if (!t) return false;
  const strongVerb = /(nacrtaj|nacrtajte|generiraj|generirajte|izgeneriraj|izgenerirajte|napravi\s+sliku|kreiraj\s+sliku|generiere|erzeuge|erstelle|zeichne|entwirf|mach\s+(mir\s+)?(ein\s+)?bild)/.test(t);
  const hasImageNoun = /(image|picture|photo|render|illustration|slika|fotka|fotografija|ikona|logo|cover|poster|banner|bild|bilder|grafik|illustration|foto)/.test(t);
  const hasActionVerb = /(generate|create|make|draw|render|illustrate|edit|change|modify|remove|add|replace|nacrtaj|generiraj|izgeneriraj|prikazi|obradi|promijeni|dodaj|ukloni|zamijeni|generiere|erzeuge|erstelle|zeichne|entwirf|bearbeite|\bändere\b|\bentferne\b|\bfüge\b|\bersetze\b)/.test(t);
  return strongVerb || (hasImageNoun && hasActionVerb);
}

/**
 * Strip command prefixes from image prompt.
 * @param {string} userText
 * @returns {string}
 */
function extractImagePrompt(userText) {
  const t = String(userText || '').trim();
  return t
    .replace(/^(generate\s+image\s*:?)/i, '')
    .replace(/^(generate\s+an\s+image\s*:?)/i, '')
    .replace(/^(generiere\s+(mir\s+)?(ein\s+)?bild\s*:?)/i, '')
    .replace(/^(erstelle\s+(mir\s+)?(ein\s+)?bild\s*:?)/i, '')
    .replace(/^(erzeuge\s+(mir\s+)?(ein\s+)?bild\s*:?)/i, '')
    .replace(/^(zeichne\s+(mir\s+)?(ein\s+)?bild\s*:?)/i, '')
    .replace(/^(generiraj\s+sliku\s*:?)/i, '')
    .replace(/^(izgeneriraj\s+sliku\s*:?)/i, '')
    .replace(/^(nacrtaj\s*:?)/i, '')
    .replace(/^(napravi\s+sliku\s*:?)/i, '')
    .replace(/^(kreiraj\s+sliku\s*:?)/i, '')
    .trim() || t;
}

// ─────────────────────────────────────────────────────────────────────────────
// planRequest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine the execution plan for this request.
 *
 * @param {object} ctx
 * @param {string}   ctx.message               - Raw user message
 * @param {string}   ctx.messageWithoutUrls     - Message with URLs stripped (D2: must be pre-initialised)
 * @param {object}   ctx.capabilities           - { web, image, rag, qdrantEnabled, wiki, movies, ... }
 * @param {Array}    ctx.relevantHistory        - Recent conversation history
 * @param {boolean}  ctx.smartEnabled           - Whether smart routing is active
 * @param {object}   ctx.toolReporter           - { start, done } tool status reporter
 * @param {object}   ctx.perfTiming             - Mutable timing object { t_router_start, t_router_done }
 *
 * @returns {Promise<{ plan: object, officialsHardWeb: boolean, freshnessHardWeb: boolean, freshnessDecision: object }>}
 */
async function planRequest({
  message,
  messageWithoutUrls,
  capabilities,
  relevantHistory,
  smartEnabled,
  toolReporter,
  perfTiming,
}) {
  // ─── Legacy fallback plan (used when all else fails) ──────────────────────
  const legacyPlan = {
    tool_calls: [],
    memory: { action: 'none' },
    response: { type: 'text' },
    confidence: 1,
    reason: 'legacy',
  };

  let plan = null;

  // ─────────────────────────────────────────────────────────────────────────
  // 🏛️ D1 — Officials check (MUST be BEFORE freshness plan)
  // If officials → officialsHardWeb is set unconditionally here so that the
  // freshness guard below can see it and skip the freshness plan.
  // ─────────────────────────────────────────────────────────────────────────
  const officialsQuery = isOfficialsQuestion(messageWithoutUrls || message);

  let officialsHardWeb = false;

  // 🌍 Freshness detection (layer 1)
  let freshnessDecision = needsWebSearchFast(messageWithoutUrls || message);
  // D5: date_only_skip → fresh:false → freshnessHardWeb stays false ✓
  let freshnessHardWeb = freshnessDecision?.fresh === true;
  if (freshnessHardWeb) {
    console.log(`🌍 [FRESHNESS] L${freshnessDecision.layer}:${freshnessDecision.category} → pre-router trigger`);
  }

  // ✅ HARD RULE: officials FIRST (overrides freshness when category=officials)
  // Problem without this: freshnessHardWeb(category:officials) sets plan BEFORE officials
  // block → officialsHardWeb stays false → no variants, no verifiedFactsBlock, no
  // officialsStrictBlock → LLM hallucinates party/person.
  if (officialsQuery && capabilities.web) {
    officialsHardWeb = true;  // ← always, regardless of freshnessHardWeb
  }

  // ✅ HARD RULE: freshness queries MUST use web_search (skip if officials already handled)
  // V5.3: WebSearchGate blocks format/style requests even if they contain freshness words
  if (!plan && freshnessHardWeb && !officialsHardWeb && capabilities.web) {
    const q = (messageWithoutUrls || message || '').trim();
    if (isWebSearchBlocked(q)) {
      console.log('[WEBGATE→planRequest] Freshness web_search BLOCKED (gate decision)');
    } else {
      plan = {
        tool_calls: [{
          name: 'web_search',
          args: { query: q, recency_days: 30 },
        }],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.99,
        reason: `freshness:${freshnessDecision?.category || '?'} (layer ${freshnessDecision?.layer ?? '?'})`,
      };
      console.log('🌍 [FRESHNESS] Hard web_search forced:', freshnessDecision);
    }
  }

  // ─── Officials plan (with queryVariants) ─────────────────────────────────
  if (!plan && officialsQuery && capabilities.web) {
    officialsHardWeb = true;
    const variants = buildOfficialsQueryVariants(messageWithoutUrls || message);
    plan = {
      tool_calls: [{
        name: 'web_search',
        args: {
          query: variants[0] || (messageWithoutUrls || message),
          queries: variants,
          timeRange: 'year',
          maxResults: 8,
        },
      }],
      memory: { action: 'none' },
      response: { type: 'text' },
      confidence: 0.99,
      reason: 'hard: officials question → web_search only',
    };
    console.log('🏛️ [HARD] officials question → forcing web_search', { variants });
    // Router is internal — no tool_status event emitted here
  }

  // ─── Explicit image generation request ───────────────────────────────────
  if (!plan && capabilities.image && isExplicitImageRequest(message)) {
    const promptRaw = extractImagePrompt(message);
    const translated = await translateToEnglish(promptRaw, { force: true }).catch(() => null);
    const promptEn = String(translated?.english || '').trim() || promptRaw;

    plan = {
      tool_calls: [{
        name: 'image_generate',
        args: { prompt: promptEn, preset: 'quality', wait: 60 },
      }],
      memory: { action: 'none' },
      response: { type: 'text' },
      confidence: 0.99,
      reason: 'Explicit image request (heuristic)',
    };
    console.log('🧭 [ROUTER] forced image_generate (heuristic)');
  }

  // ─── Smart routing (heuristic + LLM router) ──────────────────────────────
  if (smartEnabled && !plan) {
    if (perfTiming) perfTiming.t_router_start = Date.now();

    // Router is internal routing logic — no tool_status event (avoids noise on simple chat)
    const routerToolId = null;

    // 🔥 V4.2: File extension → force RAG plan (skip router)
    const fileExtensionPattern = /\.(xls|xlsx|doc|docx|pdf|csv|txt|json|zip)\b/i;
    const hasFileExtension = fileExtensionPattern.test(message);

    if (hasFileExtension && capabilities.rag) {
      console.log('📄 [V4.2-ROUTER] File extension detected, forcing RAG plan (bypassing router)');
      plan = {
        tool_calls: [],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.95,
        reason: 'File extension detected - forcing RAG (V4.2)',
        forceRag: true,
      };
      if (perfTiming) perfTiming.t_router_done = Date.now();
      if (routerToolId) {
        toolReporter.done(routerToolId, 'Plan: RAG (file extension detected)', {
          tools: ['rag'],
          method: 'v4.2-file-ext',
          latency: perfTiming ? (perfTiming.t_router_done - perfTiming.t_router_start) : 0,
        });
      }
    }

    // ⚡ Quick heuristic router (< 50 ms)
    if (!plan && QUICK_HEURISTIC_ROUTER) {
      const heuristic = quickHeuristicRouter({
        message,
        capabilities,
        hasHistory: Boolean(relevantHistory && relevantHistory.length > 0),
      });
      if (heuristic.confident && heuristic.plan) {
        plan = heuristic.plan;
        if (perfTiming) perfTiming.t_router_done = Date.now();
        console.log(`⚡ [ROUTER] Quick heuristic decision (${perfTiming ? perfTiming.t_router_done - perfTiming.t_router_start : '?'}ms):`, heuristic.reason);
        if (routerToolId) {
          const tools = (plan.tool_calls || []).map((t) => t?.name).filter(Boolean);
          toolReporter.done(routerToolId, `Plan (heuristic): ${tools.length ? tools.join(', ') : 'chat'}`, {
            tools,
            method: 'heuristic',
            latency: perfTiming ? (perfTiming.t_router_done - perfTiming.t_router_start) : 0,
          });
        }
      } else {
        console.log(`🤔 [ROUTER] Ambiguous query, falling back to LLM router: ${heuristic.reason}`);
      }
    }

    // LLM router fallback
    if (!plan) {
      try {
        const routerPromise = decideToolPlan({ message, history: relevantHistory, capabilities });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Router timeout')), ROUTER_TIMEOUT_MS)
        );
        plan = await Promise.race([routerPromise, timeoutPromise]);
        if (perfTiming) perfTiming.t_router_done = Date.now();
        console.log(`🧭 [ROUTER] LLM decision (${perfTiming ? perfTiming.t_router_done - perfTiming.t_router_start : '?'}ms)`);
      } catch (e) {
        if (perfTiming) perfTiming.t_router_done = Date.now();
        const isTimeout = e?.message === 'Router timeout';
        console.warn(`⚠️ [ROUTER] ${isTimeout ? 'Timeout' : 'Failed'} (${perfTiming ? perfTiming.t_router_done - perfTiming.t_router_start : '?'}ms):`, e?.message || e);
        plan = {
          tool_calls: [],
          memory: { action: (capabilities?.qdrantEnabled ? 'auto' : 'none') },
          response: { type: 'text' },
          confidence: 0.0,
          reason: isTimeout ? 'fallback: router_timeout' : 'fallback: router_error',
        };
      }
    }

    console.log('🧭 [ROUTER] plan:', {
      tool_calls: plan.tool_calls?.map((t) => t.name) || [],
      memory: plan.memory?.action,
      response: plan.response?.type,
      confidence: plan.confidence,
      reason: plan.reason,
    });

    if (routerToolId && !(perfTiming && perfTiming.t_router_done)) {
      const tools = (plan.tool_calls || []).map((t) => t?.name).filter(Boolean);
      const summary = tools.length ? `Plan: ${tools.join(', ')}` : 'Plan: no tools';
      toolReporter.done(routerToolId, summary, {
        tools,
        responseType: plan?.response?.type || 'text',
        confidence: plan?.confidence,
        method: 'llm',
        latency: perfTiming ? (perfTiming.t_router_done - perfTiming.t_router_start) : 0,
      });
    }
  }

  // ─── Legacy fallback (always ensure plan exists) ──────────────────────────
  if (!plan) {
    plan = legacyPlan;
    console.log('🧭 [ROUTER] using legacy plan');
  }

  return { plan, officialsHardWeb, freshnessHardWeb, freshnessDecision };
}

module.exports = { planRequest, isExplicitImageRequest, extractImagePrompt };
