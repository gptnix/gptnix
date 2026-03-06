'use strict';

/**
 * Centralised environment config for GPTNiX backend.
 * Keep this file "dumb": only read env vars + constants, no heavy initialisation.
 */

const QDRANT_URL = process.env.QDRANT_URL || '';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';

// Qdrant keep-alive / wake-up (managed Qdrant instances may sleep after inactivity)
const QDRANT_KEEPALIVE_ENABLED = (process.env.QDRANT_KEEPALIVE_ENABLED || 'true').toLowerCase() !== 'false';
const QDRANT_KEEPALIVE_INTERVAL_MS = Number(process.env.QDRANT_KEEPALIVE_INTERVAL_MS || 12 * 60 * 1000);
const QDRANT_WAKEUP_MAX_RETRIES = Number(process.env.QDRANT_WAKEUP_MAX_RETRIES || 8);
const QDRANT_WAKEUP_RETRY_BASE_MS = Number(process.env.QDRANT_WAKEUP_RETRY_BASE_MS || 1500);
const QDRANT_AUTO_ENSURE_COLLECTIONS = (process.env.QDRANT_AUTO_ENSURE_COLLECTIONS || 'true').toLowerCase() !== 'false';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// OpenRouter (OpenAI-compatible aggregator)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_API_BASE = process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1';

// Geoapify (geocoding/places/routing)
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || '';
const GEOAPIFY_API_BASE = process.env.GEOAPIFY_API_BASE || 'https://api.geoapify.com';

// Image generation (Replicate)
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || '';
// Backwards-compat: older deployments may set REPLICATE_VERSION.
// This can be either a Replicate *version hash* or a model slug (owner/model).
const REPLICATE_VERSION = process.env.REPLICATE_VERSION || 'minimax/image-01';

// Prefer these going forward (model slugs). If unset, we fall back to REPLICATE_VERSION.
const REPLICATE_MODEL_QUALITY = process.env.REPLICATE_MODEL_QUALITY || 'minimax/image-01';
const REPLICATE_MODEL_FAST = process.env.REPLICATE_MODEL_FAST || 'minimax/image-01';
const IMAGEGEN_DEFAULT_PRESET = process.env.IMAGEGEN_DEFAULT_PRESET || 'quality'; // quality|balanced|fast

// Translation (prompt → English)
const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || 'gpt-4o-mini';

// Voice (TTS/STT)
const VOICE_TTS_MODEL = process.env.VOICE_TTS_MODEL || 'gpt-4o-mini-tts';
// Default voice: prefer a clearly "male" voice out of the box.
// You can still override via VOICE_TTS_VOICE.
const VOICE_TTS_VOICE = process.env.VOICE_TTS_VOICE || 'onyx';
const VOICE_TTS_FORMAT = process.env.VOICE_TTS_FORMAT || 'mp3';
const VOICE_TTS_SPEED = Number(process.env.VOICE_TTS_SPEED || 1);
// Default to the most broadly available STT model.
// You can opt into newer snapshots via VOICE_STT_MODEL (e.g. gpt-4o-transcribe).
const VOICE_STT_MODEL = process.env.VOICE_STT_MODEL || 'whisper-1';
// For voice chat we prefer *speed* by default: return audioBase64 directly.
// If you want Firebase Storage URLs, set VOICE_PERSIST_DEFAULT=true.
const VOICE_PERSIST_DEFAULT = (process.env.VOICE_PERSIST_DEFAULT || 'false').toLowerCase() !== 'false';

// Web search
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const TAVILY_API_BASE = process.env.TAVILY_API_BASE || 'https://api.tavily.com';

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
const SERPER_API_BASE = process.env.SERPER_API_BASE || 'https://google.serper.dev';
// Global defaults (override via env for localization)
const SERPER_DEFAULT_GL = process.env.SERPER_DEFAULT_GL || 'us';
const SERPER_DEFAULT_HL = process.env.SERPER_DEFAULT_HL || 'en';

// Wolfram|Alpha (optional, but very powerful general compute/knowledge)
const WOLFRAM_APP_ID = process.env.WOLFRAM_APP_ID || '';

// Movies / TV metadata
// TMDB: use a v4 "Read Access Token" as Bearer (works with v3 endpoints too)
// NOTE: People sometimes paste the v4 token into TMDB_API_KEY by mistake.
// We normalize + auto-detect to make TMDB actually work.
function _trim(v) {
  return String(v || '').trim();
}

