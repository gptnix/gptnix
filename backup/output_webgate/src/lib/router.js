'use strict';

/**
 * 🎯 ENHANCED SMART ROUTER V4
 * 
 * Vercel AI Pattern: Router BEFORE LLM
 * - 80% routes handled by DETERMINISTIC PATTERNS (< 5ms)
 * - 15% routes handled by SEMANTIC MATCHING (< 50ms) 
 * - 5% fallback to LLM router (2-5s)
 * 
 * Key improvements:
 * - More aggressive pattern matching
 * - Tool-first mentality (when in doubt, use tools)
 * - Clear confidence scoring
 * - Fast paths for common queries
 */

const {
  OPENAI_API_KEY,
  DEEPSEEK_API_KEY,
  OPENROUTER_API_KEY,
  SMART_ROUTING_ENABLED,
  ROUTER_PROVIDER,
  ROUTER_MODEL_OPENAI,
  ROUTER_MODEL_DEEPSEEK,
  ROUTER_MAX_TOKENS,
  ROUTER_CONFIDENCE_THRESHOLD,
} = require('../config/env');

const { callOpenAIChat } = require('../services/providers/openaiChat');
const { callOpenRouterChat } = require('../services/providers/openrouterChat');
const { callDeepSeek } = require('../services/providers/deepseek');
const { isWebSearchBlocked } = require('../utils/webSearchGate');

/**
 * ⚡ TIER 1: INSTANT RESPONSES (< 5ms)
 * Zero-cost, zero-latency pattern matching
 * Handles: greetings, farewells, simple affirmations
 */
function instantPatternRouter(message) {
  const msg = String(message || '').toLowerCase().trim();
  
  // Greetings
  if (/^(hi|hello|hey|yo|sup|hej|bok|zdravo|pozdrav|dobar dan|dobro jutro|dobra večer)$/i.test(msg)) {
    return {
      plan: {
        tool_calls: [],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.99,
        reason: 'Instant greeting (v4 fast path)',
        skipMemoryRetrieval: true,
        skipRouting: true
      },
      confident: true
    };
  }
  
  // Farewells
  if (/^(bye|goodbye|see you|see ya|ciao|doviđenja|adio|ćao)$/i.test(msg)) {
    return {
      plan: {
        tool_calls: [],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.99,
        reason: 'Instant farewell (v4 fast path)',
        skipMemoryRetrieval: true,
        skipRouting: true
      },
      confident: true
    };
  }
  
  // Simple affirmations
  if (/^(ok|okay|thanks|thank you|thx|hvala|fala|super|great|cool|nice|da|yes|yeah|yep|yup|ne|no|nope)$/i.test(msg)) {
    return {
      plan: {
        tool_calls: [],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.99,
        reason: 'Instant affirmation (v4 fast path)',
        skipMemoryRetrieval: true,
        skipRouting: true
      },
      confident: true
    };
  }
  
  return null; // Not instant response
}

/**
 * ⚡ TIER 2: COMMAND PATTERN ROUTER (< 10ms)
 * Hard-coded patterns for explicit commands
 * Handles: memory commands, explicit tool requests
 */
