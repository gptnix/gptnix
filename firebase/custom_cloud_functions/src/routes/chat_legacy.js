'use strict';

const express = require('express');


const crypto = require('crypto');

const {
  DEEPSEEK_API_KEY,
  OPENAI_API_KEY,
  SMART_ROUTING_ENABLED,
  QUICK_HEURISTIC_ROUTER,
  ROUTER_TIMEOUT_MS,
  TOOLS_TOTAL_TIMEOUT_MS,
  THREAD_SUMMARY_ENABLED,
  BACKGROUND_ASSISTANT_ENABLED,
  TAVILY_API_KEY,
  SERPER_API_KEY,
  WEB_STRICT_MODE,
  WEB_QUERY_YEAR_AUGMENT,
  WEB_STRICT_NONSTREAM_ON_WEB,
  ACCURACY_GUARD_ENABLED,
  ACCURACY_GUARD_FORCE_TOOLS,
  ACCURACY_GUARD_VERIFY_PASS,
  ACCURACY_GUARD_NONSTREAM_ON_HIGH_RISK,
  ACCURACY_GUARD_VERIFIER_PROVIDER,
  ACCURACY_GUARD_VERIFIER_MODEL,
  ACCURACY_GUARD_VERIFIER_OPENAI_MODEL,
  ACCURACY_GUARD_MAX_TOKENS,
  ACCURACY_GUARD_ASYNC_VERIFY,
  DEFAULT_STREAM,
  STREAM_LATENCY_BUDGET_MS,
  MEMORY_TIMEOUT_STREAM_MS,
  SEMANTIC_FILTER_STREAM_MS,
  WOLFRAM_APP_ID,
  TMDB_BEARER_TOKEN,
  TMDB_API_KEY,
  OMDB_API_KEY,
  WEBSEARCH_DEFAULT_MODE,
  WEBSEARCH_DEFAULT_MAX_RESULTS,
} = require('../config/env');
const { decideToolPlan, quickHeuristicRouter } = require('../services/smartRouter');
const { buildTimeContext } = require('../utils/time');
const { translateToEnglish } = require('../services/translate');
const { getCopilotBrief } = require('../services/backgroundAssistant');
const {
  logVerifierEvent,
  logCopilotDecision,
  logLatencyEvent,
} = require('../utils/observability');
// Image generation (Replicate)
const { generateImageWithReplicate } = require('../services/imageGen');
const { persistGeneratedImages } = require('../services/imagePersistence');
const { buildFluxPrompt } = require('../services/fluxPrompt');
const {
  assessRisk,
  shouldForceGrounding,
  buildSourcesIndex,
  makeSourcesBlock,
  validateCitationsAgainstSources,
  defaultInsufficientEvidenceMessage,
  buildVerifierMessages,
  postProcessFinalAnswer,
  stripFollowupQuestions,
  extractStructuredFacts,
  isSmallTalk, // 🔥 V5.1.1: Small talk detection
  sanitizeToolBlocksForExternal,
} = require('../services/accuracyGuard');

// ✅ Hard-grounding for time-sensitive office holders (president, mayor, načelnik, CEO, ...)
const { isOfficialsQuestion, buildOfficialsQueryVariants } = require('../utils/officials');
const { needsWebSearchFast, isFreshnessSignalFromRouter } = require('../utils/freshness');
const { extractWebFacts, makeVerifiedFactsBlock } = require('../services/webFactsExtractor');
const { BUILD_TAG } = require('../server/banner');

// Billing (Replicate)
const { getFirestore } = require('../billing/firestore');
const { usdFromReplicate } = require('../billing/cost');
const { logUsageEvent, todayKey } = require('../billing/logger');

// ─────────────────────────────────────────
// Small helpers (kept here to avoid extra deps)
// ─────────────────────────────────────────

/**
 * Ultra-short messages are usually continuations ("ne", "ok", "nije dobar").
 * We treat them as follow-ups to the immediately previous topic.
 */
function isVeryShortUserTurn(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  const tokens = t.split(/\s+/).filter(Boolean);
  // keep it conservative: short OR very few tokens
  return t.length <= 36 || tokens.length <= 6;
}

/**
 * Guard OSM/Nominatim: only run when query clearly asks for a place/address.
 */
function looksLikeLocationQuery(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  // explicit map/geo intent
  const geoHints = [
    'gdje', 'di je', 'lokacija', 'adresa', 'karta', 'mapa', 'koordinate',
    'najbli', 'blizu', 'u blizini', 'openstreetmap', 'nominatim', 'osm'
  ];
  if (geoHints.some((h) => t.includes(h))) return true;
  // common "u <mjesto>" / "u splitu" style
  if (/\bu\s+[\p{L}]{3,}/u.test(t)) return true;
  // comma-separated places ("Split, Hrvatska")
  if (/,\s*[\p{L}]{3,}/u.test(t)) return true;
  return false;
}

/**
 * V4.2: ENHANCED DOCUMENT QUERY DETECTION
 * Check if message is asking about a document/file
 * Returns true ONLY if query is clearly document-related
 * Prevents recent uploads from hijacking unrelated queries like "Avatar 3"
 * 
 * V4.2 adds: File extension detection (.xls, .xlsx, .doc, .docx, .pdf, .csv)
 */
function _isDocumentQuery(message) {
  const msg = String(message || '').toLowerCase().trim();
  
  // V4.2: Check for explicit file extensions FIRST (highest priority)
  const fileExtensionPattern = /\.(xls|xlsx|doc|docx|pdf|csv|txt|json|zip)\b/i;
  if (fileExtensionPattern.test(message)) {
    console.log('📄 [V4.2-DOC-DETECT] File extension found in message → Document query');
    return true;
  }
  
  // Document-specific keywords
  const docPatterns = [
    /\b(što piše|what does it say|što kaže|what says)\b/i,
    /\b(u dokumentu|in (the )?(document|file|pdf|image|picture|photo))\b/i,
    /\b(iz (dokumenta|fajla|slike|pdf|excel|excelu|xls|xlsx))\b/i,
    /\b(analiz|analy[sz]e|summarize|sažetak|sumiraj)\b.*\b(doc|file|pdf|image|slika|prilog)/i,
    /\b(pročitaj|read|scan|ocr|extract)\b.*\b(doc|file|pdf|image|text)/i,
    /\b(opisati|describe|explain)\b.*\b(sliku|image|photo|picture|document)/i,
    /\b(sadržaj|content)\b.*\b(doc|file|pdf)/i,
    /\b(prilog|attachment|upload|uploaded)\b/i,
    
    // V4.2: New patterns for file operations
    /\b(pronađi|find|search|pretraži|nađi)\b.*\b(u|iz|from|in)\b/i,
    /\b(ima li|is there|does.*contain|postoji li)\b.*\b(u|iz|in)\b/i,
    /\b(koliko|how many|broj)\b.*\b(u|iz|in)\b.*\b(file|doc|excel|tabeli|tablici)/i,
  ];
  
  // Non-document queries (explicit exclusions) - prevents hijacking
  const nonDocPatterns = [
    /\b(film|movie|serija|series|avatar|inception|batman|marvel|tmdb)\b/i,
    /\b(weather|vrijeme|temperatura|kiša|snow|forecast)\b/i,
    /\b(načelnik|gradonačelnik|predsjednik|ministar|mayor|president|minister)\b/i,
    /\b(tečaj|tecaj|exchange rate|valuta|currency|eur|usd|bam)\b/i,
    /\b(gdje je|where is|location|lokacija|adresa|address)\b/i,
  ];
  
  const hasDocPattern = docPatterns.some(p => p.test(msg));
  const hasNonDocPattern = nonDocPatterns.some(p => p.test(msg));
  
  // Return true ONLY if has document pattern AND no conflicting pattern
  return hasDocPattern && !hasNonDocPattern;
}

function _summarizeToolBlocksForCopilot({ mustUseBlocks = [], optionalBlocks = [], maxChars = 1200 } = {}) {
  try {
    const parts = [];
    const pushFrom = (label, blocks, maxEach) => {
      const arr = Array.isArray(blocks) ? blocks : [];
      for (let i = 0; i < arr.length; i++) {
        const raw = String(arr[i] || '').replace(/\s+/g, ' ').trim();
        if (!raw) continue;
        parts.push(`${label}${i + 1}: ${raw.slice(0, maxEach)}${raw.length > maxEach ? '…' : ''}`);
        if (parts.join('\n').length >= maxChars) break;
      }
    };

    // MUST blocks first (usually the most important grounding)
    pushFrom('M', mustUseBlocks, 260);
    // OPTIONAL blocks next
    if (parts.join('\n').length < maxChars) pushFrom('O', optionalBlocks, 220);

    let out = parts.join('\n').trim();
    if (out.length > maxChars) out = out.slice(0, maxChars - 1) + '…';
    return out;
  } catch (_) {
    return '';
  }
}

function _shouldUseReasonerHeuristic(text, { hasAttachments = false } = {}, accuracyRisk = null) {
  const t = String(text || '').toLowerCase();
  const riskLevel = String(accuracyRisk?.level || 'low').toLowerCase();

  // Strong signals for deep reasoning (math/logic/proofs) or heavy debugging.
  const strongReasoning =
    /(\bdokaz\b|\bproof\b|\btheorem\b|\blemma\b|\bizračunaj\b|\bizracunaj\b|\bračunaj\b|\bracunaj\b|\bderiv\b|\bintegral\b|\bmatri(c|k)\b|\blogika\b|\bkorak po korak\b|\bstep by step\b|\bformal\b|\boptimizacija\b|\bcomplexity\b|\bbig-?o\b|\balgorit(am|am)\b)/i.test(t);

  // Debugging tends to benefit from the reasoner only when the input is large/complex.
  const looksLikeBigDebug =
    (/(stack trace|exception|traceback|segfault|nullpointer|race condition|deadlock|memory leak|kubernetes|docker|cloud run|firestore)/i.test(t) &&
      (t.length > 700 || /\n/.test(String(text || '')))) ||
    (/(flutterflow|flutter|dart|node\.js|express|typescript|sql|regex)/i.test(t) && (t.length > 900 || (String(text || '').match(/\n/g) || []).length > 18));

  // If user attached files, it's often a “read + reason” job.
  const attachmentsSignal = hasAttachments && (t.length > 350 || /(analiz|sažmi|summary|summarize|provjeri|verify|validiraj)/i.test(t));

  // High factual-risk does NOT automatically mean reasoner; it's more about grounding.
  // But if the user explicitly asks for verification/consistency, prefer reasoner.
  const verificationSignal = /(provjeri|verificiraj|validiraj|ispravi|debug|zašto|zasto)/i.test(t) && (t.length > 500 || riskLevel === 'high');

  return Boolean(strongReasoning || looksLikeBigDebug || attachmentsSignal || verificationSignal);
}

async function logReplicateBillingOnce({
  predictionId,
  status,
  model,
  preset,
  imagesCount,
  seconds,
  userId,
  conversationId,
  operation,
}) {
  try {
    if (!predictionId) return false;

    const db = getFirestore();
    if (!db) return false;

    // Idempotency: avoid double-billing on poll / retries
    const idemRef = db.collection('billing_idempotency').doc(`replicate_${predictionId}`);
    try {
      await idemRef.create({
        ts: new Date(),
        provider: 'replicate',
        kind: 'image',
        predictionId,
        status: String(status || ''),
      });
    } catch (e) {
      // Already exists => already billed
      const msg = String(e?.message || '');
      if (msg.includes('ALREADY_EXISTS') || msg.includes('already exists')) return false;
      // unknown error => continue without idempotency guarantee
    }

    const sec = Number(seconds);
    const safeSeconds = Number.isFinite(sec) ? Math.max(0, sec) : 0;
    const safeImages = Number.isFinite(Number(imagesCount)) ? Math.max(1, Number(imagesCount)) : 1;
    
    const { usd, breakdown } = usdFromReplicate({
      seconds: safeSeconds,
      images: safeImages,
      model: model || null,
    });
    
    const day = todayKey(new Date());

    await logUsageEvent({
      ts: new Date(),
      day,
      userId: userId || 'guest',
      conversationId: conversationId || null,
      requestId: `replicate_${predictionId}`,
      kind: 'image',
      provider: 'replicate',
      model: model || null,
      operation: operation || 'image_generate',
      units: {
        seconds: safeSeconds,
        images: Number.isFinite(Number(imagesCount)) ? Number(imagesCount) : undefined,
      },
      costUsd: usd,
      meta: {
        preset: preset || null,
        status: status || null,
        ...breakdown,
      },
    });

    return true;
  } catch (_) {
    return false;
  }
}


// ═══════════════════════════════════════════════════════════════
// 🌍 LANGUAGE PREFERENCE HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Get language instruction for system prompt based on user's language preference
 * @param {string} lang - Language code (en, hr, bs, sr, de, es, fr, etc.)
 * @returns {string} - Instruction in target language
 */
function getLanguageInstruction(lang) {
  const instructions = {
    'en': 'Respond in English.',
    'hr': 'Odgovaraj na hrvatskom jeziku. Koristi latinicu.',
    'bs': 'Odgovaraj na bosanskom jeziku. Koristi latinicu.',
    'sr': 'Odgovaraj na srpskom jeziku. Koristi latinicu.',
    'de': 'Antworte auf Deutsch.',
    'es': 'Responde en español.',
    'fr': 'Répondez en français.',
    'it': 'Rispondi in italiano.',
    'pt': 'Responda em português.',
    'pl': 'Odpowiedz po polsku.',
    'nl': 'Antwoord in het Nederlands.',
    'ru': 'Отвечай на русском языке.',
    'tr': 'Türkçe yanıt ver.',
    'ja': '日本語で回答してください。',
    'zh': '请用中文回答。',
    'ko': '한국어로 답변하세요.',
    'ar': 'أجب بالعربية.',
  };
  const key = String(lang || '').toLowerCase().slice(0, 2);
  return instructions[key] || instructions['en'];
}

// ═══════════════════════════════════════════════════════════════
// 🧷 CITATION ENFORCEMENT (ANTI-HALLUCINATION)
// ═══════════════════════════════════════════════════════════════
// Hard rules:
// - If citations are required and there are no sources → force “insufficient evidence”
// - If citations are required and answer has:
//   a) no citations, or b) citations not in SOURCES INDEX → run a repair pass
//   using the existing verifier infrastructure.
async function _enforceCitationsOrRepair({
  draft,
  requireCitations,
  sourcesIndex,
  sourcesBlock,
  userMessage,
  languageHint,
  mustUseBlocks,
  useOpenAI,
  verifierModels,
  callOpenAIChat,
  callDeepSeek,
  userId,
  conversationId,
  requestId,
}) {
  const text = String(draft || '').trim();
  const needsCites = Boolean(requireCitations);

  if (!needsCites) return { ok: true, text };

  // No sources => do not let the model “sound confident”.
  if (!Array.isArray(sourcesIndex) || sourcesIndex.length === 0) {
    return { ok: false, text: defaultInsufficientEvidenceMessage(languageHint), forced: true };
  }

  const v = validateCitationsAgainstSources(text, sourcesIndex);
  const failNoCites = !v.hasAny;
  const failUnknown = !v.ok;

  if (!failNoCites && !failUnknown) {
    return { ok: true, text };
  }

  // Repair pass: reuse verifier (remove unsupported claims; only allow valid [n]).
  const reason = failNoCites
    ? 'Nema citata u odgovoru iako su potrebni.'
    : `Postoje citati koji nisu u SOURCES INDEX: ${v.unknown.map((x) => `[${x}]`).join(', ')}`;

  const extraRule =
    'REPAIR TASK (strict):\n' +
    `- Problem: ${reason}\n` +
    '- Rewrite the draft so that every concrete claim based on sources has a valid [n] citation from SOURCES INDEX.\n' +
    '- If a detail cannot be supported, remove it or state a short limitation (no guessing).\n' +
    '- Do NOT invent new sources or citations.\n';

  const toolBlocksForVerifier = useOpenAI
    ? sanitizeToolBlocksForExternal(mustUseBlocks, { maxBlocks: 4, maxChars: 1400 })
    : mustUseBlocks;

  const verifierMessages = buildVerifierMessages({
    userMessage,
    draftAnswer: text,
    sourcesBlock,
    toolBlocks: toolBlocksForVerifier,
    languageHint,
  });

  verifierMessages.push({ role: 'system', content: extraRule });

  let repaired = '';
  try {
    if (useOpenAI) {
      repaired = await callOpenAIChat(
        { messages: verifierMessages, model: verifierModels.openai },
        0,
        verifierModels.maxTokens,
        { userId: userId || 'guest', conversationId: conversationId || null, requestId: requestId || null, operation: 'citation_repair' },
      );
    } else {
      repaired = await callDeepSeek(
        { messages: verifierMessages, model: verifierModels.deepseek },
        0,
        verifierModels.maxTokens,
        { userId: userId || 'guest', conversationId: conversationId || null, requestId: requestId || null, operation: 'citation_repair' },
      );
    }
  } catch (_) {
    repaired = '';
  }

  repaired = postProcessFinalAnswer(repaired || text, { languageHint });
  const v2 = validateCitationsAgainstSources(repaired, sourcesIndex);
  if (!v2.hasAny || !v2.ok) {
    // Final fallback: safer than shipping fake citations.
    return { ok: false, text: defaultInsufficientEvidenceMessage(languageHint), forced: true };
  }

  return { ok: true, text: repaired, repaired: true };
}


// Tool helpers (used by SmartRouter tool-calls)
const { getWeather } = require('../services/tools/weather');
const { convertCurrency } = require('../services/tools/fx');
const { wikiLookup } = require('../services/tools/wiki');
const { wikidataLookup } = require('../services/tools/wikidata');
const { osmGeocode, osmNearby } = require('../services/tools/osm');
const { openfdaDrugLabel } = require('../services/tools/openfda');
const { rxnavInteractions } = require('../services/tools/rxnav');
const { holidaysPublic } = require('../services/tools/holidays');
const { movieReport } = require('../services/tools/movies');
const {
  decodeVin,
  modelsForMake,
  recallsByVehicle,
  complaintsByVehicle,
  trimsByCarQuery,
  safetyRatings,
} = require('../services/tools/cars');

const { qdrantEnabled } = require('../clients/qdrant');
const { replicateEnabled } = require('../clients/replicate');
const { isRateLimited } = require('../middleware/rateLimit');
const { getConversationHistory, getDefaultSystemPrompt } = require('../services/conversation');
const { getThreadSummary, updateThreadSummary } = require('../services/threadSummary');
const { retrieveFromQdrant, hardDeleteMemoriesByInstruction, saveMemoryFromInstruction, extractSemanticMemory } = require('../services/memory');
const { getCachedMemories, cacheMemories } = require('../utils/memoryResultCache');
// NOTE: DeepSeek can drift if we over-filter context. We keep a solid recent window.
// Optional semantic filtering remains available but is used only as an *add-on*, not as a replacement.
const { filterRelevantHistory } = require('../services/historyFilter');
const { streamFromOpenAI } = require('../services/providers/openaiChat');
const { streamFromDeepSeek, callDeepSeek } = require('../services/providers/deepseek');
const { ragContextForChat } = require('../services/rag');
const { extractUrls, canonicalizeUrl } = require('../utils/url');
const { readProvidedUrlsAsResults } = require('../services/websearch/reader');
const { webSearch, makeWebContextBlock } = require('../services/websearch');
const { planWebQuery } = require('../services/webQueryPlanner');
const { buildMemoryBlock, formatForSystemPrompt } = require('../services/memoryInjector');

// Attachments (user uploads) → extracted context for the LLM.
const {
  normalizeAttachments,
  buildDefaultAutoPromptForAttachment,
  isLikelyDescribeRequest,
} = require('../services/attachments');
const { buildAttachmentContextBlocks } = require('../services/attachmentContext');
const { getUserPersonalization } = require('../services/personalization');

function isExplicitImageRequest(userText = '') {
  const t = String(userText || '').toLowerCase().trim();
  if (!t) return false;

  // Strong verbs that almost always mean image generation (even without the word "slika")
  const strongVerb = /(nacrtaj|nacrtajte|generiraj|generirajte|izgeneriraj|izgenerirajte|napravi\s+sliku|kreiraj\s+sliku|generiere|erzeuge|erstelle|zeichne|entwirf|mach\s+(mir\s+)?(ein\s+)?bild)/.test(t);

  const hasImageNoun = /(image|picture|photo|render|illustration|slika|fotka|fotografija|ikona|logo|cover|poster|banner|bild|bilder|grafik|illustration|foto)/.test(t);
  const hasActionVerb = /(generate|create|make|draw|render|illustrate|edit|change|modify|remove|add|replace|nacrtaj|generiraj|izgeneriraj|prikazi|obradi|promijeni|dodaj|ukloni|zamijeni|generiere|erzeuge|erstelle|zeichne|entwirf|bearbeite|\bändere\b|\bentferne\b|\bfüge\b|\bersetze\b)/.test(t);

  return strongVerb || (hasImageNoun && hasActionVerb);
}



function extractImagePrompt(userText = '') {
  const t = String(userText || '').trim();
  // remove common command prefixes (hr/en)
  const cleaned = t
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
    .trim();

  return cleaned || t;
}

function _isGenericDocAnalysisIntent(t = '') {
  const s = String(t || '').trim().toLowerCase();
  if (!s) return false;
  // very short UI-button prompts: "analiza", "analyze", "summarize"...
  if (s.length <= 20 && /^(analiza|analyze|analyse|summary|summarize|sažmi|sazmi|izvuci|izdvoji|extract|pregled|obradi)$/.test(s)) return true;
  // common phrases
  return /(analiziraj|sažmi|sazmi|izdvoji|izvuci|extract|summarize|sumariz(e|iraj)|pregledaj|pročitaj|procitaj).*(dokument|datotek|fajl|file|pdf|xlsx|docx|prilog|attachment)/.test(s);
}


/**
 * ⚡ IMPROVED TIMEOUT WRAPPER
 * Returns fallback value if promise doesn't resolve within ms
 * Catches errors and still respects timeout
 */
function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(`⏱️ Operation timed out after ${ms}ms, using fallback`);
        resolve(fallback);
      }
    }, ms);
    
    promise
      .then(result => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(result);
        }
      })
      .catch(error => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.warn(`⚠️ Operation failed:`, error?.message || String(error));
          resolve(fallback);
        }
      });
  });
}



function _normTextForDedupe(s) {
  // Normalise line endings to avoid duplicate-ish messages when different
  // clients/platforms send \r\n vs \n.
  return String(s || '').replace(/\r\n/g, '\n').trim();
}

function _extractYears(s) {
  const text = String(s || '');
  const years = new Set();
  const re = /\b(20\d{2})\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const y = Number(m[1]);
    if (y >= 2000 && y <= 2100) years.add(y);
  }
  return years;
}

function _extractLinesWithPlaceAndTime(text, {
  place = '',
  around = 2,
  maxLines = 8,
} = {}) {
  const t = String(text || '');
  const p = String(place || '').trim();
  if (!t || !p) return [];

  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const reTime = /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s*(?:h|sati|sat)\b/i;
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.toLowerCase().includes(p.toLowerCase()) && reTime.test(l)) {
      hits.push(i);
    }
  }
  if (!hits.length) return [];

  const picked = new Set();
  for (const idx of hits.slice(0, 5)) {
    for (let j = Math.max(0, idx - around); j <= Math.min(lines.length - 1, idx + around); j++) {
      picked.add(j);
    }
  }
  return Array.from(picked)
    .sort((a, b) => a - b)
    .map((i) => lines[i])
    .slice(0, maxLines);
}

