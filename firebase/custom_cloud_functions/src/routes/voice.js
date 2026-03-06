'use strict';

const express = require('express');
const multer = require('multer');

const {
  SMART_ROUTING_ENABLED,
  THREAD_SUMMARY_ENABLED,
  TAVILY_API_KEY,
  SERPER_API_KEY,
  WEB_STRICT_MODE,
  WEB_QUERY_YEAR_AUGMENT,
  OPENAI_API_KEY,
  VOICE_PERSIST_DEFAULT,
} = require('../config/env');

const { isRateLimited } = require('../middleware/rateLimit');
const { getConversationHistory, getDefaultSystemPrompt } = require('../services/conversation');
const { getThreadSummary, updateThreadSummary } = require('../services/threadSummary');
const {
  retrieveFromQdrant,
  hardDeleteMemoriesByInstruction,
  saveMemoryFromInstruction,
  extractSemanticMemory,
} = require('../services/memory');
const { filterRelevantHistory } = require('../services/historyFilter');
const { qdrantEnabled } = require('../clients/qdrant');
const { replicateEnabled } = require('../clients/replicate');
const { decideToolPlan } = require('../services/smartRouter');
const { ragContextForChat } = require('../services/rag');
const { webSearch, makeWebContextBlock } = require('../services/websearch');
const { planWebQuery } = require('../services/webQueryPlanner');
const { extractUrls } = require('../utils/url');
const { readProvidedUrlsAsResults } = require('../services/websearch/reader');
const { translateToEnglish } = require('../services/translate');
const { getUserPersonalization } = require('../services/personalization');
const { pickLanguage } = require('../services/language');
const { buildFluxPrompt } = require('../services/fluxPrompt');
const { generateImageWithReplicate } = require('../services/imageGen');
const { persistGeneratedImages } = require('../services/imagePersistence');
const { buildTimeContext } = require('../utils/time');
const { callDeepSeek } = require('../services/providers/deepseek');
const { callOpenAIChat } = require('../services/providers/openaiChat');
const { persistVoiceAudio } = require('../services/voicePersistence');
const { transcribeAudioBuffer, synthesizeSpeech } = require('../services/voice');
const {
  getVoiceProfile,
  updateVoiceProfile,
  guessLanguageFromText,
  pickPreferredLanguage,
  pickMaleVoice,
  pickTtsSpeed,
  buildVoiceProfilePrompt,
  inferVoiceStyleFromText,
} = require('../services/voiceProfile');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // 25MB is plenty for short VAD clips; avoid accidental huge uploads
    fileSize: 25 * 1024 * 1024,
  },
});

function isExplicitImageRequest(userText = '') {
  const t = String(userText).toLowerCase();
  const hasImageNoun = /(image|picture|photo|render|illustration|slika|fotka|fotografija|ikona|logo)/.test(t);
  const hasActionVerb = /(generate|create|make|draw|render|illustrate|edit|change|modify|remove|add|replace|upscale|enhance|generiraj|napravi|izradi|nacrtaj|prikazi|obradi|promijeni|dodaj|ukloni|zamijeni)/.test(
    t,
  );
  return hasImageNoun && hasActionVerb;
}

