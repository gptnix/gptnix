'use strict';

/**
 * titleGenerator.js — Auto-generate conversation titles using LLM
 *
 * FIXES (v5.2.3 - combined):
 * 1. Race condition: setImmediate → setTimeout(3000ms) da FF stigne kreirati doc
 * 2. update() → set({merge:true}) — update() baca error ako doc ne postoji
 * 3. shouldGenerateTitle(null) → true (ne blokiramo ako doc još ne postoji)
 * 4. OpenAI fallback na DeepSeek ako OPENAI_API_KEY nije postavljen
 * 5. Hardkodano 'conversations' → CONVERSATIONS_COLLECTION iz env
 */

const { getFirestore } = require('../billing/firestore');
const { OPENAI_API_KEY, DEEPSEEK_API_KEY, CONVERSATIONS_COLLECTION } = require('../config/env');

// ─────────────────────────────────────────
// Heuristički fallback (bez LLM-a)
// ─────────────────────────────────────────
function _heuristicTitle(userMessage) {
  const words = String(userMessage || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const title = words.slice(0, 5).join(' ');
  return title.length >= 3 ? title : 'Chat ' + new Date().toLocaleDateString();
}

// ─────────────────────────────────────────
// LLM poziv s fallback lancem: OpenAI → DeepSeek → heuristika
// ─────────────────────────────────────────
async function _callLLMForTitle(prompt) {
  // 1) Pokušaj OpenAI ako ima key
  if (OPENAI_API_KEY) {
    try {
      const { callOpenAIChat } = require('./providers/openaiChat');
      const result = await callOpenAIChat(
        { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] },
        0.7, 60, null
      );
      if (result && String(result).trim().length >= 3) {
        console.log('[TITLE_GEN] Used OpenAI for title');
        return String(result).trim();
      }
    } catch (e) {
      console.warn('[TITLE_GEN] OpenAI failed, trying DeepSeek:', e.message);
    }
  }

  // 2) Fallback na DeepSeek
  if (DEEPSEEK_API_KEY) {
    try {
      const { callDeepSeek } = require('./providers/deepseek');
      const result = await callDeepSeek(
        { model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }] },
        0.7, 60, null
      );
      if (result && String(result).trim().length >= 3) {
        console.log('[TITLE_GEN] Used DeepSeek for title');
        return String(result).trim();
      }
    } catch (e) {
      console.warn('[TITLE_GEN] DeepSeek also failed:', e.message);
    }
  }

  return null; // caller koristi heuristiku
}

// ─────────────────────────────────────────
// Provjera treba li generirati naslov
// ─────────────────────────────────────────
function shouldGenerateTitle(convData) {
  // Ako doc ne postoji (FF ga još nije kreirao) → generiraj
  if (!convData) {
    console.log('[TITLE_GEN] No convData (doc not yet created) → will generate');
    return true;
  }

  const messageCount = Number(convData.message_count || 0);
  const title = String(convData.title || '').trim().toLowerCase();
  const isManual = Boolean(convData.title_is_manual);

  if (isManual) {
    console.log('[TITLE_GEN] Skipping: title is manual');
    return false;
  }

  if (messageCount > 4) {
    console.log('[TITLE_GEN] Skipping: message_count too high:', messageCount);
    return false;
  }

  const genericTitles = [
    'new chat', 'novi chat', 'new conversation',
    'nova konverzacija', 'untitled', 'bez naslova', '',
  ];

  if (!title || genericTitles.includes(title)) {
    console.log('[TITLE_GEN] Will generate: title is empty or generic');
    return true;
  }

  console.log('[TITLE_GEN] Skipping: already has good title:', title);
  return false;
}