function _messageWantsFreshInfo(userText) {
  const t = String(userText || '').toLowerCase();

  // 1) Explicit freshness / time‑sensitive language
  if (
    /(danas|jučer|sutra|ovaj tjedan|ovog tjedna|ovaj mjesec|ove godine|ovogodi|najnov|recent|updated|update|breaking|trenutno|trenutni|sadašnji|aktualn|now|this year|today|this week|latest|current|as of)/i.test(
      t,
    )
  ) {
    return true;
  }

  // 2) Year hints (user asking in a specific year context)
  if (/(202[5-9]|2030)/.test(t)) return true;

  // 3) Implicit “current office-holder” questions.
  // In BHS, queries like “tko je načelnik ...” are almost always “current”.
  const who = /\b(tko|ko|who)\b/i;
  const office =
    /\b(predsjednik|predsjednica|načelnik|gradonačelnik|premijer|ministar|guverner|senator|zastupnik|župan|predsjedavajući|pope|papa|ceo|direktor|chief executive|prime minister|mayor)\b/i;
  if (who.test(t) && office.test(t)) return true;

  return false;
}

function _looksLikeWikiQuery(userText = '') {
  const t = String(userText || '').trim().toLowerCase();
  if (!t) return false;

  // v3.2: Exclude greetings, farewells, affirmations (NEVER wiki)
  const instantExclusions = [
    /^(hi|hello|hey|yo|sup|hej|bok|zdravo|pozdrav|dobar dan|dobro jutro|dobra večer)$/i,
    /^(kako si|how are you|what's up|whats up)$/i,
    /^(bye|goodbye|see you|see ya|ciao|doviđenja|adio|ćao)$/i,
    /^(ok|okay|thanks|thank you|thx|hvala|fala|super|great|cool|nice)$/i,
    /^(da|yes|yeah|yep|yup|ne|no|nope)$/i
  ];
  
  if (instantExclusions.some(pattern => pattern.test(t))) {
    return false; // Never wiki for these
  }

  // direct mentions
  if (t.includes('wikipedia') || t.includes('wiki')) return true;

  // classic "who/what is" patterns (HR/EN)
  if (/^(tko|ko)\s+je\b/.test(t)) return true;
  if (/^(što|sta)\s+je\b/.test(t)) return true;
  if (/^(definicija|biografija|povijest)\b/.test(t)) return true;
  if (/^(who)\s+is\b/.test(t)) return true;
  if (/^(what)\s+is\b/.test(t)) return true;

  // short entity-like query (1-4 words) with no "deal/promo" intent
  const promo = /(akcij|snizen|popust|letak|katalog|ponud|cijen|sale|discount|flyer|promo|deal|facebook|instagram|tiktok|kup|narud)/i;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 4 && !promo.test(t) && !/[{}<>;=]/.test(t)) return true;

  return false;
}


