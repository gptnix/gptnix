'use strict';

/**
 * buildPrompt — assembles systemBlock, mustUseBlocks, and optionalBlocks
 *
 * Takes a comprehensive state object and returns:
 *   { systemBlock, mustUseBlocks, optionalBlocks }
 *
 * Block order in systemBlock (must match original chat.js):
 *   1. systemPrompt (base GPTNIX_SYSTEM_PROMPT)
 *   2. memoryBlock  (long-term user memory)
 *   3. personalizationBlock (style/tone/nickname — FIX19c)
 *   4. timeBlock    (current date/time)
 *   5. languageBlock (language instruction)
 *   6. formatBlock  (length / format hints)
 *   7. toolUsageBlock (which tools ran this turn + STRICT RULES)
 *   8. articleSafetyBlock (ARTICLE SAFETY MODE — only if article detected)
 *   9. officialsBlock (OFFICIALS STRICT MODE — only if officialsHardWeb)
 *  10. freshnessBlock (FRESHNESS GROUNDED MODE — only if freshnessHardWeb && !officialsHardWeb)
 *  11. GENERAL BEHAVIOUR (hardcoded footer)
 *
 * RAG and other tool context go into mustUseBlocks (not systemBlock),
 * matching the original chat.js behavior.
 *
 * Zero behavior change.
 */

const { stripToolFormat } = require('./utils');
const {
  _extractYears,
  _extractLinesWithPlaceAndTime,
  _messageWantsFreshInfo,
  isVeryShortUserTurn,
} = require('./chatHelpers');
const { buildSourcesIndex, makeSourcesBlock } = require('../../services/accuracyGuard');

const timeBlockFn          = require('./promptBlocks/timeBlock');
const memoryBlockFn        = require('./promptBlocks/memoryBlock');
const personalizationBlockFn = require('./promptBlocks/personalizationBlock');
const languageBlockFn      = require('./promptBlocks/languageBlock');
const { getLanguageInstruction } = require('./promptBlocks/languageBlock');
const formatBlockFn        = require('./promptBlocks/formatBlock');
const officialsBlockFn     = require('./promptBlocks/officialsBlock');
const freshnessBlockFn     = require('./promptBlocks/freshnessBlock');
const ragBlockFn           = require('./promptBlocks/ragBlock');
const { buildArticleSafetyBlock } = require('./promptBlocks/articleSafetyBlock');

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the full prompt state for this request.
 *
 * @param {object} s — State object (see JSDoc below for all fields)
 * @returns {{ systemBlock: string, mustUseBlocks: string[], optionalBlocks: string[], timeCtx: object|null }}
 */