function commandPatternRouter(message, capabilities) {
  const msg = String(message || '').toLowerCase().trim();
  
  // 🧠 MEMORY WRITE
  if (/^(\s*)(zapamti|zabiljezi|zabilježi|spremi|snimi|remember|save)\b/i.test(message) ||
      /\b(zapamti|zabiljezi|zabilježi|spremi|snimi)\s+(u\s+)?(memoriju|memory)\b/i.test(message)) {
    return {
      plan: {
        tool_calls: [],
        memory: { action: 'save', content: String(message || '').trim() },
        response: { type: 'text' },
        confidence: 0.99,
        reason: 'Explicit memory write command',
        skipToolRouting: true,
      },
      confident: true,
    };
  }
  
  // 🧠 MEMORY DELETE
  if (/^(\s*)(zaboravi|obrisi|obriši|forget|delete)\b/i.test(message) ||
      /\b(zaboravi|obrisi|obriši|forget)\s+(to|ovo|that|this)\b/i.test(message)) {
    return {
      plan: {
        tool_calls: [],
        memory: { action: 'delete' },
        response: { type: 'text' },
        confidence: 0.99,
        reason: 'Explicit memory delete command',
        skipToolRouting: true,
      },
      confident: true,
    };
  }
  
  // 🧠 MEMORY QUERY (personal info)
  const memoryQueryPatterns = [
    /\b(my name|moje ime|koje je moje ime|what('?s| is) my name|kako se zovem)\b/i,
    /\b(who am i|ko sam|tko sam|what do you know about me|što znaš o meni)\b/i,
    /\b(where (do i|am i)|gdje (sam|živim)|where i live|moja lokacija)\b/i,
    /\b(my (location|city|country|profession|job|work)|moj (posao|grad))\b/i,
    /\b(do you (know|remember) me|znaš li me|sjećaš li se mene)\b/i,
  ];
  
  if (memoryQueryPatterns.some(pattern => pattern.test(msg))) {
    return {
      plan: {
        tool_calls: [],
        memory: { action: 'retrieve' },
        response: { type: 'text' },
        confidence: 0.99,
        reason: 'Direct memory query',
        skipToolRouting: true,
      },
      confident: true
    };
  }
  
  // 🎨 EXPLICIT IMAGE GENERATION (multilingual)
  // Fix: German prompts (e.g. "Generiere ein Bild: Hund im Weltraum") weren't triggering image generation.
  // Heuristic: verb + (optional filler) + image noun.
  const _imageIntentRe = /\b(generiraj|napravi|kreiraj|izgeneriraj|nacrtaj|dizajniraj|generate|create|draw|make|design|generier(?:e|en)|erzeug(?:e|en)|erstelle|mach(?:e|en)|zeichne|entwirf)\b[\s\S]{0,30}\b(slika|sliku|slike|ilustracij(?:a|u|e)|image|picture|photo|illustration|drawing|artwork|bild|bilder|grafik|foto)\b/i;
  if (_imageIntentRe.test(message)) {
    return {
      plan: {
        tool_calls: [{ name: 'image_generate', args: {} }],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.95,
        reason: 'Explicit image generation request'
      },
      confident: true
    };
  }
  
  return null; // Not a command
}


/**
 * 🔎 FORCE WEB SEARCH (ChatGPT-level heuristic)
 * We force web_search for questions that are likely factual, time-sensitive, or about public people/official roles.
 * This prevents the LLM from "being confident" and skipping search when grounding is needed.
 *
 * V5.3: WebSearchGate HARD_BLOCK runs first to prevent false positives
 *       (e.g. "kad daješ izvore, stavi klikabilne" no longer triggers web search).
 */
function shouldForceWebSearch(rawMessage = '') {
  const msg = String(rawMessage || '').trim();
  const m = msg.toLowerCase();

  if (!m) return false;

  // ✅ V5.3: WebSearchGate HARD_BLOCK — check this BEFORE anything else
  // If the gate blocks it, no web search regardless of other patterns.
  if (isWebSearchBlocked(msg)) {
    console.log('[WEBGATE→ROUTER] shouldForceWebSearch=false (HARD_BLOCK)');
    return false;
  }

  // ✅ Time-sensitive office holders / public officials
  if (isTimeSensitiveOfficeHolderQuestion(msg)) {
    console.log('🏛️ [V5.2-ROUTER] Office-holder question → force web_search');
    return true;
  }

  // Define looksMath early so we can use it everywhere
  const looksMath = /\b(izračunaj|izracunaj|računaj|racunaj|postotak|percentage|calc(ulate)?|=|\+|\-|\*|\/)\b/i.test(msg);

  // Hard negatives: local coding/debug tasks should NOT auto-trigger web search.
  const devNeg = /\b(flutter|flutterflow|dart|node\.?js|javascript|typescript|firebase|firestore|cloud\s*run|docker|deploy|build|stack\s*trace|exception|error|bug|fix|refaktor|refactor|logovi|logs|sse|api)\b/i;
  if (devNeg.test(msg)) return false;

  // User explicitly asking for online lookup
  if (/\b(web\s*search|pretra(ž|z)i\s+internet|googlaj|nađi\s+na\s+webu|potraži\s+online)\b/i.test(msg)) return true;

  // User explicitly asking for REAL sources/links (not format requests — gate already filtered those)
  // V5.3: Narrowed from "izvor|link" (too broad) to explicit source CONTENT requests only
  const wantsSources = /\b(daj\s+(mi\s+)?(izvore|linkove)\s+(za|o)|linkaj|napiši\s+s\s+citatima|provjeri\s+(tvrdnju|claim)|verify\s+(claim|fact)|cited\s+sources?)\b/i;
  if (wantsSources.test(msg)) return true;

  // Contains URL or site: query
  if (/https?:\/\//i.test(msg) || /\bsite:\S+/i.test(msg)) return true;

  // ✨ V5.1: Enhanced domain/TLD detection (language-agnostic)
  if (/\b\w+\.(hr|ba|com|net|org|de|fr|cn|jp|ru|uk|eu|ch|at|it|es|pt|nl|be|se|no|dk|fi|pl|cz|sk|si|ro|bg|gr|tr|il|ae|in|au|nz)\b/i.test(msg)) {
    console.log('🌐 [V5.1-ROUTER] Domain detected → force web_search');
    return true;
  }

  // "freshness" or "current" signals
  if (/\b(trenutno|sada|danas|jučer|jucer|sutra|ovaj\s+tjedan|ovaj\s+mjesec|najnovije|zadnje|latest|today|now|current|breaking)\b/i.test(msg)) return true;

  // Question marks alone are NOT enough to force web.
  const hasQuestionMark = msg.includes('?');
  const isQuestionLength = msg.length > 15 && msg.length < 200;
  if (hasQuestionMark && isQuestionLength && !looksMath) {
    if (/\b(trenutno|sada|danas|jučer|jucer|sutra|ovaj\s+tjedan|ovaj\s+mjesec|najnovije|zadnje|latest|today|now|current|breaking)\b/i.test(msg)) {
      console.log('❓ [V5.2-ROUTER] Question + freshness signal → force web_search');
      return true;
    }
  }

  const hasRecency = /\b(trenutni|current|sadašnji|sadasnji|danas|today|now|latest|najnoviji|zadnji|breaking|2024|2025|2026)\b/i.test(msg);

  const qWords = /\b(tko\s+je|ko\s+je|što\s+je|sta\s+je|kada\s+je|gdje\s+je|koliko\s+je|how\s+many|when\s+is|where\s+is|who\s+is|what\s+is)\b/i;
  if (qWords.test(msg) && !looksMath && hasRecency) return true;

  return false;
}

/**
 * 🏛️ Time-sensitive office holders
 *
 * Always treat questions about "who is the president/PM/mayor/minister/CEO..." as time-sensitive,
 * even when the user does NOT explicitly say "trenutni" / "current".
 *
 * Why: these facts change and stale answers are unacceptable.
 */
function isTimeSensitiveOfficeHolderQuestion(rawText = '') {
  const text = String(rawText || '').trim();
  const t = text.toLowerCase();
  if (!t) return false;

  // Avoid false positives for dev tasks or code contexts
  const devNeg = /\b(flutter|flutterflow|dart|node\.?js|javascript|typescript|firebase|firestore|cloud\s*run|docker|deploy|build|stack\s*trace|exception|error|bug|fix|refaktor|refactor|logovi|logs|sse|api)\b/i;
  if (devNeg.test(text)) return false;

  // Role/office keywords (HR/EN/DE + common)
  const roleRe = /\b(predsjednik|predsjednica|premijer|predsjednik\s+vlade|ministar|načelnik|nacelnik|gradonačelnik|guverner|kancelar|kanzler|senator|predsjedavajući|ceo|chief\s+executive|direktor|director|president|prime\s+minister|mayor|governor|chancellor|minister)\b/i;
  if (!roleRe.test(text)) return false;

  // Must look like asking for the holder (not just mentioning the role)
  const looksLikeWho = /\b(tko\s+je|ko\s+je|who\s+is|wer\s+ist|kto\s+jest|chi\s+è|quien\s+es|qui\s+est)\b/i.test(text);

  // Entity hints: country/state/union names, abbreviations, etc.
  const entityHint = /\b(sad|usa|u\.?s\.?a\.?|u\.?s\.?|united\s+states|sjedinjenih\s+dr\u017eava|amerik(e|a)|uk|u\.?k\.?|united\s+kingdom|england|germany|deutschland|njemačk(e|a)|france|francusk(e|a)|hrvatsk(e|a)|croatia|bosn(e|a)|hercegovin(e|a)|bih|serbia|srbija|italy|italija|spain|španjolsk(e|a)|russia|rusija|eu|europsk(a|e)\s+unij(a|e))\b/i.test(text);

  // Very short generic question still time-sensitive
  const shortGeneric = looksLikeWho && text.length <= 40;

  return looksLikeWho || entityHint || shortGeneric;
}

/**
 * ⚡ TIER 3: DOMAIN PATTERN ROUTER (< 20ms)
 * Domain-specific keyword matching
 * Handles: movies, weather, currency, wiki, locations, documents
 */
function domainPatternRouter(message, capabilities) {
  const msg = String(message || '').toLowerCase().trim();
  const len = msg.length;

  
  // 📄 DOCUMENT/RAG QUERIES
  const documentPatterns = [
    /\b(doc|docs|document|dokument|dokumenta|file|fajl|datoteka)\b/i,
    /\b(pdf|docx|xlsx|txt|image|photo|slika|fotografija|screenshot|scan)\b/i,
    /\b(upload|uploaded|prilog|attachment|attach)\b/i,
    /\b(analiz|analy[sz]e|summarize|sažetak|opisati|describe|pročitaj|read)\b/i,
    /\b(u dokumentu|in (the )?(document|file)|iz (dokumenta|fajla))\b/i,
    /\b(što piše|what does it say|what's in|sadržaj|content)\b.*\b(doc|file|pdf|image)/i,
  ];
  
  if (documentPatterns.some(pattern => pattern.test(msg))) {
    console.log('📄 [V4-ROUTER] Document query → RAG');
    return {
      plan: {
        tool_calls: [{ name: 'rag_retrieve', args: { query: message } }],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.92,
        reason: 'Document/RAG query (v4 pattern)'
      },
      confident: true
    };
  }
  
  // 🎬 MOVIES (TMDB-first)
  if (capabilities.movies) {
    const hasMovieKeyword = /\b(film|movie|serija|series|sezona|season|epizod|episode|glumci|cast|trailer|imdb|tmdb)\b/i.test(msg);
    const hasYearOrNumber = /\b(19\d{2}|20\d{2})\b/.test(msg) || /\d/.test(msg);
    const looksLikeCalculation = /\b(izračunaj|izracunaj|računaj|racunaj|koliko\s+je|calculate|compute)\b/i.test(msg);
    
    if ((hasMovieKeyword || (hasYearOrNumber && len <= 48)) && !looksLikeCalculation) {
      console.log('🎬 [V4-ROUTER] Movie query → TMDB');
      return {
        plan: {
          tool_calls: [{ name: 'movie_report', args: { query: String(message || '').trim() } }],
          memory: { action: 'none' },
          response: { type: 'text' },
          confidence: 0.90,
          reason: 'Movie query (v4 pattern)'
        },
        confident: true
      };
    }
  }
  
  // 🌦️ WEATHER
  if (capabilities.weather) {
    const weatherKeywords = /\b(weather|vrijeme|prognoza|temperatura|temperature|rain|kiša|snow|snijeg|wind|vjetar|forecast|sun|sunce|cloud|oblak)\b/i;
    const locationContext = /\b(in|u|za|for)\s+[A-Z]/i.test(message) || /\b(today|tonight|tomorrow|danas|večeras|sutra|ovaj tjedan|this week)\b/i.test(msg);
    
    if (weatherKeywords.test(msg) && (locationContext || len <= 60)) {
      console.log('🌦️ [V4-ROUTER] Weather query → weather_forecast');
      return {
        plan: {
          tool_calls: [{ name: 'weather_forecast', args: { query: message } }],
          memory: { action: 'none' },
          response: { type: 'text' },
          confidence: 0.88,
          reason: 'Weather query (v4 pattern)'
        },
        confident: true
      };
    }
  }
  
  // 💱 CURRENCY CONVERSION
  if (capabilities.fx) {
    const hasCurrencyCodes = /\b([A-Z]{3})\s+(to|u|in)\s+([A-Z]{3})\b/i.test(message) ||
                             /\b(usd|eur|gbp|jpy|chf|bam|hrk|rsd)\b/i.test(msg);
    const hasNumbers = /\d/.test(message);
    const conversionWords = /\b(convert|konvertuj|konvertiraj|exchange|tečaj|tecaj|rate|kurs)\b/i.test(msg);
    
    if ((hasCurrencyCodes && hasNumbers) || (conversionWords && hasCurrencyCodes)) {
      console.log('💱 [V4-ROUTER] Currency query → fx_convert');
      return {
        plan: {
          tool_calls: [{ name: 'fx_convert', args: { query: message } }],
          memory: { action: 'none' },
          response: { type: 'text' },
          confidence: 0.92,
          reason: 'Currency conversion (v4 pattern)'
        },
        confident: true
      };
    }
  }
  
  // 🗺️ LOCATION/GEOCODING
  if (capabilities.osm) {
    const locationKeywords = /\b(gdje je|where is|adresa|address|koordinate|coordinates|location|lokacija)\b/i;
    const nearbyKeywords = /\b(nearest|najbliže|blizu|near me|u blizini|around|oko)\b/i;
    
    if (locationKeywords.test(msg)) {
      console.log('🗺️ [V4-ROUTER] Location query → osm_geocode');
      return {
        plan: {
          tool_calls: [{ name: 'osm_geocode', args: { query: message } }],
          memory: { action: 'none' },
          response: { type: 'text' },
          confidence: 0.87,
          reason: 'Location query (v4 pattern)'
        },
        confident: true
      };
    }
    
    if (nearbyKeywords.test(msg)) {
      console.log('🧭 [V4-ROUTER] Nearby query → osm_nearby');
      return {
        plan: {
          tool_calls: [{ name: 'osm_nearby', args: { query: message } }],
          memory: { action: 'none' },
          response: { type: 'text' },
          confidence: 0.86,
          reason: 'Nearby places query (v4 pattern)'
        },
        confident: true
      };
    }
  }
  
  // 🏛️ TIME-SENSITIVE OFFICIALS (must be true → always web grounded)
  // Example: "Tko je predsjednik SAD?" should never be answered from stale model knowledge.
  if (capabilities.web && isTimeSensitiveOfficeHolderQuestion(message)) {
    console.log('🏛️ [V5.2-ROUTER] Office-holder query → web_search');
    return {
      plan: {
        tool_calls: [{ name: 'web_search', args: { query: message } }],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.93,
        reason: 'Time-sensitive office-holder query (always web grounded)'
      },
      confident: true
    };
  }
  
  // 📚 WIKIPEDIA/KNOWLEDGE (for "who is", "what is")
  if (capabilities.wiki) {
    const knowledgeQuestions = /\b(who is|tko je|ko je|what is|što je|sta je|explain|objasni)\b/i;
    const hasProperNoun = /[A-Z][a-z]+/.test(message); // Likely a name/entity
    
    if (knowledgeQuestions.test(msg) && hasProperNoun && len <= 80) {
      console.log('📚 [V4-ROUTER] Knowledge query → wiki_summary');
      return {
        plan: {
          tool_calls: [{ name: 'wiki_summary', args: { query: message } }],
          memory: { action: 'none' },
          response: { type: 'text' },
          confidence: 0.84,
          reason: 'Encyclopedia query (v4 pattern)'
        },
        confident: true
      };
    }
  }
  
  // NOTE: office-holder queries are handled above.
  
  // 🔎 WEB SEARCH (current events, news, real-time data)
  if (capabilities.web) {
    // V5.3: Gate blocks format/style/code requests even if they contain freshness words
    if (!isWebSearchBlocked(message)) {
      const currentEventKeywords = /\b(latest|najnovije|news|vijesti|trenutno|current|now|sada|today|danas|happening|događa se)\b/i;
      const timeIndicators = /\b(2024|2025|2026|this year|ove godine|recently|nedavno)\b/i;
      const realTimeQueries = /\b(price|cijena|stock|dionice|cryptocurrency|bitcoin|eth)\b/i;

      if (currentEventKeywords.test(msg) || timeIndicators.test(msg) || realTimeQueries.test(msg)) {
        console.log('🔎 [V4-ROUTER] Current event → web_search');
        return {
          plan: {
            tool_calls: [{ name: 'web_search', args: { query: message } }],
            memory: { action: 'none' },
            response: { type: 'text' },
            confidence: 0.89,
            reason: 'Current events query (v4 pattern)',
          },
          confident: true,
        };
      }
    }
  }
  
  // 🔎 ChatGPT-level: force web_search when the question needs grounding
  // IMPORTANT: This MUST be near the end so domain-specific tools (weather/osm/etc.) win first.
  if (capabilities.web && shouldForceWebSearch(message)) {
    console.log('🔎 [V4-ROUTER] Forced web_search (grounding heuristic)');
    return {
      plan: {
        tool_calls: [{
          name: 'web_search',
          args: {
            query: String(message || '').trim(),
            mode: 'auto',
            prefer: 'auto',
            searchDepth: 'advanced',
            maxResults: 8,
            includeRawContent: 'markdown'
          }
        }],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.82,
        reason: 'Forced web_search grounding heuristic'
      },
      confident: true
    };
  }

  return null; // No domain pattern matched
}

/**
 * ⚡ TIER 4: LLM ROUTER (2-5s fallback)
 * Only called when pattern matching fails
 * This is the LAST RESORT
 */
async function llmFallbackRouter({ message, history, capabilities }) {
  console.log('🤖 [V4-ROUTER] Falling back to LLM router (patterns failed)');
  
  if (!SMART_ROUTING_ENABLED) {
    return {
      tool_calls: [],
      memory: { action: 'none' },
      response: { type: 'text' },
      confidence: 0.5,
      reason: 'Router disabled'
    };
  }
  
  // Build available tools list
  const tools = [];
  if (capabilities.movies) tools.push('movie_report');
  if (capabilities.weather) tools.push('weather_forecast');
  if (capabilities.fx) tools.push('fx_convert');
  if (capabilities.wiki) tools.push('wiki_summary', 'wikidata_lookup');
  if (capabilities.osm) tools.push('osm_geocode', 'osm_nearby');
  if (capabilities.web) tools.push('web_search');
  if (capabilities.rag) tools.push('rag_retrieve');
  if (capabilities.image) tools.push('image_generate');
  if (capabilities.wolfram) tools.push('wolfram_query');
  if (capabilities.holidays) tools.push('holidays_public');
  if (capabilities.vehicles) tools.push('vehicle_vin_decode', 'vehicle_models_for_make', 'vehicle_recalls_by_vehicle', 'vehicle_complaints_by_vehicle', 'vehicle_trims_carquery', 'vehicle_safety_ratings');
  if (capabilities.drugs) tools.push('drug_label_openfda', 'drug_interactions_rxnav');
  if (capabilities.geoapify) tools.push('geoapify_geocode', 'geoapify_places', 'geoapify_route');
  
  // Compact history for context
  const smallHistory = (history || [])
    .slice(-6)
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 200) }));
  
  const userMsg = String(message || '').trim();
  
  const schema = {
    tool_calls: "Array of tool calls. Each: { name: string, args: object }",
    memory: "{ action: 'none'|'save'|'delete'|'retrieve', content?: string }",
    response: "{ type: 'text'|'image_only'|'image_and_text' }",
    confidence: 'number 0..1',
    reason: 'short reason'
  };
  
  const system = `You are a tool-use router for a multilingual AI assistant.
Your job: decide which tools (if any) to use for the user's latest message.

Available tools: ${tools.join(', ')}

⚠️ CONSERVATIVE tool use policy — only use tools when truly needed:
- Use web_search ONLY for: fresh/current events, time-sensitive facts, news, prices, official positions, or when user explicitly requests sources/links.
- Do NOT use web_search for: formatting requests, style changes, concept explanations, coding help, or questions answerable from training knowledge.
- When in doubt about web_search → NO tools (prefer no tools over unnecessary search).

Output MUST be ONLY valid JSON matching the schema. No markdown, no extra text.`;
  
  const user = {
    latest_message: userMsg,
    recent_history: smallHistory,
    tools,
    json_schema: schema
  };
  
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(user) }
  ];
  
  try {
    const raw = await callRouterLLM(messages);
    const parsed = safeJsonParse(raw);
    
    if (!parsed) {
      return {
        tool_calls: [],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 0.3,
        reason: 'LLM router parse failed'
      };
    }
    
    return normalizePlan(parsed);
  } catch (error) {
    console.error('[V4-ROUTER] LLM router error:', error.message);
    return {
      tool_calls: [],
      memory: { action: 'none' },
      response: { type: 'text' },
      confidence: 0.2,
      reason: 'LLM router error'
    };
  }
}

