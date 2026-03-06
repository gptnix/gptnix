'use strict';

const { admin, db } = require('../config/firebase');
const { CONVERSATIONS_COLLECTION } = require('../config/env');
const { uploadImageFromUrl } = require('./storage');

function nowIsoCompact() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function guessExtFromUrl(url = '') {
  const m = url.match(/\.([a-zA-Z0-9]{3,4})(\?|$)/);
  if (!m) return 'webp';
  return m[1].toLowerCase();
}

/**
 * Upload Replicate-hosted images to Firebase Storage, then write an "image message" to Firestore.
 * This is optional: only runs when conversationId is present.
 */
async function persistGeneratedImages({
  conversationId,
  userId,
  prompt,
  prompt_en,
  prompt_final,
  provider,
  model,
  preset,
  predictionId,
  images = [],
  storeMessage = true,
  meta = null,
}) {
  if (!conversationId) {
    return { stored: false, reason: 'conversationId missing' };
  }

  if (!Array.isArray(images) || images.length === 0) {
    return { stored: false, reason: 'no images to store' };
  }

  const convRef = db.collection(CONVERSATIONS_COLLECTION).doc(conversationId);

  const ts = nowIsoCompact();
  const uploads = [];

  for (let i = 0; i < images.length; i++) {
    const srcUrl = images[i];
    const ext = guessExtFromUrl(srcUrl);
    const destination = `gptnix/images/${userId || 'anon'}/${predictionId || 'pred'}-${ts}-${i}.${ext}`;

    const uploaded = await uploadImageFromUrl({
      url: srcUrl,
      destination,
    });

    uploads.push({
      index: i,
      sourceUrl: srcUrl,
      storageBucket: uploaded.bucket,
      storagePath: uploaded.path,
      downloadUrl: uploaded.downloadUrl,
    });
  }

  if (!storeMessage) {
    // Best-effort: bump conversation timestamp so clients know something happened.
    try {
      await convRef.set(
        { updated_at: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
    } catch {
      // ignore
    }

    return {
      stored: true,
      messageId: null,
      uploads,
    };
  }

  const messageDoc = {
    role: 'assistant',
    type: 'image',
    // No caption/preview text (frontend renders the image itself).
    text: '',
    provider: provider || 'replicate',
    model: model || null,
    preset: preset || null,
    predictionId: predictionId || null,
    meta: meta || null,
    images: uploads,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  // (moved) convRef is defined earlier

  // Write message + bump conversation timestamp (best-effort).
  const msgRef = await convRef.collection('messages').add(messageDoc);
  await convRef.set(
    { updated_at: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );

  return {
    stored: true,
    messageId: msgRef.id,
    uploads,
  };
}

module.exports = { persistGeneratedImages };