function _stripBearerPrefix(v) {
  const s = _trim(v);
  return s.replace(/^bearer\s+/i, '').trim();
}

function _looksLikeJwt(v) {
  const s = _trim(v);
  // JWTs usually start with eyJ and have at least two '.' separators.
  if (!s) return false;
  const dotCount = (s.match(/\./g) || []).length;
  return s.length >= 40 && dotCount >= 2 && s.startsWith('eyJ');
}

let TMDB_BEARER_TOKEN = _stripBearerPrefix(process.env.TMDB_BEARER_TOKEN || '');

// TMDB v3 API key (query param). Many deployments only have this.
// Supported env aliases: TMDB_API_KEY | TMDB_V3_API_KEY | TMDB_KEY
let TMDB_API_KEY = _trim(
  process.env.TMDB_API_KEY ||
  process.env.TMDB_V3_API_KEY ||
  process.env.TMDB_KEY ||
  ''
);

// If the API key looks like a JWT, treat it as Bearer token automatically.
if (!TMDB_BEARER_TOKEN && TMDB_API_KEY && _looksLikeJwt(TMDB_API_KEY)) {
  TMDB_BEARER_TOKEN = _stripBearerPrefix(TMDB_API_KEY);
  TMDB_API_KEY = '';
}
const TMDB_API_BASE = process.env.TMDB_API_BASE || 'https://api.themoviedb.org/3';

// OMDb (fallback / complementary ratings & imdb fields)
// Supported env aliases: OMDB_API_KEY | OMDB_KEY
const OMDB_API_KEY = _trim(process.env.OMDB_API_KEY || process.env.OMDB_KEY || '');
const OMDB_API_BASE = process.env.OMDB_API_BASE || 'https://www.omdbapi.com';

// ScrapeDev (optional) — deep page fetch for richer excerpts (use sparingly to control cost)
const SCRAPEDEV_TOKEN = process.env.SCRAPEDEV_TOKEN || '';
const SCRAPEDEV_API_BASE = process.env.SCRAPEDEV_API_BASE || 'https://api.scrapedev.com/scrape';

// OpenStreetMap (free, no key)
// Nominatim usage policy recommends a proper User-Agent.
const OSM_USER_AGENT = process.env.OSM_USER_AGENT || 'gptnix-backend';
// Strongly recommended: real contact email / URL for Nominatim & Overpass usage policy.
// Set one (or both):
// - OSM_CONTACT_EMAIL (alias: OSM_NOMINATIM_EMAIL)
// - OSM_CONTACT_URL   (alias: OSM_REFERER)
const OSM_CONTACT_EMAIL = process.env.OSM_CONTACT_EMAIL || process.env.OSM_NOMINATIM_EMAIL || '';
const OSM_CONTACT_URL = process.env.OSM_CONTACT_URL || process.env.OSM_REFERER || '';
const OSM_NOMINATIM_BASE = process.env.OSM_NOMINATIM_BASE || 'https://nominatim.openstreetmap.org';
// Most public Overpass endpoints expose /api/interpreter
const OSM_OVERPASS_BASE = process.env.OSM_OVERPASS_BASE || 'https://overpass-api.de/api/interpreter';
const OSM_TIMEOUT_MS = Number(process.env.OSM_TIMEOUT_MS || 9000);

// Wikipedia / MediaWiki
const WIKI_USER_AGENT = process.env.WIKI_USER_AGENT || 'gptnix-backend';
const WIKI_TIMEOUT_MS = Number(process.env.WIKI_TIMEOUT_MS || '6500');

// Weather providers
// OpenWeather (optional, requires API key)
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const OPENWEATHER_API_BASE = process.env.OPENWEATHER_API_BASE || 'https://api.openweathermap.org';
const OPENWEATHER_TIMEOUT_MS = Number(process.env.OPENWEATHER_TIMEOUT_MS || 9000);

// MET Norway (yr.no) Locationforecast (no key, but strict User-Agent policy)
const METNO_USER_AGENT = process.env.METNO_USER_AGENT || process.env.WEATHER_USER_AGENT || '';
const METNO_LOCATIONFORECAST_BASE =
  process.env.METNO_LOCATIONFORECAST_BASE || 'https://api.met.no/weatherapi/locationforecast/2.0';
const METNO_TIMEOUT_MS = Number(process.env.METNO_TIMEOUT_MS || 9000);

