'use strict';

const crypto = require('crypto');
const { OPENAI_API_KEY, RAG_COLLECTION } = require('../config/env');
const { qdrantClient, qdrantEnabled, ensureRagCollection } = require('../clients/qdrant');
const { getEmbedding, embedChunksForRag } = require('./embeddings');
const { extractTextFromFile } = require('./fileTextExtractor');
const { chunkText } = require('../utils/text');
const { callDeepSeek } = require('./providers/deepseek');

function makeUploadId() {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (_e) {
    // ignore
  }
  return crypto.randomBytes(16).toString('hex');
}

function makePointId() {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (_e) {
    // ignore
  }
  return crypto.randomBytes(16).toString('hex');
}

async function ragUpload({ file, userId, conversationId }) {
  if (!qdrantEnabled) {
    const err = new Error('Qdrant disabled');
    err.statusCode = 503;
    throw err;
  }
  if (!OPENAI_API_KEY) {
    const err = new Error('OpenAI API key missing');
    err.statusCode = 500;
    throw err;
  }

  await ensureRagCollection();

  if (!file) {
    const err = new Error('No file uploaded');
    err.statusCode = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('userId required');
    err.statusCode = 400;
    throw err;
  }

  console.log('📁 RAG upload:', {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    userId,
    conversationId: conversationId || null,
  });

  // ✅ Delete old images from same conversation if uploading new image
  const mt = (file.mimetype || '').toLowerCase();
  // FIX: isImage based on mimetype only (not filename extension) per requirement
  const isImage = mt.startsWith('image/');
  if (isImage && conversationId) {
    try {
      console.log('🗑️ Deleting old images from conversation:', conversationId);
      
      // Find all points with this conversation_id
      const scrollResult = await qdrantClient.scroll(RAG_COLLECTION, {
        filter: {
          must: [
            { key: 'user_id', match: { value: userId } },
            { key: 'conversation_id', match: { value: conversationId } },
          ],
        },
        limit: 100,
        with_payload: true,
      });

      // Filter for image files
      
      const imagePoints = scrollResult.points.filter((point) => {
        // FIX: Use mimetype only for isImage detection (consistent with upload)
        const pm = String(point.payload?.mimetype || point.payload?.mimeType || '').toLowerCase();
        return pm.startsWith('image/');
      });

      if (imagePoints.length > 0) {
        const idsToDelete = imagePoints.map((p) => p.id);
        await qdrantClient.delete(RAG_COLLECTION, {
          points: idsToDelete,
        });
        console.log(`✅ Deleted ${idsToDelete.length} old image chunks`);
      }
    } catch (deleteErr) {
      console.warn('⚠️ Failed to delete old images (continuing):', deleteErr.message);
      // Continue with upload even if delete fails
    }
  }

  let text;
  try {
    text = await extractTextFromFile(file.buffer, file.mimetype, file.originalname);
  } catch (extractError) {
    console.error('❌ RAG text extraction failed:', extractError.message);
    const err = new Error(`Failed to extract text from ${file.originalname}: ${extractError.message}`);
    err.statusCode = 400;
    throw err;
  }

  if (!text || text.trim().length < 5) {
    console.error('❌ RAG no text extracted from file:', file.originalname);
    const err = new Error(`No text extracted from file ${file.originalname}. File may be empty or in unsupported format.`);
    err.statusCode = 400;
    throw err;
  }

  console.log('✅ RAG extracted', text.length, 'chars from', file.originalname);

  // Keep a single timestamp for all chunks from this upload.
  const uploadedAtMs = Date.now();
  const uploadedAtIso = new Date(uploadedAtMs).toISOString();
  const uploadId = makeUploadId();

  // V4.3: Chunk and clean
  const rawChunks = chunkText(text, 800, 120);
  console.log(`📦 [RAG] Created ${rawChunks.length} raw chunks`);
  
  // V4.3: Filter out binary garbage chunks
  const chunks = rawChunks.filter((chunk, idx) => {
    if (!chunk || chunk.trim().length < 10) {
      console.log(`⚠️ [RAG] Skipping chunk ${idx}: too short`);
      return false;
    }
    
    // Count printable vs non-printable characters
    const printable = (chunk.match(/[\x20-\x7E\n\r\t]/g) || []).length;
    const ratio = printable / chunk.length;
    
    if (ratio < 0.7) {
      console.log(`⚠️ [RAG] Skipping chunk ${idx}: ${Math.round(ratio * 100)}% printable (threshold 70%)`);
      return false;
    }
    
    return true;
  });
  
  console.log(`✅ [RAG] Kept ${chunks.length}/${rawChunks.length} clean chunks`);
  
  if (chunks.length === 0) {
    const err = new Error(`No valid chunks after filtering binary garbage from ${file.originalname}`);
    err.statusCode = 400;
    throw err;
  }

  const vectors = await embedChunksForRag(chunks, { userId, conversationId, operation: 'rag_upload_embeddings' });

  if (!vectors.length) {
    const err = new Error('Failed to embed chunks for RAG');
    err.statusCode = 500;
    throw err;
  }

  const points = vectors.map((vec, i) => ({
    id: makePointId(),
    vector: vec,
    payload: {
      user_id: userId,
      conversation_id: conversationId || null,
      filename: file.originalname,
      mimetype: file.mimetype,
      upload_id: uploadId,
      chunk_index: i,
      chunk_text: chunks[i],
      uploaded_at: uploadedAtIso,
      uploaded_at_ms: uploadedAtMs,
    },
  }));

  await qdrantClient.upsert(RAG_COLLECTION, {
    wait: true,
    points,
  });

  return {
    status: 'ok',
    file: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    chunks: chunks.length,
    extracted_chars: text.length,
    uploaded_at: uploadedAtIso,
    uploaded_at_ms: uploadedAtMs,
    upload_id: uploadId,
    // Helpful for the FlutterFlow UI: if the user uploads a file without text,
    // the client can show this as the "user prompt".
    suggested_prompt: `Analiziraj priloženi dokument: ${file.originalname}`,
  };
}