function _normTextForDedupe(s) {
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

function _messageWantsFreshInfo(userText) {
  const t = String(userText || '').toLowerCase();
  return /(danas|sutra|ovaj tjedan|ovog tjedna|ovaj mjesec|ove godine|ovogodi|najnov|trenutno|sad|this year|today|this week|latest|current)/i.test(
    t,
  );
}

function _normalizeLangCode(code) {
  const raw = String(code || '').trim().toLowerCase();
  if (!raw) return '';

  // accept BCP-47: hr-HR → hr
  const base = raw.split(/[-_]/)[0];

  // Normalize regional variants that are effectively the same output language for GPTNiX.
  if (['hr', 'bs', 'sr', 'sh'].includes(base)) return 'hr';
  return base;
}

function _languageInstruction(lang) {
  const l = _normalizeLangCode(lang);
  if (!l) return 'Reply in the same language the user is speaking.';
  if (l === 'hr') return 'Odgovaraj isključivo na hrvatskom jeziku.';
  if (l === 'en') return 'Reply in English.';
  if (l === 'de') return 'Antworte auf Deutsch.';
  if (l === 'it') return 'Rispondi in italiano.';
  if (l === 'es') return 'Responde en español.';
  if (l === 'fr') return 'Réponds en français.';
  return `Reply in ${l}.`;
}

function _buildVoiceFastSystemBlock({ preferredLang, detectedLang, uiLanguageHint, timeCtx, voiceProfilePrompt }) {
  const lang =
    _normalizeLangCode(preferredLang) ||
    _normalizeLangCode(detectedLang) ||
    _normalizeLangCode(uiLanguageHint) ||
    'en';

  const li = _languageInstruction(lang);

  const timeLine = timeCtx
    ? `
TIME CONTEXT (local): today=${timeCtx.localDate || ''}, now=${timeCtx.localHuman || ''}${timeCtx.offsetName ? ` (${timeCtx.offsetName})` : ''}`
    : '';

  const vp = voiceProfilePrompt && String(voiceProfilePrompt).trim()
    ? `

VOICE PROFILE (internal, adapt to the user):
${String(voiceProfilePrompt).trim()}`
    : '';

  return `You are GPTNiX Voice, a helpful assistant in a voice conversation.
${li}${timeLine}

RULES:
- Be concise and conversational.
- DO NOT mention web search or browsing.
- If you are unsure, ask a short clarifying question.
- Prefer short sentences suitable for speech.${vp}`;
}


function _isOpenAIChatModel(model) {
  const m = String(model || '').trim().toLowerCase();
  if (!m) return false;

  // Exclude non-chat models commonly used in this backend
  if (
    m.includes('whisper') ||
    m.includes('transcribe') ||
    m.includes('tts') ||
    m.includes('embedding') ||
    m.includes('audio')
  ) {
    return false;
  }

  // Accept OpenAI chat model families
  if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3')) return true;

  return false;
}

function _isDeepSeekChatModel(model) {
  const m = String(model || '').trim().toLowerCase();
  if (!m) return false;
  return m.includes('deepseek');
}


function _setSseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

function _sseSend(res, event, payload) {
  try {
    const data = JSON.stringify(payload ?? {});
    if (event) res.write(`event: ${event}
`);
    res.write(`data: ${data}

`);
  } catch (e) {
    // last resort
    try {
      if (event) res.write(`event: ${event}
`);
      res.write(`data: {}

`);
    } catch (_) {}
  }
}

function _extractTtsChunk(buf) {
  let buffer = String(buf || '');
  if (!buffer.trim()) return null;

  const MIN = 80;
  const MAX = 240;
  if (buffer.length < MIN) return null;

  const window = buffer.slice(0, MAX);
  let cut = Math.max(window.lastIndexOf('.'), window.lastIndexOf('!'), window.lastIndexOf('?'), window.lastIndexOf('\n'));

  // If no good punctuation boundary, fall back to whitespace near MAX once buffer is large.
  if (cut < MIN - 1) {
    if (buffer.length < MAX) return null;
    cut = window.lastIndexOf(' ');
    if (cut < MIN - 1) cut = MAX - 1;
  }

  const chunk = buffer.slice(0, cut + 1).trim();
  const rest = buffer.slice(cut + 1).trimStart();
  if (!chunk) return null;
  return { chunk, rest };
}

async function _streamDeepSeekDeltas({ messages, model, temperature = 0.6, maxTokens = 900, onDelta, signal }) {
  const url = 'https://api.deepseek.com/v1/chat/completions';
  const payload = {
    model,
    messages,
    temperature,
    stream: true,
    max_tokens: maxTokens,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || ''}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    const err = new Error(`DeepSeek stream error ${resp.status}`);
    err.status = resp.status;
    err.body = t;
    throw err;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process full lines
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);

      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === '[DONE]') return;

      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) onDelta?.(delta);
      } catch (_) {
        // ignore
      }
    }
  }
}