const WEBSEARCH_DEFAULT_MAX_RESULTS = Number(process.env.WEBSEARCH_DEFAULT_MAX_RESULTS || 5);
const WEBSEARCH_DEFAULT_MODE = process.env.WEBSEARCH_DEFAULT_MODE || 'auto'; // auto|general|news
const WEBSEARCH_TIMEOUT_MS = Number(process.env.WEBSEARCH_TIMEOUT_MS || 12000);
const WEBSEARCH_CONTEXT_CHARS = Number(process.env.WEBSEARCH_CONTEXT_CHARS || 2200); // injected into chat prompt
// Web search -> Vision/OCR over images (Tavily/Serper images)
// Modes: off | auto | on
const WEBSEARCH_VISION_DEFAULT = (process.env.WEBSEARCH_VISION_DEFAULT || 'auto').toLowerCase();
const WEBSEARCH_VISION_MODEL = process.env.WEBSEARCH_VISION_MODEL || process.env.TRANSLATE_MODEL || 'gpt-4o-mini';
const WEBSEARCH_VISION_MAX_IMAGES = Number(process.env.WEBSEARCH_VISION_MAX_IMAGES || 3);
const WEBSEARCH_VISION_TIMEOUT_MS = Number(process.env.WEBSEARCH_VISION_TIMEOUT_MS || 15000);

// When true, Vision/OCR over web images is only allowed when:
// - query strongly implies the user wants text from an image (OCR), OR
// - query matches flyer/menu/schedule/price-list heuristics.
// This prevents accidental spending and hallucination.
const WEBSEARCH_VISION_STRICT_GUARD = (process.env.WEBSEARCH_VISION_STRICT_GUARD || 'true').toLowerCase() !== 'false';

// Websearch reranking
const WEBSEARCH_RERANK_ENABLE = (process.env.WEBSEARCH_RERANK_ENABLE || 'true').toLowerCase() !== 'false';
const WEBSEARCH_FRESHNESS_ENABLE = (process.env.WEBSEARCH_FRESHNESS_ENABLE || 'true').toLowerCase() !== 'false';
// JSON: { "boost": ["domain"...], "penalize": ["domain"...] }
const WEBSEARCH_TRUST_CONFIG_JSON = process.env.WEBSEARCH_TRUST_CONFIG_JSON || '';

// Web search strictness (anti-hallucination)
// When true, the assistant MUST cite web results for factual claims and must NOT claim to have searched unless tool results are present.
const WEB_STRICT_MODE = (process.env.WEB_STRICT_MODE || "true").toLowerCase() !== "false";
// When true, auto-append the current year to web search queries that ask for "this year / today / latest" but do not include a year.
const WEB_QUERY_YEAR_AUGMENT = (process.env.WEB_QUERY_YEAR_AUGMENT || "true").toLowerCase() !== "false";
// When true and a web search is used, prefer non-stream generation internally even if the client requested streaming.
const WEB_STRICT_NONSTREAM_ON_WEB = (process.env.WEB_STRICT_NONSTREAM_ON_WEB || "true").toLowerCase() !== "false";

// Web query rewrite (improves weak queries like "sahrana" by inferring intent + adding entities/keywords)
// Enabled by default. Uses a small LLM pass only for short/ambiguous or special intents (e.g., obituaries).
const WEB_QUERY_REWRITE_ENABLED = (process.env.WEB_QUERY_REWRITE_ENABLED || 'true').toLowerCase() !== 'false';
const WEB_QUERY_REWRITE_MODEL = process.env.WEB_QUERY_REWRITE_MODEL || 'deepseek-chat';

// ─────────────────────────────────────────
// Streaming defaults (ChatGPT-like UX)
// ─────────────────────────────────────────
// Default stream ON unless client explicitly sends stream=false
const DEFAULT_STREAM = (process.env.DEFAULT_STREAM || 'true').toLowerCase() !== 'false';
// Latency budget: max time for pre-LLM operations (memory + semantic filter + router + tools)
const STREAM_LATENCY_BUDGET_MS = Number(process.env.STREAM_LATENCY_BUDGET_MS || 800);
// Memory timeout: Increased to 5000ms (Qdrant + OpenAI embeddings can take 3-4s)
const MEMORY_TIMEOUT_STREAM_MS = Number(process.env.MEMORY_TIMEOUT_STREAM_MS || 5000);
const SEMANTIC_FILTER_STREAM_MS = Number(process.env.SEMANTIC_FILTER_STREAM_MS || 200);