function _extractWikiQuery(userText = '') {
  let s = String(userText || '').trim();
  if (!s) return '';
  // remove explicit "wiki/wikipedia" tokens but keep the entity/query
  s = s.replace(/\b(wikipedia|wiki|wikipedija|vikipedija)\b/gi, ' ');
  s = s.replace(/\b(na|u|sa|s|iz)\s+(wikipedia|wiki|wikipedija|vikipedija)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function _explicitlyRequestsWebSearch(userText = '') {
  const t = String(userText || '').toLowerCase();
  // If the user says "check online" / asks for sources / social posts etc.
  return /(na internetu|web|google|provjeri|izvor|izvori|link|facebook|instagram|tiktok|najnovije|vijesti|news|trenutno|trenutni|sadašnji|aktualn)/i.test(
    t,
  );
}

// Detect queries that require STRICT grounding from OCR/Vision (flyers, deals, price lists)
function _looksLikeFlyerDealsQuery(userText = '') {
  const t = String(userText || '').toLowerCase();
  // multilingual-ish: Croatian/Bosnian/Serbian + English + German keywords
  return /(akcij|akcija|letak|katalog|ponud|ponuda|popust|snižen|snizen|cijen|cijena|artikl|artikli|proizvod|na akciji|sale|discount|deal|flyer|brochure|price list|angebote|angebot|rabatt|prospekt|preis)/i.test(
    t,
  );
}

function _parseDateRangeFromText(t) {
  const s = String(t || '');
  // common local formats: 19.12.2025 - 31.12.2025, 19.12.-31.12.2025, 19/12/2025
  const m = s.match(
    /(\b\d{1,2}[\./]\d{1,2}(?:[\./]\d{2,4})?\b)\s*(?:-|–|do|to)\s*(\b\d{1,2}[\./]\d{1,2}(?:[\./]\d{2,4})?\b)/i,
  );
  if (!m) return null;
  return { from: m[1], to: m[2] };
}

function _extractFlyerDealsFromImageInsights(imageInsights) {
  const out = {
    items: [],
    dateRange: null,
    sources: [],
  };
  if (!imageInsights || !imageInsights.ok) return out;

  const imgs = Array.isArray(imageInsights.images) ? imageInsights.images : [];
  const allText = [];

  for (const im of imgs) {
    if (im?.url) out.sources.push(im.url);
    if (im?.ocrText) allText.push(String(im.ocrText));

    const items = Array.isArray(im?.items) ? im.items : [];
    for (const it of items) {
      const name = String(it?.name || it?.title || '').trim();
      const price = String(it?.price || it?.amount || '').trim();
      const currency = String(it?.currency || '').trim();
      const unit = String(it?.unit || '').trim();
      const normName = name.replace(/\s+/g, ' ').trim();
      if (!normName) continue;
      out.items.push({ name: normName, price, currency, unit });
    }
  }

  // Deduplicate items by name+price+unit
  const seen = new Set();
  out.items = out.items.filter((it) => {
    const k = `${it.name.toLowerCase()}|${it.price}|${it.currency}|${it.unit}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // If no structured items, attempt a conservative regex parse from OCR text
  if (!out.items.length && allText.length) {
    const lines = allText
      .join('\n')
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    // Patterns like: "JABUKE ZLATNI 1,00 KM/kg" or "JABUKE 1 KM/kg"
    const re = /^([A-ZŠĐČĆŽ0-9\-\s]{3,})\s+(\d+[\.,]?\d*)\s*(KM|BAM|€|EUR)?\s*(\/\s*kg|\/\s*l|\/\s*kom|kg|l|kom|g|ml)?/i;
    for (const ln of lines) {
      const m = ln.match(re);
      if (!m) continue;
      const name = m[1].replace(/\s+/g, ' ').trim();
      const price = m[2].trim();
      const currency = (m[3] || '').trim();
      const unit = (m[4] || '').replace(/\s+/g, '').trim();
      if (!name || name.length < 3) continue;
      out.items.push({ name, price, currency, unit });
      if (out.items.length >= 40) break;
    }
  }

  // Date range
  if (allText.length) {
    out.dateRange = _parseDateRangeFromText(allText.join('\n'));
  }
  return out;
}

function _buildStrictFlyerAnswer({ queryText, flyer, languageHint }) {
  const lang = (languageHint || '').toLowerCase();
  const hr = !lang || lang.startsWith('hr') || lang.startsWith('bs') || lang.startsWith('sr');

  if (!flyer || !flyer.items || !flyer.items.length) {
    return hr
      ? 'Ne mogu pouzdano pročitati artikle/cijene sa pronađenih slika (OCR nije izvukao stavke). Pošalji mi link na objavu ili bolju sliku letka i ponovit ću čitanje bez nagađanja.'
      : 'I can’t reliably read items/prices from the found images (OCR did not extract any items). Share the post link or a clearer flyer image and I’ll re-run extraction without guessing.';
  }

  const lines = [];
  if (hr) {
    lines.push('Evo **isključivo onoga što je OCR uspio pročitati sa slika** (bez izmišljanja):');
  } else {
    lines.push('Here is **only what OCR could read from the images** (no guessing):');
  }

  if (flyer.dateRange?.from && flyer.dateRange?.to) {
    lines.push(hr ? `📅 Period na slici: **${flyer.dateRange.from} – ${flyer.dateRange.to}**` : `📅 Date range on image: **${flyer.dateRange.from} – ${flyer.dateRange.to}**`);
  }

  lines.push('');
  lines.push(hr ? '🛒 Artikli:' : '🛒 Items:');
  flyer.items.slice(0, 40).forEach((it, idx) => {
    const p = it.price ? `${it.price}${it.currency ? ' ' + it.currency : ''}` : '';
    const u = it.unit ? `${it.unit}` : '';
    const tail = [p, u].filter(Boolean).join(' ');
    lines.push(`${idx + 1}. ${it.name}${tail ? ` — ${tail}` : ''}`);
  });

  if (flyer.sources?.length) {
    lines.push('');
    lines.push(hr ? '🔎 OCR iz slika:' : '🔎 OCR from images:');
    flyer.sources.slice(0, 3).forEach((u) => lines.push(`- ${u}`));
  }

  lines.push('');
  lines.push(hr ? 'Ako želiš da bude 100% sigurno, pošalji mi direktan link na Stridon objavu/letak (jer neke slike u web searchu znaju biti unrelated).' : 'If you want 100% certainty, share the direct post/flyer link (web-search images can sometimes be unrelated).');

  return lines.join('\n');
}

/**
 * ⚡ PROPER TIMEOUT HELPER
 * Returns fallback value if promise doesn't resolve within timeoutMs
 * More reliable than Promise.race for operations that can't be aborted
 */
function withProperTimeout(promise, timeoutMs, fallbackValue) {
  return new Promise((resolve) => {
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(`⏱️ Timeout after ${timeoutMs}ms, using fallback`);
        resolve(fallbackValue);
      }
    }, timeoutMs);
    
    promise
      .then(result => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(result);
        }
      })
      .catch(error => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.warn(`⚠️ Operation failed after ${timeoutMs}ms timeout:`, error?.message || String(error));
          resolve(fallbackValue);
        }
      });
  });
}

function createChatRouter() {
  const router = express.Router();

function safeFlush(res) {
  try {
    if (typeof res.flush === 'function') res.flush();
  } catch (_) {}
}

function setupSSE(res, { timeoutMs = 240000 } = {}) {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    try {
      res.flushHeaders?.();
    } catch (_) {}
  }

  const sendEvent = (type, payload = {}) => {
    try {
      if (res.writableEnded || res.destroyed) return;
      const out = JSON.stringify({ type, ...payload });
      res.write(`data: ${out}\n\n`);
      safeFlush(res);
    } catch (_) {}
  };

  // Keep-alive pings so proxies don't kill the connection
  const heartbeat = setInterval(() => {
    try {
      if (res.writableEnded || res.destroyed) return;
      sendEvent('ping', { t: Date.now() });
    } catch (_) {}
  }, 15000);

  const timeout = setTimeout(() => {
    try {
      sendEvent('error', { message: 'SSE timeout' });
      res.end();
    } catch (_) {}
  }, timeoutMs);

  const cleanup = () => {
    clearInterval(heartbeat);
    clearTimeout(timeout);
  };

  res.on('close', cleanup);

  return { sendEvent, heartbeat, timeout, cleanup };
}

function createToolReporter(sendEvent) {
  const enabled = typeof sendEvent === 'function';
  let seq = 0;

  const _emit = (payload) => {
    if (!enabled) return;
    sendEvent('tool_status', { ts: new Date().toISOString(), ...payload });
  };

  const start = (tool, title, message, extra = {}) => {
    if (!enabled) return null;
    const id = `${tool}-${Date.now()}-${++seq}`;
    _emit({ id, tool, status: 'start', title, message, ...extra });
    return id;
  };

  const progress = (id, message, extra = {}) => {
    if (!enabled || !id) return;
    _emit({ id, status: 'progress', message, ...extra });
  };

  const done = (id, message, extra = {}) => {
    if (!enabled || !id) return;
    _emit({ id, status: 'done', message, ...extra });
  };

  const error = (id, message, extra = {}) => {
    if (!enabled || !id) return;
    _emit({ id, status: 'error', message, ...extra });
  };

  return { enabled, start, progress, done, error };
}

function isContactIntent(q) {
  const s = String(q || '').toLowerCase();
  return /(kontakt|contact|telefon|tel\.|mob|broj|pozovi|pozvati|email|e-mail|mail|radno vrijeme|radno vreme|working hours|adresa|lokacija)/i.test(
    s
  );
}

function isExplicitDateIntent(q) {
  const s = String(q || '');
  // 29.12.2025 or 29/12/2025 etc.
  if (/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/.test(s)) return true;
  // 27. prosinca 2025 (month words)
  if (
    /\b\d{1,2}\.\s*(siječnja|sijecnja|veljače|veljace|ožujka|ozujka|travnja|svibnja|lipnja|srpnja|kolovoza|rujna|listopada|studenoga|prosinca)\s*\d{4}\b/i.test(
      s
    )
  )
    return true;
  return false;
}


  router.post('/chat', async (req, res) => {
    const startTime = Date.now();

  // Stable request id for logs/tools (avoid ReferenceError)
  const requestId = (() => {
    const h = (req.headers && (req.headers['x-request-id'] || req.headers['x-requestid'])) || null;
    const trace = (req.headers && req.headers['x-cloud-trace-context'])
      ? String(req.headers['x-cloud-trace-context']).split('/')[0]
      : null;
    try {
      return String(h || trace || crypto.randomUUID());
    } catch (_) {
      return String(h || trace || (Date.now().toString(36) + Math.random().toString(16).slice(2)));
    }
  })();

  // helpful for client debugging
  try { res.setHeader('x-request-id', requestId); } catch (_) {}

    // SSE/tool-status state (must exist for the whole handler, including catch)
    let sse = null;
    let sendEvent = null;
    let heartbeat = null;
    let timeout = null;
    let sseCleanup = null;
    let toolReporter = createToolReporter(null);

    try {
      const {
        message: rawMessage,
        userId: bodyUserId, // ⚠️ Don't trust this - use authenticated userId from token
        conversationId,
        stream: streamBody, // No default - determined by DEFAULT_STREAM config
        model: requestedModel, // ✅ allow client to request specific DeepSeek model (e.g. Think/R1)
        provider: requestedProvider,
        debugRouter = false,
        languageHint,
        preferredLanguage, // 🌍 User's language preference (NEW!)
        timeInfo, // ⏰ dolazi iz FlutterFlow widgeta

        // 🔎 Web search (optional)
        useWebSearch = false,
        webSearchMode,
        webMaxResults,
        webTimeRange,
        webSearchDepth,
        webPrefer,
        webIncludeRawContent = false,
      } = req.body || {};

      // 🔒 SECURITY FIX: Use authenticated userId from JWT token
      // req.user is set by verifyFirebaseToken middleware
      // Never trust userId from req.body as it can be spoofed
      const userId = req.user?.uid || bodyUserId;

      // ── Personalization (60s cached, non-fatal) ─────────────────────────
      let userPersonalization = null;
      if (userId) {
        try { userPersonalization = await getUserPersonalization(userId); } catch (_) {}
      }
      
      if (!userId) {
        console.error('❌ Missing userId in authenticated request');
        return res.status(400).json({ 
          error: 'Missing userId', 
          details: 'User ID must come from authenticated token' 
        });
      }

// ─────────────────────────────────────────
// ⚡ OPTIMIZED STREAM DETECTION (ChatGPT-like UX)
// ─────────────────────────────────────────
// Priority:
// 1. If client explicitly sets stream=false → respect it
// 2. If client sends stream=true OR Accept: text/event-stream → stream
// 3. Otherwise → DEFAULT_STREAM from env (default: true)
const acceptHeader = String(req.headers['accept'] || '');
const acceptSSE = acceptHeader.includes('text/event-stream');

// Determine if stream is explicitly disabled
const explicitlyDisabled = streamBody === false;
const explicitlyEnabled = streamBody === true || acceptSSE;

// Apply logic: disabled > enabled > default
let stream = explicitlyDisabled ? false : (explicitlyEnabled ? true : DEFAULT_STREAM);


      const _modelRaw = typeof requestedModel === 'string' ? requestedModel : '';
      const _providerRaw = typeof requestedProvider === 'string' ? requestedProvider : '';
      const forceOpenRouter = _providerRaw.toLowerCase() === 'openrouter' || /^\s*(openrouter:|or:)\s*/i.test(_modelRaw);
      const openRouterModel = forceOpenRouter ? _modelRaw.replace(/^\s*(openrouter:|or:)\s*/i, '').trim() : '';

      // 🌍 Language resolution: preferredLanguage > languageHint > 'en'
      const userLanguage = preferredLanguage || languageHint || 'en';

      console.log('\n🟦 /chat request:', {
        build: BUILD_TAG,
        stream,
        streamBody,
        acceptSSE,
        explicitlyDisabled,
        explicitlyEnabled,
        DEFAULT_STREAM,
        useWebSearch,
        hasUserId: Boolean(userId),
        conversationId: conversationId || null,
        msgLen: (rawMessage || '').length,
        languageHint: languageHint || null,
        preferredLanguage: preferredLanguage || null,
        finalLanguage: userLanguage,
        timeInfo: timeInfo ? Object.keys(timeInfo) : null,
      });

      // ═══════════════════════════════════════════════════════════════
      // ⚡⚡⚡ v3.2: INSTANT FAST PATH FOR GREETINGS/FAREWELLS (< 10ms)
      // Skip ALL: memory, router, wiki, web, accuracy guard, tools
      // Just LLM direct chat for instant response
      // ═══════════════════════════════════════════════════════════════
      const msgTrimmed = String(rawMessage || '').toLowerCase().trim();
      const instantGreetingPatterns = [
        /^(hi|hello|hey|yo|sup|hej|bok|zdravo|pozdrav|dobar dan|dobro jutro|dobra večer)$/i,
        /^(kako si|how are you|what's up|whats up)$/i,
        /^(bye|goodbye|see you|see ya|ciao|doviđenja|adio|ćao)$/i,
        /^(ok|okay|thanks|thank you|thx|hvala|fala|super|great|cool|nice)$/i,
        /^(da|yes|yeah|yep|yup|ne|no|nope)$/i
      ];
      
      const isInstantGreeting = instantGreetingPatterns.some(p => p.test(msgTrimmed));
      
      // 🚨 SAFETY: Disable instant greeting if conversationId exists
      // This ensures we always use full flow (including RAG check) for existing conversations
      // Instant greeting is only for the FIRST message in a new conversation
      const allowInstantGreeting = isInstantGreeting && !conversationId;
      
      if (allowInstantGreeting) {
        console.log('⚡⚡⚡ [INSTANT] Greeting detected, skipping all retrieval/routing');
        
        const { callDeepSeek, streamFromDeepSeek } = require('../services/providers/deepseek');
        
        // Minimal conversation history (last 3 messages max for context)
        let minimalHistory = [];
        if (conversationId) {
          try {
            const hist = await withTimeout(getConversationHistory(conversationId, { limit: 3 }), 500, []);
            minimalHistory = Array.isArray(hist) ? hist.slice(-3) : [];
          } catch (e) {
            console.warn('⚠️ [INSTANT] History failed:', e?.message);
          }
        }
        
        // Build minimal messages array
        const langInstr = getLanguageInstruction(userLanguage);
        const instantMessages = [
          { role: 'system', content: `You are a helpful AI assistant. ${langInstr} Respond naturally and conversationally to greetings and simple messages.` },
          ...minimalHistory.map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: rawMessage }
        ];
        
        // Stream or non-stream response
        if (stream && acceptSSE) {
          // Use setupSSE for proper SSE initialization
          sse = setupSSE(res, { timeoutMs: 60000 }); // Short timeout for greetings
          sendEvent = sse.sendEvent;
          heartbeat = sse.heartbeat;
          timeout = sse.timeout;
          sseCleanup = sse.cleanup;
          
          // Send init event (proper SSE event, not comment)
          sendEvent('init', { ok: true, t: new Date().toISOString(), stream: true, instant: true });
          
          // Anti-buffering padding (comment is OK, won't be displayed)
          const padding = ':' + ' '.repeat(2000) + '\n\n';
          res.write(padding);
          safeFlush(res);
          
          // Stream from DeepSeek using proper streaming function
          try {
            await streamFromDeepSeek({
              messages: instantMessages,
              model: 'deepseek-chat',
              res,
              heartbeat,
              timeout,
              userId: userId || 'guest',
              message: rawMessage,
              conversationId: conversationId || null,
              startTime: Date.now(),
            });
            
            console.log('⚡ [INSTANT] Greeting response sent (stream)');
            return;
          } catch (err) {
            console.error('⚠️ [INSTANT] Stream failed:', err?.message);
            
            // Cleanup on error
            if (timeout) clearTimeout(timeout);
            if (heartbeat) clearInterval(heartbeat);
            
            if (!res.destroyed) {
              sendEvent('error', { error: 'Stream failed', message: err?.message });
              res.end();
            }
            return;
          }
        } else {
          // Non-stream response
          try {
            const response = await callDeepSeek(
              instantMessages,
              0.25,
              150,
              { userId: userId || 'guest', conversationId: conversationId || null, operation: 'instant_greeting' }
            );
            
            res.json({
              id: `instant-${Date.now()}`,
              reply: response || 'Hello!',
              model: 'deepseek-chat',
              sources: [],
              instantPath: true
            });
            console.log('⚡ [INSTANT] Greeting response sent (non-stream)');
            return;
          } catch (err) {
            console.error('⚠️ [INSTANT] Non-stream failed:', err?.message);
            res.status(500).json({ error: 'Instant path failed' });
            return;
          }
        }
      }

      // ⏱️ Performance timing (to track latency bottlenecks)
      const perfTiming = {
        t_start: Date.now(),
        t_sse_open: null,
        t_memory_done: null,
        t_semantic_done: null,
        t_router_start: null,
        t_router_done: null,
        t_tools_done: null,
        t_first_token: null,
        t_stream_done: null,
        t_verifier_done: null,
      };

      // Attachments can be sent as `attachments: [...]` or embedded in the body.
      const attachments = normalizeAttachments(req.body || {});
      const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

      // If user pasted direct file/image URLs in text, treat them as attachments too.
      if (!hasAttachments) {
        try {
          const urls = extractUrls(rawMessage || '');
          const fileLike = (urls || []).filter((u) =>
            /\.(png|jpg|jpeg|webp|gif|bmp|tiff|pdf|docx?|xlsx?|pptx?)($|\?)/i.test(u),
          );
          if (fileLike.length) {
            for (const u of fileLike.slice(0, 6)) {
              attachments.push({
                url: u,
                type: /\.(png|jpg|jpeg|webp|gif|bmp|tiff)($|\?)/i.test(u) ? 'image' : 'file',
                name: u.split('/').pop(),
              });
            }
          }
        } catch (_) {}
      }

      // Allow "image-only" / "file-only" messages: if there is no text, fall back to a sensible default.
      let userText = typeof rawMessage === 'string' ? rawMessage.trim() : '';
      if (!userText && hasAttachments) {
        userText = buildDefaultAutoPromptForAttachment(attachments[0]);
      }

      // Downstream code expects a variable named `message`.
      const message = userText;


      // Precompute a URL-stripped version of the message for routing heuristics (avoid TDZ bugs).
      const messageWithoutUrls = String(message || '')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

// ─────────────────────────────────────────
// 🧠 HARD STOP: explicit memory write/delete commands
// This must bypass routing, web search, wiki and RAG to avoid UX disasters.
// Works in both stream and non-stream mode.
// ─────────────────────────────────────────
      const _memCmdText = String(message || '').trim();
      const _memWriteCmd = /^(\s*)(zapamti|zabiljezi|zabilježi|spremi|snimi|remember|save)\b/i.test(_memCmdText) || /\b(zapamti|zabiljezi|zabilježi|spremi|snimi)\s+(u\s+)?(memoriju|memory)\b/i.test(_memCmdText);
      const _memDeleteCmd = /^(\s*)(zaboravi|obrisi|obriši|forget|delete)\b/i.test(_memCmdText) || /\b(zaboravi|obrisi|obriši|forget)\s+(to|ovo|that|this)\b/i.test(_memCmdText);
      if (_memWriteCmd || _memDeleteCmd) {
        const memUserId = userId || (conversationId ? `guest:${conversationId}` : 'guest');
        const shortLang = String(userLanguage || 'en').toLowerCase().slice(0,2);
        const isBhs = ['hr','bs','sr'].includes(shortLang);
        let memoryEventLocal = null;
        if (_memDeleteCmd) {
          const del = await hardDeleteMemoriesByInstruction(memUserId, _memCmdText).catch((e) => ({ deletedCount: 0, error: String(e?.message || e) }));
          memoryEventLocal = { action: 'deleted', deletedCount: Number(del?.deletedCount || 0), error: del?.error || null };
        } else {
          const saved = await saveMemoryFromInstruction({ userId: memUserId, conversationId, content: _memCmdText, source: 'explicit_command' }).catch((e) => ({ saved: false, id: null, content: _memCmdText, error: String(e?.message || e) }));
          memoryEventLocal = { action: 'saved', id: saved?.id || null, content: saved?.content || _memCmdText, error: saved?.error || null };
        }

        const ack = _memDeleteCmd
          ? (isBhs ? 'U redu — obrisao sam to iz memorije.' : 'Okay — removed from memory.')
          : (isBhs ? 'U redu — zapamtio sam.' : 'Got it — saved to memory.');

        if (stream) {
          // Minimal SSE response
          sse = setupSSE(res, { timeoutMs: 120000 });
          sendEvent = sse.sendEvent;
          heartbeat = sse.heartbeat;
          timeout = sse.timeout;
          sseCleanup = sse.cleanup;
          toolReporter = createToolReporter(sendEvent);
          sendEvent('init', { ok: true, t: new Date().toISOString(), stream: true });
          sendEvent('memory', memoryEventLocal);
          sendEvent('done', { message: ack });
          try { res.end(); } catch (_) {}
          return;
        }

        return res.json({ answer: ack, images: [], sources: [], routePlan: { tool_calls: [], memory: { action: _memDeleteCmd ? 'delete' : 'save' } } });
      }


// ─────────────────────────────────────────
// Long-form / length requests (e.g. "u 50 rečenica") — enforce via formatting
// ─────────────────────────────────────────
const _lengthParse = (() => {
  const t = String(message || '').toLowerCase();
  const wordToNum = {
    'deset': 10,
    'dvadeset': 20,
    'trideset': 30,
    'cetrdeset': 40,
    'četrdeset': 40,
    'pedeset': 50,
    'sto': 100,
    'stotinu': 100,
  };

  let n = 0;

  // 1) Digits: "50 rečenica"
  const m1 = t.match(/\b(\d{1,3})\s*(rečenic|recenic|rečenica|recenica|rečenice|recenice|sentence|sentences)\b/i);
  if (m1 && m1[1]) n = parseInt(m1[1], 10);

  // 2) Words: "pedeset rečenica"
  if (!n) {
    const m2 = t.match(/\b(deset|dvadeset|trideset|četrdeset|cetrdeset|pedeset|sto|stotinu)\s*(rečenic|recenic|rečenica|recenica|rečenice|recenice)\b/i);
    if (m2 && m2[1] && wordToNum[m2[1]]) n = wordToNum[m2[1]];
  }

  const isLongHint = /\b(detaljno|opširno|opsirno|dugačko|dugacko|esej|u\s+detalje|što\s+više|sto\s+vise)\b/i.test(t);
  const requestedLength = Number.isFinite(n) ? Math.max(0, n) : 0;

  // Cap to prevent runaway token usage
  const capped = requestedLength ? Math.min(requestedLength, 120) : 0;

  let addon = '';
  if (capped > 0) {
    addon = [
      'FORMAT REQUIREMENT (VERY IMPORTANT):',
      `- Output MUST be a numbered list from 1 to ${capped}.`,
      '- Each item MUST be exactly ONE sentence (no multi-sentence items).',
      '- No introduction, no conclusion, no headings — ONLY the numbered list.',
      '- Write in Croatian.',
      '- If you are unsure about precise numbers/dates, phrase it generally rather than guessing.',
    ].join('\n');
  } else if (isLongHint) {
    addon = [
      'LONG-FORM REQUIREMENT (VERY IMPORTANT):',
      '- Provide a comprehensive, long-form answer.',
      '- Do not summarize prematurely.',
      '- Write in Croatian.',
    ].join('\n');
  }

  return { requestedLength: capped, isLongFormRequest: Boolean(capped > 0 || isLongHint), systemAddon: addon };
})();

const requestedLength = _lengthParse.requestedLength;
const isLongFormRequest = _lengthParse.isLongFormRequest;
const lengthInstructionAddon = _lengthParse.systemAddon;

      if (!userText || userText.length < 1) {
        return res.status(400).json({ error: 'message required (or provide attachments)' });
      }

      if (userId && isRateLimited(userId)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }

      // ─────────────────────────────────────────
      // ⚡ SSE EARLY INIT (ChatGPT-like instant feedback)
      // Anti-buffering: send init event + padding immediately to break proxy/CDN buffering
      // ─────────────────────────────────────────
      if (stream) {
        sse = setupSSE(res, { timeoutMs: 240000 });
        sendEvent = sse.sendEvent;
        heartbeat = sse.heartbeat;
        timeout = sse.timeout;
        sseCleanup = sse.cleanup;
        toolReporter = createToolReporter(sendEvent);
        
        perfTiming.t_sse_open = Date.now();
        
        // 🚀 ANTI-BUFFERING: Send init + padding immediately
        // Many proxies (Cloud Run, CloudFlare) buffer until 2KB
        sendEvent('init', { ok: true, t: new Date().toISOString(), stream: true });
        
        // Send padding comment (2KB) to break buffering
        const padding = ':' + ' '.repeat(2000) + '\n\n';
        res.write(padding);
        
        // Force flush headers (critical for Cloud Run)
        if (typeof res.flushHeaders === 'function') {
          res.flushHeaders();
        }
        
        console.log(`⚡ SSE opened (${Date.now() - perfTiming.t_sse_open}ms)`);
      }

      // ─────────────────────────────────────────
      // 0) Time context (early)
      // Used to interpret "today/this year/latest" and to enrich web queries.
      // ─────────────────────────────────────────
      let earlyTimeCtx = null;
      try {
        earlyTimeCtx = buildTimeContext({ clientTimeInfo: timeInfo, languageHint });
      } catch (e) {
        earlyTimeCtx = null;
      }

      // ─────────────────────────────────────────
      // 1) History + memories (parallel)
      // ⚡ OPTIMIZED: Shorter timeouts for stream mode (faster TTFT)
      // ─────────────────────────────────────────
      const memToolId = userId ? toolReporter.start('memory', 'Memorija', 'Tražim relevantne uspomene…') : null;
      
      // Adaptive timeout: stream mode = faster, non-stream = thorough
      const memoryTimeout = stream ? MEMORY_TIMEOUT_STREAM_MS : 2000;
      console.log(`⏱️ [MEMORY-TIMEOUT] Using ${memoryTimeout}ms timeout (stream: ${stream}, MEMORY_TIMEOUT_STREAM_MS: ${MEMORY_TIMEOUT_STREAM_MS})`);

      // ⚡ v3.2: Direct parallel execution with individual timeouts (don't wait for all)
      // This ensures Memory done timing reflects actual timeout, not slowest operation
      const conversationPromise = conversationId 
        ? withTimeout(getConversationHistory(conversationId, { limit: 120 }), 2000, [])
        : Promise.resolve([]);
      
      const memoriesPromise = userId
        ? (async () => {
            // 🚀 Check cache first (instant if cached)
            const cached = getCachedMemories(userId, message);
            if (cached) return cached;
            
            // Cache miss - fetch from Qdrant (increased limit to 10 for better recall)
            const result = await withTimeout(retrieveFromQdrant(userId, message, 10), memoryTimeout, []);
            
            // Cache the result (even if timeout, background promise will complete)
            if (result && result.length > 0) {
              cacheMemories(userId, message, result);
            }
            
            return result;
          })()
        : Promise.resolve([]);
      
      const summaryPromise = (conversationId && THREAD_SUMMARY_ENABLED)
        ? withTimeout(getThreadSummary(conversationId), 1500, '')
        : Promise.resolve('');

      // Execute in parallel, each with its own timeout
      const [conversation, userMemories, threadSummary] = await Promise.all([
        conversationPromise,
        memoriesPromise,
        summaryPromise
      ]);
      
      perfTiming.t_memory_done = Date.now();
      console.log(`⏱️ Memory done: ${perfTiming.t_memory_done - perfTiming.t_start}ms`);

      // 🧠 Build two-tier memory block with strict validation (GOLD version)
      // ⚠️ RELAXED THRESHOLDS: Qdrant scores are often 0.4-0.5 even for relevant memories
      const { coreBlock, contextualBlock, totalInjected, stats } = buildMemoryBlock(
        userMemories, 
        message,
        {
          minScore: 0.40,              // Lowered to 0.40 (Qdrant often returns 0.43-0.48)
          minKeywordOverlap: 0.15,     // Lowered to 0.15
          maxAgeDays: 90,              // Increased to 90 days
        }
      );

      const memoryBlock = formatForSystemPrompt({ coreBlock, contextualBlock });
      console.log(`🧠 [MEMORY-STATS]`, stats);
      
      // 🔍 DEBUG: Log what we're actually injecting
      console.log(`🧠 [MEMORY-DEBUG] userMemories.length: ${userMemories?.length || 0}`);
      console.log(`🧠 [MEMORY-DEBUG] coreBlock length: ${coreBlock?.length || 0}`);
      console.log(`🧠 [MEMORY-DEBUG] contextualBlock length: ${contextualBlock?.length || 0}`);
      console.log(`🧠 [MEMORY-DEBUG] memoryBlock length: ${memoryBlock?.length || 0}`);
      if (memoryBlock) {
        console.log(`🧠 [MEMORY-DEBUG] memoryBlock preview:`, memoryBlock.slice(0, 200));
      } else {
        console.log(`🧠 [MEMORY-DEBUG] ⚠️ NO MEMORY BLOCK GENERATED!`);
      }

      if (memToolId) {
        toolReporter.done(memToolId, `Memorija: ${totalInjected}/${stats.total} ubrizgano`, { 
          total: stats.total,
          injected: totalInjected,
          core: stats.core,
          contextual: stats.contextual,
          rejected: stats.rejected,
        });
      }

      // Keep a solid recent window (unfiltered). This is the #1 fix for "topic drift".
      // (counts are "messages", not "turns")
      const veryShortTurn = isVeryShortUserTurn(message);
      const keepRecent = veryShortTurn ? 28 : (message.length < 80 ? 24 : 18);
      const recentCount = Math.max(10, keepRecent);
      const recentHistory = Array.isArray(conversation) ? conversation.slice(-recentCount) : [];

      // OPTIONAL: add a few semantically relevant OLDER messages (only if embeddings are available).
      // We NEVER replace the recent window with filtered results.
      // ⚡ OPTIMIZED: Skip semantic filter in stream mode if latency budget exceeded
      const olderPool = Array.isArray(conversation) ? conversation.slice(0, Math.max(0, conversation.length - recentCount)) : [];
      const elapsedSoFar = Date.now() - perfTiming.t_start;
      const remainingBudget = STREAM_LATENCY_BUDGET_MS - elapsedSoFar;
      const semanticTimeout = stream ? Math.min(SEMANTIC_FILTER_STREAM_MS, Math.max(50, remainingBudget)) : 1200;
      
      // For ultra-short turns, semantic retrieval often causes false positives (topic mixing).
      // In that case we rely on the bigger recent window instead.
      const semanticAddOn = veryShortTurn
        ? []
        : await withTimeout(
            filterRelevantHistory(olderPool, message, {
              // keep this small; recentHistory already provides continuity
              maxMessages: 14,
              similarityThreshold: 0.55,
            }),
            semanticTimeout,
            [],
          );
      
      perfTiming.t_semantic_done = Date.now();
      console.log(`⏱️ Semantic filter done: ${perfTiming.t_semantic_done - perfTiming.t_start}ms (timeout=${semanticTimeout}ms)`);

      const relevantHistory = (() => {
        const merged = [...semanticAddOn, ...recentHistory];

        // Deduplicate by role+content+timestamp (so repeated identical user prompts at different times stay)
        const seen = new Set();
        const out = [];
        for (const m of merged) {
          if (!m || !m.role || !m.content) continue;
          const key = `${m.role}:${m.content}:${m.ts ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(m);
        }

        // Ensure chronological order (CRITICAL so the latest user message stays last)
        out.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
        return out;
      })();

      console.log(`🧩 History window: total=${conversation.length} recent=${recentHistory.length} relevant=${relevantHistory.length}`);

      // ─────────────────────────────────────────
      // 1a) Attachments (user uploads) → extract text/OCR/vision once
      // ─────────────────────────────────────────
      let attachmentBlocks = [];
      if (hasAttachments) {
        try {
          const att = await buildAttachmentContextBlocks(attachments, {
            toolReporter,
            userText: message,
            billing: billingCtx,
            visionMode: 'auto',
          });
          attachmentBlocks = Array.isArray(att?.blocks) ? att.blocks : [];
        } catch (e) {
          attachmentBlocks = [
            `UPLOADED FILE CONTEXT ERROR: ${String(e?.message || e)}`,
          ];
        }
      }

      // ─────────────────────────────────────────
      // 1b) Smart routing plan (web/rag/image/memory)
      // ─────────────────────────────────────────
      const smartEnabled = (req.body?.smartRouting ?? true) !== false && SMART_ROUTING_ENABLED;

      const capabilities = {
        web: Boolean(TAVILY_API_KEY || SERPER_API_KEY),
        rag: Boolean(userId && qdrantEnabled),
        image: Boolean(replicateEnabled),
        weather: true,
        fx: true,
        wiki: true,
        wikidata: true,
        osm: true,
        cars: true,
        drugs: true,
        wolfram: Boolean(WOLFRAM_APP_ID),
        movies: Boolean(TMDB_BEARER_TOKEN || TMDB_API_KEY || OMDB_API_KEY),
        holidays: true,
        zip: true,
      };

      console.log('🔧 [CAPABILITIES]', {
        web: capabilities.web,
        rag: capabilities.rag,
        image: capabilities.image,
        weather: capabilities.weather,
        fx: capabilities.fx,
        wiki: capabilities.wiki,
        wikidata: capabilities.wikidata,
        osm: capabilities.osm,
        drugs: capabilities.drugs,
        wolfram: capabilities.wolfram,
        movies: capabilities.movies,
        holidays: capabilities.holidays,
        userId: Boolean(userId),
        qdrantEnabled,
        hasOpenAI: Boolean(OPENAI_API_KEY),
        hasTavily: Boolean(TAVILY_API_KEY),
        hasSerper: Boolean(SERPER_API_KEY),
        hasReplicate: Boolean(replicateEnabled),
        hasTMDB: Boolean(TMDB_BEARER_TOKEN || TMDB_API_KEY),
        hasOMDB: Boolean(OMDB_API_KEY),
        hasWolfram: Boolean(WOLFRAM_APP_ID),
      });

      // Smart routing plan. Start as null so we can decide (heuristics → router → legacy default).
      let plan = null;
      // ✅ Hard grounding flag for time-sensitive office holders
      const officialsQuery = isOfficialsQuestion(messageWithoutUrls || message);

      let officialsHardWeb = false;
      // 🌍 FRESHNESS: multilingual dynamic-facts detection (sports, prices, news, schedules...)
      let freshnessDecision = needsWebSearchFast(messageWithoutUrls || message);
      let freshnessHardWeb = freshnessDecision?.fresh === true;
      if (freshnessHardWeb) {
        console.log(`🌍 [FRESHNESS] L${freshnessDecision.layer}:${freshnessDecision.category} → pre-router trigger`);
      }

      const legacyPlan = {
        tool_calls: [],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 1,
        reason: 'legacy',
      };

      const routerToolId = smartEnabled
        ? toolReporter.start('router', 'Planer', 'Odlučujem koje alate koristiti…')
        : null;

      // ✅ HARD RULE: officials FIRST (overrides freshness when category=officials)
      // officialHardWeb MORA biti true čim je officialsQuery true — neovisno o freshnessHardWeb.
      // Problem bez ovog fixa: freshnessHardWeb(category:officials) postavi plan PRIJE officials
      // bloka → officialsHardWeb ostaje false → nema variants, nema verifiedFactsBlock, nema
      // officialsStrictBlock → LLM ne dobije grounding i halucinira stranku/osobu.
      if (officialsQuery && capabilities.web) {
        officialsHardWeb = true;  // ← uvijek, bez obzira na freshnessHardWeb
      }

      // ✅ HARD RULE: freshness queries MUST use web_search (skip if officials already handled)
      if (!plan && freshnessHardWeb && !officialsHardWeb && capabilities.web) {
        const q = (messageWithoutUrls || message || '').trim();
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

  if (!plan && officialsQuery && capabilities.web) {
        officialsHardWeb = true;
        const variants = buildOfficialsQueryVariants(messageWithoutUrls || message);
        plan = {
          tool_calls: [
            {
              name: 'web_search',
              args: {
                query: variants[0] || (messageWithoutUrls || message),
                queries: variants,
                // Bias to fresher results
                timeRange: 'year',
                maxResults: 8,
              },
            },
          ],
          memory: { action: 'none' },
          response: { type: 'text' },
          confidence: 0.99,
          reason: 'hard: officials question → web_search only',
        };
        console.log('🏛️ [HARD] officials question → forcing web_search', { variants });
        if (routerToolId) toolReporter.done(routerToolId, 'Plan: web_search (officials hard rule)', { tools: ['web_search'], confidence: 0.99 });
      }

      // Fast path: explicit image request (Croatian/English keywords).
      // We also translate the prompt to English so the image model behaves consistently.
      if (capabilities.image && isExplicitImageRequest(message)) {
        const promptRaw = extractImagePrompt(message);
        const translated = await translateToEnglish(promptRaw, { force: true }).catch(() => null);
        const promptEn = String(translated?.english || '').trim() || promptRaw;

        plan = {
          tool_calls: [
            {
              name: 'image_generate',
              args: {
                prompt: promptEn,
                preset: 'quality',
                wait: 60,
              },
            },
          ],
          memory: { action: 'none' },
          response: { type: 'text' },
          confidence: 0.99,
          reason: 'Explicit image request (heuristic)',
        };
        console.log('🧭 [ROUTER] forced image_generate (heuristic)');
        if (routerToolId) toolReporter.done(routerToolId, 'Plan: image_generate', { tools: ['image_generate'], responseType: 'text', confidence: 0.99 });
      }

      if (smartEnabled && !plan) {
        perfTiming.t_router_start = Date.now();
        
        // 🔥 V4.2: FILE EXTENSION PRIORITY CHECK
        // If message contains file extension, force RAG plan (skip router entirely)
        const fileExtensionPattern = /\.(xls|xlsx|doc|docx|pdf|csv|txt|json|zip)\b/i;
        const hasFileExtension = fileExtensionPattern.test(message);
        
        if (hasFileExtension && capabilities.rag) {
          console.log('📄 [V4.2-ROUTER] File extension detected, forcing RAG plan (bypassing router)');
          plan = {
            tool_calls: [],  // No external tools, just RAG
            memory: { action: 'none' },
            response: { type: 'text' },
            confidence: 0.95,
            reason: 'File extension detected - forcing RAG (V4.2)',
            forceRag: true  // V4.2: Signal that RAG MUST be used
          };
          perfTiming.t_router_done = Date.now();
          
          if (routerToolId) {
            toolReporter.done(routerToolId, 'Plan: RAG (file extension detected)', { 
              tools: ['rag'], 
              method: 'v4.2-file-ext',
              latency: perfTiming.t_router_done - perfTiming.t_router_start
            });
          }
        }
        
        // ⚡ QUICK HEURISTIC ROUTER FIRST (< 50ms)
        if (!plan && QUICK_HEURISTIC_ROUTER) {
          const heuristic = quickHeuristicRouter({ 
            message, 
            capabilities,
            hasHistory: Boolean(relevantHistory && relevantHistory.length > 0)
          });
          if (heuristic.confident && heuristic.plan) {
            plan = heuristic.plan;
            perfTiming.t_router_done = Date.now();
            console.log(`⚡ [ROUTER] Quick heuristic decision (${perfTiming.t_router_done - perfTiming.t_router_start}ms):`, heuristic.reason);
            if (routerToolId) {
              const tools = (plan.tool_calls || []).map((t) => t?.name).filter(Boolean);
              toolReporter.done(routerToolId, `Plan (heuristic): ${tools.length ? tools.join(', ') : 'chat'}`, { 
                tools, 
                method: 'heuristic',
                latency: perfTiming.t_router_done - perfTiming.t_router_start
              });
            }
          } else {
            console.log(`🤔 [ROUTER] Ambiguous query, falling back to LLM router: ${heuristic.reason}`);
          }
        }
        
        // LLM Router fallback (only if heuristic didn't decide)
        if (!plan) {
          try {
            // Timeout protection (prevents 7s+ hangs)
            const routerPromise = decideToolPlan({ message, history: relevantHistory, capabilities });
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Router timeout')), ROUTER_TIMEOUT_MS)
            );
            
            plan = await Promise.race([routerPromise, timeoutPromise]);
            perfTiming.t_router_done = Date.now();
            console.log(`🧭 [ROUTER] LLM decision (${perfTiming.t_router_done - perfTiming.t_router_start}ms)`);
          } catch (e) {
            perfTiming.t_router_done = Date.now();
            const isTimeout = e?.message === 'Router timeout';
            console.warn(`⚠️ [ROUTER] ${isTimeout ? 'Timeout' : 'Failed'} (${perfTiming.t_router_done - perfTiming.t_router_start}ms):`, e?.message || e);
            plan = { tool_calls: [], memory: { action: (capabilities?.qdrantEnabled ? 'auto' : 'none') }, response: { type: 'text' }, confidence: 0.0, reason: isTimeout ? 'fallback: router_timeout' : 'fallback: router_error' };
          }
        }
        
        console.log('🧭 [ROUTER] plan:', {
          tool_calls: plan.tool_calls?.map((t) => t.name) || [],
          memory: plan.memory?.action,
          response: plan.response?.type,
          confidence: plan.confidence,
          reason: plan.reason,
        });

        if (routerToolId && !perfTiming.t_router_done) {
          // Only report if not already reported by heuristic
          const tools = (plan.tool_calls || []).map((t) => t?.name).filter(Boolean);
          const summary = tools.length ? `Plan: ${tools.join(', ')}` : 'Plan: bez alata';
          toolReporter.done(routerToolId, summary, { 
            tools, 
            responseType: plan?.response?.type || 'text', 
            confidence: plan?.confidence,
            method: 'llm',
            latency: perfTiming.t_router_done - perfTiming.t_router_start
          });
        }
      }

      // Legacy fallback (always ensure plan exists)
      if (!plan) {
        plan = legacyPlan;
        if (routerToolId) toolReporter.done(routerToolId, 'Plan: legacy način', { tools: [] });
      }

      // Memory actions (router decides)
      let memoryEvent = null;
      if (userId && plan?.memory?.action === 'delete') {
        console.log('🧠 [MEMORY-DELETE] Router requested memory deletion.');
        const del = await hardDeleteMemoriesByInstruction(userId, message).catch((e) => {
          console.error(e);
          return { deletedCount: 0, error: String(e?.message || e) };
        });
        memoryEvent = { action: 'deleted', deletedCount: Number(del?.deletedCount || 0), error: del?.error || null };
      }
      if (userId && plan?.memory?.action === 'save') {
        console.log('🧠 [MEMORY-SAVE] Router requested memory save.');
        const content = String(plan?.memory?.content || message).trim();
        const saved = await saveMemoryFromInstruction({ userId, conversationId, content, source: 'router' }).catch((e) => {
          console.error(e);
          return { id: null, content, error: String(e?.message || e) };
        });
        memoryEvent = { action: 'saved', id: saved?.id || null, content: saved?.content || content, error: saved?.error || null };
      }


      // ─────────────────────────────────────────
      // 2) Optional context prompt
      // ─────────────────────────────────────────
      let contextPrompt = '';

      if (userMemories.length > 0) {
        contextPrompt +=
          '🧠 Below are important long-term memories about the user (facts). Use them ONLY if they are relevant to the user\'s latest message or if the user asks direct questions about the user, their life, preferences or history.\n';
        const memStrings = userMemories.slice(0, 8).map((m, idx) => {
          const p = m.payload || {};
          const txt = p.content || p.text || p.memory || p.value || '';
          const cat = p.category || 'other';
          const imp = p.importance != null ? Number(p.importance).toFixed(2) : '';
          const ts = p.timestamp || '';
          return `- [${idx + 1}] (${cat}, importance=${imp}${ts ? `, ts=${ts}` : ''}) ${txt}`;
        });
        contextPrompt += memStrings.join('\n');
        contextPrompt += '\n\n';
      }
      // Conversation history is sent as structured chat messages (role-based), not as a text block.
      // ─────────────────────────────────────────
      // 3) Tool execution (RAG / Web / Image) based on router plan
      // ─────────────────────────────────────────
      // If the user provided URLs, we must read them directly.
      // This prevents "search snippet guessing" and fixes the common "it said 11h but link says 08h" problem.
      const providedUrls = extractUrls(message);

      let toolCalls = Array.isArray(plan?.tool_calls) ? [...plan.tool_calls] : [];

      // ✅ Normalize tool calls (router may return ['web_search'] as strings)
      // Downstream logic expects objects: { name, args }
      toolCalls = toolCalls
        .map((c) => {
          if (!c) return null;
          if (typeof c === 'string') return { name: c, args: {} };
          if (typeof c === 'object') {
            const name = c.name || c.tool || c.type;
            if (!name) return null;
            return { name: String(name).trim(), args: c.args && typeof c.args === 'object' ? c.args : {} };
          }
          return null;
        })
        .filter(Boolean);

      // Hard heuristic: movie/title lookups (e.g. 'Avatar 3') should go to TMDB tool first,
      // not to wiki. This is a cheap guardrail on top of the router.
      const _looksLikeMovieQuery = (() => {
        if (!capabilities.movies) return false;
        const q = String(messageWithoutUrls || message || '').trim();
        const t = q.toLowerCase();
        if (!q) return false;
        if (/\b(tmdb|imdb|omdb)\b/i.test(q)) return true;
        if (/\b(film|movie|serija|series|sezona|season|epizod|episode|glumci|cast|trailer|poster)\b/i.test(t)) return true;
        // Short sequel-style titles: word(s) + small number/year
        const short = q.length <= 60;
        const hasNumber = /\b\d{1,2}\b/.test(t) || /\b(19\d{2}|20\d{2})\b/.test(t);
        const looksCalc = /\b(izračunaj|izracunaj|računaj|racunaj|koliko\s+je|calculate|compute)\b/i.test(t);
        const words = t.split(/\s+/).filter(Boolean);
        if (short && hasNumber && words.length <= 6 && !looksCalc) return true;
        return false;
      })();

      const _hasMovieCall = toolCalls.find((c) => ['movie_report','movie_lookup','movies_report'].includes(String(c?.name || '').trim()));
      if (!_hasMovieCall && _looksLikeMovieQuery) {
        toolCalls.push({ name: 'movie_report', args: { query: String(messageWithoutUrls || message || '').trim() } });
      }
      const webCall = toolCalls.find((c) => c?.name === 'web_search');
      // 🌍 FRESHNESS Layer 2: router decided web_search → check if grounding needed
      // Catches: ZH/JA/AR/KO scripts, "Ronaldo Juventus?", upitne rečenice bez L0/L1 match
      // FIX9: No more length<120 standalone — uses qmark/qword/2-entities guard
      if (!freshnessHardWeb && !officialsHardWeb && webCall) {
        if (isFreshnessSignalFromRouter(messageWithoutUrls || message)) {
          freshnessHardWeb = true;
          freshnessDecision = { fresh: true, category: 'router-signal', layer: 2 };
          console.log('🌍 [FRESHNESS] Layer 2 activated (router+question signal)');
        }
      }
      const ragCall = toolCalls.find((c) => c?.name === 'rag_retrieve');
      const imgCall = toolCalls.find((c) => c?.name === 'image_generate');
      const weatherCall = toolCalls.find((c) => c?.name === 'weather_forecast');
      const fxCall = toolCalls.find((c) => c?.name === 'fx_convert');
      const wikiCall = toolCalls.find((c) => ['wiki_summary','wiki','wikipedia','wiki_lookup'].includes(String(c?.name || '').trim()));
      const wikidataCall = toolCalls.find((c) => c?.name === 'wikidata_lookup');
      const osmGeocodeCall = toolCalls.find((c) => ['osm_geocode','osm_nominatim','osm_geocoding'].includes(String(c?.name || '').trim()));
      const osmNearbyCall = toolCalls.find((c) => ['osm_nearby','osm_overpass','osm_poi'].includes(String(c?.name || '').trim()));

      // ✅ Safety belt: if GEO/WEATHER tools are present, never run web_search unless explicitly forced
      // This prevents accidental web_search routing for maps/weather across any language.
      if (!useWebSearch && webCall && (weatherCall || osmGeocodeCall || osmNearbyCall)) {
        toolCalls = toolCalls.filter(c => c?.name !== 'web_search');
        console.log('🧹 [TOOLS] Dropped web_search because GEO/WEATHER tool is available');
      }
      const drugLabelCall = toolCalls.find((c) => c?.name === 'drug_label_openfda');
      const drugInteractionsCall = toolCalls.find((c) => c?.name === 'drug_interactions_rxnav');
      const wolframCall = toolCalls.find((c) => c?.name === 'wolfram_query');
      const holidaysCall = toolCalls.find((c) => c?.name === 'holidays_public');
      const movieCall = toolCalls.find((c) => ['movie_report','movie_lookup','movies_report'].includes(String(c?.name || '').trim()));
      const vinDecodeCall = toolCalls.find((c) => c?.name === 'vehicle_vin_decode');
      const vehicleModelsCall = toolCalls.find((c) => c?.name === 'vehicle_models_for_make');
      const vehicleRecallsCall = toolCalls.find((c) => c?.name === 'vehicle_recalls_by_vehicle');
      const vehicleComplaintsCall = toolCalls.find((c) => c?.name === 'vehicle_complaints_by_vehicle');
      const vehicleTrimsCall = toolCalls.find((c) => c?.name === 'vehicle_trims_carquery');
      const vehicleSafetyCall = toolCalls.find((c) => c?.name === 'vehicle_safety_ratings');

      // Guard: don't generate images unless the user explicitly asked
      const allowImageGen = imgCall && isExplicitImageRequest(message);

      let ragContext = '';
      let webContext = '';
      let verifiedFactsBlock = '';
      let weatherContext = '';
      let fxContext = '';
      let wikiContext = '';
      let wikidataContext = '';
      let osmGeocodeContext = '';
      let osmNearbyContext = '';
      let vehicleVinContext = '';
      let vehicleModelsContext = '';
      let vehicleRecallsContext = '';
      let vehicleComplaintsContext = '';
      let vehicleTrimsContext = '';
      let vehicleSafetyContext = '';
      let openfdaContext = '';
      let rxnavContext = '';
      let wolframContext = '';
      let holidaysContext = '';
      let moviesContext = '';
      let webResults = null;
      let wikiSources = [];
      let flyerDeals = null; // extracted strictly from OCR/Vision (no LLM guessing)
      let generatedImages = null;

      // 3a) Direct URL reads (if user pasted a link)
      // This runs even if the router didn't request web_search.
      let directUrlResults = [];
      if (providedUrls.length) {
        try {
          console.log('🔗 [URL READ] User provided URLs:', providedUrls.slice(0, 3));
          const hintForUrlRead = [messageWithoutUrls, providedUrls.join(' ')].filter(Boolean).join('\\n');
          directUrlResults = await readProvidedUrlsAsResults(providedUrls, {
            hint: hintForUrlRead || message,
          });
          console.log('✅ [URL READ] Done. Pages:', directUrlResults.length);
        } catch (e) {
          console.warn('⚠️ [URL READ] Failed:', e.message);
          directUrlResults = [];
        }
      }

      // Legacy override (if smart routing disabled): keep old behaviour.
      const legacyUseWeb = !smartEnabled && Boolean(useWebSearch);


      // Wikipedia-first heuristic: for enciklopedijske teme, Wiki ima prednost nad plaćenim web searchom
      const wantFreshRouting = _messageWantsFreshInfo(message) || _messageWantsFreshInfo(messageWithoutUrls);
      const userExplicitWeb = _explicitlyRequestsWebSearch(messageWithoutUrls || message);
      
      // 🚨 "No-tools" from router can be wrong for time-sensitive / factual queries.
      // We only treat it as a HARD skip when the user does not request web AND the message does not look freshness-sensitive.
      const routerSaidNoTools = plan &&
        Array.isArray(plan.tool_calls) &&
        plan.tool_calls.length === 0 &&
        (plan.confidence || 0) >= 0.7;

      const hardNoTools = Boolean(routerSaidNoTools && !userExplicitWeb && !wantFreshRouting);

      if (hardNoTools) {
        console.log(`⚡ [HEURISTICS-SKIP] Router said no tools (confidence: ${plan.confidence}), skipping heuristics`);
      }

      const heuristicWiki = !hardNoTools && capabilities.wiki && !wantFreshRouting && _looksLikeWikiQuery(messageWithoutUrls || message);

      // ─────────────────────────────────────────
      // Accuracy guard: detect high-risk factual queries and force extra grounding.
      // (No follow-up questions; prefer verification + restrained output.)
      // BUT: Skip if router said "no tools needed"
      // ─────────────────────────────────────────
      const accuracyRisk = ACCURACY_GUARD_ENABLED ? assessRisk(messageWithoutUrls || message) : { level: 'low', reasons: [] };
      
      // 🔥 V5.1.1: SMALL TALK GUARD (CRITICAL FIX!)
      // Check if this is casual conversation that should NOT trigger wiki/web search.
      // This prevents queries like "kako si, šta radiš danas?" from triggering expensive
      // and unnecessary wiki/web lookups due to "danas" keyword matching volatile regex.
      const isSmallTalkQuery = isSmallTalk((messageWithoutUrls || message).toLowerCase());
      
      // Logging intent for observability
      console.log(`💬 [INTENT] smalltalk=${isSmallTalkQuery}, accuracyRisk=${accuracyRisk.level}, reasons=[${accuracyRisk.reasons.join(', ')}]`);
      
      // Force grounding ONLY if NOT small talk
      // Small talk should NEVER trigger wiki/web search, even if accuracy risk is high
      const forceGrounding =
        !isSmallTalkQuery &&  // 🔥 NEW: Block force grounding for small talk
        ACCURACY_GUARD_ENABLED && 
        ACCURACY_GUARD_FORCE_TOOLS && 
        shouldForceGrounding(accuracyRisk) && 
        (providedUrls?.length || 0) === 0;

      // ─────────────────────────────────────────
      // Grounded entity/place mode (anti-hallucination)
      // If the user asks about a real-world entity (city/place/club/person/etc.) in a stable, encyclopedic way,
      // force the model to stay strictly within trusted tool blocks (Wiki/Wikidata/OSM).
      // This is especially important for short prompts like "Tomislavgrad" or "Fiorentina (Italija)".
      // BUT: Skip if router said "no tools needed"
      // ─────────────────────────────────────────
      const groundedEntityMode =
        !routerSaidNoTools && Boolean(heuristicWiki) && !wantFreshRouting && !userExplicitWeb && (providedUrls?.length || 0) === 0 && !isLongFormRequest;

      // In grounded entity mode, also try to geocode the entity/place name to reduce ambiguity.
      const heuristicOsmGeocode = !routerSaidNoTools && Boolean(groundedEntityMode) && Boolean(capabilities.osm);

      // ─────────────────────────────────────────
      // 🚨 CRITICAL: RAG RECENT CONTEXT (ALWAYS CHECK!)
      // ─────────────────────────────────────────
      // If there is a *recent upload* for this conversation,
      // ALWAYS surface it to the model, regardless of router decision!
      // Recent uploads are EXPECTED by users and must not be skipped.
      // ─────────────────────────────────────────
      let recentRagContext = '';
      let hasRecentUploadContext = false;
      
      if (capabilities.rag && userId && conversationId) {
        try {
          console.log('📄 [RAG] Checking for recent uploads...');
          const ragProbe = await ragContextForChat({
            userId,
            conversationId,
            query: '',
            topK: 6,
            windowMinutes: Number(process.env.RAG_RECENT_WINDOW_MINUTES || 10080),
          });
          recentRagContext = ragProbe?.context || '';
          
          hasRecentUploadContext = Boolean(recentRagContext && recentRagContext.trim().length > 50);
          
          if (hasRecentUploadContext) {
            console.log('✅ [RAG] Recent upload found! Length:', recentRagContext.length, 'chars');
          } else {
            console.log('📄 [RAG] No recent uploads in time window');
          }
        } catch (e) {
          console.warn('⚠️ [RAG] Recent context check failed:', e.message);
          recentRagContext = '';
          hasRecentUploadContext = false;
        }
      }

      // ─────────────────────────────────────────
      // RAG EXECUTION DECISION
      // ─────────────────────────────────────────
      // Use RAG if:
      // 1. V4.2: Plan explicitly forces RAG (file extension detected)
      // 2. Router explicitly requested it (ragCall)
      // 3. Recent upload exists (hasRecentUploadContext) - PRIORITY!
      // 4. Message contains document/file keywords
      // ─────────────────────────────────────────
      const shouldUseRag = !officialsHardWeb && (
        (plan?.forceRag && capabilities.rag) ||                                  // 🔥 V4.2: File extension detection
        (hasRecentUploadContext && capabilities.rag) ||                          // 🔥 PRIORITY: Recent upload
        (smartEnabled && ragCall && capabilities.rag) ||                         // Router said RAG
        (!smartEnabled && capabilities.rag &&                                    // Fallback: pattern match
          /\b(doc|docs|document|dokument|pdf|prilog|attachment|upload|uploaded|file|fajl|screenshot|scan|analiz|sažetak|opisati|pročitaj)\b/i.test(
            String(message || ''),
          ))
      );
      
      console.log('🔍 [RAG-DECISION]', {
        shouldUseRag,
        forceRag: Boolean(plan?.forceRag),
        hasRecentUploadContext,
        ragCall: Boolean(ragCall),
        smartEnabled,
        capabilities_rag: capabilities.rag
      });

      if (shouldUseRag) {
        const q = (ragCall?.args?.query || message).toString();
        const ragToolId = toolReporter.start('rag', 'RAG', 'Tražim relevantne podatke (RAG)…', { query: q });
        try {
          // 🔥 V4.1 FIX: Only use recent upload if query is ACTUALLY about documents
          // Prevents hijacking: "Avatar 3" after PDF upload should NOT inject PDF context!
          if (hasRecentUploadContext && _isDocumentQuery(message)) {
            console.log('✅ [RAG] Recent upload exists AND query is document-related, using it');
            ragContext = recentRagContext;
          } else if (hasRecentUploadContext && !_isDocumentQuery(message)) {
            console.log('🚫 [RAG-SKIP] Recent upload exists but query is NOT document-related (V4.1 hijacking prevention)');
            // Do semantic search instead - don't let upload hijack unrelated queries
            console.log('🔍 [RAG] Doing semantic search instead:', q.substring(0, 50));
            const ragRes = await ragContextForChat({ 
              userId, 
              conversationId, 
              query: q, 
              topK: 4, 
              windowMinutes: Number(process.env.RAG_RECENT_WINDOW_MINUTES || 10080) 
            });
            ragContext = ragRes?.context || '';
          } else {
            // No recent upload, do semantic search with query
            console.log('🔍 [RAG] No recent upload, doing semantic search:', q.substring(0, 50));
            const ragRes = await ragContextForChat({ 
              userId, 
              conversationId, 
              query: q, 
              topK: 4, 
              windowMinutes: Number(process.env.RAG_RECENT_WINDOW_MINUTES || 10080) 
            });
            ragContext = ragRes?.context || '';
          }
          if (ragToolId) {
            toolReporter.done(
              ragToolId,
              ragContext && ragContext.length
                ? `RAG: pronađen kontekst (${ragContext.length} znakova)`
                : 'RAG: nema dodatnog konteksta',
              { chars: ragContext ? ragContext.length : 0 }
            );
          }
          if (ragContext && ragContext.length > 50) {
            console.log('✅ RAG context retrieved:', ragContext.substring(0, 100) + '...');
          }
        } catch (e) {
          console.warn('⚠️ RAG failed:', e.message);
          if (ragToolId) toolReporter.error(ragToolId, `RAG nije uspio: ${String(e?.message || e)}`);
          ragContext = '';
        }
      }
      
      // 🔥 V4.1: SMART FALLBACK - Only inject recent upload if query is about documents
      // Prevents RAG hijacking unrelated queries (e.g., "Avatar 3" after PDF upload)
      if (!ragContext && hasRecentUploadContext && _isDocumentQuery(message)) {
        console.log('📄 [RAG-FALLBACK] Recent upload exists AND query is document-related, using as context');
        ragContext = recentRagContext;
      } else if (!ragContext && hasRecentUploadContext) {
        console.log('🚫 [RAG-FALLBACK] Recent upload exists but query is NOT document-related, skipping (V4.1 hijacking prevention)');
      }
      
      // Final RAG context check
      if (ragContext && ragContext.length > 50) {
        console.log('✅ [RAG-FINAL] Context available:', ragContext.length, 'chars');
      } else {
        console.log('📄 [RAG-FINAL] No context available');
      }



// Wiki layer (Wikipedia + Wikidata + DBpedia) — run BEFORE paid web_search
// Goal: for encyclopedic, stable info, use free wiki sources first, and only then decide if web_search is needed.
// 🔥 V5.1.1: Added !isSmallTalkQuery guard to prevent wiki lookup for casual conversation
// Wiki is great for stable/encyclopedic topics, but it often becomes stale for
// time‑sensitive questions. If we already decided to run web_search (or the
// message looks “fresh”), we skip wiki early to avoid polluting grounding.
const shouldDoWikiEarly =
  !isSmallTalkQuery && // never do wiki for small talk
  capabilities.wiki &&
  !officialsHardWeb &&
  !movieCall &&
  !webCall &&
  !wantFreshRouting &&
  ((smartEnabled && wikiCall) || heuristicWiki);

if (shouldDoWikiEarly) {
  const wikiToolId = toolReporter.start('wiki_summary', 'Wiki', 'Tražim na Wikipediji…', {
    query: String(wikiCall?.args?.query || messageWithoutUrls || message).slice(0, 160),
  });
  try {
    const a = wikiCall?.args || {};
    const rawQuery = String(a.query || a.q || a.search || messageWithoutUrls || message).trim().slice(0, 400);
    const query = (_extractWikiQuery(rawQuery) || rawQuery).trim().slice(0, 200);
    const title = String(a.title || '').trim().slice(0, 200);

    console.log('📚 [WIKI] (early) query=', { rawQuery, query, title });

    // In accuracy guard mode, always include Wikidata enrichment if available.
    const includeWikidata = Boolean(capabilities.wikidata);
    const w = await wikiLookup({ query, title, languageHint, includeWikidata, includeDbpedia: true });
    if (w?.ok && w?.context) {
      wikiContext = w.context;
      wikiSources = Array.isArray(w.sources) ? w.sources : [];
      if (wikiToolId) toolReporter.done(wikiToolId, 'Wiki sloj: pronađen sažetak', { lang: w.lang, title: w.resolvedTitle });
      console.log('📚 [WIKI] ok (early)');
    } else {
      if (wikiToolId) toolReporter.done(wikiToolId, 'Wiki sloj: nema rezultata', { error: w?.error || 'no_result' });
      console.warn('⚠️ [WIKI] Not ok (early):', w?.error);
    }
  } catch (e) {
    console.warn('⚠️ [WIKI] Failed (early):', e.message);
    if (wikiToolId) toolReporter.error(wikiToolId, `Wiki sloj nije uspio: ${String(e?.message || e)}`);
  }
}

      // Web search - more aggressive triggering
      // If URLs were provided, we still *may* do web search, but the direct URL content always comes first.
      
const forceContactWebSearch = capabilities.web && isContactIntent(messageWithoutUrls || message);
      const routerRequestedWeb = Boolean(smartEnabled && webCall);
      // IMPORTANT: Never skip a router-requested web_search.
      // Otherwise time-sensitive "who is the president/mayor/CEO" questions can be answered
      // from wiki-only context (or stale cached summaries) and silently bypass grounding.
      const skipPaidWebBecauseWiki =
        Boolean(wikiContext && wikiContext.trim()) &&
        !routerRequestedWeb &&
        !userExplicitWeb &&
        !wantFreshRouting &&
        !forceGrounding &&
        providedUrls.length === 0 &&
        !forceContactWebSearch;

      // Web search triggers:
      // - explicit request / fresh info / contact intent
      // - router requested web_search
      // - accuracy guard (medium/high risk) to cross-check volatile claims
      // If the router said "no tools" we still allow web search for freshness / explicit web / accuracy guard.
      // 🔥 V5.1.1: Small talk guard with exception for explicit web requests
      // EXCEPTION: If user explicitly says "googlaj" or "pretraži web", allow even for small talk
      // Respect request-level toggle, BUT never block a router-requested web_search.
      // - explicitlyDisabled=true should always win (user/dev hard off)
      // - if router decided web_search (webCall) we allow it even when useWebSearch is false
      //   because this is exactly how we keep "who is the president"-type queries truthful.
      const webAllowedByUser =
        !explicitlyDisabled &&
        (Boolean(userExplicitWeb) || useWebSearch !== false || (smartEnabled && webCall));

      const shouldDoWebSearch =
        webAllowedByUser &&
        (!isSmallTalkQuery || userExplicitWeb) &&  // 🔥 Block small talk UNLESS explicit web request
        !hardNoTools &&
        Boolean(capabilities.web) &&
        (forceContactWebSearch || userExplicitWeb || wantFreshRouting || forceGrounding || ((smartEnabled && webCall) || legacyUseWeb)) &&
        !skipPaidWebBecauseWiki;

      if (shouldDoWebSearch) {
        let webToolId = null;
        try {
          // ─────────────────────────────────────────
          // CONTEXT CARRY FIX
          // If the user sends a "web search" command like "pronađi na internetu",
          // we must keep the previous user question as the real search target.
          // Otherwise we end up searching for the command itself.
          // This is designed to work language-agnostic (heuristics + a small multilingual set).
          const _normCmd = (s) => String(s || '')
            .toLowerCase()
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          const _looksLikeWebCommandOnly = (text) => {
            const t = _normCmd(text);
            if (!t) return false;
            // direct common forms (HR/EN + a few common starters)
            const direct = new Set([
              'pronadi na internetu',
              'pronađi na internetu',
              'pretrazi na internetu',
              'pretraži na internetu',
              'pretrazi web',
              'pretraži web',
              'googlaj',
              'google',
              'search',
              'web search',
              'look up',
              'lookup',
              'find online',
              'find on internet',
              'busca en internet',
              'chercher sur internet',
              'procure na internet',
            ]);
            if (direct.has(t)) return true;

            const wc = t.split(' ').filter(Boolean).length;
            // Short imperative-like commands, often containing "web" or "internet"
            if (wc <= 5 && (t.includes('internet') || t.includes('web'))) return true;
            // Starts with common imperative verbs across languages (keep small & safe)
            const starters = [
              'find', 'search', 'look', 'busca', 'buscar', 'cherche', 'chercher', 'procure',
              'pretrazi', 'pretrazi', 'pretrazi', 'pretrazi', 'googlaj',
              'найди', 'искать', 'поиск', '搜索', '検索'
            ];
            if (wc <= 4 && starters.some((s) => t.startsWith(s))) return true;
            return false;
          };

          const _pickPreviousUserQuestion = (hist) => {
            if (!Array.isArray(hist)) return null;
            for (let i = hist.length - 1; i >= 0; i--) {
              const m = hist[i];
              if (!m || m.role !== 'user') continue;
              const c = String(m.content || '').trim();
              if (!c) continue;
              if (_looksLikeWebCommandOnly(c)) continue;
              // discard ultra-short acknowledgements
              if (c.length < 6) continue;
              return c;
            }
            return null;
          };

          const baseQueryRaw = String(webCall?.args?.query || messageWithoutUrls || message);
          const isCmd = _looksLikeWebCommandOnly(message) || _looksLikeWebCommandOnly(baseQueryRaw);
          const prevUserQ = isCmd ? _pickPreviousUserQuestion(relevantHistory) : null;
          const resolvedUserMessage = (isCmd && prevUserQ) ? prevUserQ : message;
          const baseQuery = (isCmd && prevUserQ) ? prevUserQ : baseQueryRaw;

          // Improve weak queries (e.g., obituary intent where a naive query like "sahrana" would fail).
          const plannedWeb = await planWebQuery({ userMessage: resolvedUserMessage, baseQuery });
// Improve weak queries (e.g., obituary intent where a naive query like "sahrana" would fail).
let augmentedQuery = plannedWeb?.query;
const queryCandidates = Array.isArray(plannedWeb?.queries) && plannedWeb.queries.length
  ? plannedWeb.queries
  : [augmentedQuery || baseQuery];

          if (WEB_QUERY_YEAR_AUGMENT) {
            const wantsFresh = _messageWantsFreshInfo(message) || _messageWantsFreshInfo(baseQuery);
            const hasYear = /\b(20\d{2})\b/.test(augmentedQuery || baseQuery);
            if (wantsFresh && !hasYear) {
              const y = Number(earlyTimeCtx?.localYear || new Date().getFullYear());
              if (y && y >= 2000 && y <= 2100) augmentedQuery = `${augmentedQuery} ${y}`;
            }
          }
          webToolId = toolReporter.start(
            'web_search',
            'Web pretraga',
            forceContactWebSearch ? 'Tražim kontakt podatke na webu…' : 'Tražim izvore na webu…',
            { query: augmentedQuery }
          );

          // Billing / observability context for web search (avoid ReferenceError)
          // Keep it lightweight (no sensitive payloads).
                    const safeRequestId = (typeof requestId !== 'undefined' && requestId) ? requestId : (req?.headers?.['x-request-id'] || req?.headers?.['x-cloud-trace-context'] || null);

const billingCtx = {
            userId: userId || 'guest',
            conversationId: conversationId || null,
            requestId: safeRequestId || null,
            operation: 'web_search',
            meta: { tool: 'web_search' },
          };

          console.log('🔎 [WEB SEARCH] Executing search (multi-round) candidates:', queryCandidates.slice(0, 4));
          let ws = null;
          for (let qi = 0; qi < Math.min(queryCandidates.length, 4); qi++) {
            const qTry = String(queryCandidates[qi] || '').trim();
            if (!qTry) continue;

            toolReporter.progress(
              webToolId,
              `Pretražujem web… (${qi + 1}/${Math.min(queryCandidates.length, 4)})`,
              { query: qTry }
            );

            console.log('🔎 [WEB SEARCH] Executing search for:', qTry.substring(0, 120));
            ws = await webSearch(qTry, {
              mode: webCall?.args?.mode || webSearchMode || WEBSEARCH_DEFAULT_MODE,
              maxResults: webCall?.args?.maxResults || webMaxResults || WEBSEARCH_DEFAULT_MAX_RESULTS,
              timeRange: webCall?.args?.timeRange || webTimeRange,
              searchDepth: webCall?.args?.searchDepth || webSearchDepth,
              // NOTE: allow string values too (e.g. 'markdown' / 'deep' / 'scrapedev')
              includeRawContent: webCall?.args?.includeRawContent ?? webIncludeRawContent,
              prefer: webCall?.args?.prefer || webPrefer,
              serperGl: webCall?.args?.serperGl,
              serperHl: webCall?.args?.serperHl,
              billing: billingCtx,
              onStatus: (p) => {
                if (!webToolId) return;
                const msg = p?.message || p?.stage || 'Web pretraga…';
                toolReporter.progress(webToolId, msg, { stage: p?.stage, ...p });
              },
            });

            // ✅ If wrapper shortcircuited to a tool (weather/OSM), stop multi-round tries
            const stages = ws?.metadata?.stages_executed || ws?.metadata?.stages || [];
            const isToolFirst = Array.isArray(stages) && stages.includes('tool_first_shortcircuit');
            if (isToolFirst) break;

            const nTmp = Array.isArray(ws?.results) ? ws.results.length : 0;
            if (nTmp >= 2) break; // good enough
          }

          if (webToolId) {
            const n = Array.isArray(ws?.results) ? ws.results.length : 0;
            const providers = Array.isArray(ws?.usedProviders) ? ws.usedProviders : [];
            toolReporter.done(webToolId, `Web pretraga gotova (${n} rezultata)`, { results: n, providers });
          }
          // Merge: direct URL reads first (citable), then search results.
          const merged = {
            ...ws,
            usedProviders: Array.from(new Set(['direct', ...(ws.usedProviders || [])])),
            results: [...directUrlResults, ...(ws.results || [])],
          };
          webResults = merged;
          // websearch.makeWebContextBlock is async (via CJS->dynamic import bridge)
          webContext = await makeWebContextBlock(merged);

          // ✅ TWO-PASS SEARCH — officials: if first pass has no party info, extract name and search for party
          if (officialsHardWeb && Array.isArray(merged.results) && merged.results.length > 0) {
            const allText = merged.results.map(r => `${r.title || ''} ${r.snippet || r.content || ''}`).join(' ');
            const hasPartyInfo = /\b(HDZ|SDP|SBB|SNSD|HNP|SDS|HNS|SBiH|NiP|DF|stranka|party|partido|partei|parti)\b/i.test(allText);
            if (!hasPartyInfo) {
              const nameMatch = allText.match(/\b([A-ZČĆŽŠĐ][a-zčćžšđ]{1,20}\s+[A-ZČĆŽŠĐ][a-zčćžšđ]{1,20})\b/u);
              if (nameMatch?.[1]) {
                const partyQuery = `"${nameMatch[1]}" stranka stranačka pripadnost`;
                console.log('🏛️ [OFFICIALS TWO-PASS] Searching party:', partyQuery);
                try {
                  const ws2 = await webSearch(partyQuery, { mode: 'balanced', maxResults: 5, timeRange: 'year', billing: billingCtx });
                  if (Array.isArray(ws2?.results) && ws2.results.length > 0) {
                    console.log(`🏛️ [OFFICIALS TWO-PASS] Found ${ws2.results.length} party results`);
                    const merged2 = { ...merged, results: [...merged.results, ...ws2.results] };
                    webResults = merged2;
                    webContext = await makeWebContextBlock(merged2);
                  }
                } catch (e2) {
                  console.warn('⚠️ [OFFICIALS TWO-PASS] failed:', e2?.message || e2);
                }
              }
            }
          }

          // ✅ VERIFIED FACTS extraction — runs for officials AND freshness queries
          if (officialsHardWeb || freshnessHardWeb) {
            try {
              const extracted = await extractWebFacts({
                userQuestion: messageWithoutUrls || message,
                webResults: merged,
                languageHint: userLanguage || languageHint || 'hr',
              });
              verifiedFactsBlock = makeVerifiedFactsBlock(extracted);
              console.log(`🧾 [WEB FACTS] extracted (${officialsHardWeb ? 'officials' : 'freshness'}):`, {
                ok: extracted?.ok,
                claims: extracted?.facts?.claims?.length || 0,
                conflict: (extracted?.facts?.claims || []).filter(x => x.conflict).length,
                err: extracted?.error || null,
              });
            } catch (e) {
              console.warn('⚠️ [WEB FACTS] extractor failed:', e?.message || e);
            }
          }
          console.log('✅ [WEB SEARCH] Found', ws?.results?.length || 0, 'results');
          
          // ✅ FRONTEND INTEGRATION: Send sources to client via SSE
          if (sendEvent && Array.isArray(webResults?.results) && webResults.results.length > 0) {
            const seen = new Set();
            const sources = [];
            for (const result of webResults.results) {
              if (sources.length >= 10) break;
              const url = String(result?.url || result?.link || '').trim();
              if (!url) continue;
              const canon = canonicalizeUrl(url, { dropQuery: false, stripTracking: true, stripWww: true }) || url;
              if (seen.has(canon)) continue;
              seen.add(canon);
              let domain = '';
              try {
                domain = new URL(url).hostname.replace(/^www\./, '');
              } catch (_) {}
              const faviconUrl = domain
                ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
                : null;
              const origin = domain ? `https://${domain}` : null;

              sources.push({
                title: result.title || result.name || 'Untitled',
                url,
                snippet: result.snippet || result.description || result.rawContent || '',
                provider: String(result.provider || 'web'),
                date: result.publishedAt || result.publishedDate || null,
                imageUrl: result.imageUrl || result.image || null,
              });
            }

            if (sources.length) {
              sendEvent('sources', { sources });
              console.log('📤 [SSE] Sent', sources.length, 'sources to frontend');
            }
          }
        } catch (e) {
          console.warn('⚠️ Web search failed:', e.message);
          if (webToolId) toolReporter.error(webToolId, `Web pretraga nije uspjela: ${String(e?.message || e)}`);
          webContext = '';
          webResults = null;
        }
      }

      // If the user provided URLs but the router/web flags didn't trigger a search,
      // we still provide a webContext block sourced from the actual page(s).
      if (!webContext && directUrlResults.length) {
        const pseudo = {
          ok: true,
          query: '(direct_url_read)',
          mode: 'direct',
          fetchedAtIso: new Date().toISOString(),
          usedProviders: ['direct'],
          results: directUrlResults,
          ddg: null,
        };
        webResults = pseudo;
        webContext = await makeWebContextBlock(pseudo);
        
        // ✅ FRONTEND INTEGRATION: Send direct URL sources
        if (sendEvent && directUrlResults.length > 0) {
          const seen = new Set();
          const sources = [];
          for (const result of directUrlResults) {
            if (sources.length >= 10) break;
            const url = String(result?.url || result?.link || '').trim();
            if (!url) continue;
            const canon = canonicalizeUrl(url, { dropQuery: false, stripTracking: true, stripWww: true }) || url;
            if (seen.has(canon)) continue;
            seen.add(canon);
            sources.push({
              title: result.title || result.name || 'Direct URL',
              url,
              snippet: result.snippet || result.description || result.rawContent || '',
              provider: String(result.provider || 'direct'),
              date: result.publishedAt || result.publishedDate || null,
              imageUrl: result.imageUrl || result.image || null,
            });
          }

          if (sources.length) {
            sendEvent('sources', { sources });
            console.log('📤 [SSE] Sent', sources.length, 'direct URL sources to frontend');
          }
        }
      }

      // STRICT flyer/deals extraction from OCR/Vision. This is used to prevent hallucinations
      // when the user asks for price lists, promo flyers, catalogues, etc.
      try {
        if (_looksLikeFlyerDealsQuery(message) && webResults?.imageInsights?.ok) {
          flyerDeals = _extractFlyerDealsFromImageInsights(webResults.imageInsights);
        }
      } catch (_e) {
        flyerDeals = null;
      }

      // Image generation - improved logging
      if (smartEnabled && imgCall && capabilities.image && allowImageGen) {
        let imgToolId = null;
        try {
          const originalPrompt = String(imgCall?.args?.prompt || message).trim();
          console.log('🎨 [IMAGE GEN] Starting image generation...');
          console.log('   Prompt:', originalPrompt.substring(0, 80));
          console.log('   Args:', JSON.stringify(imgCall?.args || {}).substring(0, 150));
          
          if (originalPrompt) {
            imgToolId = toolReporter.start('image_gen', 'Slika', 'Pripremam prompt za generiranje…', {
              prompt: originalPrompt,
              expected: 'image',
            });
            const tr = await translateToEnglish(originalPrompt, { force: true });
            const promptEnglish = tr?.english || originalPrompt;
            const promptFinal = buildFluxPrompt(promptEnglish, {
              extra: String(imgCall?.args?.promptExtra || '').trim(),
              preset: String(imgCall?.args?.preset || '').trim(),
            });

            if (imgToolId) {
              toolReporter.progress(imgToolId, 'Generiram sliku…');
            }

            console.log('   Translated prompt:', promptEnglish.substring(0, 80));
const wait = Number(imgCall?.args?.wait ?? 60);

            const result = await generateImageWithReplicate(
              {
                preset: imgCall?.args?.preset,
                prompt: promptFinal,
                aspect_ratio: imgCall?.args?.aspect_ratio,
                num_outputs: imgCall?.args?.num_outputs,
                seed: imgCall?.args?.seed,
                output_format: imgCall?.args?.output_format,
                output_quality: imgCall?.args?.output_quality,
                prompt_optimizer: imgCall?.args?.prompt_optimizer,
                disable_safety_checker: imgCall?.args?.disable_safety_checker,
              },
              { waitSeconds: wait },
            );

                        // Billing: Replicate image gen (only when final status)
            const _finalStatuses = new Set(['succeeded', 'failed', 'canceled']);
            if (_finalStatuses.has(String(result?.status || ''))) {
              await logReplicateBillingOnce({
                predictionId: result?.predictionId,
                status: result?.status,
                model: result?.model ?? result?.version ?? null,
                preset: result?.preset,
                imagesCount: Array.isArray(result?.images) ? result.images.length : 0,
                seconds: result?.predictSeconds ?? result?.metrics?.predict_time ?? result?.metrics?.predictTime,
                userId: userId || 'guest',
                conversationId: conversationId || null,
                operation: 'chat_image_generate',
              });
            }

console.log('✅ [IMAGE GEN] Success! Status:', result.status);
            console.log('   Images:', result.images?.length || 0);

            generatedImages = {
              ...result,
            };

            if (imgToolId) {
              const n = Array.isArray(result?.images) ? result.images.length : 0;
              toolReporter.done(imgToolId, `Slika generirana`, {
                images: n,
                predictionId: result?.predictionId || null,
              });
            }
          }
        } catch (e) {
          console.error('❌ [IMAGE GEN] Failed:', e.message);
          console.error('   Stack:', e.stack);
          if (imgToolId) toolReporter.error(imgToolId, `Generiranje slike nije uspjelo: ${String(e?.message || e)}`);
          generatedImages = { error: e.message, details: e.details || null };
        }
      } else if (allowImageGen && !capabilities.image) {
        console.warn('⚠️ [IMAGE GEN] Router requested image generation but capability is disabled');
        console.warn('   Check REPLICATE_API_TOKEN in env');
      }

      
      // Optional: persist generated images to Firebase Storage (stable download URLs)
      // (frontend can display them without auth issues; avoids "broken image" when CDN URLs expire)
      if (
        generatedImages &&
        !generatedImages.error &&
        Array.isArray(generatedImages.images) &&
        generatedImages.images.length &&
        userId &&
        conversationId
      ) {
        try {
          const persisted = await persistGeneratedImages({
            userId,
            conversationId,
            // Do NOT store caption/prompt in Firestore (frontend renders the image itself).
            storeMessage: false,
            images: generatedImages.images,
            predictionId: generatedImages.predictionId || null,
            provider: 'replicate',
            preset: imgCall?.args?.preset ?? null,
            meta: {
              aspect_ratio: imgCall?.args?.aspect_ratio ?? null,
              output_format: imgCall?.args?.output_format ?? null,
              output_quality: imgCall?.args?.output_quality ?? null,
            },
});

          if (persisted && Array.isArray(persisted.uploads) && persisted.uploads.length) {
            // Keep frontend compatibility: return image URLs (strings)
            generatedImages.images = persisted.uploads
              .map((u) => (u && typeof u === "object" ? (u.downloadUrl || u.sourceUrl || "") : ""))
              .filter(Boolean);
            generatedImages.persisted = { ok: true, uploads: persisted.uploads };
          }
        } catch (e) {
          console.warn('⚠️ Image persistence failed:', e.message);
          // keep original provider URLs
        }
      }

      // 3c) Weather (Open-Meteo) and FX (Frankfurter)
      // These are fast, free APIs (no keys). Prefer them over web_search for their domains.
      const shouldDoWeather = smartEnabled && weatherCall && capabilities.weather;
      if (shouldDoWeather) {
        try {
          const a = weatherCall?.args || {};
          const place = String(a.place || a.location || a.city || a.query || messageWithoutUrls || message)
            .trim()
            .slice(0, 120);
          const lat = a.latitude ?? a.lat;
          const lon = a.longitude ?? a.lon ?? a.lng;
          const wx = await getWeather({
            place: place || null,
            latitude: lat,
            longitude: lon,
            languageHint,
            provider: a.provider || a.source || a.api || 'auto',
          });
          if (wx?.ok && wx?.context) {
            weatherContext = wx.context;
            console.log('🌦️ [WEATHER] ok');
          } else {
            weatherContext = `Greška (weather): ${wx?.error || 'nepoznato'}`;
            console.warn('⚠️ [WEATHER] Not ok:', wx?.error);
          }
        } catch (e) {
          console.warn('⚠️ [WEATHER] Failed:', e.message);
          weatherContext = `Greška (weather): ${e.message}`;
        }
      }

      const shouldDoFx = smartEnabled && fxCall && capabilities.fx;
      if (shouldDoFx) {
        try {
          const a = fxCall?.args || {};
          const fx = await convertCurrency({
            amount: a.amount ?? a.value ?? 1,
            from: a.from ?? a.base ?? 'EUR',
            to: a.to ?? a.target ?? a.symbols,
            symbols: Array.isArray(a.symbols) ? a.symbols : undefined,
            date: a.date,
          });
          if (fx?.ok && fx?.context) {
            fxContext = fx.context;
            console.log('💱 [FX] ok');
          } else {
            fxContext = `Greška (fx): ${fx?.error || 'nepoznato'}`;
            console.warn('⚠️ [FX] Not ok:', fx?.error);
          }
        } catch (e) {
          console.warn('⚠️ [FX] Failed:', e.message);
          fxContext = `Greška (fx): ${e.message}`;
        }
      }

      // 3d) Holidays (free, no keys)
      const shouldDoHolidays = smartEnabled && holidaysCall && capabilities.holidays;
      if (shouldDoHolidays) {
        try {
          const a = holidaysCall?.args || {};
          const cc = String(a.countryCode || a.country || a.cc || '').trim();
          const year = Number(a.year || earlyTimeCtx?.localYear || new Date().getFullYear());
          const mode = String(a.mode || '').trim().toLowerCase(); // 'next' | 'year' | ''

          let parts = [];

          if (!mode || mode === 'next') {
            const next = await getNextPublicHolidays({ countryCode: cc, languageHint });
            if (next?.ok && next?.context) parts.push(next.context);
            else parts.push(`Greška (holidays-next): ${next?.error || 'nepoznato'}`);
          }

          if (!mode || mode === 'year') {
            const list = await getPublicHolidays({ countryCode: cc, year, languageHint });
            if (list?.ok && list?.context) parts.push(list.context);
            else parts.push(`Greška (holidays-year): ${list?.error || 'nepoznato'}`);
          }

          holidaysContext = parts.filter(Boolean).join('\n\n');
          console.log('🎌 [HOLIDAYS] done');
        } catch (e) {
          console.warn('⚠️ [HOLIDAYS] Failed:', e.message);
          holidaysContext = `Greška (holidays): ${e.message}`;
        }
      }

      // 3e) Wikidata (structured facts)
      // Wikidata is helpful for stable structured facts. For “fresh”/news‑like
      // questions where web_search is already planned, skip Wikidata to avoid
      // stale or off‑topic structured lookups.
      const shouldDoWikidata =
        Boolean(capabilities.wikidata) &&
        !isSmallTalkQuery &&
        !webCall &&
        !wantFreshRouting &&
        Boolean(smartEnabled && wikidataCall);
      if (shouldDoWikidata) {
        try {
          const a = wikidataCall?.args || {};
          const q = String(a.query || a.q || a.search || messageWithoutUrls || message).trim().slice(0, 250);
          const w = await wikidataLookup({ query: q, languageHint });
          if (w?.ok && w?.context) {
            wikidataContext = w.context;
            console.log('🧩 [WIKIDATA] ok');
          } else {
            wikidataContext = `Greška (wikidata): ${w?.error || 'nepoznato'}`;
            console.warn('⚠️ [WIKIDATA] Not ok:', w?.error);
          }
        } catch (e) {
          console.warn('⚠️ [WIKIDATA] Failed:', e.message);
          wikidataContext = `Greška (wikidata): ${e.message}`;
        }
      }

      // 3e.5) Movies (TMDB primary + OMDb fallback)
      const shouldDoMovies = smartEnabled && movieCall && capabilities.movies;
      if (shouldDoMovies) {
        try {
          const a = movieCall?.args || {};
          const q = String(a.query || a.title || messageWithoutUrls || message).trim().slice(0, 200);
          const year = a.year ? Number(a.year) : undefined;
          const tmdbId = a.tmdbId ?? a.id;
          const imdbId = a.imdbId ?? a.imdb;

          const mr = await movieReport({ query: q, year, tmdbId, imdbId, languageHint, includeImages: true });
          if (mr?.ok && mr.reportMarkdown) {
            moviesContext = mr.reportMarkdown;
            console.log('🎬 [MOVIES] ok', { providerUsed: mr.providerUsed });
          } else {
            moviesContext = `Greška (movies): ${mr?.error || 'nepoznato'}`;
            console.warn('⚠️ [MOVIES] Not ok:', mr?.error);
          }
        } catch (e) {
          console.warn('⚠️ [MOVIES] Failed:', e.message);
          moviesContext = `Greška (movies): ${e.message}`;
        }
      }

      // ✅ Wiki sloj za filmove/serije ide zadnji (tek ako movies nije našao rezultat)
      if (capabilities.wiki && !wikiContext && shouldDoMovies && typeof moviesContext === 'string' && moviesContext.startsWith('Greška (movies):')) {
        try {
          const query = String(messageWithoutUrls || message).trim();
          const w = await wikiLookup({ query, title: '', languageHint, includeWikidata: true, includeDbpedia: true });
          if (w?.ok && w.summaryMarkdown) {
            wikiContext = w.summaryMarkdown;
            console.log('📚 [WIKI] ok (late after movies)');
          } else if (w?.error) {
            console.warn('⚠️ [WIKI] late failed:', w.error);
          }
        } catch (e) {
          console.warn('⚠️ [WIKI] late exception:', e?.message || String(e));
        }
      }

      // 3f) OpenStreetMap (Nominatim/Overpass)
      // Heuristic: when in grounded entity/place mode, run a quick geocode even if the router didn't ask.
      // This adds stable, non-creative facts (country/coords/admin area) and reduces hallucinations.
      const osmGeocodeRequested = Boolean(smartEnabled && osmGeocodeCall);
      const baseTextForOsm = String(messageWithoutUrls || message || '').trim();
      // HARD GUARD: only run OSM/Nominatim when the query actually looks like a place/address question.
      // This prevents nonsense calls like "koji je bio rezultat" being sent to Nominatim.
      const osmGeocodeHeuristic = Boolean(
        !osmGeocodeRequested &&
          looksLikeLocationQuery(baseTextForOsm) &&
          (groundedEntityMode || (forceGrounding && (Boolean(heuristicWiki) || accuracyRisk.reasons?.includes('short entity')))),
      );

      const shouldDoOsmGeocode = Boolean(capabilities.osm) && (osmGeocodeRequested || osmGeocodeHeuristic);
      if (shouldDoOsmGeocode) {
        try {
          const a = osmGeocodeCall?.args || {};
          const baseText = baseTextForOsm;
          let q = String(a.query || a.q || a.place || a.search || baseText).trim();

          // If this geocode was triggered heuristically for an entity/place question,
          // strip common filler prefixes so Nominatim gets a clean query.
          if (osmGeocodeHeuristic) {
            q = q
              .replace(/^\s*(detaljno\s+o|detaljno|sve\s+o|info\s+o|info|informacije\s+o|informacije|opis\s+o|opis|o)\s+/i, '')
              .replace(/[?！!]+$/g, '')
              .trim();
          }

          q = q.slice(0, 200);

          // If this doesn't look like a location lookup, block the call (protects Nominatim + prevents topic drift).
          if (!looksLikeLocationQuery(q)) {
            if (osmGeocodeRequested) {
              osmGeocodeContext = 'Greška (osm_geocode): OSM geocode je samo za mjesta/adrese. (Upit ne izgleda kao lokacija.)';
            } else {
              osmGeocodeContext = '';
            }
            console.warn('⚠️ [OSM GEOCODE] Skipped (not a location query):', q);
          } else {
          const limit = a.limit;
          const countrycodes = a.countrycodes || a.country || a.cc;

            const g = await osmGeocode({ query: q, limit, countrycodes, languageHint });
            if (g?.ok && g?.context) {
              osmGeocodeContext = g.context;
              console.log('🗺️ [OSM GEOCODE] ok');
            } else {
              // If heuristic, fail silently (avoid polluting tool blocks with errors).
              if (osmGeocodeRequested) {
                osmGeocodeContext = `Greška (osm_geocode): ${g?.error || 'nepoznato'}`;
              } else {
                osmGeocodeContext = '';
              }
              console.warn('⚠️ [OSM GEOCODE] Not ok:', g?.error);
            }
          }
        } catch (e) {
          console.warn('⚠️ [OSM GEOCODE] Failed:', e.message);
          if (osmGeocodeRequested) {
            osmGeocodeContext = `Greška (osm_geocode): ${e.message}`;
          } else {
            osmGeocodeContext = '';
          }
        }
      }

      const shouldDoOsmNearby = smartEnabled && osmNearbyCall && capabilities.osm;
      if (shouldDoOsmNearby) {
        try {
          const a = osmNearbyCall?.args || {};
          const place = String(a.place || a.query || a.q || messageWithoutUrls || message).trim().slice(0, 200);
          const latitude = a.lat || a.latitude;
          const longitude = a.lon || a.lng || a.longitude;
          const radius = a.radius;
          const limit = a.limit;
          const key = a.key;
          const value = a.value;

          const n = await osmNearby({ place, latitude, longitude, radius, limit, key, value, languageHint });
          if (n?.ok && n?.context) {
            osmNearbyContext = n.context;
            console.log('🧭 [OSM NEARBY] ok');
          } else {
            osmNearbyContext = `Greška (osm_nearby): ${n?.error || 'nepoznato'}`;
            console.warn('⚠️ [OSM NEARBY] Not ok:', n?.error);
          }
        } catch (e) {
          console.warn('⚠️ [OSM NEARBY] Failed:', e.message);
          osmNearbyContext = `Greška (osm_nearby): ${e.message}`;
        }
      }

      // 3g) Vehicle / car APIs (NHTSA vPIC + NHTSA Recalls/Safety + CarQuery)
      const shouldDoVin = smartEnabled && vinDecodeCall && capabilities.cars;
      if (shouldDoVin) {
        const a = vinDecodeCall?.args || {};
        const vin = a.vin || a.VIN || a.chassis || a.sasija || messageWithoutUrls || message;
        const modelYear = a.modelYear || a.year;
        const id = toolReporter.start('vehicle_vin_decode', 'Vozilo', 'Dekodiram VIN…', { vin: String(vin).slice(0, 20) });
        try {
          const out = await decodeVin({ vin, modelYear });
          if (out?.ok && out?.context) {
            vehicleVinContext = out.context;
            toolReporter.done(id, 'VIN dekodiran', { ok: true });
            console.log('🚗 [VIN] ok');
          } else {
            vehicleVinContext = `Greška (vehicle_vin_decode): ${out?.error || 'nepoznato'}`;
            toolReporter.error(id, 'VIN: greška', { ok: false, error: out?.error });
            console.warn('⚠️ [VIN] Not ok:', out?.error);
          }
        } catch (e) {
          vehicleVinContext = `Greška (vehicle_vin_decode): ${e.message}`;
          toolReporter.error(id, 'VIN: greška', { ok: false, error: e.message });
          console.warn('⚠️ [VIN] Failed:', e.message);
        }
      }

      const shouldDoVehicleModels = smartEnabled && vehicleModelsCall && capabilities.cars;
      if (shouldDoVehicleModels) {
        const a = vehicleModelsCall?.args || {};
        const make = a.make || a.brand || a.marka;
        const modelYear = a.modelYear || a.year;
        const vehicleType = a.vehicleType || a.type;
        const id = toolReporter.start('vehicle_models_for_make', 'Vozilo', 'Dohvaćam modele za marku…', {
          make: String(make || '').slice(0, 40),
        });
        try {
          const out = await getModelsForMake({ make, modelYear, vehicleType });
          if (out?.ok && out?.context) {
            vehicleModelsContext = out.context;
            toolReporter.done(id, 'Modeli dohvaćeni', { ok: true, count: out.models?.length || 0 });
            console.log('🚗 [MODELS] ok');
          } else {
            vehicleModelsContext = `Greška (vehicle_models_for_make): ${out?.error || 'nepoznato'}`;
            toolReporter.error(id, 'Modeli: greška', { ok: false, error: out?.error });
            console.warn('⚠️ [MODELS] Not ok:', out?.error);
          }
        } catch (e) {
          vehicleModelsContext = `Greška (vehicle_models_for_make): ${e.message}`;
          toolReporter.error(id, 'Modeli: greška', { ok: false, error: e.message });
          console.warn('⚠️ [MODELS] Failed:', e.message);
        }
      }

      const shouldDoRecalls = smartEnabled && vehicleRecallsCall && capabilities.cars;
      if (shouldDoRecalls) {
        const a = vehicleRecallsCall?.args || {};
        const make = a.make || a.brand;
        const model = a.model;
        const year = a.year || a.modelYear;
        const id = toolReporter.start('vehicle_recalls_by_vehicle', 'Vozilo', 'Provjeravam opozive…', {
          make: String(make || '').slice(0, 30),
          model: String(model || '').slice(0, 40),
        });
        try {
          const out = await getRecallsByVehicle({ make, model, year });
          if (out?.ok && out?.context) {
            vehicleRecallsContext = out.context;
            toolReporter.done(id, `Opozivi: ${out.count || 0}`, { ok: true, count: out.count || 0 });
            console.log('🚗 [RECALLS] ok');
          } else {
            vehicleRecallsContext = `Greška (vehicle_recalls_by_vehicle): ${out?.error || 'nepoznato'}`;
            toolReporter.error(id, 'Opozivi: greška', { ok: false, error: out?.error });
            console.warn('⚠️ [RECALLS] Not ok:', out?.error);
          }
        } catch (e) {
          vehicleRecallsContext = `Greška (vehicle_recalls_by_vehicle): ${e.message}`;
          toolReporter.error(id, 'Opozivi: greška', { ok: false, error: e.message });
          console.warn('⚠️ [RECALLS] Failed:', e.message);
        }
      }

      const shouldDoComplaints = smartEnabled && vehicleComplaintsCall && capabilities.cars;
      if (shouldDoComplaints) {
        const a = vehicleComplaintsCall?.args || {};
        const make = a.make || a.brand;
        const model = a.model;
        const year = a.year || a.modelYear;
        const id = toolReporter.start('vehicle_complaints_by_vehicle', 'Vozilo', 'Provjeravam prijave kvarova…', {
          make: String(make || '').slice(0, 30),
          model: String(model || '').slice(0, 40),
        });
        try {
          const out = await getComplaintsByVehicle({ make, model, year });
          if (out?.ok && out?.context) {
            vehicleComplaintsContext = out.context;
            toolReporter.done(id, `Prijave: ${out.count || 0}`, { ok: true, count: out.count || 0 });
            console.log('🚗 [COMPLAINTS] ok');
          } else {
            vehicleComplaintsContext = `Greška (vehicle_complaints_by_vehicle): ${out?.error || 'nepoznato'}`;
            toolReporter.error(id, 'Prijave: greška', { ok: false, error: out?.error });
            console.warn('⚠️ [COMPLAINTS] Not ok:', out?.error);
          }
        } catch (e) {
          vehicleComplaintsContext = `Greška (vehicle_complaints_by_vehicle): ${e.message}`;
          toolReporter.error(id, 'Prijave: greška', { ok: false, error: e.message });
          console.warn('⚠️ [COMPLAINTS] Failed:', e.message);
        }
      }

      const shouldDoTrims = smartEnabled && vehicleTrimsCall && capabilities.cars;
      if (shouldDoTrims) {
        const a = vehicleTrimsCall?.args || {};
        const make = a.make || a.brand;
        const model = a.model;
        const year = a.year || a.modelYear;
        const keyword = a.keyword;
        const id = toolReporter.start('vehicle_trims_carquery', 'Vozilo', 'Tražim trimove/specifikacije…', {
          make: String(make || '').slice(0, 30),
          model: String(model || '').slice(0, 40),
        });
        try {
          const out = await getTrimsCarQuery({ make, model, year, keyword, full_results: a.full_results });
          if (out?.ok && out?.context) {
            vehicleTrimsContext = out.context;
            toolReporter.done(id, `Trims: ${out.count || 0}`, { ok: true, count: out.count || 0 });
            console.log('🚗 [TRIMS] ok');
          } else {
            vehicleTrimsContext = `Greška (vehicle_trims_carquery): ${out?.error || 'nepoznato'}`;
            toolReporter.error(id, 'Trims: greška', { ok: false, error: out?.error });
            console.warn('⚠️ [TRIMS] Not ok:', out?.error);
          }
        } catch (e) {
          vehicleTrimsContext = `Greška (vehicle_trims_carquery): ${e.message}`;
          toolReporter.error(id, 'Trims: greška', { ok: false, error: e.message });
          console.warn('⚠️ [TRIMS] Failed:', e.message);
        }
      }

      const shouldDoSafety = smartEnabled && vehicleSafetyCall && capabilities.cars;
      if (shouldDoSafety) {
        const a = vehicleSafetyCall?.args || {};
        const make = a.make || a.brand;
        const model = a.model;
        const year = a.year || a.modelYear;
        const includeDetail = a.includeDetail;
        const id = toolReporter.start('vehicle_safety_ratings', 'Vozilo', 'Dohvaćam sigurnosne ocjene…', {
          make: String(make || '').slice(0, 30),
          model: String(model || '').slice(0, 40),
        });
        try {
          const out = await getSafetyRatings({ make, model, year, includeDetail });
          if (out?.ok && out?.context) {
            vehicleSafetyContext = out.context;
            toolReporter.done(id, 'Sigurnosne ocjene dohvaćene', { ok: true });
            console.log('🚗 [SAFETY] ok');
          } else {
            vehicleSafetyContext = `Greška (vehicle_safety_ratings): ${out?.error || 'nepoznato'}`;
            toolReporter.error(id, 'Sigurnost: greška', { ok: false, error: out?.error });
            console.warn('⚠️ [SAFETY] Not ok:', out?.error);
          }
        } catch (e) {
          vehicleSafetyContext = `Greška (vehicle_safety_ratings): ${e.message}`;
          toolReporter.error(id, 'Sigurnost: greška', { ok: false, error: e.message });
          console.warn('⚠️ [SAFETY] Failed:', e.message);
        }
      }

      // 3h) Drug APIs (openFDA label + RxNav interactions)
      const shouldDoDrugLabel = smartEnabled && drugLabelCall && capabilities.drugs;
      if (shouldDoDrugLabel) {
        try {
          const a = drugLabelCall?.args || {};
          const q = String(a.query || a.drug || a.name || messageWithoutUrls || message).trim().slice(0, 160);
          const d = await openFdaDrugLabel({ query: q });
          if (d?.ok && d?.context) {
            openfdaContext = d.context;
            console.log('💊 [OPENFDA] ok');
          } else {
            openfdaContext = `Greška (openfda): ${d?.error || 'nepoznato'}`;
            console.warn('⚠️ [OPENFDA] Not ok:', d?.error);
          }
        } catch (e) {
          console.warn('⚠️ [OPENFDA] Failed:', e.message);
          openfdaContext = `Greška (openfda): ${e.message}`;
        }
      }

      const shouldDoDrugInteractions = smartEnabled && drugInteractionsCall && capabilities.drugs;
      if (shouldDoDrugInteractions) {
        try {
          const a = drugInteractionsCall?.args || {};
          const drug = String(a.query || a.drug || a.name || messageWithoutUrls || message).trim().slice(0, 160);
          const other = String(a.with || a.other || a.otherDrug || a.drug2 || '').trim().slice(0, 80);

          const r = await rxNavInteractions({ query: drug });

          // If user asked about a specific pair, filter results to those containing the other drug.
          if (r?.ok && other && Array.isArray(r?.interactions)) {
            const o = other.toLowerCase();
            const filtered = r.interactions.filter((it) =>
              String(it?.a || '').toLowerCase().includes(o) || String(it?.b || '').toLowerCase().includes(o),
            );
            if (filtered.length) {
              r.interactions = filtered.slice(0, 10);
              r.context = r.context + `\n\nFilter: interactions containing "${other}"`;
            }
          }

          if (r?.ok && r?.context) {
            rxnavContext = r.context;
            console.log('💊 [RXNAV] ok');
          } else {
            rxnavContext = `Greška (rxnav): ${r?.error || 'nepoznato'}`;
            console.warn('⚠️ [RXNAV] Not ok:', r?.error);
          }
        } catch (e) {
          console.warn('⚠️ [RXNAV] Failed:', e.message);
          rxnavContext = `Greška (rxnav): ${e.message}`;
        }
      }

      // 3g) Wolfram|Alpha (optional)
      const shouldDoWolfram = smartEnabled && wolframCall && capabilities.wolfram;
      if (shouldDoWolfram) {
        try {
          const a = wolframCall?.args || {};
          const input = String(a.input || a.query || a.q || messageWithoutUrls || message).trim().slice(0, 260);
          const w = await wolframQuery({ input, units: a.units });
          if (w?.ok && w?.context) {
            wolframContext = w.context;
            console.log('🧠 [WOLFRAM] ok');
          } else {
            wolframContext = `Greška (wolfram): ${w?.error || 'nepoznato'}`;
            console.warn('⚠️ [WOLFRAM] Not ok:', w?.error);
          }
        } catch (e) {
          console.warn('⚠️ [WOLFRAM] Failed:', e.message);
          wolframContext = `Greška (wolfram): ${e.message}`;
        }
      }

// ─────────────────────────────────────────
      // 4) System prompt + time block + language instruction
      // ─────────────────────────────────────────
      const systemPrompt = await getDefaultSystemPrompt();

      // ⏰ TIME BLOCK (server + optional client hints)
      // Goal: make "today / this year" questions deterministic.
      let timeBlock = '';
      let timeCtx = null;
      try {
        const tctx = buildTimeContext({ clientTimeInfo: timeInfo, languageHint });
        timeCtx = tctx;
        const clientLocal = timeInfo && typeof timeInfo.localHuman === 'string' ? timeInfo.localHuman : null;
        const clientIso = timeInfo && typeof timeInfo.iso === 'string' ? timeInfo.iso : null;
        const clientOffset = timeInfo && typeof timeInfo.timezoneOffset === 'string' ? timeInfo.timezoneOffset : null;

        timeBlock =
          '\nCURRENT TIME CONTEXT (CRITICAL):\n' +
          `- TODAY (local): ${tctx.localDate || tctx.localHuman}\n` +
          `- CURRENT LOCAL TIME: ${tctx.localHuman}${tctx.offsetName ? ` (${tctx.offsetName})` : ''}\n` +
          `- CURRENT YEAR (local): ${tctx.localYear || ''}\n` +
          `- Timezone used: ${tctx.timeZone}\n` +
          `- Server ISO (UTC): ${tctx.serverIso}\n` +
          (clientLocal ? `- User device local time (as sent): ${clientLocal}\n` : '') +
          (clientIso ? `- User device ISO time (as sent): ${clientIso}\n` : '') +
          (clientOffset ? `- User timezone offset (as sent): ${clientOffset}\n` : '') +
          '\nTIME INTERPRETATION RULES:\n' +
          '- Interpret phrases like "danas", "sutra", "ovaj tjedan", "ovaj mjesec", "ove godine" relative to TODAY (local) above.\n' +
          '- If web sources mention only past years and do not explicitly confirm the current year, say you cannot confirm for the current year.\n';
      } catch (err) {
        console.error('Time block error:', err);
        timeBlock = '';
        timeCtx = null;
      }

      const lang = (userLanguage || '').trim().toLowerCase();
      const languageInstruction = lang
        ? `
LANGUAGE PREFERENCE:
- The user's preferred language is: ${getLanguageInstruction(lang)}
- Answer in this language.
- If the latest user message is clearly in another language, follow the language of the latest user message instead.`
        : `
LANGUAGE PREFERENCE:
- Answer in the same language as the user's latest message.
- If the language is unclear, default to English.`;

      // Prefer web evidence for time‑sensitive questions (news, results, scores,
      // medals, dates, etc.). In those cases, wiki summaries are allowed only as
      // background.
      const preferWebOverWiki = Boolean(webContext && wantFreshRouting);

      const toolUsageBlock = `TOOLS USED THIS TURN:
- web_search: ${webContext ? 'YES' : 'NO'}
- rag_retrieve: ${ragContext ? 'YES' : 'NO'}
- weather_forecast: ${weatherContext ? 'YES' : 'NO'}
- fx_convert: ${fxContext ? 'YES' : 'NO'}
- wiki_summary: ${wikiContext ? 'YES' : 'NO'}
- wikidata_lookup: ${wikidataContext ? 'YES' : 'NO'}
- osm_geocode: ${osmGeocodeContext ? 'YES' : 'NO'}
- osm_nearby: ${osmNearbyContext ? 'YES' : 'NO'}
- vehicle_vin_decode: ${vehicleVinContext ? 'YES' : 'NO'}
- vehicle_models_for_make: ${vehicleModelsContext ? 'YES' : 'NO'}
- vehicle_recalls_by_vehicle: ${vehicleRecallsContext ? 'YES' : 'NO'}
- vehicle_complaints_by_vehicle: ${vehicleComplaintsContext ? 'YES' : 'NO'}
- vehicle_trims_carquery: ${vehicleTrimsContext ? 'YES' : 'NO'}
- vehicle_safety_ratings: ${vehicleSafetyContext ? 'YES' : 'NO'}
- drug_label_openfda: ${openfdaContext ? 'YES' : 'NO'}
- drug_interactions_rxnav: ${rxnavContext ? 'YES' : 'NO'}
- wolfram_query: ${wolframContext ? 'YES' : 'NO'}
- holidays_public: ${holidaysContext ? 'YES' : 'NO'}
- movie_report: ${moviesContext ? 'YES' : 'NO'}
- image_generate: ${generatedImages ? 'YES' : 'NO'}

RESPONSE FORMAT RULES:
- NEVER use XML tags in your responses (like <movie_report>, <movie_title>, <wiki_summary>, etc.)
- NEVER return structured data formats (XML/JSON) unless the user explicitly asks for it
- ALWAYS respond in natural, conversational language using complete sentences
- Use markdown formatting (bold, lists, headers) when presenting information to users
- If you see data blocks in the context (MOVIE DATA, WIKI DATA, etc.), use them as SOURCE MATERIAL and respond naturally

STRICT RULES:
- If rag_retrieve is YES, you MUST use the provided RAG DATA as the source of truth for the user's uploaded file(s) for THIS turn.
  - Do NOT say you "can't see" or "don't have" the file(s) if RAG DATA is present.
  - If RAG DATA conflicts with older chat history, prefer RAG DATA for this turn.
- If web_search is NO, you MUST NOT claim you searched the web or say "prema rezultatima pretraživanja".
- If web_search is YES, any concrete fact taken from sources MUST include a citation like [1], [2].
- If weather_forecast is YES, you MUST use the provided WEATHER DATA as the source of truth for weather.
- If fx_convert is YES, you MUST use the provided FX DATA as the source of truth for currency conversion/rates.
- If wiki_summary is YES, ${preferWebOverWiki
  ? 'use the provided WIKI DATA ONLY as background and DO NOT let it override WEB SEARCH RESULTS for time-sensitive facts.'
  : 'you MUST use the provided WIKI DATA as the source of truth for that topic summary.'}
- If wikidata_lookup is YES, you MUST use the provided WIKIDATA DATA as the source of truth for structured entity facts.
- If osm_geocode is YES, you MUST use the provided OSM GEOCODE DATA as the source of truth for geocoding results.
- If osm_nearby is YES, you MUST use the provided OSM NEARBY DATA as the source of truth for nearby POI results.
- If vehicle_vin_decode is YES, you MUST use the provided VEHICLE VIN DATA as the source of truth for decoded VIN fields.
- If vehicle_models_for_make is YES, you MUST use the provided VEHICLE MODELS DATA as the source of truth for model lists.
- If vehicle_recalls_by_vehicle is YES, you MUST use the provided VEHICLE RECALLS DATA as the source of truth for recalls.
- If vehicle_complaints_by_vehicle is YES, you MUST use the provided VEHICLE COMPLAINTS DATA as the source of truth for complaints.
- If vehicle_trims_carquery is YES, you MUST use the provided VEHICLE TRIMS DATA as the source of truth for trims/specs.
- If vehicle_safety_ratings is YES, you MUST use the provided VEHICLE SAFETY DATA as the source of truth for safety ratings.
- If drug_label_openfda is YES, you MUST use the provided DRUG LABEL DATA as the source of truth for label excerpts.
- If drug_interactions_rxnav is YES, you MUST use the provided DRUG INTERACTIONS DATA as the source of truth for interaction pairs.
- If wolfram_query is YES, you MUST use the provided WOLFRAM DATA as the source of truth for computations.
- If holidays_public is YES, you MUST use the provided HOLIDAY DATA as the source of truth for holiday dates.
- If movie_report is YES, you MUST use the provided MOVIE DATA (TMDB/OMDb) as the source of truth for movie metadata, cast/crew, and image URLs.
`;

      // Build a unified sources index (wiki + web + direct URL reads) so the model can cite and (more importantly)
      // so the verifier pass can delete claims that are not supported.
      const sourcesIndex = buildSourcesIndex({ wikiSources, webResults, max: 10 });
      const sourcesBlock = makeSourcesBlock(sourcesIndex);

      const officialsStrictBlock = officialsHardWeb
        ? `
OFFICIALS STRICT MODE (NON-NEGOTIABLE):
- This question asks about a CURRENT office holder / official role.
- You MUST answer ONLY using the VERIFIED FACTS block below.
- If a detail is not present there, say you cannot confirm from sources.
- Do NOT use prior knowledge or wiki for office-holder identity/party/role.
- Every concrete claim MUST include a citation [n] matching SOURCES.

CONFLICT RULE (critical — Wikipedia is often stale for current officials):
- If VERIFIED FACTS shows a SOURCE CONFLICT, use ONLY the non-disputed (✓) facts.
- Do NOT blend: never take a person's name from source A and their party from source B.
- If you mention a discrepancy, say: "Stariji izvori navode X, ali prema službenim stranicama Y je točno."
- Wikipedia party/role data for office holders is unreliable — always prefer official/government domains.

\${verifiedFactsBlock || 'VERIFIED FACTS: (none extracted — state uncertainty clearly, do not invent)'}
`
        : '';

      // 🌍 FRESHNESS grounding block (parallel to officialsStrictBlock)
      const freshnessStrictBlock = (freshnessHardWeb && !officialsHardWeb)
        ? `
FRESHNESS WEB-GROUNDED MODE:
This question asks about a time-sensitive fact (sports, prices, standings, schedules, company roles, or news).
- Use ONLY information from WEB SEARCH RESULTS and VERIFIED FACTS below.
- If a specific detail is NOT supported in sources → say "prema dostupnim izvorima ne mogu potvrditi".
- Do NOT fill gaps from training data — training data may be 6-24 months out of date.
- For every concrete fact, cite the source with [n].
- If sources conflict: say "Stariji izvori navode X, ali prema novijim izvorima Y je točno."

${verifiedFactsBlock || ''}
`.trim()
        : '';

      // ── Personalization block ──────────────────────────────────────────────
      let personalizationBlock = '';
      if (userPersonalization) {
        const p = userPersonalization;
        const lines = [];
        if (p.nickname)    lines.push(`- Address the user as "${p.nickname}".`);
        if (p.occupation)  lines.push(`- User's occupation: ${p.occupation}.`);
        const STYLE_MAP = {
          // Flutter style values
          default:      '',
          concise:      'Be maximally concise. Short answers unless detail is explicitly requested.',
          detailed:     'Provide thorough, in-depth explanations. Cover edge cases and context.',
          creative:     'Be imaginative and expressive. Use vivid language and creative framing.',
          professional: 'Use a formal, business-like tone. Avoid slang and contractions.',
          casual:       'Be friendly and relaxed. Conversational tone, like texting a friend.',
          // Legacy / extra values
          funny:        'Use a humorous, witty tone. Jokes and wordplay are welcome.',
          formal:       'Use a professional, formal tone. Avoid slang.',
          friendly:     'Use a warm, friendly, conversational tone.',
        };
        const styleLine = STYLE_MAP[p.styleTone] || (p.styleTone ? `Tone: ${p.styleTone}.` : '');
        if (styleLine) lines.push(`- ${styleLine}`);
        if (p.characteristics?.length) lines.push(`- Style traits: ${p.characteristics.join(', ')}.`);
        if (p.customInstructions) lines.push(`\nUSER CUSTOM INSTRUCTIONS (follow strictly):\n${p.customInstructions}`);
        if (p.about) lines.push(`\nUSER BACKGROUND:\n${p.about}`);
        if (lines.length) personalizationBlock = `\nPERSONALIZATION:\n${lines.join('\n')}`;
      }

      const systemBlock = `${systemPrompt}

${memoryBlock ? `\n${memoryBlock}\n` : ''}

${personalizationBlock}

${timeBlock}

${languageInstruction}

${lengthInstructionAddon}

${toolUsageBlock}

${officialsStrictBlock}

${freshnessStrictBlock}

GENERAL BEHAVIOUR (VERY IMPORTANT):
- ALWAYS treat the USER'S LATEST message as the main question.
- Assume CONTINUITY: the conversation is ongoing; use the recent chat messages to keep references (names, pronouns, plans) consistent.
- Stay ON TOPIC. Do not introduce unrelated subjects.
- First, answer DIRECTLY to what the user asked or said in their latest message.
- Use LONG-TERM MEMORY and conversation history when it helps the current topic.
- Only treat it as a topic change if the user clearly switches topics.
- If there are multiple topics in the latest message, prioritise health/safety first, then everything else.
- If the latest message is short/ambiguous, DO NOT ask follow-up questions; make the best reasonable assumption OR explicitly state what cannot be confirmed from the available context.
`.trim();

      const mustUseBlocks = [];
      const optionalBlocks = [];

      // Extra guard for very short follow-ups (prevents topic drift).
      if (isVeryShortUserTurn(message) && Array.isArray(relevantHistory) && relevantHistory.length) {
        const tail = relevantHistory
          .slice(-6)
          .map(m => {
            const role = m.role === 'assistant' ? 'ASSISTANT' : 'USER';
            const txt = (m.content || '').toString().replace(/\s+/g, ' ').trim();
            return `${role}: ${txt}`;
          })
          .join('\n');

        mustUseBlocks.push(
          'FOLLOW-UP CONTINUITY (CRITICAL):\n' +
            '- The user\'s latest message is very short and should be treated as a reply to the current topic.\n' +
            '- DO NOT interpret the user\'s short message as a new search keyword or as a new entity name.\n' +
            '- Keep the same subject/entity that was being discussed in the recent conversation.\n' +
            '- If the short message is ambiguous and you truly cannot determine the referenced subject from the tail below, ask ONE short clarifying question (only one).\n\n' +
            'RECENT CONVERSATION TAIL:\n' +
            tail
        );
      }

      // User uploaded files/images (OCR/extract/vision) must be available to the LLM.
      if (Array.isArray(attachmentBlocks) && attachmentBlocks.length) {
        mustUseBlocks.push(...attachmentBlocks);
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔧 UNIVERSAL FIX: Strip XML tags and markdown from ALL tool outputs
      // ═══════════════════════════════════════════════════════════════
      // Problem: LLM sees XML tags like <web_search_results>, <movie_title>, etc.
      // and returns them in responses instead of natural language.
      //
      // Solution: Clean all tool contexts before injecting into LLM system prompt.
      // ═══════════════════════════════════════════════════════════════
      const stripToolFormat = (text) => {
        if (!text) return '';
        let clean = String(text).trim();
        
        // 1. Remove ALL XML tags (opening, closing, self-closing)
        clean = clean.replace(/<\/?[^>]+(>|$)/g, '');
        
        // 2. Remove markdown images
        clean = clean.replace(/!\[.*?\]\(.*?\)/g, '');
        
        // 3. Remove markdown headers (###, ##, #)
        clean = clean.replace(/^#+\s+/gm, '');
        
        // 4. Remove bold/italic markdown
        clean = clean.replace(/\*\*(.*?)\*\*/g, '$1');  // **bold**
        clean = clean.replace(/\*(.*?)\*/g, '$1');      // *italic*
        clean = clean.replace(/__(.*?)__/g, '$1');      // __bold__
        clean = clean.replace(/_(.*?)_/g, '$1');        // _italic_
        
        // 5. Remove bullet points
        clean = clean.replace(/^[\-\*]\s+/gm, '');
        
        // 6. Remove blockquotes
        clean = clean.replace(/^>\s+/gm, '');
        
        // 7. Remove excessive newlines
        clean = clean.replace(/\n{3,}/g, '\n\n');
        
        // 8. Decode common HTML entities that might remain
        clean = clean.replace(/&lt;/g, '<');
        clean = clean.replace(/&gt;/g, '>');
        clean = clean.replace(/&amp;/g, '&');
        clean = clean.replace(/&quot;/g, '"');
        clean = clean.replace(/&apos;/g, "'");
        
        return clean.trim();
      };

      // Apply to ALL tool contexts before adding to mustUseBlocks
      if (contextPrompt && String(contextPrompt).trim()) {
        optionalBlocks.push(String(contextPrompt).trim());
      }
      if (ragContext && String(ragContext).trim()) {
	        // RAG context is the user's CURRENT uploaded file(s) and must be treated as tool output.
	        const cleanRagContext = stripToolFormat(ragContext);
	        mustUseBlocks.push(`RAG DATA (trusted):\n${cleanRagContext}`);
      }
      if (weatherContext && String(weatherContext).trim()) {
        const cleanWeatherContext = stripToolFormat(weatherContext);
        mustUseBlocks.push(`WEATHER DATA (trusted):\n${cleanWeatherContext}`);
      }
      if (fxContext && String(fxContext).trim()) {
        const cleanFxContext = stripToolFormat(fxContext);
        mustUseBlocks.push(`FX DATA (trusted):\n${cleanFxContext}`);
      }
      if (wikiContext && String(wikiContext).trim()) {
        const cleanWikiContext = stripToolFormat(wikiContext);
        mustUseBlocks.push(`WIKI DATA (trusted):\n${cleanWikiContext}`);
      }
      if (wikidataContext && String(wikidataContext).trim()) {
        const cleanWikidataContext = stripToolFormat(wikidataContext);
        mustUseBlocks.push(`WIKIDATA DATA (trusted):\n${cleanWikidataContext}`);
      }
      if (osmGeocodeContext && String(osmGeocodeContext).trim()) {
        const cleanOsmGeocodeContext = stripToolFormat(osmGeocodeContext);
        mustUseBlocks.push(`OSM GEOCODE DATA (trusted):\n${cleanOsmGeocodeContext}`);
      }
      if (osmNearbyContext && String(osmNearbyContext).trim()) {
        const cleanOsmNearbyContext = stripToolFormat(osmNearbyContext);
        mustUseBlocks.push(`OSM NEARBY DATA (trusted):\n${cleanOsmNearbyContext}`);
      }

      if (sourcesBlock) {
        mustUseBlocks.push(sourcesBlock);
      }

      // ─────────────────────────────────────────
      // Grounded entity/place rule: when the user asks about a real-world entity in a stable way
      // (e.g., "Tomislavgrad" or "Fiorentina (Italija)"), we must prevent creative additions.
      // The model may ONLY state factual claims that are explicitly supported by the trusted blocks
      // (Wiki/Wikidata/OSM/RAG/URL content). Everything else must be marked as not confirmable.
      // ─────────────────────────────────────────
      if (groundedEntityMode) {
        mustUseBlocks.push(
          'ENTITY/PLACE GROUNDING RULES (STRICT):\n' +
            '- For this request, treat WIKI/WIKIDATA/OSM blocks as the primary facts about the entity.\n' +
            '- DO NOT add new names, dates, numbers, historical claims, distances, populations, "official" roles, or admin details unless they appear in the trusted blocks.\n' +
            '- If the user asks for a detail that is not explicitly present in the trusted blocks, say you cannot confirm it from the available context and suggest what to check next.\n' +
            '- If the entity is ambiguous (multiple meanings), do NOT ask a question; briefly list 2–3 plausible interpretations and state what you cannot confirm from the trusted blocks.\n' +
            '- Keep the answer compact unless the user explicitly asked for an exhaustive write-up.\n'
        );
      }
      if (vehicleVinContext && String(vehicleVinContext).trim()) {
        const cleanVehicleVinContext = stripToolFormat(vehicleVinContext);
        mustUseBlocks.push(`VEHICLE VIN DATA (trusted):\n${cleanVehicleVinContext}`);
      }
      if (vehicleModelsContext && String(vehicleModelsContext).trim()) {
        const cleanVehicleModelsContext = stripToolFormat(vehicleModelsContext);
        mustUseBlocks.push(`VEHICLE MODELS DATA (trusted):\n${cleanVehicleModelsContext}`);
      }
      if (vehicleRecallsContext && String(vehicleRecallsContext).trim()) {
        const cleanVehicleRecallsContext = stripToolFormat(vehicleRecallsContext);
        mustUseBlocks.push(`VEHICLE RECALLS DATA (trusted):\n${cleanVehicleRecallsContext}`);
      }
      if (vehicleComplaintsContext && String(vehicleComplaintsContext).trim()) {
        const cleanVehicleComplaintsContext = stripToolFormat(vehicleComplaintsContext);
        mustUseBlocks.push(`VEHICLE COMPLAINTS DATA (trusted):\n${cleanVehicleComplaintsContext}`);
      }
      if (vehicleTrimsContext && String(vehicleTrimsContext).trim()) {
        const cleanVehicleTrimsContext = stripToolFormat(vehicleTrimsContext);
        mustUseBlocks.push(`VEHICLE TRIMS DATA (trusted):\n${cleanVehicleTrimsContext}`);
      }
      if (vehicleSafetyContext && String(vehicleSafetyContext).trim()) {
        const cleanVehicleSafetyContext = stripToolFormat(vehicleSafetyContext);
        mustUseBlocks.push(`VEHICLE SAFETY DATA (trusted):\n${cleanVehicleSafetyContext}`);
      }
      if (openfdaContext && String(openfdaContext).trim()) {
        const cleanOpenfdaContext = stripToolFormat(openfdaContext);
        mustUseBlocks.push(`DRUG LABEL DATA (trusted):\n${cleanOpenfdaContext}`);
      }
      if (rxnavContext && String(rxnavContext).trim()) {
        const cleanRxnavContext = stripToolFormat(rxnavContext);
        mustUseBlocks.push(`DRUG INTERACTIONS DATA (trusted):\n${cleanRxnavContext}`);
      }
      if (wolframContext && String(wolframContext).trim()) {
        const cleanWolframContext = stripToolFormat(wolframContext);
        mustUseBlocks.push(`WOLFRAM DATA (trusted):\n${cleanWolframContext}`);
      }
      if (holidaysContext && String(holidaysContext).trim()) {
        const cleanHolidaysContext = stripToolFormat(holidaysContext);
        mustUseBlocks.push(`HOLIDAY DATA (trusted):\n${cleanHolidaysContext}`);
      }
      if (moviesContext && String(moviesContext).trim()) {
        // 🔧 FIX: Use universal strip function for consistency
        const cleanMovieContext = stripToolFormat(moviesContext);
        mustUseBlocks.push(`MOVIE DATA (trusted, respond naturally):\n${cleanMovieContext}`);
      }
      if (webContext && String(webContext).trim()) {
        // 🔧 FIX: Strip XML tags from web search results
        // Web search returns <web_search_results><source>... which confuses LLM
        const cleanWebContext = stripToolFormat(webContext);
        mustUseBlocks.push(`WEB SEARCH RESULTS (trusted, respond naturally):\n${cleanWebContext}`);

        // If the user provided a URL and asks a schedule/time-style question, pre-extract the
        // most relevant lines from the page(s). This helps the LLM not miss the exact line.
        try {
          const isScheduleQ = /(misa|mise|misni|raspored|župne obavijesti|zupne obavijesti|božić|bozic|termin|sat|sati)/i.test(
            String(message || ''),
          );
          if (isScheduleQ && providedUrls.length) {
            const list = Array.isArray(webResults?.results) ? webResults.results : [];
            const extracted = [];
            for (let i = 0; i < Math.min(list.length, 3); i++) {
              const r = list[i];
              if (!r || !r.rawContent) continue;
              // Try to find lines that mention Kovači (common in your examples). Also try any
              // place word present in the user prompt.
              const placeHints = [];
              if (/kovač/i.test(message)) placeHints.push('Kovači');
              // Add one more hint: the most unique capitalized token from the message.
              const cap = String(message)
                .replace(/https?:\/\/\S+/g, ' ')
                .match(/\b([A-ZČĆŽŠĐ][\p{L}\p{M}]{3,})\b/gu);
              if (cap && cap.length) placeHints.push(cap[0]);

              const uniq = Array.from(new Set(placeHints.filter(Boolean)));
              for (const place of uniq.slice(0, 2)) {
                const lines = _extractLinesWithPlaceAndTime(String(r.rawContent || ''), {
                  place,
                  around: 1,
                  maxLines: 6,
                });
                if (lines.length) {
                  extracted.push({ idx: i + 1, place, lines });
                  break;
                }
              }
            }

            if (extracted.length) {
              const block =
                'EXTRACTED FROM PROVIDED URL(S) (HIGH PRECISION):\n' +
                extracted
                  .map((e) =>
                    `- From source [${e.idx}] (match: ${e.place}):\n` +
                    e.lines.map((l) => `  - ${l}`).join('\n'),
                  )
                  .join('\n');
              mustUseBlocks.push(block);
              mustUseBlocks.push(
                'RULE (VERY IMPORTANT): If the extracted lines contain the exact time, answer using that time and cite the same source number [n]. If not, do NOT invent a time.',
              );
            }
          }
        } catch (_e) {
          // ignore extractor failures
        }

        // Temporal sanity guard: prevent "2023 schedule" from being presented as "this year".
        try {
          const wantFresh = _messageWantsFreshInfo(message);
          const currentYear = Number(timeCtx?.localYear || new Date().getUTCFullYear());
          const years = new Set();
          const list = Array.isArray(webResults?.results) ? webResults.results : [];
          for (const r of list) {
            _extractYears(r.title).forEach((y) => years.add(y));
            _extractYears(r.snippet).forEach((y) => years.add(y));
            _extractYears(r.url).forEach((y) => years.add(y));
            if (r.rawContent) _extractYears(r.rawContent).forEach((y) => years.add(y));
          }
          const yearsArr = Array.from(years).sort((a, b) => a - b);
          const hasCurrent = years.has(currentYear);

          // Add a guard only when the user asks for fresh info OR when sources appear to be older.
          if (wantFresh || (yearsArr.length && !hasCurrent)) {
            mustUseBlocks.push(
              'TEMPORAL SANITY CHECK (STRICT):\n' +
                `- Current local year: ${currentYear}\n` +
                `- Years detected in web sources: ${yearsArr.length ? yearsArr.join(', ') : 'none'}\n` +
                '- If the user asks for "this year / ovogodišnje / danas" and the sources do NOT explicitly mention the current year, DO NOT assume.\n' +
                '- In that case, say you cannot confirm for the current year from the provided sources and suggest the official channel to verify.\n'
            );
          }
        } catch (e) {
          // ignore temporal analysis failures
        }

        // Extra guardrails to reduce hallucinations when answering from web results.
        mustUseBlocks.push(
          'CITATION RULES (STRICT):\n' +
            '- Any non-trivial factual claim that comes from the web results MUST be cited with [n].\n' +
            '- Only use citations that refer to the numbered list in the WEB SEARCH RESULTS block.\n' +
            '- If the web results do NOT explicitly contain a needed detail (e.g., exact times, dates, names, addresses), DO NOT guess.\n' +
            '- In that case, say you cannot confirm from the sources and suggest what to check next.\n' +
            '- Do not fabricate “official confirmations”, “corrections”, or “schedules” unless they are clearly stated in the sources.\n'
        );
      }

      if (generatedImages && Array.isArray(generatedImages.images) && generatedImages.images.length) {
        const urls = generatedImages.images
          .map((im) => {
            if (typeof im === 'string') return im;
            if (im && typeof im === 'object') return im.downloadUrl || im.url || im.sourceUrl || '';
            return '';
          })
          .filter(Boolean);
        // Intentionally NOT injecting image URLs into the LLM system prompt (prevents duplicate previews).
      }

      // ─────────────────────────────────────────
      // Background Copilot (GPT-4o-mini) — internal
      // ─────────────────────────────────────────
      let copilot = null;
      let effectiveModel = requestedModel;

      const _toolFlagsForCopilot = {
        web: Boolean(webContext),
        rag: Boolean(ragContext),
        attachments: Boolean(hasAttachments),
        wiki: Boolean(wikiContext || wikidataContext),
        weather: Boolean(weatherContext),
        fx: Boolean(fxContext),
        movies: Boolean(moviesContext),
        imageGen: Boolean(generatedImages && Array.isArray(generatedImages.images) && generatedImages.images.length),
      };

      // Quick model heuristic: default to chat; only opt into reasoner for heavy reasoning/debug.
      const heuristicNeedsReasoner = _shouldUseReasonerHeuristic(
        message,
        { hasAttachments: Boolean(hasAttachments) },
        accuracyRisk,
      );

      if (!effectiveModel) {
        effectiveModel = heuristicNeedsReasoner ? 'deepseek-reasoner' : 'deepseek-chat';
      }

      // V3: Data minimization - extract structured facts only (no PII, no tokens, no URLs)
      const structuredFacts = extractStructuredFacts([...mustUseBlocks, ...optionalBlocks]);

      const elapsedBeforeCopilot = Date.now() - perfTiming.t_start;
      const remainingBudgetForCopilot = STREAM_LATENCY_BUDGET_MS - elapsedBeforeCopilot;
      const shouldRunCopilot = Boolean(
        BACKGROUND_ASSISTANT_ENABLED &&
          OPENAI_API_KEY &&
          (stream ? remainingBudgetForCopilot > 120 : true)
      );

      const copilotStartTime = Date.now();
      if (shouldRunCopilot) {
        copilot = await getCopilotBrief({
          userText: message,
          language: userLanguage,
          threadSummary,
          memoryBlock,
          toolFlags: _toolFlagsForCopilot,
          toolResults: structuredFacts,  // V3: structured facts only
          recentHistory: relevantHistory,
        });
      }
      const copilotLatency = Date.now() - copilotStartTime;

      
      // V3: Risk + complexity signals (copilot provides risk signal; backend decides policy)
      const copilotRiskLevel =
        copilot && copilot.ok && copilot.risk_level ? String(copilot.risk_level).toLowerCase() : 'low';
      const heuristicRiskLevel = heuristicNeedsReasoner ? 'high' : 'low'; // complexity signal
      const accuracyRiskLevel = String(accuracyRisk?.level || 'low').toLowerCase();

      const _riskScore = (lvl) => (lvl === 'high' ? 2 : lvl === 'medium' ? 1 : 0);
      const finalRiskScore = Math.max(_riskScore(accuracyRiskLevel), _riskScore(copilotRiskLevel), forceGrounding ? 2 : 0);
      const finalRiskLevel = finalRiskScore >= 2 ? 'high' : finalRiskScore === 1 ? 'medium' : 'low';

      // Model selection: prefer deepseek-chat for speed; use reasoner for heavy reasoning OR high factual risk.
      if (!requestedModel) {
        if (heuristicNeedsReasoner || finalRiskLevel === 'high') {
          effectiveModel = 'deepseek-reasoner';
        } else {
          effectiveModel = 'deepseek-chat';
        }
      }

      // Streaming policy: keep SSE protocol if requested, but disable *real* token streaming on high risk.
      const streamRequested = Boolean(stream);
      const allowRealStream = streamRequested && !(finalRiskLevel === 'high' && ACCURACY_GUARD_NONSTREAM_ON_HIGH_RISK);

      // Verification policy: verify on high risk (or explicit grounding). In stream mode this becomes pseudo-stream + verify.
      const shouldVerify = Boolean(
        ACCURACY_GUARD_ENABLED && ACCURACY_GUARD_VERIFY_PASS && (finalRiskLevel === 'high' || forceGrounding),
      );
      logCopilotDecision({
        userId,
        conversationId,
        copilotRisk: copilotRiskLevel,
        copilotWhy: copilot?.why || 'N/A',
        heuristicRisk: heuristicRiskLevel,
        finalModel: effectiveModel,
        streamRequested,
        allowRealStream,
        finalVerify: shouldVerify,
        latencyMs: copilotLatency,
      });

      // Prioritize grounding blocks so the most important context survives
      // truncation AND is visible to the verifier.
      const _toolBlockPriority = (block) => {
        if (!block) return 99;
        const b = String(block).toUpperCase();
        if (b.includes('RAG CONTEXT')) return 0;
        if (b.includes('WEB SEARCH RESULTS')) return 1;
        if (b.includes('SOURCES (FOR CITATIONS)')) return 2;
        if (b.includes('WIKI DATA')) return 3;
        if (b.includes('WIKIDATA DATA')) return 4;
        if (b.includes('MOVIES DATA')) return 6;
        if (b.includes('WEATHER DATA')) return 7;
        if (b.includes('FX DATA')) return 7;
        if (b.includes('OSM')) return 8;
        return 50;
      };
      const prioritizeToolBlocks = (blocks) =>
        (Array.isArray(blocks) ? blocks : [])
          .map((b, i) => ({ b, i, p: _toolBlockPriority(b) }))
          .sort((x, y) => (x.p - y.p) || (x.i - y.i))
          .map((x) => x.b);

      const prioritizedMustUseBlocks = prioritizeToolBlocks(mustUseBlocks);

      // V3: Unified super-system (one cohesive system message instead of 5 separate ones)
      const unifiedSystem = [
        systemBlock,
        copilot && copilot.ok && copilot.systemAddendum
          ? '\n🎯 KEY GUIDANCE:\n' + String(copilot.systemAddendum).trim()
          : '',
        threadSummary && String(threadSummary).trim()
          ? '\nCONVERSATION CONTEXT (internal):\n' + String(threadSummary).slice(0, 800)
          : '',
        prioritizedMustUseBlocks.length
          ? '\n⚠️ GROUNDING FACTS (MUST USE):\n' + prioritizedMustUseBlocks.slice(0, 6).join('\n\n').slice(0, 2600)
          : '',
        optionalBlocks.length
          ? '\nADDITIONAL CONTEXT (use if relevant):\n' + optionalBlocks.slice(0, 2).join('\n\n').slice(0, 1200)
          : '',
      ]
        .filter(Boolean)
        .join('\n')
        .trim();

      const messages = [
        { role: 'system', content: unifiedSystem },
      ];


      // Add Firestore conversation history (role-based)
      // Send the most relevant slice to reduce context drift.
      let historyMsgs = Array.isArray(relevantHistory) ? relevantHistory : [];

      // If the user just uploaded a file and is asking for a generic analysis,
      // trim history aggressively so the model doesn't answer an older prompt.
      if (typeof hasRecentUploadContext !== 'undefined' && hasRecentUploadContext && _isGenericDocAnalysisIntent(message)) {
        historyMsgs = historyMsgs.slice(-6);
      }
      historyMsgs
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
        .forEach((m) => messages.push({ role: m.role, content: String(m.content).trim() }));

      // Avoid duplicating the latest user message if FF already stored it before calling backend
      const last = messages[messages.length - 1];
      const sameAsLastUser =
        last && last.role === 'user' && _normTextForDedupe(last.content) === _normTextForDedupe(message);
      if (!sameAsLastUser) {
        messages.push({ role: 'user', content: String(message).trim() });
      }

      // Backwards compatible debug prompt (useful for logs / debugging)
      const fullPrompt = messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

      // ─────────────────────────────────────────
      // 5) Non-stream JSON
      // ─────────────────────────────────────────
      if (!stream) {
        // Strict grounded mode for flyers/deals (prices, catalogues): answer ONLY from OCR/Vision extraction.
        // This avoids the "invented items" failure mode.
        if (_looksLikeFlyerDealsQuery(message) && flyerDeals && flyerDeals.items && flyerDeals.items.length) {
          const answer = _buildStrictFlyerAnswer({
            queryText: message,
            flyer: flyerDeals,
            languageHint,
          });
          const duration = Date.now() - startTime;
          console.log(`✅ /chat (flyer_strict) completed in ${duration}ms (items=${flyerDeals.items.length})`);
          return res.json({
            answer,
            images: generatedImages?.images || [],
            sources: (() => {
          const seen = new Set();
          const out = [];
          const add = (arr) => {
            for (const s of Array.isArray(arr) ? arr : []) {
              if (!s || !s.url) continue;
              const key = String(s.url);
              if (seen.has(key)) continue;
              seen.add(key);
              out.push(s);
            }
          };
          add(wikiSources);
          add(webResults?.results);
          return out;
        })(),
            routePlan: plan,
          });
        }

        // If router decided this is image-only, we can return images without spending an LLM call.
        if (
          generatedImages &&
          Array.isArray(generatedImages.images) &&
          generatedImages.images.length
        ) {
          const duration = Date.now() - startTime;
          console.log(`✅ /chat (image_generated) completed in ${duration}ms`);
          return res.json({
            answer: '',
            images: generatedImages.images,
            sources: (() => {
          const seen = new Set();
          const out = [];
          const add = (arr) => {
            for (const s of Array.isArray(arr) ? arr : []) {
              if (!s || !s.url) continue;
              const key = String(s.url);
              if (seen.has(key)) continue;
              seen.add(key);
              out.push(s);
            }
          };
          add(wikiSources);
          add(webResults?.results);
          return out;
        })(),
            routePlan: plan,
          });
        }

        const { callDeepSeek } = require('../services/providers/deepseek');
        // Keep DeepSeek deterministic to reduce topic drift.
        const temp = (accuracyRisk.level !== 'low' || forceGrounding)
          ? 0.15
          : (WEB_STRICT_MODE && webContext ? 0.2 : 0.25);
	        const maxTokens = Number.isFinite(Number(req.body?.maxTokens))
	          ? Number(req.body.maxTokens)
	          : 1400;
        let answer = '';
        if (forceOpenRouter) {
          const { callOpenRouterChat } = require('../services/providers/openrouterChat');
          answer = await callOpenRouterChat(
            { messages, model: openRouterModel || 'openai/gpt-4o-mini' },
            temp,
            4000,
            { userId: userId || 'guest', conversationId: conversationId || null, requestId: requestId || null }
          );
        } else {
          answer = await callDeepSeek({ messages, model: effectiveModel }, temp, 4000);
        }

        // Lightweight post-processing (remove "Procjena:" openers, trailing questions, etc.)
        answer = postProcessFinalAnswer(answer, { languageHint });

        // Accuracy guard: verify + rewrite pass (removes unsupported claims).
        // Runs only in NON-STREAM mode. For high-risk requests we auto-disable streaming upstream.
        const isEncyclopedic = Boolean(accuracyRisk?.reasons && accuracyRisk.reasons.includes('encyclopedic'));
        if (shouldVerify && !isLongFormRequest && !isEncyclopedic) {
          try {
            const verifierProvider = String(ACCURACY_GUARD_VERIFIER_PROVIDER || 'auto').toLowerCase();
            const useOpenAI =
              verifierProvider === 'openai' || (verifierProvider === 'auto' && Boolean(OPENAI_API_KEY));

            // Privacy guard: when calling external providers (OpenAI), do not forward raw tool dumps.
            // We pass a sanitized + truncated context slice to reduce leak risk.
            const toolBlocksForVerifier = useOpenAI
              ? sanitizeToolBlocksForExternal(prioritizeToolBlocks(mustUseBlocks), { maxBlocks: 4, maxChars: 1400 })
              : mustUseBlocks;

            const verifierMessages = buildVerifierMessages({
              userMessage: message,
              draftAnswer: answer,
              sourcesBlock,
              toolBlocks: toolBlocksForVerifier,
              languageHint,
            });

            const verifierStartTime = Date.now();
            let verified = '';
            if (useOpenAI) {
              const { callOpenAIChat } = require('../services/providers/openaiChat');
              verified = await callOpenAIChat(
                { messages: verifierMessages, model: ACCURACY_GUARD_VERIFIER_OPENAI_MODEL || 'gpt-4o-mini' },
                0,
                Number(ACCURACY_GUARD_MAX_TOKENS || 1200),
                { userId: userId || 'guest', conversationId: conversationId || null, requestId: safeRequestId || null, operation: 'accuracy_verifier' },
              );
            } else {
              verified = await callDeepSeek(
                { messages: verifierMessages, model: ACCURACY_GUARD_VERIFIER_MODEL || 'deepseek-reasoner' },
                0,
                Number(ACCURACY_GUARD_MAX_TOKENS || 1200),
                { userId: userId || 'guest', conversationId: conversationId || null, requestId: safeRequestId || null, operation: 'accuracy_verifier' },
              );
            }
            const verifierLatency = Date.now() - verifierStartTime;

            // Observability: log hashes + lengths (no raw text)
            const crypto = require('crypto');
            const _hash = (s) =>
              crypto.createHash('sha256').update(String(s || '').slice(0, 4000)).digest('hex').slice(0, 16);

            const changed = String(verified || '').trim() ? _hash(answer) !== _hash(verified) : false;
            const deltaChars = Math.abs((verified || '').length - (answer || '').length);

            logVerifierEvent({
              userId,
              conversationId,
              changed,
              deltaChars,
              latencyMs: verifierLatency,
              draftLen: (answer || '').length,
              verifiedLen: (verified || '').length,
              draftHash: _hash(answer),
              verifiedHash: _hash(verified),
              provider: useOpenAI ? 'openai' : 'deepseek',
              model: useOpenAI
                ? (ACCURACY_GUARD_VERIFIER_OPENAI_MODEL || 'gpt-4o-mini')
                : (ACCURACY_GUARD_VERIFIER_MODEL || 'deepseek-reasoner'),
            });

            if (String(verified || '').trim()) {
              answer = postProcessFinalAnswer(verified || answer, { languageHint });
            }
          } catch (e) {
            console.warn('⚠️ [ACCURACY_GUARD] Verifier pass failed:', e?.message || String(e));
          }
        }

        // ─────────────────────────────────────────
        // Anti-hallucination: enforce citations when grounding is expected
        // ─────────────────────────────────────────
        try {
          const requireCitations = Boolean(webContext) ||
            (Boolean(forceGrounding) && String(accuracyRisk?.level || 'low') !== 'low');

          if (requireCitations) {
            const verifierProvider = String(ACCURACY_GUARD_VERIFIER_PROVIDER || 'auto').toLowerCase();
            const useOpenAI = verifierProvider === 'openai' || (verifierProvider === 'auto' && Boolean(OPENAI_API_KEY));
            const verifierModels = {
              openai: ACCURACY_GUARD_VERIFIER_OPENAI_MODEL || 'gpt-4o-mini',
              deepseek: ACCURACY_GUARD_VERIFIER_MODEL || 'deepseek-reasoner',
              maxTokens: Number(ACCURACY_GUARD_MAX_TOKENS || 1200),
            };

            const { callOpenAIChat } = useOpenAI ? require('../services/providers/openaiChat') : { callOpenAIChat: null };

            const enforced = await _enforceCitationsOrRepair({
              draft: answer,
              requireCitations,
              sourcesIndex,
              sourcesBlock,
              userMessage: message,
              languageHint,
              mustUseBlocks,
              useOpenAI,
              verifierModels,
              callOpenAIChat,
              callDeepSeek,
              userId,
              conversationId,
              requestId: safeRequestId || null,
            });

            answer = enforced.text;
          }
        } catch (e) {
          console.warn('⚠️ [CITATION_ENFORCE] Failed:', e?.message || String(e));
        }

        // schedule memory extraction
        if (userId && answer && answer.trim()) {
          setImmediate(() => {
            extractSemanticMemory(
              [
                { role: 'user', content: message },
                { role: 'assistant', content: answer.trim() },
              ],
              userId,
            ).catch(console.error);
          });
        }

        // Update running thread summary (anchor for models that drift).
        if (THREAD_SUMMARY_ENABLED && conversationId && answer && answer.trim()) {
          setImmediate(() => {
            updateThreadSummary({
              conversationId,
              previousSummary: threadSummary,
              userMessage: message,
              assistantMessage: answer.trim(),
            }).catch(console.error);
          });
        }

        const duration = Date.now() - startTime;
        console.log(`✅ /chat completed in ${duration}ms (len=${(answer || '').length})`);
        
        // V3: Observability - total request latency
        logLatencyEvent({
          userId,
          conversationId,
          operation: 'total_request',
          latencyMs: duration,
        });

        return res.json({
          answer,
          images: generatedImages?.images || [],
          sources: (() => {
          const seen = new Set();
          const out = [];
          const add = (arr) => {
            for (const s of Array.isArray(arr) ? arr : []) {
              if (!s || !s.url) continue;
              const key = String(s.url);
              if (seen.has(key)) continue;
              seen.add(key);
              out.push(s);
            }
          };
          add(wikiSources);
          add(webResults?.results);
          return out;
        })(),
          routePlan: plan,
        });
      }

      // ─────────────────────────────────────────
      // 6) Streaming SSE
      // ─────────────────────────────────────────
      // SSE headers (anti-buffering for proxies / Cloud Run)
      // IMPORTANT: set ALL headers BEFORE flushHeaders().
      // If you call flushHeaders() first and then setHeader(), Node throws
      // ERR_HTTP_HEADERS_SENT and the stream ends with 200 + empty body.
      // SSE should already be initialised earlier (before tool calls) so tool statuses can stream.
      // If for some reason it isn't, initialise now.
      if (!sendEvent) {
        sse = setupSSE(res, { timeoutMs: Number(process.env.SSE_TIMEOUT_MS || 240000) });
        sendEvent = sse.sendEvent;
        heartbeat = sse.heartbeat;
        timeout = sse.timeout;
        sseCleanup = sse.cleanup;
        sendEvent('init', { ok: true });
      }

      if (memoryEvent) {
        sendEvent('memory', memoryEvent);
      }

      // If this is a flyer/deals query and OCR extracted items, answer immediately in strict grounded mode.
      if (_looksLikeFlyerDealsQuery(message) && flyerDeals && flyerDeals.items && flyerDeals.items.length) {
        const answer = _buildStrictFlyerAnswer({ queryText: message, flyer: flyerDeals, languageHint });
        clearTimeout(timeout);
        clearInterval(heartbeat);
        sendEvent('token', { content: answer });
        sendEvent('done', { message: answer });
        res.end();
        return;
      }

      // Images (if any) are stored to Firestore via imagePersistence and will
      // show up in the UI through the messages collection.

      // If an image was generated, end the stream here (no caption / no extra preview).
      if (
        generatedImages &&
        Array.isArray(generatedImages.images) &&
        generatedImages.images.length
      ) {
        clearTimeout(timeout);
        clearInterval(heartbeat);
        sendEvent('done', { message: '', images: generatedImages.images || [] });
        res.end();
        return;
      }

      try {
        // Accuracy guard: for medium/high-risk factual queries (and/or web strict mode), prefer a controllable
        
        // non-stream generation + verify+rewrite pass, then emit it as SSE.
        const isEncyclopedic = Boolean(accuracyRisk?.reasons && accuracyRisk.reasons.includes('encyclopedic'));
        const forceRealStream = isLongFormRequest || isEncyclopedic;

        // If user asked for stream but this is high-risk, we keep SSE but avoid live token streaming:
        // draft (non-stream) → optional verifier → emit a single SSE chunk.
        const doPseudoStream = !allowRealStream && !forceRealStream;

        // Temperature for streaming/pseudo-stream path.
        // NOTE: `temp` was previously defined only in the non-stream branch, which
        // caused ReferenceError in pseudo-stream mode.
        const temp = (accuracyRisk.level !== 'low' || forceGrounding)
          ? 0.15
          : (WEB_STRICT_MODE && webContext ? 0.2 : 0.25);

        console.log(
          `🧠 [STREAM_POLICY] requested=${Boolean(stream)} allowReal=${Boolean(allowRealStream)} pseudo=${doPseudoStream} risk=${String(
            copilot?.risk_level || 'unknown',
          )} accuracyRisk=${String(accuracyRisk?.level || 'unknown')}`,
        );

        if (doPseudoStream) {
          try {
            const draftStart = Date.now();

            // Non-stream draft (faster/cleaner + allows verifier before user sees text)
            let draft = await callDeepSeek(
              { messages, model: effectiveModel },
              temp,
              maxTokens,
              { userId, conversationId, requestId, operation: 'accuracy_guard_draft' },
            );

            draft = postProcessFinalAnswer(draft || '', { languageHint });

            // Optional verify+rewrite pass
            if (shouldVerify) {
              const verifierProvider = String(ACCURACY_GUARD_VERIFIER_PROVIDER || 'auto').toLowerCase();
              const useOpenAI =
                verifierProvider === 'openai' || (verifierProvider === 'auto' && Boolean(OPENAI_API_KEY));

              const toolBlocksForVerifier = useOpenAI
                ? sanitizeToolBlocksForExternal(prioritizeToolBlocks(mustUseBlocks), { maxBlocks: 4, maxChars: 1400 })
                : mustUseBlocks;

              const verifierMessages = buildVerifierMessages({
                userMessage: message,
                draftAnswer: draft,
                sourcesBlock,
                toolBlocks: toolBlocksForVerifier,
                languageHint,
              });

              const verifierStartTime = Date.now();
              let verified = '';
              if (useOpenAI) {
                const { callOpenAIChat } = require('../services/providers/openaiChat');
                verified = await callOpenAIChat(
                  { messages: verifierMessages, model: ACCURACY_GUARD_VERIFIER_OPENAI_MODEL || 'gpt-4o-mini' },
                  0,
                  Number(ACCURACY_GUARD_MAX_TOKENS || 1200),
                  { userId: userId || 'guest', conversationId: conversationId || null, requestId: safeRequestId || null, operation: 'accuracy_verifier' },
                );
              } else {
                verified = await callDeepSeek(
                  { messages: verifierMessages, model: ACCURACY_GUARD_VERIFIER_MODEL || 'deepseek-reasoner' },
                  0,
                  Number(ACCURACY_GUARD_MAX_TOKENS || 1200),
                  { userId: userId || 'guest', conversationId: conversationId || null, requestId: safeRequestId || null, operation: 'accuracy_verifier' },
                );
              }

              const verifierLatency = Date.now() - verifierStartTime;

              const crypto = require('crypto');
              const _hash = (s) =>
                crypto.createHash('sha256').update(String(s || '').slice(0, 4000)).digest('hex').slice(0, 16);

              const changed = String(verified || '').trim() ? _hash(draft) !== _hash(verified) : false;
              const deltaChars = Math.abs((verified || '').length - (draft || '').length);

              logVerifierEvent({
                userId,
                conversationId,
                changed,
                deltaChars,
                latencyMs: verifierLatency,
                draftLen: (draft || '').length,
                verifiedLen: (verified || '').length,
                draftHash: _hash(draft),
                verifiedHash: _hash(verified),
                provider: useOpenAI ? 'openai' : 'deepseek',
                model: useOpenAI
                  ? (ACCURACY_GUARD_VERIFIER_OPENAI_MODEL || 'gpt-4o-mini')
                  : (ACCURACY_GUARD_VERIFIER_MODEL || 'deepseek-reasoner'),
              });

              if (String(verified || '').trim()) {
                draft = postProcessFinalAnswer(verified || draft, { languageHint });
              }
            }

            // Enforce citations in pseudo-stream too (prevents fake [n] / no-cite answers)
            try {
              const requireCitations = Boolean(webContext) ||
                (Boolean(forceGrounding) && String(accuracyRisk?.level || 'low') !== 'low');

              if (requireCitations) {
                const verifierProvider = String(ACCURACY_GUARD_VERIFIER_PROVIDER || 'auto').toLowerCase();
                const useOpenAI = verifierProvider === 'openai' || (verifierProvider === 'auto' && Boolean(OPENAI_API_KEY));
                const verifierModels = {
                  openai: ACCURACY_GUARD_VERIFIER_OPENAI_MODEL || 'gpt-4o-mini',
                  deepseek: ACCURACY_GUARD_VERIFIER_MODEL || 'deepseek-reasoner',
                  maxTokens: Number(ACCURACY_GUARD_MAX_TOKENS || 1200),
                };
                const { callOpenAIChat } = useOpenAI ? require('../services/providers/openaiChat') : { callOpenAIChat: null };

                const enforced = await _enforceCitationsOrRepair({
                  draft,
                  requireCitations,
                  sourcesIndex,
                  sourcesBlock,
                  userMessage: message,
                  languageHint,
                  mustUseBlocks,
                  useOpenAI,
                  verifierModels,
                  callOpenAIChat,
                  callDeepSeek,
                  userId,
                  conversationId,
                  requestId: safeRequestId || null,
                });

                draft = enforced.text;
              }
            } catch (e) {
              console.warn('⚠️ [CITATION_ENFORCE] Pseudo-stream enforce failed:', e?.message || String(e));
            }

            const draftLatency = Date.now() - draftStart;
            res.write(`data: ${JSON.stringify({ type: 'token', text: draft, final: true, ttfbMs: draftLatency })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: 'done', ok: true })}\n\n`);
            res.end();

            // Memory extraction (fire-and-forget)
            try {
              scheduleMemoryExtraction({
                userId,
                text: message,
                assistantText: draft,
                languageHint,
              });
            } catch (e) {
              // ignore
            }
            return; // pseudo-stream done
          } catch (e) {
            console.warn('⚠️ [STREAM_POLICY] Pseudo-stream failed:', e?.message || String(e));
            // fall back to real streaming below
          }
        }

// If DeepSeek missing => stream OpenAI
        if (!DEEPSEEK_API_KEY && OPENAI_API_KEY) {
          const fullResponse = await streamFromOpenAI({
            messages,
            fullPrompt,
            res,
            heartbeat,
            timeout,
            userId,
            message,
            conversationId,
            startTime,
          });

          if (userId && fullResponse && fullResponse.trim()) {
            console.log('🧠 [MEMORY] Scheduling extraction after response...');
            setImmediate(() => {
              extractSemanticMemory(
                [
                  { role: 'user', content: message },
                  { role: 'assistant', content: fullResponse.trim() },
                ],
                userId,
              ).catch(console.error);
            });
          }

          // Update running thread summary (anchor for models that drift).
          if (THREAD_SUMMARY_ENABLED && conversationId && fullResponse && fullResponse.trim()) {
            setImmediate(() => {
              updateThreadSummary({
                conversationId,
                previousSummary: threadSummary,
                userMessage: message,
                assistantMessage: fullResponse.trim(),
              }).catch(console.error);
            });
          }

          return;
        }

        let fullResponse = '';

        if (forceOpenRouter) {
          const { streamFromOpenRouter } = require('../services/providers/openrouterChat');
          fullResponse = await streamFromOpenRouter({
            messages,
            fullPrompt,
            model: openRouterModel || 'openai/gpt-4o-mini',
            res,
            heartbeat,
            timeout,
            userId,
            message,
            conversationId,
            startTime,
          });
        } else {
          fullResponse = await streamFromDeepSeek({
            messages,
            fullPrompt,
            model: effectiveModel, // ✅ propagate effective model (requested or copilot suggestion) to streaming call
            res,
            heartbeat,
            timeout,
            userId,
            message,
            conversationId,
            startTime,
          });
        }

        if (userId && fullResponse && fullResponse.trim()) {
          console.log('🧠 [MEMORY] Scheduling extraction after response...');
          setImmediate(() => {
            extractSemanticMemory(
              [
                { role: 'user', content: message },
                { role: 'assistant', content: fullResponse.trim() },
              ],
              userId,
            ).catch(console.error);
          });
        }

        // Update running thread summary (anchor for models that drift).
        if (THREAD_SUMMARY_ENABLED && conversationId && fullResponse && fullResponse.trim()) {
          setImmediate(() => {
            updateThreadSummary({
              conversationId,
              previousSummary: threadSummary,
              userMessage: message,
              assistantMessage: fullResponse.trim(),
            }).catch(console.error);
          });
        }
        
        // ⏱️ Log final performance metrics
        console.log('⏱️ [PERFORMANCE]', {
          total: Date.now() - perfTiming.t_start,
          sse_open: perfTiming.t_sse_open ? perfTiming.t_sse_open - perfTiming.t_start : null,
          memory: perfTiming.t_memory_done ? perfTiming.t_memory_done - perfTiming.t_start : null,
          semantic: perfTiming.t_semantic_done ? perfTiming.t_semantic_done - perfTiming.t_start : null,
          router: perfTiming.t_router_done ? perfTiming.t_router_done - perfTiming.t_start : null,
          first_token: perfTiming.t_first_token ? perfTiming.t_first_token - perfTiming.t_start : null,
        });
      } catch (error) {
        clearInterval(heartbeat);
        clearTimeout(timeout);
        console.error('❌ Streaming error:', error);

        if (!res.destroyed) {
          const out = JSON.stringify({ type: 'error', message: error.message || 'Stream error' });
          res.write(`data: ${out}\n\n`);
          res.end();
        }
      }
    } catch (error) {
      console.error('❌ /chat error:', error);

      // If we're already in SSE mode, send an SSE error instead of JSON.
      if (res.headersSent && !res.writableEnded && !res.destroyed) {
        try {
          const out = JSON.stringify({ type: 'error', message: error.message || 'Chat error' });
          res.write(`data: ${out}\n\n`);
          res.end();
          return;
        } catch (_) {}
      }

      return res.status(500).json({ error: 'Chat error', details: error.message });
    }
  });

  return router;
}

module.exports = { createChatRouter };
