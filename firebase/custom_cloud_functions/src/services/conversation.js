'use strict';

const { db } = require('../config/firebase');
const { CONVERSATIONS_COLLECTION } = require('../config/env');

const ORDER_FIELDS = [
  'created_at',
  'createdAt',
  'created_at_utc',
  'timestamp',
  'time',
  'createdAtMs',
  'created_at_ms',
];

const MESSAGE_COLLECTIONS = ['messages', 'chat_messages', 'chatMessages', 'msgs'];

function toMillis(v) {
  if (!v) return null;

  // Firestore Timestamp
  if (typeof v === 'object' && typeof v.toMillis === 'function') {
    try {
      return v.toMillis();
    } catch {
      // ignore
    }
  }

  if (typeof v === 'number' && Number.isFinite(v)) return v;

  if (typeof v === 'string') {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return parsed;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }

  // Firestore Timestamp-like
  if (typeof v === 'object' && v._seconds != null) {
    const ms = Number(v._seconds) * 1000 + Number(v._nanoseconds || 0) / 1e6;
    if (!Number.isNaN(ms)) return ms;
  }

  return null;
}

function normalizeRole(data = {}) {
  const raw =
    data.role ??
    data.senderRole ??
    data.authorRole ??
    data.messageRole ??
    data.fromRole ??
    data.sender ??
    data.from ??
    data.author ??
    data.type ??
    data.messageType ??
    '';

  const r = String(raw || '').toLowerCase().trim();

  // Preserve system role if it exists (some clients store it).
  if (r === 'system') return 'system';
  if (['assistant', 'ai', 'bot', 'gpt'].includes(r)) return 'assistant';
  if (['user', 'human'].includes(r)) return 'user';

  // common boolean flags
  const userFlags = ['isUser', 'fromUser', 'user', 'human', 'from_user'];
  for (const f of userFlags) {
    if (data[f] === true) return 'user';
  }
  const aiFlags = ['isAi', 'isAI', 'fromAi', 'fromAI', 'assistant', 'bot', 'ai', 'from_ai'];
  for (const f of aiFlags) {
    if (data[f] === true) return 'assistant';
  }

  // sender/id style strings
  const sender = String(data.senderId ?? data.sender ?? data.from ?? data.author ?? '').toLowerCase();
  if (
    sender.includes('assist') ||
    sender.includes('bot') ||
    sender.includes('ai') ||
    sender.includes('gpt')
  ) {
    return 'assistant';
  }
  if (sender.includes('user') || sender.includes('human')) return 'user';

  // fallback
  return 'user';
}

function extractContent(data = {}) {
  const v =
    data.text ??
    data.content ??
    data.message ??
    data.body ??
    data.value ??
    data.prompt ??
    data.response ??
    '';

  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    if (typeof v.text === 'string') return v.text;
    if (typeof v.content === 'string') return v.content;
  }
  return String(v || '');
}

/**
 * Reads last messages from Firestore.
 * Expects: conversations/{conversationId}/(messages|chat_messages|chatMessages|msgs)
 * Robust to different field names used by FlutterFlow.
 */
async function getConversationHistory(conversationId, options = {}) {
  const limitRaw = options.limit ?? options.max ?? 60;
  // Important: we want the *latest* messages.
  const limit = Math.max(1, Math.min(120, Number(limitRaw) || 60));

  try {
    const doc = await db.collection(CONVERSATIONS_COLLECTION).doc(conversationId).get();
    if (!doc.exists) return [];

    let snap = null;
    let usedField = null;
    let usedCollection = null;

    // Try ordered queries on known collections + fields.
    // NOTE: Use DESC to fetch the latest messages, then we will re-sort chronologically.
    for (const colName of MESSAGE_COLLECTIONS) {
      const col = doc.ref.collection(colName);

      for (const field of ORDER_FIELDS) {
        try {
          snap = await col.orderBy(field, 'desc').limit(limit).get();
          usedField = field;
          usedCollection = colName;
          break;
        } catch {
          // try next field
        }
      }

      // If we got docs, stop.
      if (snap && snap.size > 0) break;

      // If ordered query returned 0 docs, try unordered in this collection.
      if (!snap || snap.size === 0) {
        try {
          const tmp = await col.limit(limit).get();
          if (tmp && tmp.size > 0) {
            snap = tmp;
            usedCollection = colName;
            usedField = null;
            break;
          }
        } catch {
          // try next collection
        }
      }
    }

    if (!snap) return [];

    const rawMsgs = snap.docs.map((d) => {
      const data = d.data() || {};
      const role = normalizeRole(data);
      const content = extractContent(data).slice(0, 2000).trim();
      const ts = toMillis(
        data.created_at ??
          data.createdAt ??
          data.timestamp ??
          data.time ??
          data.createdAtMs ??
          data.created_at_ms ??
          data.created_at_utc,
      );

      return { role, content, ts: ts ?? 0 };
    });

    let msgs = rawMsgs.filter((m) => m.content);

    // Always sort chronologically (ASC). Even if we fetched DESC, we want natural chat order.
    msgs = msgs.sort((a, b) => (a.ts || 0) - (b.ts || 0));

    console.log(
      `💬 Loaded ${msgs.length} history messages (col=${usedCollection || 'unknown'}, order=${
        usedField || 'none'
      }, limit=${limit}).`,
    );

    return msgs.map(({ role, content, ts }) => ({ role, content, ts }));
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

async function getDefaultSystemPrompt() {
  try {
    const doc = await db.collection('system_prompts').doc('default').get();
    if (doc.exists) {
      const data = doc.data();
      if (data.active === true && data.text) {
        return data.text;
      }
    }
  } catch (error) {
    console.error('System prompt fetch error:', error.message);
  }

  // Sensible, production-safe default. (Can be overridden via Firestore: system_prompts/default)
  return (
    'You are GPTNiX, a helpful AI assistant.\n' +
    '\n' +
    'CORE RULES:\n' +
    '- Stay on the user\'s latest message. Assume continuity within the conversation.\n' +
    '- Be direct, useful, and practical.\n' +
    '- If you are unsure, say so. Do NOT guess.\n' +
    '- Never dump internal tool payloads (raw JSON/XML or tool blocks). Use them silently.\n' +
    '- For very short follow-ups (e.g., "ne", "ok", "nije dobar"), assume they refer to the current topic. If ambiguous, ask ONE clarifying question.\n' +
    '\n' +
    'WHEN WEB SEARCH RESULTS ARE PROVIDED:\n' +
    '- Treat them as the ONLY source of fresh facts.\n' +
    '- Do NOT invent details that are not explicitly supported by the results.\n' +
    '- If the results do not contain the needed detail, say: "Ne mogu potvrditi iz dostupnih izvora" and suggest what to check.\n' +
    '- Use simple bracket citations like [1], [2] that refer to the numbered web results list.\n' +
    '\n' +
    'WHEN WIKI / WIKIDATA / OSM TOOL DATA IS PROVIDED:\n' +
    '- Treat it as verified tool output for stable facts (names, places, coordinates, basic descriptions).\n' +
    '- Do NOT add extra factual claims that are not explicitly supported by the provided tool data.\n' +
    '- If a requested detail is missing, say you cannot confirm it from the available context and suggest what to check.\n' +
    '\n' +
    'FORMATTING:\n' +
    '- If you provide code, always wrap it in triple backticks and include the language.\n' +
    '- If you provide multiple code examples, each example gets its own code block.\n'
  );
}

module.exports = { getConversationHistory, getDefaultSystemPrompt };
