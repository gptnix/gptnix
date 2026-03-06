'use strict';

const { v4: uuidv4 } = require('uuid');
const { OPENAI_API_KEY, MEMORY_EXTRACT_PROVIDER, MEMORY_EXTRACT_MODEL, MEMORY_EXTRACT_MAX_TOKENS } = require('../config/env');
const {
  qdrantClient,
  qdrantEnabled,
  ensureMemoriesCollection,
} = require('../clients/qdrant');
const { getEmbedding } = require('./embeddings');
const { callOpenAIChat } = require('./providers/openaiChat');
const { callDeepSeek } = require('./providers/deepseek');

const COLLECTION_NAME = require('../config/env').COLLECTION_NAME;

async function extractSemanticMemory(conversation, userId) {
  if (!qdrantEnabled || !OPENAI_API_KEY) {
    console.log('🧠 [MEMORY] Skipping extraction — Qdrant or embeddings disabled');
    return { extracted: 0, stored: 0, skipped: 1, failed: 0 };
  }

  const conversationText = (conversation || [])
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n');

  if (conversationText.length < 50) {
    console.log('🧠 [MEMORY] Conversation too short, skipping.');
    return { extracted: 0, stored: 0, skipped: 1, failed: 0 };
  }

  const prompt = `You are a memory extraction module for an AI assistant.
From the following conversation, extract 3–5 *long-term* facts about the USER.

Rules:
- Focus on stable facts: name, age, family, work, preferences, location (if stable), habits.
- Skip temporary things like: today's weather, one-off jokes, random small talk.
- Each memory must be SHORT and standalone.
- importance is a number 0.0–1.0 (0.9 = very important, 0.6 = medium).
- category is one word: "personal", "family", "work", "preferences", "health", "other".
- DO NOT invent any facts. If there are no clear long-term facts, return an empty JSON array [].

Conversation:
${conversationText.slice(0, 2000)}

Return ONLY JSON in one of these shapes, no commentary:
1) Plain array:
[
  {"content": "User's name is <NAME>", "importance": 0.9, "category": "personal"},
  {"content": "User lives in <CITY/COUNTRY>", "importance": 0.7, "category": "personal"}
]

or

2) { "memories": [ ...same objects as above... ] }`;

  try {
    console.log('🧠 [MEMORY] Extracting from conversation for user:', userId);
    const provider = String(MEMORY_EXTRACT_PROVIDER || 'auto').toLowerCase();
    const maxTokens = Number.isFinite(Number(MEMORY_EXTRACT_MAX_TOKENS)) ? Number(MEMORY_EXTRACT_MAX_TOKENS) : 900;

    let response = '';
    if ((provider === 'openai' || provider === 'auto') && OPENAI_API_KEY) {
      response = await callOpenAIChat(
        { prompt, model: MEMORY_EXTRACT_MODEL || 'gpt-4o-mini' },
        0.2,
        maxTokens,
        { operation: 'memory_extract', userId: userId || 'guest' },
      );
    } else {
      response = await callDeepSeek(prompt, 0.2, maxTokens);
    }

    let cleaned = response.trim();

    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '');
    }

    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.slice(firstBracket, lastBracket + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('🧠 [MEMORY] JSON parse failed:', e.message);
      console.error('🧠 [MEMORY] Raw response (first 500 chars):', cleaned.slice(0, 500));
      return { extracted: 0, stored: 0, skipped: 0, failed: 1 };
    }

    let memories = [];
    if (Array.isArray(parsed)) {
      memories = parsed;
    } else if (parsed && Array.isArray(parsed.memories)) {
      memories = parsed.memories;
    } else if (parsed && Array.isArray(parsed.data)) {
      memories = parsed.data;
    } else {
      console.error('🧠 [MEMORY] Response has no array of memories');
      console.error('🧠 [MEMORY] Parsed object:', JSON.stringify(parsed, null, 2));
      return { extracted: 0, stored: 0, skipped: 0, failed: 1 };
    }

    console.log(`🧠 [MEMORY] Extracted ${memories.length} candidate memories for user ${userId}`);
    console.log('🧠 [MEMORY] Parsed memories:', JSON.stringify(memories, null, 2));

    let stored = 0;
    await ensureMemoriesCollection();

    for (const memory of memories.slice(0, 5)) {
      let rawContent =
        typeof memory === 'string' ? memory : memory.content || memory.text || memory.memory || '';

      const content = rawContent.toString().trim();
      const importance = Number(
        typeof memory === 'object' && memory.importance != null ? memory.importance : 0.8,
      );
      const category = ((typeof memory === 'object' && memory.category) || 'other').toString();

      if (!content || content.length < 8) {
        console.log('🧠 [MEMORY] Skipping short/empty memory:', content);
        continue;
      }

      if (importance < 0.60) {
        console.log(`🧠 [MEMORY] Skipping low-importance (${importance.toFixed(2)}) memory: ${content}`);
        continue;
      }

      try {
        console.log('🧠 [MEMORY] Embedding & storing:', content);
        const embedding = await getEmbedding(content, { userId, operation: 'memory_extract_embedding' });
        if (!embedding) {
          console.log('🧠 [MEMORY] Embedding failed, skipping point.');
          continue;
        }

        try {
          const dupCheck = await qdrantClient.search(COLLECTION_NAME, {
            vector: embedding,
            filter: {
              must: [{ key: 'userId', match: { value: userId } }],
            },
            limit: 1,
            score_threshold: 0.99, // Increased from 0.985 (stricter duplicate detection)
          });

          if (dupCheck && dupCheck.length > 0) {
            console.log('🧠 [MEMORY] Detected near-duplicate memory, skipping store:', content);
            continue;
          }
        } catch (dupErr) {
          console.warn('🧠 [MEMORY] Duplicate check failed (continuing):', dupErr);
        }

        await qdrantClient.upsert(COLLECTION_NAME, {
          wait: true,
          points: [
            {
              id: uuidv4(),
              vector: embedding,
              payload: {
                content,
                userId,
                importance,
                category,
                timestamp: new Date().toISOString(),
              },
            },
          ],
        });

        stored++;
        console.log('🧠 [MEMORY] Stored OK.');
      } catch (error) {
        console.error('🧠 [MEMORY] Failed to store memory:', error);
      }
    }

    return { extracted: memories.length, stored, skipped: 0, failed: 0 };
  } catch (error) {
    console.error('❌ [MEMORY] Extraction error:', error);
    return { extracted: 0, stored: 0, skipped: 0, failed: 1 };
  }
}