async function ragQuery({ userId, query, conversationId, topK = 5 }) {
  if (!userId || !query) {
    const err = new Error('userId and query are required');
    err.statusCode = 400;
    throw err;
  }
  if (!qdrantEnabled) {
    const err = new Error('Qdrant disabled');
    err.statusCode = 500;
    throw err;
  }

  await ensureRagCollection();

  const queryEmbedding = await getEmbedding(query, { userId, conversationId, operation: 'rag_query_embedding' });
  if (!queryEmbedding) {
    return { status: 'ok', answer: null, matches: [] };
  }

  const filter = { must: [{ key: 'user_id', match: { value: userId } }] };
  if (conversationId) {
    filter.must.push({ key: 'conversation_id', match: { value: conversationId } });
  }

  const hits = await qdrantClient.search(RAG_COLLECTION, {
    vector: queryEmbedding,
    limit: topK,
    filter,
    with_payload: true,
  });

  const context = hits
    .map((h, i) => {
      const p = h.payload || {};
      return `[${i + 1}] [file=${p.filename || 'unknown'}] ${p.chunk_text || ''}`;
    })
    .join('\n\n');

  const ragPrompt = `You are GPTNiX RAG assistant.

You must answer ONLY using the information in the provided context.
If the answer is not clearly covered by the context, say the documents do not contain this information and do NOT hallucinate.

CONTEXT:
${context}

QUESTION:
${query}

ANSWER:`;

  const answer = await callDeepSeek(ragPrompt, 0.2, 2000);

  return {
    status: 'ok',
    answer,
    matches: hits.map((h) => ({
      score: h.score,
      file: h.payload?.filename,
      index: h.payload?.chunk_index,
    })),
  };
}

/**
 * Lightweight helper for /chat: per-message RAG context block.
 */