// ─────────────────────────────────────────
// Accuracy guard (anti-hallucination)
// Enabled by default: forces extra grounding for high-risk factual queries and runs a verify+rewrite pass.
// ─────────────────────────────────────────
const ACCURACY_GUARD_ENABLED = (process.env.ACCURACY_GUARD_ENABLED || 'true').toLowerCase() !== 'false';
const ACCURACY_GUARD_FORCE_TOOLS = (process.env.ACCURACY_GUARD_FORCE_TOOLS || 'true').toLowerCase() !== 'false';
const ACCURACY_GUARD_VERIFY_PASS = (process.env.ACCURACY_GUARD_VERIFY_PASS || 'true').toLowerCase() !== 'false';
// When true, if request is high-risk we will not token-stream; we will generate+verify and then emit once.
// OPTIMIZED: Only block stream for HIGH risk, not medium/low
const ACCURACY_GUARD_NONSTREAM_ON_HIGH_RISK = (process.env.ACCURACY_GUARD_NONSTREAM_ON_HIGH_RISK || 'true').toLowerCase() !== 'false';
// Verifier provider:
// - auto    : prefer OpenAI if available, else DeepSeek
// - openai  : always use OpenAI for verifier pass
// - deepseek: always use DeepSeek for verifier pass
const ACCURACY_GUARD_VERIFIER_PROVIDER = (process.env.ACCURACY_GUARD_VERIFIER_PROVIDER || 'auto').toLowerCase();

// DeepSeek verifier model (when provider=deepseek)
const ACCURACY_GUARD_VERIFIER_MODEL = process.env.ACCURACY_GUARD_VERIFIER_MODEL || 'deepseek-reasoner';

// OpenAI verifier model (when provider=openai)
const ACCURACY_GUARD_VERIFIER_OPENAI_MODEL = process.env.ACCURACY_GUARD_VERIFIER_OPENAI_MODEL || 'gpt-4o-mini';
const ACCURACY_GUARD_MAX_TOKENS = Number(process.env.ACCURACY_GUARD_MAX_TOKENS || 900);
// Verifier runs async (fire-and-forget) after stream completes, unless HIGH risk
const ACCURACY_GUARD_ASYNC_VERIFY = (process.env.ACCURACY_GUARD_ASYNC_VERIFY || 'true').toLowerCase() !== 'false';

// ─────────────────────────────────────────
// Router Performance Optimizations
// ─────────────────────────────────────────
// Quick heuristic router: instant pattern matching before LLM (< 50ms vs 3-7s)
const QUICK_HEURISTIC_ROUTER = (process.env.QUICK_HEURISTIC_ROUTER || 'true').toLowerCase() !== 'false';
// Router timeout: max time for LLM router decision (ms) - prevents 7s+ hangs
// Router timeout (ms)
// Tool-first geo/weather routing can occasionally take slightly over 3s depending on model latency.
// Default to 6000ms to avoid false router_timeouts that may trigger unwanted web-search fallbacks.
const ROUTER_TIMEOUT_MS = Number(process.env.ROUTER_TIMEOUT_MS || 6000);
// Tools execution timeout: max time for ALL tools combined (ms) - prevents tools from blocking stream
const TOOLS_TOTAL_TIMEOUT_MS = Number(process.env.TOOLS_TOTAL_TIMEOUT_MS || 8000);

// LLM fallback policy (DeepSeek-only by default). If disabled, the backend will not silently switch to OpenAI/OpenRouter.
const LLM_FALLBACK_ENABLED = (process.env.LLM_FALLBACK_ENABLED || 'false').toLowerCase() === 'true';


// Smart routing (tool-use planner)
// If disabled, /chat behaves like a normal chat endpoint with optional RAG/memory.
const SMART_ROUTING_ENABLED = (process.env.SMART_ROUTING_ENABLED || 'true').toLowerCase() !== 'false';

// Router can use OpenAI (recommended) or DeepSeek. "auto" = OpenAI if available else DeepSeek.
const ROUTER_PROVIDER = (process.env.ROUTER_PROVIDER || 'auto').toLowerCase(); // auto|openai|deepseek|openrouter
const ROUTER_MODEL_OPENAI = process.env.ROUTER_MODEL_OPENAI || 'gpt-4o-mini';
const ROUTER_MODEL_DEEPSEEK = process.env.ROUTER_MODEL_DEEPSEEK || 'deepseek-chat';
const ROUTER_MAX_TOKENS = Number(process.env.ROUTER_MAX_TOKENS || 700);
const ROUTER_STRICT_JSON = (process.env.ROUTER_STRICT_JSON || 'true').toLowerCase() !== 'false';
const ROUTER_CONFIDENCE_THRESHOLD = Number(process.env.ROUTER_CONFIDENCE_THRESHOLD || 0.5);