/**
 * 🌍 GEO/WEATHER TOOL-FIRST ROUTER (Language-agnostic)
 * Prevents accidental web_search for weather/maps by doing a tiny multilingual intent classification.
 * Runs before domainPatternRouter and before the expensive LLM fallback.
 */
async function geoWeatherToolFirstRouter({ message, history = [], capabilities = {} }) {
  if (!message) return null;
  if (!capabilities.weather && !capabilities.osm) return null;

  // Keep context tiny to stay cheap
  const smallHistory = (history || [])
    .slice(-4)
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 160) }));

  const system = `You are a multilingual intent classifier.
Decide if the user's message is about:
- WEATHER (forecast/current conditions) -> weather_forecast
- GEO (where is X / address / coordinates / reverse geocode) -> osm_geocode
- NEARBY PLACES (near me / nearby X / closest pharmacy etc.) -> osm_nearby
Otherwise -> other

Return ONLY valid JSON:
{"tool":"weather_forecast|osm_geocode|osm_nearby|other","confidence":0..1}`;

  const user = {
    latest_message: String(message).trim().slice(0, 500),
    recent_history: smallHistory
  };

  let raw;
  try {
    raw = await callRouterLLM([
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(user) }
    ]);
  } catch (e) {
    return null;
  }

  const parsed = safeJsonParse(raw);
  if (!parsed || !parsed.tool) return null;

  const tool = String(parsed.tool || '').trim();
  const conf = Number(parsed.confidence ?? 0);
  if (!Number.isFinite(conf) || conf < 0.65) return null;

  if (tool === 'weather_forecast' && capabilities.weather) {
    return {
      plan: {
        tool_calls: [{ name: 'weather_forecast', args: { query: String(message).trim() } }],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: Math.min(0.95, Math.max(0.70, conf)),
        reason: 'Tool-first GEO/WEATHER classifier'
      },
      confident: true
    };
  }

  if ((tool === 'osm_geocode' || tool === 'osm_nearby') && capabilities.osm) {
    return {
      plan: {
        tool_calls: [{ name: tool, args: { query: String(message).trim() } }],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: Math.min(0.95, Math.max(0.70, conf)),
        reason: 'Tool-first GEO/WEATHER classifier'
      },
      confident: true
    };
  }

  return null;
}