async function ragContextForChat({
  userId,
  conversationId,
  query,
  topK = 6,
  windowMinutes = 10080, // 7 days
  maxContextChars = 6000,
  graceMinutes = 4,
  minScoreDoc = 0.25,
  minScoreNonDoc = 0.32,
}) {
  const start = Date.now();

  const meta = {
    ragUsed: false,
    strategy: 'none', // latest_upload | semantic | none
    upload_id: null,
    filename: null,
    chunksCount: 0,
    bestScore: null,
    reason: 'none',
    latency_ms: 0,
    hasRecentUpload: false,
  };

  try {
    if (!qdrantEnabled || !userId) {
      meta.reason = 'qdrant_disabled_or_missing_user';
      meta.latency_ms = Date.now() - start;
      return { ok: true, context: '', meta };
    }

    const ensured = await ensureRagCollection();
    if (!ensured) {
      meta.reason = 'ensure_collection_failed';
      meta.latency_ms = Date.now() - start;
      return { ok: true, context: '', meta };
    }

    const qTrim = String(query || '').trim();

    const isProbe = !qTrim;

    // Heuristic: doc-related intent
    const docRelatedPatterns = [
      /\b(pdf|dokument|docx?|ugovor|fajl|datoteka|prilog|prilozeni|priloženi|upload|u\s+pdf\b)\b/i,
      /\b(analiziraj|sažmi|sazmi|pročitaj|procitaj|izvuci|izvuci\s+iz|što\s+piše|sta\s+piše|sto\s+pise|sta\s+pise)\b/i,
      /\b(na\s+stranici|u\s+tablici|u\s+tabeli|u\s+tekstu|u\s+dokumentu)\b/i,
    ];
    const isDocRelated = docRelatedPatterns.some((re) => re.test(qTrim));

    const baseFilter = {
      must: [
        { key: 'user_id', match: { value: userId } },
        ...(conversationId ? [{ key: 'conversation_id', match: { value: conversationId } }] : []),
      ],
    };

    // Find latest upload within time window (for gating)
    const now = Date.now();
    const windowMs = Number(windowMinutes) * 60 * 1000;
    const sinceMs = now - windowMs;
    const graceMs = Number(graceMinutes) * 60 * 1000;

    const recentFilter = {
      must: [...baseFilter.must, { key: 'uploaded_at_ms', range: { gte: sinceMs } }],
    };

    let latestUpload = null; // { upload_id, filename, uploaded_at_ms, uploaded_at }

    try {
      const scrolled = await qdrantClient.scroll(RAG_COLLECTION, {
        filter: recentFilter,
        limit: 200,
        with_payload: true,
        with_vector: false,
      });

      const points = Array.isArray(scrolled?.points)
        ? scrolled.points
        : Array.isArray(scrolled?.result)
          ? scrolled.result
          : [];

      if (points.length) {
        meta.hasRecentUpload = true;
        for (const pt of points) {
          const p = pt?.payload || {};
          const t = Number(p.uploaded_at_ms || 0) || (p.uploaded_at ? Date.parse(p.uploaded_at) : 0) || 0;
          if (!latestUpload || t > Number(latestUpload.uploaded_at_ms || 0)) {
            latestUpload = {
              upload_id: p.upload_id || null,
              filename: p.filename || null,
              uploaded_at_ms: t,
              uploaded_at: p.uploaded_at || null,
            };
          }
        }
      }
    } catch (_e) {
      // ignore
    }

    if (isProbe) {
      meta.upload_id = latestUpload?.upload_id || null;
      meta.filename = latestUpload?.filename || null;
      meta.reason = latestUpload ? 'probe_has_upload' : 'probe_no_upload';
      meta.latency_ms = Date.now() - start;
      return { ok: true, context: '', meta };
    }

    const withinGrace = latestUpload && now - Number(latestUpload.uploaded_at_ms || 0) <= graceMs;
    const looksLikeAnalyze = /\b(analiziraj|sažmi|sazmi|objasni|izvuci|izvuci\s+iz|pronađi|pronadi)\b/i.test(qTrim);

    // Latest upload should only be used when doc-related OR shortly after upload + analyze-like
    const allowLatestMode = Boolean(latestUpload && (isDocRelated || (withinGrace && looksLikeAnalyze)));

    async function semanticSearch(filterOverride) {
      const queryEmbedding = await getEmbedding(qTrim, {
        userId,
        conversationId,
        operation: 'rag_chat_embedding',
      });
      if (!queryEmbedding) return [];

      const hits = await qdrantClient.search(RAG_COLLECTION, {
        vector: queryEmbedding,
        limit: topK,
        filter: filterOverride || baseFilter,
        with_payload: true,
      });

      return Array.isArray(hits) ? hits : [];
    }

    let hits = [];

    // 1) Latest upload mode (restricted to upload_id or filename)
    if (allowLatestMode) {
      const restrictedFilter = latestUpload?.upload_id
        ? { must: [...baseFilter.must, { key: 'upload_id', match: { value: latestUpload.upload_id } }] }
        : latestUpload?.filename
          ? { must: [...baseFilter.must, { key: 'filename', match: { value: latestUpload.filename } }] }
          : baseFilter;

      hits = await semanticSearch(restrictedFilter);
      meta.strategy = 'latest_upload';
      meta.upload_id = latestUpload?.upload_id || null;
      meta.filename = latestUpload?.filename || null;
      meta.reason = isDocRelated ? 'doc_related' : 'grace_window';
    }

    // 2) General semantic mode: only if score threshold passes
    if (!hits.length) {
      const semanticHits = await semanticSearch(baseFilter);
      const best = semanticHits[0];
      const bestScore = best?.score != null ? Number(best.score) : null;
      meta.bestScore = bestScore;

      const threshold = isDocRelated ? minScoreDoc : minScoreNonDoc;
      if (bestScore != null && bestScore >= threshold) {
        hits = semanticHits;
        meta.strategy = 'semantic';
        meta.reason = isDocRelated ? 'doc_related_semantic' : 'semantic_threshold_pass';
      } else {
        meta.strategy = 'none';
        meta.reason = isDocRelated ? 'no_relevant_hits' : 'non_doc_threshold_fail';
        meta.latency_ms = Date.now() - start;
        return { ok: true, context: '', meta };
      }
    }

    if (!hits.length) {
      meta.reason = 'no_hits';
      meta.latency_ms = Date.now() - start;
      return { ok: true, context: '', meta };
    }

    const main = hits[0]?.payload || {};
    meta.upload_id = meta.upload_id || main.upload_id || null;
    meta.filename = meta.filename || main.filename || null;
    meta.bestScore = meta.bestScore != null ? meta.bestScore : hits[0]?.score != null ? Number(hits[0].score) : null;
    meta.chunksCount = hits.length;
    meta.ragUsed = true;

    const prettyTime = (iso, ms) => {
      if (iso) return iso;
      const t = Number(ms || 0);
      return t ? new Date(t).toISOString() : 'unknown';
    };

    const headerLines = [];
    headerLines.push('📄 RAG DOCUMENT CONTEXT');
    if (meta.filename) headerLines.push(`Filename: ${meta.filename}`);
    if (meta.upload_id) headerLines.push(`UploadId: ${meta.upload_id}`);
    headerLines.push(`Uploaded: ${prettyTime(main.uploaded_at, main.uploaded_at_ms)}`);
    headerLines.push('');
    headerLines.push('EXCERPTS (use these as file content):');

    let context = headerLines.join('\n') + '\n';

    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      const p = h?.payload || {};
      const chunkNo = Number.isFinite(Number(p.chunk_index)) ? Number(p.chunk_index) : i;
      const text = String(p.chunk_text || '').replace(/\s+/g, ' ').trim();
      const line = `- [${i + 1}] (${p.filename || meta.filename || 'file'}, chunk ${chunkNo}) ${text}`;
      if (context.length + line.length + 2 > maxContextChars) break;
      context += line.slice(0, 1200) + '\n';
    }

    context +=
      '\nRULE: Use ONLY the excerpts above when answering about the document. If missing, say the document does not contain it.\n';

    console.log('[RAG] context result', {
      ragUsed: meta.ragUsed,
      strategy: meta.strategy,
      upload_id: meta.upload_id,
      chunks: meta.chunksCount,
      bestScore: meta.bestScore != null ? meta.bestScore.toFixed(3) : null,
      reason: meta.reason,
      latency_ms: meta.latency_ms,
      contextChars: context.length,
    });

    meta.latency_ms = Date.now() - start;
    return { ok: true, context, meta };
  } catch (err) {
    console.warn('⚠️ [RAG] context error (ignored):', err?.message || err);
    meta.reason = 'exception';
    meta.latency_ms = Date.now() - start;
    return { ok: false, context: '', meta };
  }
}
module.exports = { ragUpload, ragQuery, ragContextForChat };