// Running thread summary (helps multi-turn coherence for models that drift)
const THREAD_SUMMARY_ENABLED = (process.env.THREAD_SUMMARY_ENABLED || 'true').toLowerCase() !== 'false';

// ─────────────────────────────────────────
// Background assistant (GPT-4o-mini)
// - Runs a cheap internal pass to keep the main model consistent
// - Safe to enable: it is a NO-OP without OPENAI_API_KEY
// ─────────────────────────────────────────
const BACKGROUND_ASSISTANT_ENABLED = (process.env.BACKGROUND_ASSISTANT_ENABLED || 'true').toLowerCase() !== 'false';
const BACKGROUND_ASSISTANT_MODEL = process.env.BACKGROUND_ASSISTANT_MODEL || 'gpt-4o-mini';
const BACKGROUND_ASSISTANT_MAX_TOKENS = Number(process.env.BACKGROUND_ASSISTANT_MAX_TOKENS || 260);
const BACKGROUND_ASSISTANT_TIMEOUT_MS = Number(process.env.BACKGROUND_ASSISTANT_TIMEOUT_MS || 900);
const BACKGROUND_ASSISTANT_MIN_CHARS = Number(process.env.BACKGROUND_ASSISTANT_MIN_CHARS || 24);

// ─────────────────────────────────────────
// Observability & Metrics (V3)
// ─────────────────────────────────────────
// Enable structured JSON logging for metrics (verifier_change_rate, latency, cost)
const OBSERVABILITY_ENABLED = (process.env.OBSERVABILITY_ENABLED || 'true').toLowerCase() !== 'false';

// Memory extraction model/provider (semantic memory into Qdrant)
// provider: auto|openai|deepseek
const MEMORY_EXTRACT_PROVIDER = (process.env.MEMORY_EXTRACT_PROVIDER || 'auto').toLowerCase();
const MEMORY_EXTRACT_MODEL = process.env.MEMORY_EXTRACT_MODEL || 'gpt-4o-mini';
const MEMORY_EXTRACT_MAX_TOKENS = Number(process.env.MEMORY_EXTRACT_MAX_TOKENS || 900);

// Web locale defaults should be global (not hardcoded to a specific country/language).
// You can override via env or pass serperGl/serperHl per-request.
// NOTE: previous defaults were region/language-specific.

// Storage
const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || '';

// Firestore collections (override if your FlutterFlow schema uses different names)
const CONVERSATIONS_COLLECTION = process.env.CONVERSATIONS_COLLECTION || 'conversations';

const PORT = process.env.PORT || 8080;

// Time / date context (used in system prompt)
// IMPORTANT: Keep global defaults; do not hardcode to any specific city.
// You may override these per deployment or per request (timeInfo from client).
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Europe/Sarajevo'; // e.g. Europe/Sarajevo
const DEFAULT_LOCALE = process.env.DEFAULT_LOCALE || 'hr-HR'; // e.g. hr-HR
// Optional: force "now" for deterministic testing/debugging.
// Example: FIXED_NOW_ISO=2025-12-21T09:15:00+01:00
const FIXED_NOW_ISO = process.env.FIXED_NOW_ISO || '';
// Safety: only honor FIXED_NOW_ISO when explicitly enabled (prevents stale production time)
const ALLOW_FIXED_NOW = String(process.env.ALLOW_FIXED_NOW || '').toLowerCase() === 'true';

// Qdrant collections
const COLLECTION_NAME = 'user_memories';
const RAG_COLLECTION = 'gptnix_rag';