function buildPrompt(s) {
  const mustUseBlocks  = [];
  const optionalBlocks = [];

  // ── 1. Base system prompt ────────────────────────────────────────────────
  const base = String(s.systemPrompt || '').trimEnd();

  // ── 2. Memory block ───────────────────────────────────────────────────────
  const mem = memoryBlockFn(s);

  // ── 3. Personalization block (FIX19c) ─────────────────────────────────────
  const personal = personalizationBlockFn(s);

  // ── 4. Time block ─────────────────────────────────────────────────────────
  let timeCtx = null;
  let tBlock = '';
  try {
    const { buildTimeContext } = require('../../utils/time');
    const { timeInfo, languageHint } = s;
    const tctx = buildTimeContext({ clientTimeInfo: timeInfo, languageHint });
    timeCtx = tctx;
    tBlock = timeBlockFn(s);
  } catch (err) {
    console.error('[buildPrompt] timeBlock error:', err);
    tBlock = '';
  }

  // ── 5. Language block ─────────────────────────────────────────────────────
  const langBlock = languageBlockFn(s);

  // ── 6. Format/length block ───────────────────────────────────────────────
  const fmtBlock = formatBlockFn(s);

  // ── 7. Tool usage block ───────────────────────────────────────────────────
  const preferWebOverWiki = Boolean(s.webContext && s.wantFreshRouting);
  const toolUsageBlock = `TOOLS USED THIS TURN:
- web_search: ${s.webContext ? 'YES' : 'NO'}
- rag_retrieve: ${s.ragContext ? 'YES' : 'NO'}
- weather_forecast: ${s.weatherContext ? 'YES' : 'NO'}
- fx_convert: ${s.fxContext ? 'YES' : 'NO'}
- wiki_summary: ${s.wikiContext ? 'YES' : 'NO'}
- wikidata_lookup: ${s.wikidataContext ? 'YES' : 'NO'}
- osm_geocode: ${s.osmGeocodeContext ? 'YES' : 'NO'}
- osm_nearby: ${s.osmNearbyContext ? 'YES' : 'NO'}
- vehicle_vin_decode: ${s.vehicleVinContext ? 'YES' : 'NO'}
- vehicle_models_for_make: ${s.vehicleModelsContext ? 'YES' : 'NO'}
- vehicle_recalls_by_vehicle: ${s.vehicleRecallsContext ? 'YES' : 'NO'}
- vehicle_complaints_by_vehicle: ${s.vehicleComplaintsContext ? 'YES' : 'NO'}
- vehicle_trims_carquery: ${s.vehicleTrimsContext ? 'YES' : 'NO'}
- vehicle_safety_ratings: ${s.vehicleSafetyContext ? 'YES' : 'NO'}
- drug_label_openfda: ${s.openfdaContext ? 'YES' : 'NO'}
- drug_interactions_rxnav: ${s.rxnavContext ? 'YES' : 'NO'}
- wolfram_query: ${s.wolframContext ? 'YES' : 'NO'}
- holidays_public: ${s.holidaysContext ? 'YES' : 'NO'}
- movie_report: ${s.moviesContext ? 'YES' : 'NO'}
- image_generate: ${(s.generatedImages && Array.isArray(s.generatedImages.images) && s.generatedImages.images.length) ? 'YES' : 'NO'}

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

  // ── 8. Article Safety block ───────────────────────────────────────────────
  // ⚖️  Attribution lock for article-like inputs (URL, long text, etc.)
  const articleSafetyBlock = buildArticleSafetyBlock(s.articleSafetyContext);

  // ── 9. Officials block ────────────────────────────────────────────────────
  const offBlock = officialsBlockFn(s);

  // ── 10. Freshness block ───────────────────────────────────────────────────
  const freshBlock = freshnessBlockFn(s);

  // ── 11. General behaviour footer ──────────────────────────────────────────
  const generalBehaviour = `GENERAL BEHAVIOUR (VERY IMPORTANT):
- ALWAYS treat the USER'S LATEST message as the main question.
- Assume CONTINUITY: the conversation is ongoing; use the recent chat messages to keep references (names, pronouns, plans) consistent.
- Stay ON TOPIC. Do not introduce unrelated subjects.
- First, answer DIRECTLY to what the user asked or said in their latest message.
- Use LONG-TERM MEMORY and conversation history when it helps the current topic.
- Only treat it as a topic change if the user clearly switches topics.
- If there are multiple topics in the latest message, prioritise health/safety first, then everything else.
- If the latest message is short/ambiguous, DO NOT ask follow-up questions; make the best reasonable assumption OR explicitly state what cannot be confirmed from the available context.`;

  const systemBlock = [base, mem, personal, tBlock, langBlock, fmtBlock,
    toolUsageBlock, articleSafetyBlock, offBlock, freshBlock, generalBehaviour]
    .map((x) => String(x || '').trimEnd())
    .filter(Boolean) // Remove empty blocks
    .join('\n\n')
    .trim();

  // ─────────────────────────────────────────────────────────────────────────
  // mustUseBlocks — follow-up continuity
  // ─────────────────────────────────────────────────────────────────────────
  if (isVeryShortUserTurn(s.message) && Array.isArray(s.relevantHistory) && s.relevantHistory.length) {
    const tail = s.relevantHistory
      .slice(-6)
      .map((m) => {
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

  // Attachment blocks (user-uploaded files)
  if (Array.isArray(s.attachmentBlocks) && s.attachmentBlocks.length) {
    mustUseBlocks.push(...s.attachmentBlocks);
  }

  // contextPrompt → optionalBlocks
  if (s.contextPrompt && String(s.contextPrompt).trim()) {
    optionalBlocks.push(String(s.contextPrompt).trim());
  }

  // RAG
  const ragStr = ragBlockFn(s);
  if (ragStr) mustUseBlocks.push(ragStr);

  // Weather
  if (s.weatherContext && String(s.weatherContext).trim()) {
    mustUseBlocks.push(`WEATHER DATA (trusted):\n${stripToolFormat(s.weatherContext)}`);
  }

  // FX
  if (s.fxContext && String(s.fxContext).trim()) {
    mustUseBlocks.push(`FX DATA (trusted):\n${stripToolFormat(s.fxContext)}`);
  }

  // Wiki
  if (s.wikiContext && String(s.wikiContext).trim()) {
    mustUseBlocks.push(`WIKI DATA (trusted):\n${stripToolFormat(s.wikiContext)}`);
  }

  // Wikidata
  if (s.wikidataContext && String(s.wikidataContext).trim()) {
    mustUseBlocks.push(`WIKIDATA DATA (trusted):\n${stripToolFormat(s.wikidataContext)}`);
  }

  // OSM Geocode
  if (s.osmGeocodeContext && String(s.osmGeocodeContext).trim()) {
    mustUseBlocks.push(`OSM GEOCODE DATA (trusted):\n${stripToolFormat(s.osmGeocodeContext)}`);
  }

  // OSM Nearby
  if (s.osmNearbyContext && String(s.osmNearbyContext).trim()) {
    mustUseBlocks.push(`OSM NEARBY DATA (trusted):\n${stripToolFormat(s.osmNearbyContext)}`);
  }

  // Grounded entity mode
  if (s.groundedEntityMode) {
    mustUseBlocks.push(
      'ENTITY/PLACE GROUNDING RULES (STRICT):\n' +
        '- For this request, treat WIKI/WIKIDATA/OSM blocks as the primary facts about the entity.\n' +
        '- DO NOT add new names, dates, numbers, historical claims, distances, populations, "official" roles, or admin details unless they appear in the trusted blocks.\n' +
        '- If the user asks for a detail that is not explicitly present in the trusted blocks, say you cannot confirm it from the available context and suggest what to check next.\n' +
        '- If the entity is ambiguous (multiple meanings), do NOT ask a question; briefly list 2–3 plausible interpretations and state what you cannot confirm from the trusted blocks.\n' +
        '- Keep the answer compact unless the user explicitly asked for an exhaustive write-up.\n'
    );
  }

  // Vehicle contexts
  if (s.vehicleVinContext && String(s.vehicleVinContext).trim())
    mustUseBlocks.push(`VEHICLE VIN DATA (trusted):\n${stripToolFormat(s.vehicleVinContext)}`);
  if (s.vehicleModelsContext && String(s.vehicleModelsContext).trim())
    mustUseBlocks.push(`VEHICLE MODELS DATA (trusted):\n${stripToolFormat(s.vehicleModelsContext)}`);
  if (s.vehicleRecallsContext && String(s.vehicleRecallsContext).trim())
    mustUseBlocks.push(`VEHICLE RECALLS DATA (trusted):\n${stripToolFormat(s.vehicleRecallsContext)}`);
  if (s.vehicleComplaintsContext && String(s.vehicleComplaintsContext).trim())
    mustUseBlocks.push(`VEHICLE COMPLAINTS DATA (trusted):\n${stripToolFormat(s.vehicleComplaintsContext)}`);
  if (s.vehicleTrimsContext && String(s.vehicleTrimsContext).trim())
    mustUseBlocks.push(`VEHICLE TRIMS DATA (trusted):\n${stripToolFormat(s.vehicleTrimsContext)}`);
  if (s.vehicleSafetyContext && String(s.vehicleSafetyContext).trim())
    mustUseBlocks.push(`VEHICLE SAFETY DATA (trusted):\n${stripToolFormat(s.vehicleSafetyContext)}`);

  // Pharma contexts
  if (s.openfdaContext && String(s.openfdaContext).trim())
    mustUseBlocks.push(`DRUG LABEL DATA (trusted):\n${stripToolFormat(s.openfdaContext)}`);
  if (s.rxnavContext && String(s.rxnavContext).trim())
    mustUseBlocks.push(`DRUG INTERACTIONS DATA (trusted):\n${stripToolFormat(s.rxnavContext)}`);

  // Wolfram
  if (s.wolframContext && String(s.wolframContext).trim())
    mustUseBlocks.push(`WOLFRAM DATA (trusted):\n${stripToolFormat(s.wolframContext)}`);

  // Holidays
  if (s.holidaysContext && String(s.holidaysContext).trim())
    mustUseBlocks.push(`HOLIDAY DATA (trusted):\n${stripToolFormat(s.holidaysContext)}`);

  // Movies
  if (s.moviesContext && String(s.moviesContext).trim())
    mustUseBlocks.push(`MOVIE DATA (trusted, respond naturally):\n${stripToolFormat(s.moviesContext)}`);

  // Web search results (with schedule extraction + temporal sanity)
  if (s.webContext && String(s.webContext).trim()) {
    mustUseBlocks.push(`WEB SEARCH RESULTS (trusted, respond naturally):\n${stripToolFormat(s.webContext)}`);

    // Schedule/time extraction for URL-based queries
    try {
      const isScheduleQ = /(misa|mise|misni|raspored|župne obavijesti|zupne obavijesti|božić|bozic|termin|sat|sati)/i.test(
        String(s.message || '')
      );
      if (isScheduleQ && Array.isArray(s.providedUrls) && s.providedUrls.length) {
        const list = Array.isArray(s.webResults && s.webResults.results) ? s.webResults.results : [];
        const extracted = [];
        for (let i = 0; i < Math.min(list.length, 3); i++) {
          const r = list[i];
          if (!r || !r.rawContent) continue;
          const placeHints = [];
          if (/kovač/i.test(s.message)) placeHints.push('Kovači');
          const cap = String(s.message)
            .replace(/https?:\/\/\S+/g, ' ')
            .match(/\b([A-ZČĆŽŠĐ][\p{L}\p{M}]{3,})\b/gu);
          if (cap && cap.length) placeHints.push(cap[0]);

          const uniq = Array.from(new Set(placeHints.filter(Boolean)));
          for (const place of uniq.slice(0, 2)) {
            const lines = _extractLinesWithPlaceAndTime(String(r.rawContent || ''), { place, around: 1, maxLines: 6 });
            if (lines.length) {
              extracted.push({ idx: i + 1, place, lines });
              break;
            }
          }
        }
        if (extracted.length) {
          mustUseBlocks.push(
            'EXTRACTED FROM PROVIDED URL(S) (HIGH PRECISION):\n' +
            extracted.map((e) =>
              `- From source [${e.idx}] (match: ${e.place}):\n` +
              e.lines.map((l) => `  - ${l}`).join('\n')
            ).join('\n')
          );
          mustUseBlocks.push(
            'RULE (VERY IMPORTANT): If the extracted lines contain the exact time, answer using that time and cite the same source number [n]. If not, do NOT invent a time.'
          );
        }
      }
    } catch (_e) { /* ignore extractor failures */ }

    // Temporal sanity guard
    try {
      const wantFresh = _messageWantsFreshInfo(s.message);
      const currentYear = Number(timeCtx && timeCtx.localYear ? timeCtx.localYear : new Date().getUTCFullYear());
      const years = new Set();
      const list = Array.isArray(s.webResults && s.webResults.results) ? s.webResults.results : [];
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
          '- In that case, say you cannot confirm for the current year from the provided sources and suggest the official channel to verify.\n'
        );
      }
    } catch (_e) { /* ignore temporal analysis failures */ }

    // Citation rules
    mustUseBlocks.push(
      'CITATION RULES (STRICT):\n' +
      '- Any non-trivial factual claim that comes from the web results MUST be cited with [n].\n' +
      '- Only use citations that refer to the numbered list in the WEB SEARCH RESULTS block.\n' +
      '- If the web results do NOT explicitly contain a needed detail (e.g., exact times, dates, names, addresses), DO NOT guess.\n' +
      '- In that case, say you cannot confirm from the sources and suggest what to check next.\n' +
      '- Do not fabricate "official confirmations", "corrections", or "schedules" unless they are clearly stated in the sources.\n'
    );

    // UI already renders source favicons/chips from structured sources.
    // Avoid duplicating a "Sources/Izvori" section in the assistant text.
    mustUseBlocks.push(
      'OUTPUT FORMAT (STRICT):\n' +
      '- Do NOT include a section titled "Izvori:" or "Sources:" in the final answer.\n' +
      '- Use inline citations like [1], [2] only.\n'
    );
  }

  // Sources index (web + wiki citations reference)
  const sourcesIndex = buildSourcesIndex({ wikiSources: s.wikiSources, webResults: s.webResults, max: 10 });
  const sourcesBlock = makeSourcesBlock(sourcesIndex);
  if (sourcesBlock) mustUseBlocks.push(sourcesBlock);

  return { systemBlock, mustUseBlocks, optionalBlocks, sourcesIndex, timeCtx };
}

module.exports = { buildPrompt };