async function retrieveFromQdrant(userId, query, limit = 5) {
  if (!qdrantEnabled) {
    console.log('🧠 [MEMORY] Retrieval skipped — Qdrant disabled');
    return [];
  }

  try {
    await ensureMemoriesCollection();

    const queryEmbedding = await getEmbedding(query, { userId, operation: 'memory_retrieve_embedding' });
    if (!queryEmbedding) {
      console.log('🧠 [MEMORY] No embedding for query, aborting search.');
      return [];
    }

    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      filter: {
        must: [{ key: 'userId', match: { value: userId } }],
      },
      limit,
      score_threshold: 0.2,
    });

    const rawCount = searchResult.length;

    const cleanedResults = searchResult.filter((p) => {
      const payload = p.payload || {};
      const txt = payload.content || payload.text || payload.memory || payload.value || '';
      return txt && txt.toString().trim().length > 0;
    });

    console.log(
      `🧠 [MEMORY] Retrieved ${rawCount} raw memories, ${cleanedResults.length} with non-empty content for user ${userId}`,
    );

    cleanedResults.forEach((p, idx) => {
      const payload = p.payload || {};
      const txt = payload.content || payload.text || payload.memory || payload.value || '';
      console.log(`   [${idx}] score=${p.score?.toFixed?.(3)} content="${txt}"`);
    });

    return cleanedResults;
  } catch (error) {
    console.error('❌ [MEMORY] Qdrant retrieval error:', error);
    return [];
  }
}