function logEnvironment() {
  console.log('🔧 Environment check:');
  console.log('- QDRANT_URL:', QDRANT_URL ? 'Set' : 'Missing');
  console.log('- QDRANT_API_KEY:', QDRANT_API_KEY ? 'Set' : 'Missing');
  console.log('- DEEPSEEK_API_KEY:', DEEPSEEK_API_KEY ? 'Set' : 'Missing');
  console.log('- OPENAI_API_KEY:', OPENAI_API_KEY ? 'Set' : 'Missing');
  console.log('- BACKGROUND_ASSISTANT_ENABLED:', BACKGROUND_ASSISTANT_ENABLED);
  console.log('- BACKGROUND_ASSISTANT_MODEL:', BACKGROUND_ASSISTANT_MODEL);
  console.log('- OBSERVABILITY_ENABLED:', OBSERVABILITY_ENABLED);
  console.log('- MEMORY_EXTRACT_PROVIDER:', MEMORY_EXTRACT_PROVIDER);
  console.log('- MEMORY_EXTRACT_MODEL:', MEMORY_EXTRACT_MODEL);
  console.log('- REPLICATE_API_TOKEN:', REPLICATE_API_TOKEN ? 'Set' : 'Missing');
  console.log('- REPLICATE_VERSION:', REPLICATE_VERSION);
  console.log('- REPLICATE_MODEL_QUALITY:', REPLICATE_MODEL_QUALITY);
  console.log('- REPLICATE_MODEL_FAST:', REPLICATE_MODEL_FAST);
  console.log('- IMAGEGEN_DEFAULT_PRESET:', IMAGEGEN_DEFAULT_PRESET);
  console.log('- TRANSLATE_MODEL:', TRANSLATE_MODEL);
  console.log('- VOICE_TTS_MODEL:', VOICE_TTS_MODEL);
  console.log('- VOICE_TTS_VOICE:', VOICE_TTS_VOICE);
  console.log('- VOICE_STT_MODEL:', VOICE_STT_MODEL);
  console.log('- TAVILY_API_KEY:', TAVILY_API_KEY ? 'Set' : 'Missing');
  console.log('- SERPER_API_KEY:', SERPER_API_KEY ? 'Set' : 'Missing');
  console.log('- TMDB_BEARER_TOKEN:', TMDB_BEARER_TOKEN ? 'Set' : 'Missing');
  console.log('- TMDB_API_KEY:', TMDB_API_KEY ? 'Set' : 'Missing');
  console.log('- OMDB_API_KEY:', OMDB_API_KEY ? 'Set' : 'Missing');
  console.log('- SCRAPEDEV_TOKEN:', SCRAPEDEV_TOKEN ? 'Set' : 'Missing');
  console.log('- WOLFRAM_APP_ID:', WOLFRAM_APP_ID ? 'Set' : 'Missing');
  console.log('- ACCURACY_GUARD_VERIFIER_PROVIDER:', ACCURACY_GUARD_VERIFIER_PROVIDER);
  console.log('- ACCURACY_GUARD_VERIFIER_MODEL (deepseek):', ACCURACY_GUARD_VERIFIER_MODEL);
  console.log('- ACCURACY_GUARD_VERIFIER_OPENAI_MODEL:', ACCURACY_GUARD_VERIFIER_OPENAI_MODEL);
  console.log('- OPENWEATHER_API_KEY:', OPENWEATHER_API_KEY ? 'Set' : 'Missing');
  console.log('- OPENWEATHER_API_BASE:', OPENWEATHER_API_BASE);
  console.log('- METNO_USER_AGENT:', METNO_USER_AGENT ? 'Set' : 'Missing');
  console.log('- METNO_LOCATIONFORECAST_BASE:', METNO_LOCATIONFORECAST_BASE);
  console.log('- OSM_USER_AGENT:', OSM_USER_AGENT);
  console.log('- OSM_CONTACT_EMAIL:', OSM_CONTACT_EMAIL ? 'Set' : 'Missing');
  console.log('- OSM_CONTACT_URL:', OSM_CONTACT_URL ? 'Set' : 'Missing');
  console.log('- OSM_NOMINATIM_BASE:', OSM_NOMINATIM_BASE);
  console.log('- OSM_OVERPASS_BASE:', OSM_OVERPASS_BASE);
  console.log('- PORT:', PORT);
  console.log('- CONVERSATIONS_COLLECTION:', CONVERSATIONS_COLLECTION);
}