/**
 * 🎯 MAIN ROUTER (V4)
 * Cascading pattern matching with LLM fallback
 */
async function routeRequest({ message, history = [], capabilities = {} }) {
  console.log('\n🎯 [V4-ROUTER] Starting cascading router...');
  
  // TIER 1: Instant (< 5ms)
  const instant = instantPatternRouter(message);
  if (instant) {
    console.log('✅ [V4-ROUTER] Matched TIER 1 (instant)');
    return instant.plan;
  }
  
  // TIER 2: Commands (< 10ms)
  const command = commandPatternRouter(message, capabilities);
  if (command) {
    console.log('✅ [V4-ROUTER] Matched TIER 2 (command)');
    return command.plan;
  }

  // TIER 2.5: Tool-first GEO/WEATHER (language-agnostic)
  try {
    const gw = await geoWeatherToolFirstRouter({ message, history, capabilities });
    if (gw) {
      console.log('✅ [V4-ROUTER] Matched TIER 2.5 (tool-first geo/weather)');
      return gw.plan;
    }
  } catch (e) {
    console.warn('[V4-ROUTER] geo/weather tool-first router failed:', e.message);
  }
  
  // TIER 3: Domains (< 20ms)
  const domain = domainPatternRouter(message, capabilities);
  if (domain) {
    console.log('✅ [V4-ROUTER] Matched TIER 3 (domain)');
    return domain.plan;
  }
  
  // TIER 4: LLM Fallback (2-5s)
  console.log('⚠️ [V4-ROUTER] No pattern match, using LLM fallback...');
  const llmPlan = await llmFallbackRouter({ message, history, capabilities });
  console.log('✅ [V4-ROUTER] Matched TIER 4 (LLM fallback)');
  return llmPlan;
}

