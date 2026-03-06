'use strict';

const { db } = require('../config/firebase');
const { OPENAI_API_KEY, CONVERSATIONS_COLLECTION } = require('../config/env');
const { callOpenAIChat } = require('./providers/openaiChat');
const { callDeepSeek } = require('./providers/deepseek');

const SUMMARY_FIELD = 'thread_summary';

async function getThreadSummary(conversationId) {
  if (!conversationId) return '';
  try {
    const doc = await db.collection(CONVERSATIONS_COLLECTION).doc(conversationId).get();
    if (!doc.exists) return '';
    const data = doc.data() || {};
    const s = typeof data[SUMMARY_FIELD] === 'string' ? data[SUMMARY_FIELD] : '';
    return s.trim();
  } catch (e) {
    console.warn('⚠️ [THREAD-SUMMARY] get failed:', e.message);
    return '';
  }
}

async function saveThreadSummary(conversationId, summary) {
  if (!conversationId) return;
  const s = String(summary || '').trim();
  if (!s) return;
  try {
    await db
      .collection(CONVERSATIONS_COLLECTION)
      .doc(conversationId)
      .set(
        {
          [SUMMARY_FIELD]: s.slice(0, 1200),
          thread_summary_updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
  } catch (e) {
    console.warn('⚠️ [THREAD-SUMMARY] save failed:', e.message);
  }
}

/**
 * Update a running summary after each assistant turn.
 * This is language-agnostic and works for multilingual chats.
 */
async function updateThreadSummary({ conversationId, previousSummary, userMessage, assistantMessage }) {
  if (!conversationId) return '';

  const prev = String(previousSummary || '').trim();
  const u = String(userMessage || '').trim();
  const a = String(assistantMessage || '').trim();
  if (!u || !a) return prev;

  const messages = [
    {
      role: 'system',
      content:
        'You are an internal summarization engine for a chat assistant. ' +
        'Maintain a short running summary of the conversation so the assistant can stay on topic.\n\n' +
        'Rules:\n' +
        '- Keep it factual and compact (max ~7 bullet points or 6–10 short lines).\n' +
        '- Preserve names, ids, numbers, requirements.\n' +
        '- Do NOT add speculation.\n' +
        '- Do NOT include private/sensitive details unless the user explicitly provided them and they are essential.\n' +
        '- Output ONLY valid JSON: {"summary":"..."}.',
    },
    {
      role: 'user',
      content:
        JSON.stringify(
          {
            previous_summary: prev,
            new_turn: { user: u, assistant: a },
          },
          null,
          2,
        ),
    },
  ];

  try {
    const raw = OPENAI_API_KEY
      ? await callOpenAIChat({ messages }, 0.1, 300)
      : await callDeepSeek({ messages }, 0.1, 300);

    let parsed = null;
    try {
      parsed = JSON.parse(String(raw || '').trim());
    } catch {
      parsed = null;
    }

    const next = (parsed && typeof parsed.summary === 'string' ? parsed.summary : String(raw || '')).trim();
    if (next) {
      await saveThreadSummary(conversationId, next);
      return next;
    }
    return prev;
  } catch (e) {
    console.warn('⚠️ [THREAD-SUMMARY] update failed:', e.message);
    return prev;
  }
}

module.exports = { getThreadSummary, updateThreadSummary };