module.exports = {
  QDRANT_URL,
  QDRANT_API_KEY,
  QDRANT_AUTO_ENSURE_COLLECTIONS,
  QDRANT_WAKEUP_RETRY_BASE_MS,
  QDRANT_WAKEUP_MAX_RETRIES,
  QDRANT_KEEPALIVE_INTERVAL_MS,
  QDRANT_KEEPALIVE_ENABLED,
  DEEPSEEK_API_KEY,
  OPENAI_API_KEY,
  OPENROUTER_API_KEY,
  OPENROUTER_API_BASE,
  GEOAPIFY_API_KEY,
  GEOAPIFY_API_BASE,
  REPLICATE_API_TOKEN,
  REPLICATE_VERSION,
  REPLICATE_MODEL_QUALITY,
  REPLICATE_MODEL_FAST,
  IMAGEGEN_DEFAULT_PRESET,
  TRANSLATE_MODEL,
  VOICE_TTS_MODEL,
  VOICE_TTS_VOICE,
  VOICE_TTS_FORMAT,
  VOICE_TTS_SPEED,
  VOICE_STT_MODEL,
  VOICE_PERSIST_DEFAULT,
  FIREBASE_STORAGE_BUCKET,
  CONVERSATIONS_COLLECTION,

  TAVILY_API_KEY,
  TAVILY_API_BASE,
  SERPER_API_KEY,
  SERPER_API_BASE,
  SERPER_DEFAULT_GL,
  SERPER_DEFAULT_HL,
  WOLFRAM_APP_ID,

  TMDB_BEARER_TOKEN,
  TMDB_API_KEY,
  TMDB_API_BASE,
  OMDB_API_KEY,
  OMDB_API_BASE,

  SCRAPEDEV_TOKEN,
  SCRAPEDEV_API_BASE,
  WIKI_USER_AGENT,
  WIKI_TIMEOUT_MS,

  OPENWEATHER_API_KEY,
  OPENWEATHER_API_BASE,
  OPENWEATHER_TIMEOUT_MS,
  METNO_USER_AGENT,
  METNO_LOCATIONFORECAST_BASE,
  METNO_TIMEOUT_MS,

  OSM_USER_AGENT,
  OSM_CONTACT_EMAIL,
  OSM_CONTACT_URL,
  OSM_NOMINATIM_BASE,
  OSM_OVERPASS_BASE,
  OSM_TIMEOUT_MS,
  WEBSEARCH_DEFAULT_MAX_RESULTS,
  WEBSEARCH_DEFAULT_MODE,
  WEBSEARCH_TIMEOUT_MS,
  WEBSEARCH_CONTEXT_CHARS,
  WEBSEARCH_VISION_DEFAULT,
  WEBSEARCH_VISION_MODEL,
  WEBSEARCH_VISION_MAX_IMAGES,
  WEBSEARCH_VISION_TIMEOUT_MS,
  WEBSEARCH_VISION_STRICT_GUARD,
  WEBSEARCH_RERANK_ENABLE,
  WEBSEARCH_FRESHNESS_ENABLE,
  WEBSEARCH_TRUST_CONFIG_JSON,
  WEB_STRICT_MODE,
  WEB_QUERY_YEAR_AUGMENT,
  WEB_STRICT_NONSTREAM_ON_WEB,
  WEB_QUERY_REWRITE_ENABLED,
  WEB_QUERY_REWRITE_MODEL,

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

  LLM_FALLBACK_ENABLED,

  QUICK_HEURISTIC_ROUTER,
  ROUTER_TIMEOUT_MS,
  TOOLS_TOTAL_TIMEOUT_MS,

  SMART_ROUTING_ENABLED,
  ROUTER_PROVIDER,
  ROUTER_MODEL_OPENAI,
  ROUTER_MODEL_DEEPSEEK,
  ROUTER_MAX_TOKENS,
  ROUTER_STRICT_JSON,
  ROUTER_CONFIDENCE_THRESHOLD,

  THREAD_SUMMARY_ENABLED,

  BACKGROUND_ASSISTANT_ENABLED,
  BACKGROUND_ASSISTANT_MODEL,
  BACKGROUND_ASSISTANT_MAX_TOKENS,
  BACKGROUND_ASSISTANT_TIMEOUT_MS,
  BACKGROUND_ASSISTANT_MIN_CHARS,
  OBSERVABILITY_ENABLED,

  MEMORY_EXTRACT_PROVIDER,
  MEMORY_EXTRACT_MODEL,
  MEMORY_EXTRACT_MAX_TOKENS,

  DEFAULT_TIMEZONE,
  DEFAULT_LOCALE,
  FIXED_NOW_ISO,
  ALLOW_FIXED_NOW,

  PORT,
  COLLECTION_NAME,
  RAG_COLLECTION,
  logEnvironment,
};