// ═══════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════

async function callRouterLLM(messages) {
  const provider = ROUTER_PROVIDER || 'auto';
  
  if (provider === 'openai' || (provider === 'auto' && OPENAI_API_KEY)) {
    const model = ROUTER_MODEL_OPENAI || 'gpt-4o-mini';
    return await callOpenAIChat({
      messages,
      model,
      maxTokens: ROUTER_MAX_TOKENS || 700,
      // Router should be deterministic; it decides tool usage.
      temperature: 0
    });
  }
  
  if (provider === 'deepseek' || (provider === 'auto' && DEEPSEEK_API_KEY)) {
    const model = ROUTER_MODEL_DEEPSEEK || 'deepseek-chat';
    return await callDeepSeek({
      messages,
      model,
      maxTokens: ROUTER_MAX_TOKENS || 700,
      temperature: 0
    });
  }
  
  if (OPENROUTER_API_KEY) {
    return await callOpenRouterChat({
      messages,
      model: ROUTER_MODEL_OPENAI || 'gpt-4o-mini',
      maxTokens: ROUTER_MAX_TOKENS || 700,
      temperature: 0
    });
  }
  
  throw new Error('No router provider available');
}

function safeJsonParse(text) {
  try {
    const cleaned = String(text || '')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function normalizePlan(plan) {
  return {
    tool_calls: Array.isArray(plan.tool_calls) ? plan.tool_calls : [],
    memory: plan.memory || { action: 'none' },
    response: plan.response || { type: 'text' },
    confidence: Number(plan.confidence) || 0.5,
    reason: String(plan.reason || '').slice(0, 200)
  };
}

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

module.exports = {
  routeRequest,
  // Legacy exports for backwards compatibility
  decideToolPlan: routeRequest,
  quickHeuristicRouter: routeRequest
};