// ─────────────────────────────────────────
// Generiranje naslova
// ─────────────────────────────────────────
async function generateConversationTitle(conversationId, userMessage, assistantMessage, { language } = {}) {
  try {
    console.log('[TITLE_GEN] Generating title for conversation:', conversationId);

    const maxLength = 600;
    const userMsg = String(userMessage || '').substring(0, maxLength);
    const aiMsg = String(assistantMessage || '').substring(0, maxLength);

    const langHint = language
      ? `Generate the title in this language: ${language}. `
      : '';

    const titlePrompt = `Based on this conversation, generate a very short, descriptive title (max 40 characters).
${langHint}
User: ${userMsg}
Assistant: ${aiMsg}

Generate ONLY the title, nothing else. Make it concise and clear. Do NOT use quotes.

Examples of good titles:
- "Pizza Recipe Help"
- "Python Code Debug"
- "Travel to Japan"

Your title:`;

    let generatedTitle = await _callLLMForTitle(titlePrompt);

    if (!generatedTitle) {
      // Heuristički fallback — bolje od "New Chat"
      generatedTitle = _heuristicTitle(userMessage);
      console.log('[TITLE_GEN] Using heuristic fallback title:', generatedTitle);
    }

    // Čišćenje
    generatedTitle = generatedTitle
      .replace(/^[\"']|[\"']$/g, '')
      .replace(/^Title:\s*/i, '')
      .replace(/^-\s*/, '')
      .trim();

    if (generatedTitle.length > 50) {
      generatedTitle = generatedTitle.substring(0, 47) + '...';
    }

    if (!generatedTitle || generatedTitle.length < 3) {
      generatedTitle = 'Chat ' + new Date().toLocaleDateString();
    }

    const db = getFirestore();
    if (!db) {
      console.warn('[TITLE_GEN] Firestore not available');
      return generatedTitle;
    }

    // ✅ FIX #4: CONVERSATIONS_COLLECTION umjesto hardkodanog 'conversations'
    // ✅ FIX #2: set({merge:true}) umjesto update() — ne baca error ako doc ne postoji
    const collection = CONVERSATIONS_COLLECTION || 'conversations';
    await db.collection(collection).doc(conversationId).set(
      {
        title: generatedTitle,
        title_is_manual: false,
        title_generated_at: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`✅ [TITLE_GEN] Title updated: "${generatedTitle}" (conv: ${conversationId})`);
    return generatedTitle;

  } catch (error) {
    console.error('❌ [TITLE_GEN] Failed:', error.message || String(error));
    return null;
  }
}

// ─────────────────────────────────────────
// Fire-and-forget scheduler
// ─────────────────────────────────────────
function scheduleTitleGeneration({ conversationId, userMessage, assistantMessage, language }) {
  if (!conversationId || !userMessage || !assistantMessage) {
    return;
  }

  // ✅ FIX #1: setTimeout(3000) umjesto setImmediate
  // setImmediate se izvršava gotovo odmah — FF frontend još nije kreirao
  // conversations/{id} dokument u Firestoreu (race condition)
  setTimeout(async () => {
    try {
      const db = getFirestore();
      if (!db) {
        console.warn('[TITLE_GEN] Firestore not available');
        return;
      }

      // ✅ FIX #3: Više ne hard-failamo ako doc ne postoji
      let convData = null;
      try {
        const collection = CONVERSATIONS_COLLECTION || 'conversations';
        const convDoc = await db.collection(collection).doc(conversationId).get();
        convData = convDoc.exists ? convDoc.data() : null;
        if (!convDoc.exists) {
          console.log('[TITLE_GEN] Doc ne postoji još → nastavljamo, set+merge će ga kreirati');
        }
      } catch (readErr) {
        console.warn('[TITLE_GEN] Ne mogu čitati conversation doc:', readErr.message);
        // nastavi — set+merge će kreirati doc
      }

      if (!shouldGenerateTitle(convData)) {
        return;
      }

      await generateConversationTitle(conversationId, userMessage, assistantMessage, { language });

    } catch (error) {
      console.error('[TITLE_GEN] Schedule failed:', error.message || String(error));
    }
  }, 3000); // 3s delay — daje FF-u vremena da kreira Firestore doc
}

module.exports = {
  shouldGenerateTitle,
  generateConversationTitle,
  scheduleTitleGeneration,
};