async function hardDeleteMemoriesByInstruction(userId, instruction) {
  if (!qdrantEnabled || !OPENAI_API_KEY) {
    console.log('🧠 [MEMORY-DELETE] Skipping — Qdrant or embeddings disabled');
    return { deletedCount: 0, ids: [] };
  }

  try {
    await ensureMemoriesCollection();

    const trimmed = (instruction || '').trim();
    if (!trimmed) {
      console.log('🧠 [MEMORY-DELETE] Empty instruction, skipping');
      return { deletedCount: 0, ids: [] };
    }

    console.log('🧠 [MEMORY-DELETE] Deletion requested for user:', userId);
    console.log('🧠 [MEMORY-DELETE] Instruction:', trimmed);

    const instructionEmbedding = await getEmbedding(trimmed, { userId, operation: 'memory_delete_instruction_embedding' });
    if (!instructionEmbedding) {
      console.log('🧠 [MEMORY-DELETE] No embedding for instruction, aborting');
      return { deletedCount: 0, ids: [] };
    }

    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: instructionEmbedding,
      filter: {
        must: [{ key: 'userId', match: { value: userId } }],
      },
      limit: 20,
    });

    if (!searchResult || searchResult.length === 0) {
      console.log('🧠 [MEMORY-DELETE] No memories found for deletion');
      return { deletedCount: 0, ids: [] };
    }

    const SCORE_THRESHOLD = 0.45;
    const candidates = searchResult.filter((p) => (p.score || 0) >= SCORE_THRESHOLD);

    console.log(
      `🧠 [MEMORY-DELETE] Found ${searchResult.length} candidates, ${candidates.length} above threshold (${SCORE_THRESHOLD})`,
    );

    candidates.forEach((p, idx) => {
      const payload = p.payload || {};
      const txt = payload.content || payload.text || payload.memory || payload.value || '';
      console.log(
        `   [DEL-CANDIDATE ${idx}] score=${p.score?.toFixed?.(3)} content="${txt}" id=${p.id}`,
      );
    });

    const idsToDelete = candidates.map((p) => p.id).filter(Boolean);

    if (!idsToDelete.length) {
      console.log('🧠 [MEMORY-DELETE] No IDs to delete after filtering, aborting');
      return { deletedCount: 0, ids: [] };
    }

    await qdrantClient.delete(COLLECTION_NAME, {
      points: idsToDelete,
      wait: true,
    });

    console.log('🧠 [MEMORY-DELETE] Deleted memory IDs:', idsToDelete);
    return { deletedCount: idsToDelete.length, ids: idsToDelete };
  } catch (error) {
    console.error('❌ [MEMORY-DELETE] Error during hard delete:', error);
  }
}

// Strip command prefixes so we store the actual fact, not the command
function _stripMemoryCommandPrefix(text) {
  return String(text || '')
    .replace(/^\s*(zapamti|zabiljezi|zabilježi|spremi|snimi|remember|save)\s+(da\s+)?(u\s+)?(memoriju|memory)?\s*/i, '')
    .replace(/^\s*(zapamti|zabiljezi|zabilježi|spremi|snimi|remember|save)\s+/i, '')
    .trim();
}

async function saveMemoryFromInstruction({ userId, conversationId, content, source = 'explicit' }) {
  if (!qdrantEnabled || !OPENAI_API_KEY) {
    console.log('🧠 [MEMORY-SAVE] Skipping — Qdrant or embeddings disabled');
    return { saved: false, id: null, content: '' };
  }

  try {
    await ensureMemoriesCollection();

    // Strip command prefix so we store the fact, not the command verb
    const cleaned = _stripMemoryCommandPrefix(content);
    if (!cleaned || cleaned.length < 3) return { saved: false, id: null, content: '' };

    const vector = await getEmbedding(cleaned, { userId, conversationId, operation: 'memory_save_embedding' });
    if (!vector) return { saved: false, id: null, content: cleaned };

    // Dup check before saving
    try {
      const dupCheck = await qdrantClient.search(COLLECTION_NAME, {
        vector,
        filter: { must: [{ key: 'userId', match: { value: userId } }] },
        limit: 1,
        score_threshold: 0.97,
      });
      if (dupCheck && dupCheck.length > 0) {
        console.log('🧠 [MEMORY-SAVE] Near-duplicate detected, skipping:', cleaned);
        return { saved: false, id: null, content: cleaned, duplicate: true };
      }
    } catch (_) {}

    const id = require('crypto').randomUUID();

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id,
          vector,
          payload: {
            userId,
            conversationId: conversationId || null,
            content: cleaned,
            source,
            // ✅ Required fields for memoryInjector two-tier system:
            importance: 0.90,          // Explicit saves are high importance
            category: 'personal',      // Default category — ensures core memory eligibility
            timestamp: new Date().toISOString(), // Used for age filtering
          },
        },
      ],
    });

    console.log('🧠 [MEMORY-SAVE] Saved memory id=', id, 'content=', cleaned);
    return { saved: true, id, content: cleaned };
  } catch (error) {
    console.error('❌ [MEMORY-SAVE] Error saving memory:', error);
    return { saved: false, id: null, content: String(content || '').trim() };
  }
}


module.exports = {
  extractSemanticMemory,
  retrieveFromQdrant,
  hardDeleteMemoriesByInstruction,
  saveMemoryFromInstruction,
};