function createVoiceRouter() {
  const router = express.Router();

  // POST /voice/chat
  // multipart/form-data:
  // - audio: file (wav)
  // - userId, conversationId, model, languageHint: clientLanguageHint, returnAudio
  router.post('/chat', upload.single('audio'), async (req, res) => {
    const startTime = Date.now();

    try {
      const file = req.file;
      const {
        userId,
        conversationId,
        model,
        languageHint: clientLanguageHint,
        returnAudio = 'true',
        // Voice optimizations
        // - fastMode (default true): disables web/rag/image/router+semantic filtering for speed.
        // - persistAudio: overrides VOICE_PERSIST_DEFAULT (default false in env.js).
        fastMode = 'true',
        persistAudio,
        ttsVoice,
        ttsFormat,
        ttsSpeed,
        timeInfo,
        // Optional flags (safe defaults)
        useWebSearch = false,
        webSearchMode,
        webMaxResults,
        webTimeRange,
        webSearchDepth,
        webPrefer,
        webIncludeRawContent = false,
      } = req.body || {};
      const requestId = (req.headers['x-request-id'] || req.headers['x-requestid'] || '').toString().trim() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const billingUserId = userId ? String(userId).trim() : 'guest';
      const audioDurationSec = (() => {
        const v = req.body?.audioDurationSec ?? req.body?.durationSec ?? req.body?.durationSeconds ?? req.body?.duration ?? null;
        const n = v != null && String(v).trim() ? Number(v) : null;
        return (n != null && Number.isFinite(n) && n > 0) ? n : null;
      })();


    // PERSONALIZATION language (profile overrides client hint)
    let personalization = null;
    try {
      if (userId) personalization = await getUserPersonalization(userId);
    } catch (e) {
      personalization = null;
    }
    let languageHint = pickLanguage({
      preferenceCode: personalization && personalization.languageCode ? personalization.languageCode : null,
      clientHint: clientLanguageHint,
    });


      const isFastMode = String(fastMode ?? 'true').toLowerCase() !== 'false';

      if (!file || !file.buffer) {
        return res.status(400).json({ error: 'Missing audio file field: audio' });
      }

      if (userId && (await isRateLimited(userId))) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }

      // 0) Transcribe (with language detection by default)
      const stt = await transcribeAudioBuffer(file.buffer, {
        mime: file.mimetype,
        filename: file.originalname,
        languageHint: clientLanguageHint,
        detectLanguage: true,
        returnLanguage: true,
        billing: {
          userId: billingUserId,
          conversationId,
          requestId,
          operation: 'stt',
          route: 'voice/chat',
          audioDurationSec,
        },
      });

      const transcriptText = typeof stt === 'string' ? stt : stt?.text;
      const detectedLangRaw = typeof stt === 'object' ? stt?.language : null;

      const message = String(transcriptText || '').trim();
      const detectedLang = _normalizeLangCode(detectedLangRaw || languageHint);

      // 0b) Per-user voice profile + language preference (keep it cheap)
      let voiceProfile = null;
      if (userId) {
        try {
          voiceProfile = await getVoiceProfile(userId);
        } catch {
          voiceProfile = null;
        }
      }

      const inferredStyle = inferVoiceStyleFromText(message);
      const guessedLang = guessLanguageFromText(message, detectedLang || languageHint);
      const preferredLang = pickPreferredLanguage({
        detectedLang: detectedLang || guessedLang,
        languageHint: clientLanguageHint,
        profile: voiceProfile,
      });

      // TTS preferences (request overrides > profile > defaults)
      const finalTtsVoice = String(ttsVoice || '').trim() || pickMaleVoice(voiceProfile);
      const speedFromReq = ttsSpeed != null && String(ttsSpeed).trim() ? Number(ttsSpeed) : NaN;
      const finalTtsSpeed = Number.isFinite(speedFromReq) ? speedFromReq : pickTtsSpeed(voiceProfile);
      const finalTtsFormat = String(ttsFormat || '').trim() || (voiceProfile && voiceProfile.ttsFormat) || '';

      const voiceProfilePrompt = buildVoiceProfilePrompt(voiceProfile);

      if (userId) {
        // Save lightweight voice memory without blocking the request
        setImmediate(() => {
          updateVoiceProfile(userId, {
            preferredLanguage: preferredLang || null,
            lastLang: preferredLang || null,
            tone: inferredStyle?.tone || null,
            style: inferredStyle?.style || null,
            ttsVoice: finalTtsVoice || null,
            ttsSpeed: Number.isFinite(finalTtsSpeed) ? finalTtsSpeed : null,
          }).catch(() => {});
        });
      }

      if (!message) {
        return res.status(200).json({ transcriptText: '', assistantText: '', error: 'Empty transcript' });
      }

      // 1) Time context (early)
      let earlyTimeCtx = null;
      try {
        // timeInfo may be JSON string in multipart
        let ti = timeInfo;
        if (typeof ti === 'string') {
          try {
            ti = JSON.parse(ti);
          } catch {
            // ignore
          }
        }
        earlyTimeCtx = buildTimeContext({ clientTimeInfo: ti, languageHint });
      } catch {
        earlyTimeCtx = null;
      }

      // 2) History + memories + summary (parallel)
      // Fast mode: keep it lean (no Qdrant memories, no summary) to cut latency.
      const historyLimit = isFastMode ? 40 : 120;
      const [historyPromise, memoriesPromise, summaryPromise] = await Promise.allSettled([
        conversationId ? getConversationHistory(conversationId, { limit: historyLimit }) : Promise.resolve([]),
        userId && qdrantEnabled && OPENAI_API_KEY
          ? (() => {
              const topK = isFastMode ? 4 : 6;
              const timeoutMs = isFastMode ? 900 : 2000;
              return Promise.race([
                retrieveFromQdrant(userId, message, topK),
                new Promise((resolve) => setTimeout(() => resolve([]), timeoutMs)),
              ]);
            })()
          : Promise.resolve([]),
        !isFastMode && conversationId && THREAD_SUMMARY_ENABLED ? getThreadSummary(conversationId) : Promise.resolve(''),
      ]);

      const conversation = historyPromise.status === 'fulfilled' ? historyPromise.value : [];
      const userMemories = memoriesPromise.status === 'fulfilled' ? memoriesPromise.value : [];
      const threadSummary = summaryPromise.status === 'fulfilled' ? summaryPromise.value : '';

      // Keep a solid recent window + optional semantic addon
      const keepRecent = message.length < 80 ? 18 : 14;
      const recentCount = Math.max(10, keepRecent);
      const recentHistory = Array.isArray(conversation) ? conversation.slice(-recentCount) : [];
      const olderPool = Array.isArray(conversation)
        ? conversation.slice(0, Math.max(0, conversation.length - recentCount))
        : [];

      // Fast mode: skip semantic filtering (extra embeddings work) to reduce latency.
      const semanticAddOn = isFastMode
        ? []
        : await filterRelevantHistory(olderPool, message, {
            maxMessages: 28,
            similarityThreshold: 0.52,
          });

      const relevantHistory = (() => {
        const merged = [...semanticAddOn, ...recentHistory];
        const seen = new Set();
        const out = [];
        for (const m of merged) {
          if (!m || !m.role || !m.content) continue;
          const key = `${m.role}:${m.content}:${m.ts ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(m);
        }
        out.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
        return out;
      })();

      // 3) Smart routing plan
      // Fast mode: skip routing/tools to keep voice snappy.
      const smartEnabled =
        !isFastMode && (req.body?.smartRouting ?? true) !== false && SMART_ROUTING_ENABLED;

      const capabilities = {
        web: !isFastMode && Boolean(TAVILY_API_KEY || SERPER_API_KEY),
        rag: !isFastMode && Boolean(userId && qdrantEnabled && OPENAI_API_KEY),
        image: !isFastMode && Boolean(replicateEnabled),
        zip: true,
      };

      let plan = {
        tool_calls: [],
        memory: { action: 'none' },
        response: { type: 'text' },
        confidence: 1,
        reason: smartEnabled ? 'default' : (isFastMode ? 'voice_fast_mode' : 'legacy'),
      };

      if (smartEnabled) {
        plan = await decideToolPlan({ message, history: relevantHistory, capabilities });
      }

      // 3b) Memory actions (router decides)
      let memoryEvent = null;
      if (userId && plan?.memory?.action === 'delete') {
        const del = await hardDeleteMemoriesByInstruction(userId, message).catch((e) => {
          return { deletedCount: 0, error: String(e?.message || e) };
        });
        memoryEvent = {
          action: 'deleted',
          deletedCount: Number(del?.deletedCount || 0),
          error: del?.error || null,
        };
      }
      if (userId && plan?.memory?.action === 'save') {
        const content = String(plan?.memory?.content || message).trim();
        const saved = await saveMemoryFromInstruction(userId, content).catch((e) => {
          return { id: null, content, error: String(e?.message || e) };
        });
        memoryEvent = {
          action: 'saved',
          id: saved?.id || null,
          content: saved?.content || content,
          error: saved?.error || null,
        };
      }

      // 4) Optional context prompt (memories)
      let contextPrompt = '';
      if (userMemories.length > 0) {
        const limit = isFastMode ? 4 : 8;

        const pickText = (m) => {
          const p = (m && m.payload) ? m.payload : {};
          return String(p.content || p.text || p.memory || p.value || '').trim();
        };

        if (isFastMode) {
          contextPrompt += '🧠 User facts (use only if relevant):\n';
          const memStrings = userMemories
            .slice(0, limit)
            .map((m, idx) => `- [${idx + 1}] ${pickText(m)}`)
            .filter((s) => !s.endsWith('] '));
          contextPrompt += memStrings.join('\n');
          contextPrompt += '\n\n';
        } else {
          contextPrompt +=
            '🧠 Below are important long-term memories about the user (facts). Use them ONLY if they are relevant to the user\'s latest message or if the user asks direct questions about the user, their life, preferences or history.\n';
          const memStrings = userMemories
            .slice(0, limit)
            .map((m, idx) => {
              const p = (m && m.payload) ? m.payload : {};
              const cat = p.category || 'other';
              const imp = p.importance != null ? Number(p.importance).toFixed(2) : '';
              const ts = p.timestamp || '';
              const txt = pickText(m);
              const meta = `(${cat}${imp ? `, importance=${imp}` : ''}${ts ? `, ts=${ts}` : ''})`;
              return `- [${idx + 1}] ${meta} ${txt}`;
            })
            .filter((s) => !s.endsWith(') '));
          contextPrompt += memStrings.join('\n');
          contextPrompt += '\n\n';
        }
      }
      // 5) Tool execution (RAG / Web / Image)
      const providedUrls = isFastMode ? [] : extractUrls(message);
      const messageWithoutUrls = String(message || '')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const toolCalls = Array.isArray(plan?.tool_calls) ? plan.tool_calls : [];
      const webCall = toolCalls.find((c) => c?.name === 'web_search');
      const ragCall = toolCalls.find((c) => c?.name === 'rag_retrieve');
      const imgCall = toolCalls.find((c) => c?.name === 'image_generate');

      const allowImageGen = imgCall && isExplicitImageRequest(message);

      let ragContext = '';
      let webContext = '';
      let webResults = null;
      let generatedImages = null;

      // Direct URL reads (even if web_search wasn't asked)
      let directUrlResults = [];
      if (!isFastMode && providedUrls.length) {
        try {
          const hintForUrlRead = [messageWithoutUrls, providedUrls.join(' ')].filter(Boolean).join('\n');
          directUrlResults = await readProvidedUrlsAsResults(providedUrls, { hint: hintForUrlRead || message });
        } catch {
          directUrlResults = [];
        }
      }

      const legacyUseWeb = !smartEnabled && String(useWebSearch).toLowerCase() === 'true';
      const shouldUseRag = (smartEnabled && ragCall && capabilities.rag) || false;
      if (shouldUseRag) {
        try {
          const q = (ragCall?.args?.query || message).toString();
          const ragRes = await ragContextForChat({ userId, query: q, conversationId, topK: 4 });
          ragContext = ragRes?.context || '';
        } catch {
          ragContext = '';
        }
      }

      const shouldDoWebSearch = (smartEnabled && webCall && capabilities.web) || legacyUseWeb;
      if (shouldDoWebSearch) {
        try {
          const baseQuery = String(webCall?.args?.query || messageWithoutUrls || message);
          let augmentedQuery = (await planWebQuery({ userMessage: message, baseQuery })).query;
          if (WEB_QUERY_YEAR_AUGMENT) {
            const wantsFresh = _messageWantsFreshInfo(message) || _messageWantsFreshInfo(baseQuery);
            const hasYear = /\b(20\d{2})\b/.test(augmentedQuery || baseQuery);
            if (wantsFresh && !hasYear) {
              const y = Number(earlyTimeCtx?.localYear || new Date().getFullYear());
              if (y && y >= 2000 && y <= 2100) augmentedQuery = `${augmentedQuery} ${y}`;
            }
          }

          const ws = await webSearch(augmentedQuery, {
            mode: webCall?.args?.mode || webSearchMode,
            maxResults: webCall?.args?.maxResults || webMaxResults,
            timeRange: webCall?.args?.timeRange || webTimeRange,
            searchDepth: webCall?.args?.searchDepth || webSearchDepth,
            includeRawContent: Boolean(webCall?.args?.includeRawContent ?? webIncludeRawContent),
            prefer: webCall?.args?.prefer || webPrefer,
            serperGl: webCall?.args?.serperGl,
            serperHl: webCall?.args?.serperHl,
          });

          const merged = {
            ...ws,
            usedProviders: Array.from(new Set(['direct', ...(ws.usedProviders || [])])),
            results: [...directUrlResults, ...(ws.results || [])],
          };

          webResults = merged;
          webContext = makeWebContextBlock(merged);
        } catch {
          webContext = '';
          webResults = null;
        }
      }

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
        webContext = makeWebContextBlock(pseudo);
      }

      if (smartEnabled && imgCall && capabilities.image && allowImageGen) {
        try {
          const originalPrompt = String(imgCall?.args?.prompt || message).trim();
          if (originalPrompt) {
            const tr = await translateToEnglish(originalPrompt, { force: true });
            const promptEnglish = tr?.english || originalPrompt;
            const promptFinal = buildFluxPrompt(promptEnglish, {
              extra: String(imgCall?.args?.promptExtra || '').trim(),
              preset: String(imgCall?.args?.preset || '').trim(),
            });

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

            generatedImages = {
              prompt: { original: originalPrompt, english: promptEnglish, final: promptFinal },
              ...result,
            };
          }
        } catch (e) {
          generatedImages = { error: e.message, details: e.details || null };
        }
      }

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
            prompt: generatedImages?.prompt?.original || message,
            prompt_en: generatedImages?.prompt?.english || '',
            prompt_final: generatedImages?.prompt?.final || '',
            images: generatedImages.images,
            predictionId: generatedImages.predictionId || null,
            provider: 'replicate',
            preset: imgCall?.args?.preset ?? null,
            meta: {
              aspect_ratio: imgCall?.args?.aspect_ratio ?? null,
              output_format: imgCall?.args?.output_format ?? null,
              output_quality: imgCall?.args?.output_quality ?? null,
            },
            storeMessage: true,
          });

          if (persisted && Array.isArray(persisted.uploads) && persisted.uploads.length) {
            generatedImages.images = persisted.uploads;
            generatedImages.persisted = { ok: true, uploads: persisted.uploads };
          }
        } catch {
          // ignore persistence failures
        }
      }

      // 6) Build messages for the model
      // Fast mode keeps the prompt short & disables tool context to reduce latency.
      let messages = [];
      if (isFastMode) {
        const voiceSystem = _buildVoiceFastSystemBlock({
          preferredLang,
          detectedLang,
          uiLanguageHint: clientLanguageHint,
          voiceProfilePrompt,
          timeCtx: earlyTimeCtx,
        });
        messages = [{ role: 'system', content: voiceSystem }];

        if (contextPrompt && String(contextPrompt).trim()) {
          messages.push({ role: 'system', content: String(contextPrompt).trim() });
        }
      } else {
        const systemPrompt = await getDefaultSystemPrompt();

      let timeBlock = '';
      let timeCtx = null;
      try {
        // Parse timeInfo again if string
        let ti = timeInfo;
        if (typeof ti === 'string') {
          try {
            ti = JSON.parse(ti);
          } catch {
            // ignore
          }
        }
        const tctx = buildTimeContext({ clientTimeInfo: ti, languageHint });
        timeCtx = tctx;

        timeBlock =
          '\nCURRENT TIME CONTEXT (CRITICAL):\n' +
          `- TODAY (local): ${tctx.localDate || tctx.localHuman}\n` +
          `- CURRENT LOCAL TIME: ${tctx.localHuman}${tctx.offsetName ? ` (${tctx.offsetName})` : ''}\n` +
          `- CURRENT YEAR (local): ${tctx.localYear || ''}\n` +
          `- Timezone used: ${tctx.timeZone}\n` +
          `- Server ISO (UTC): ${tctx.serverIso}\n` +
          '\nTIME INTERPRETATION RULES:\n' +
          '- Interpret phrases like "danas", "sutra", "ovaj tjedan", "ovaj mjesec", "ove godine" relative to TODAY (local) above.\n' +
          '- If web sources mention only past years and do not explicitly confirm the current year, say you cannot confirm for the current year.\n';
      } catch {
        timeBlock = '';
        timeCtx = null;
      }

      const lang = (languageHint || '').trim().toLowerCase();
      const languageInstruction = lang
        ? `
LANGUAGE PREFERENCE:
- The user's interface language code is "${lang}".
- Answer primarily in this language.
- If the latest user message is clearly in another language, follow the language of the latest user message instead.`
        : `
LANGUAGE PREFERENCE:
- Answer in the same language as the user\'s latest message.
- If the language is unclear, default to English.`;

      const toolUsageBlock = `TOOLS USED THIS TURN:
- web_search: ${webContext ? 'YES' : 'NO'}
- rag_retrieve: ${ragContext ? 'YES' : 'NO'}
- image_generate: ${generatedImages ? 'YES' : 'NO'}

STRICT RULES:
- If web_search is NO, you MUST NOT claim you searched the web or say "prema rezultatima pretraživanja".
- If web_search is YES, any concrete fact taken from sources MUST include a citation like [1], [2].
`;

      const systemBlock = `${systemPrompt}

${timeBlock}

${languageInstruction}

${toolUsageBlock}

GENERAL BEHAVIOUR (VERY IMPORTANT):
- ALWAYS treat the USER'S LATEST message as the main question.
- Assume CONTINUITY: the conversation is ongoing; use the recent chat messages to keep references consistent.
- Stay ON TOPIC. Do not introduce unrelated subjects.
- First, answer DIRECTLY to what the user asked or said in their latest message.
`.trim();

      const mustUseBlocks = [];
      const optionalBlocks = [];

      if (contextPrompt && String(contextPrompt).trim()) optionalBlocks.push(String(contextPrompt).trim());
      if (ragContext && String(ragContext).trim()) optionalBlocks.push(String(ragContext).trim());

      if (webContext && String(webContext).trim()) {
        mustUseBlocks.push(String(webContext).trim());

        // Temporal sanity guard
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
          if (wantFresh || (yearsArr.length && !hasCurrent)) {
            mustUseBlocks.push(
              'TEMPORAL SANITY CHECK (STRICT):\n' +
                `- Current local year: ${currentYear}\n` +
                `- Years detected in web sources: ${yearsArr.length ? yearsArr.join(', ') : 'none'}\n` +
                '- If the user asks for "this year / ovogodišnje / danas" and the sources do NOT explicitly mention the current year, DO NOT assume.\n' +
                '- In that case, say you cannot confirm for the current year from the provided sources and suggest the official channel to verify.\n',
            );
          }
        } catch {
          // ignore
        }

        mustUseBlocks.push(
          'CITATION RULES (STRICT):\n' +
            '- Any non-trivial factual claim that comes from the web results MUST be cited with [n].\n' +
            '- If the web results do NOT explicitly contain a needed detail, DO NOT guess.\n',
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
        if (urls.length) {
          mustUseBlocks.push('IMAGE GENERATION RESULT (URLs):\n' + urls.map((u, i) => `- [${i + 1}] ${u}`).join('\n'));
        }
      }

        messages = [
        { role: 'system', content: systemBlock },
        ...(threadSummary && String(threadSummary).trim()
          ? [
              {
                role: 'system',
                content:
                  'RUNNING CONVERSATION SUMMARY (internal; use to stay on topic, do not reveal unless asked):\n' +
                  String(threadSummary).trim(),
              },
            ]
          : []),
        ...(mustUseBlocks.length
          ? [
              {
                role: 'system',
                content:
                  '⚠️ TOOL RESULTS (STRICT) - YOU MUST USE THIS INFORMATION:\n\n' +
                  mustUseBlocks.join('\n\n') +
                  "\n\n⚠️ IMPORTANT: The above data was retrieved specifically for the user's query. You MUST incorporate it into your response.",
              },
            ]
          : []),
        ...(optionalBlocks.length
          ? [
              {
                role: 'system',
                content:
                  'ℹ️ ADDITIONAL CONTEXT (OPTIONAL) - use ONLY if it is relevant to the user\'s latest message:\n\n' +
                  optionalBlocks.join('\n\n'),
              },
            ]
          : []),
        ];
      }

      const historyMsgs = Array.isArray(relevantHistory) ? relevantHistory : [];
      historyMsgs
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
        .forEach((m) => messages.push({ role: m.role, content: String(m.content).trim() }));

      const last = messages[messages.length - 1];
      const sameAsLastUser =
        last && last.role === 'user' && _normTextForDedupe(last.content) === _normTextForDedupe(message);
      if (!sameAsLastUser) messages.push({ role: 'user', content: message });

      // 7) Generate answer (non-stream)
      // Prefer DeepSeek (primary), fallback to OpenAI if needed.
      const temp = WEB_STRICT_MODE && webContext ? 0.2 : 0.25;
      let assistantText = '';

      try {
        // IMPORTANT: client 'model' can be DeepSeek (chat), or can be a NON-chat model
        // (e.g. whisper-1 / *-tts) by mistake. Never pass non-chat models into OpenAI chat.
        const rawModel = String(model || '').trim();
        const useOpenAI = OPENAI_API_KEY && _isOpenAIChatModel(rawModel);
        const deepSeekModel = _isDeepSeekChatModel(rawModel) ? rawModel : undefined;

        if (useOpenAI) {
          assistantText = await callOpenAIChat({ messages, model: rawModel }, temp, 900);
        } else {
          // If client passed something weird (whisper/tts/etc), DeepSeek will fall back to its default.
          assistantText = await callDeepSeek({ messages, model: deepSeekModel }, temp, 900);
        }
      } catch (e) {
        // Fallback MUST use a real OpenAI chat model (never reuse the client model here).
        if (OPENAI_API_KEY) {
          assistantText = await callOpenAIChat({ messages, model: 'gpt-4o-mini' }, temp, 900);
        } else {
          throw e;
        }
      }

      assistantText = String(assistantText || '').trim();

      // Schedule memory extraction & summary update
      if (userId && assistantText) {
        setImmediate(() => {
          extractSemanticMemory(
            [
              { role: 'user', content: message },
              { role: 'assistant', content: assistantText },
            ],
            userId,
          ).catch(console.error);
        });
      }

      if (THREAD_SUMMARY_ENABLED && conversationId && assistantText) {
        setImmediate(() => {
          updateThreadSummary({
            conversationId,
            previousSummary: threadSummary,
            userMessage: message,
            assistantMessage: assistantText,
          }).catch(console.error);
        });
      }

      // 8) TTS (optional)
      const wantsAudio = String(returnAudio || 'true').toLowerCase() !== 'false';
      const persistAudioBool =
        persistAudio !== undefined
          ? String(persistAudio).toLowerCase() !== 'false'
          : Boolean(VOICE_PERSIST_DEFAULT);
      // Fast mode: avoid Storage upload (it adds seconds). Frontend supports base64.
      const shouldPersistAudio = persistAudioBool && !isFastMode;
      let audioUrl = '';
      let audioBase64 = '';
      let audioMime = '';

      if (wantsAudio) {
        try {
          const tts = await synthesizeSpeech(assistantText, {
            voice: finalTtsVoice,
            speed: finalTtsSpeed,
            format: finalTtsFormat || undefined,
            billing: {
              userId: billingUserId,
              conversationId,
              requestId,
              operation: 'tts',
              route: 'voice/chat',
            },
          });
          audioMime = tts.mime;

          if (shouldPersistAudio) {
            // Persist to Storage (preferred)
            const persisted = await persistVoiceAudio({
              userId: userId || 'anon',
              conversationId: conversationId || 'voice',
              audioBuffer: tts.buffer,
              mimeType: tts.mime,
              ext: tts.format,
              meta: {
                model: tts.model,
                voice: tts.voice,
                speed: tts.speed,
              },
            }).catch(() => null);

            if (persisted && persisted.downloadUrl) {
              audioUrl = persisted.downloadUrl;
            } else {
              audioBase64 = tts.buffer.toString('base64');
            }
          } else {
            audioBase64 = tts.buffer.toString('base64');
          }
        } catch (e) {
          // No audio is still OK for the client (it will continue loop)
          audioUrl = '';
          audioBase64 = '';
          audioMime = '';
          console.warn('⚠️ Voice TTS failed:', e.message);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ /voice/chat completed in ${duration}ms (tLen=${message.length}, aLen=${assistantText.length})`);

      return res.json({
        transcriptText: message,
        userText: message,
        detectedLanguage: detectedLang || '',
        assistantText,
        text: assistantText,

        audioUrl,
        audioBase64,
        audioMime,

        sources: webResults?.results || [],
        images: generatedImages?.images || [],
        routePlan: plan,
        memoryEvent,
      });
    } catch (err) {
      console.error('❌ /voice/chat error:', err);
      return res.status(500).json({ error: 'Voice chat error', details: err.message });
    }
  });



  // POST /voice/stream
  // SSE stream that emits transcript/text deltas/audio chunks.
  // Enables partial TTS streaming on the client side.
  router.post('/stream', upload.single('audio'), async (req, res) => {
    const startedAt = Date.now();

    _setSseHeaders(res);
    const send = (event, payload) => _sseSend(res, event, payload);

    // Keep-alive ping (some proxies close idle connections)
    const pingTimer = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (_) {}
}, 15000);

    const abortController = new AbortController();
    req.on('close', () => {
      try { abortController.abort(); } catch (_) {}
      try { clearInterval(pingTimer); } catch (_) {}
    });

    try {
      // Basic checks
      if (!req.file || !req.file.buffer) {
        send('error', { error: 'Missing audio file.' });
        return res.end();
      }

      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      if (apiKey && apiKey !== VOICE_API_KEY) {
        send('error', { error: 'Unauthorized.' });
        return res.end();
      }

      // Parse JSON/meta fields (FormData can carry strings)
      const body = req.body || {};
      const userId = String(body.userId || '').trim() || null;
      const conversationId = String(body.conversationId || '').trim() || null;
      languageHint = pickLanguage({
      preferenceCode: personalization && personalization.languageCode ? personalization.languageCode : null,
      clientHint: _normalizeLangCode(body.languageHint || '') || null,
    });

      const ttsVoice = String(body.ttsVoice || '').trim() || null;
      const ttsFormat = String(body.ttsFormat || '').trim() || null;
      const ttsSpeedRaw = body.ttsSpeed;
      const ttsSpeed = ttsSpeedRaw != null && String(ttsSpeedRaw).trim() ? Number(ttsSpeedRaw) : null;

      const requestId = (req.headers['x-request-id'] || req.headers['x-requestid'] || '').toString().trim() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const billingUserId = userId ? String(userId).trim() : 'guest';
      const audioDurationSec = (() => {
        const v = body?.audioDurationSec ?? body?.durationSec ?? body?.durationSeconds ?? body?.duration ?? null;
        const n = v != null && String(v).trim() ? Number(v) : null;
        return (n != null && Number.isFinite(n) && n > 0) ? n : null;
      })();

      send('status', { phase: 'transcribing' });

      // 1) STT
      const { text: transcriptText, language: detectedLangRaw } = await transcribeAudioBuffer(req.file.buffer, {
        mime: req.file.mimetype,
        filename: req.file.originalname,
        languageHint: clientLanguageHint,
        fast: true,
        billing: {
          userId: billingUserId,
          conversationId,
          requestId,
          operation: 'stt',
          route: 'voice/stream',
          audioDurationSec,
        },
      });

      const message = String(transcriptText || '').trim();
      const detectedLang = _normalizeLangCode(detectedLangRaw || languageHint);

      if (!message) {
        send('error', { error: 'No speech detected.' });
        return res.end();
      }

      // 2) Profile + language + TTS prefs
      const voiceProfile = userId ? await getVoiceProfile(userId) : null;
      const inferred = inferVoiceStyleFromText(message);
      const guessedLang = guessLanguageFromText(message, detectedLang || languageHint);
      const preferredLang = pickPreferredLanguage({ detectedLang: detectedLang || guessedLang, languageHint: clientLanguageHint, profile: voiceProfile });

      const finalTtsVoice = ttsVoice || pickMaleVoice(voiceProfile);
      const finalTtsSpeed = Number.isFinite(ttsSpeed) ? ttsSpeed : pickTtsSpeed(voiceProfile);
      const finalTtsFormat = ttsFormat || (voiceProfile && voiceProfile.ttsFormat) || null;

      if (userId) {
        setImmediate(() => {
          updateVoiceProfile(userId, {
            preferredLanguage: preferredLang || null,
            lastLang: preferredLang || null,
            tone: inferred.tone,
            style: inferred.style,
            ttsVoice: finalTtsVoice || null,
            ...(Number.isFinite(finalTtsSpeed) ? { ttsSpeed: finalTtsSpeed } : {}),
          }).catch(() => {});
        });
      }

      send('transcript', {
        text: message,
        detectedLanguage: detectedLang || null,
        preferredLanguage: preferredLang || null,
      });

      // 3) Light memory retrieval (best-effort, low timeout)
      let memories = [];
      if (userId && qdrantEnabled && OPENAI_API_KEY) {
        try {
          const timeout = 900
          memories = await Promise.race([
            retrieveFromQdrant(userId, message, 4),
            new Promise((resolve) => setTimeout(() => resolve([]), timeout)),
          ]);
        } catch (_) {
          memories = [];
        }
      }

      const earlyTimeCtx = buildTimeContext(req, { overrideTimezone: TIMEZONE_DEFAULT });
      const timeCtx = earlyTimeCtx?.localDate ? `TIME: Today is ${earlyTimeCtx.localDate}. Now is ${earlyTimeCtx.localHuman}.` : '';

      let memoryBlock = '';
      if (memories && memories.length) {
        const pickText = (m) => {
          const p = (m && m.payload) ? m.payload : {};
          return String(p.content || p.text || p.memory || p.value || '').trim();
        };
        const lines = memories.slice(0, 4).map((m, i) => `- [${i+1}] ${pickText(m)}`).filter(Boolean);
        if (lines.length) memoryBlock = `\n\n🧠 User facts (use only if relevant):\n${lines.join('\n')}\n`;
      }

      const voiceProfilePrompt = buildVoiceProfilePrompt(voiceProfile);

      // 4) Messages (force fast + no tools)
      const systemPrompt = _buildVoiceFastSystemBlock({
        preferredLang,
        detectedLang,
        uiLanguageHint: clientLanguageHint,
        timeCtx,
        voiceProfilePrompt,
      });

      const messages = [
        { role: 'system', content: systemPrompt + (memoryBlock ? memoryBlock : '') },
        ...(conversationId ? (await getConversationHistory({ userId, conversationId, maxMessages: 20, prefer: 'voice' })).messages : []),
        { role: 'user', content: message },
      ];

      // 5) Stream LLM deltas + do chunked TTS
      const deepSeekModel = DEEPSEEK_CHAT_MODEL || 'deepseek-chat';
      const openAiModel = OPENAI_CHAT_MODEL || 'gpt-4o-mini';
      const chosenModel = (SMART_ROUTING_ENABLED === 'true') ? deepSeekModel : deepSeekModel;

      const fullTextParts = [];
      let speakBuffer = '';
      let audioSeq = 0;
      let ttsChain = Promise.resolve();

      send('status', { phase: 'thinking', model: chosenModel });

      const onDelta = (delta) => {
        if (!delta) return;
        fullTextParts.push(delta);
        speakBuffer += delta;
        send('text_delta', { delta });

        const extracted = _extractTtsChunk(speakBuffer);
        if (extracted && extracted.chunk) {
          const chunkToSpeak = extracted.chunk;
          speakBuffer = extracted.rest || '';
          const seq = ++audioSeq;

          ttsChain = ttsChain.then(async () => {
            try {
              const audioBuffer = await synthesizeSpeech(chunkToSpeak, {
                voice: finalTtsVoice,
                speed: finalTtsSpeed,
                format: finalTtsFormat,
                billing: {
                  userId: billingUserId,
                  conversationId,
                  requestId,
                  operation: 'tts_chunk',
                  route: 'voice/stream',
                },
              });
              const b64 = Buffer.from(audioBuffer).toString('base64');
              send('audio_chunk', {
                seq,
                voice: finalTtsVoice,
                format: finalTtsFormat || 'mp3',
                data: b64,
                text: chunkToSpeak,
              });
            } catch (e) {
              send('audio_error', { seq, error: String(e?.message || e) });
            }
          });
        }
      };

      // Stream tokens
      try {
        await _streamDeepSeekDeltas({
          apiKey: DEEPSEEK_API_KEY,
          model: chosenModel,
          messages,
          temperature: 0.4,
          maxTokens: 900,
          onDelta,
          signal: abortController.signal,
        });
      } catch (e) {
        // Fallback: non-stream OpenAI (still output as single chunk)
        const assistantText = await callOpenAIChat({
          messages,
          model: openAiModel,
        }, 0.4, 900);
        onDelta(assistantText);
      }

      // Final flush
      const remaining = String(speakBuffer || '').trim();
      if (remaining) {
        const seq = ++audioSeq;
        ttsChain = ttsChain.then(async () => {
          try {
            const audioBuffer = await synthesizeSpeech(remaining, {
              voice: finalTtsVoice,
              speed: finalTtsSpeed,
              format: finalTtsFormat,
              billing: {
                userId: billingUserId,
                conversationId,
                requestId,
                operation: 'tts_final',
                route: 'voice/stream',
              },
            });
            const b64 = Buffer.from(audioBuffer).toString('base64');
            send('audio_chunk', {
              seq,
              voice: finalTtsVoice,
              format: finalTtsFormat || 'mp3',
              data: b64,
              text: remaining,
              final: true,
            });
          } catch (e) {
            send('audio_error', { seq, error: String(e?.message || e) });
          }
        });
      }

      await ttsChain;

      const fullText = fullTextParts.join('').trim();

      // Save semantic memory (async)
      if (userId && qdrantEnabled && OPENAI_API_KEY) {
        setImmediate(() => {
          extractSemanticMemory({
            userId,
            message: fullText ? message : '',
            assistant: fullText || '',
            limit: 6,
          }).catch(() => {});
        });
      }

      send('done', {
        text: fullText,
        ms: Date.now() - startedAt,
        audioChunks: audioSeq,
        preferredLanguage: preferredLang || null,
        voice: finalTtsVoice,
      });

      clearInterval(pingTimer);
      return res.end();

    } catch (err) {
      try {
        send('error', { error: String(err?.message || err) });
      } catch (_) {}
      try { clearInterval(pingTimer); } catch (_) {}
      return res.end();
    }
  });
  return router;
}

module.exports = { createVoiceRouter };
