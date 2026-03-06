'use strict';

const express = require('express');

const { replicateEnabled } = require('../clients/replicate');
const { REPLICATE_VERSION } = require('../config/env');
const { isRateLimited } = require('../middleware/rateLimit');
const { generateImageWithReplicate, pollPrediction } = require('../services/imageGen');
const { persistGeneratedImages } = require('../services/imagePersistence');
const { translateToEnglish } = require('../services/translate');
const { buildFluxPrompt } = require('../services/fluxPrompt');

// Billing (Replicate)
const { getFirestore } = require('../billing/firestore');
const { usdFromReplicate } = require('../billing/cost');
const { logUsageEvent, todayKey } = require('../billing/logger');

async function logReplicateBillingOnce({
  predictionId,
  status,
  model,
  preset,
  imagesCount,
  seconds,
  userId,
  conversationId,
  operation,
}) {
  try {
    if (!predictionId) return false;

    const db = getFirestore();
    if (!db) return false;

    // Idempotency: avoid double-billing on poll / retries
    const idemRef = db.collection('billing_idempotency').doc(`replicate_${predictionId}`);
    try {
      await idemRef.create({
        ts: new Date(),
        provider: 'replicate',
        kind: 'image',
        predictionId,
        status: String(status || ''),
      });
    } catch (e) {
      // Already exists => already billed
      const msg = String(e?.message || '');
      if (msg.includes('ALREADY_EXISTS') || msg.includes('already exists')) return false;
      // unknown error => continue without idempotency guarantee
    }

    const sec = Number(seconds);
    const safeSeconds = Number.isFinite(sec) ? Math.max(0, sec) : 0;
    const safeImages = Number.isFinite(Number(imagesCount)) ? Math.max(1, Number(imagesCount)) : 1;
    
    const { usd, breakdown } = usdFromReplicate({
      seconds: safeSeconds,
      images: safeImages,
      model: model || null,
    });
    
    const day = todayKey(new Date());

    await logUsageEvent({
      ts: new Date(),
      day,
      userId: userId || 'guest',
      conversationId: conversationId || null,
      requestId: `replicate_${predictionId}`,
      kind: 'image',
      provider: 'replicate',
      model: model || null,
      operation: operation || 'image_generate',
      units: {
        seconds: safeSeconds,
        images: Number.isFinite(Number(imagesCount)) ? Number(imagesCount) : undefined,
      },
      costUsd: usd,
      meta: {
        preset: preset || null,
        status: status || null,
        ...breakdown,
      },
    });

    return true;
  } catch (_) {
    return false;
  }
}

function createImageRouter() {
  const router = express.Router();

  // POST /image/generate
  // Body: { prompt, preset?, translate?, aspect_ratio, num_outputs, num_inference_steps, guidance, seed, output_format, output_quality, go_fast, disable_safety_checker, wait, conversationId, userId }
  router.post('/image/generate', async (req, res) => {
    try {
      const userId = req.body?.userId || req.headers['x-user-id'] || req.ip;
      if (isRateLimited(String(userId))) {
        return res.status(429).json({ error: 'Rate limited' });
      }

      if (!replicateEnabled) {
        return res.status(503).json({
          error: 'Replicate is not configured',
          details: 'Missing REPLICATE_API_TOKEN',
        });
      }

      const originalPrompt = String(req.body?.prompt ?? req.body?.text ?? '').trim();
      if (!originalPrompt) {
        return res.status(400).json({ error: 'prompt required' });
      }

      // ─────────────────────────────────────────
      // 1) Translate prompt → English (for Flux adherence)
      // ─────────────────────────────────────────
      const doTranslate = (req.body?.translate ?? true) !== false;
      let promptEnglish = originalPrompt;
      let translationMeta = { provider: 'none', didTranslate: false };

      if (doTranslate) {
        const tr = await translateToEnglish(originalPrompt, { force: true });
        promptEnglish = tr.english || originalPrompt;
        translationMeta = { provider: tr.provider, didTranslate: tr.didTranslate, cached: tr.cached };
      }

      // ─────────────────────────────────────────
      // 2) Add a *compact* quality/anatomy guard
      // ─────────────────────────────────────────
      const promptFinal = buildFluxPrompt(promptEnglish, {
        extra: String(req.body?.promptExtra || '').trim(),
        preset: String(req.body?.preset || '').trim(),
      });

      const wait = req.body?.wait ?? 60;

      // Call Replicate
      const bodyForReplicate = {
        ...req.body,
        prompt: promptFinal,
      };
      const result = await generateImageWithReplicate(bodyForReplicate, { waitSeconds: Number(wait) });

      // ─────────────────────────────────────────
      // 3) Persist outputs to Firebase Storage (optional)
      // ─────────────────────────────────────────
      const conversationId =
        req.body?.conversationId || req.body?.conversation_id || req.body?.convId || null;
      const storeToFirestore = Boolean(req.body?.storeToFirestore ?? conversationId);

      let persisted = null;
      if (
        storeToFirestore &&
        result?.status === 'succeeded' &&
        Array.isArray(result.images) &&
        result.images.length > 0
      ) {
        try {
          persisted = await persistGeneratedImages({
            conversationId,
            userId: String(userId || 'anon'),
            prompt: originalPrompt,
            prompt_en: promptEnglish,
            prompt_final: promptFinal,
            provider: 'replicate',
            model: result?.model ?? req.body?.version ?? req.body?.model ?? REPLICATE_VERSION,
            preset: result.preset,
            predictionId: result.predictionId,
            images: result.images,
          });
        } catch (persistErr) {
          console.error('⚠️ Image persist error:', persistErr);
          persisted = { stored: false, error: persistErr.message };
        }
      }

      // ─────────────────────────────────────────
      // 4) Billing (Replicate) — log once per prediction (idempotent)
      // ─────────────────────────────────────────
      const billingUserId = req.body?.userId || req.headers['x-user-id'] || 'guest';
      const finalStatuses = new Set(['succeeded', 'failed', 'canceled']);
      if (finalStatuses.has(String(result?.status || ''))) {
        await logReplicateBillingOnce({
          predictionId: result?.predictionId,
          status: result?.status,
          model: result?.model ?? req.body?.version ?? req.body?.model ?? REPLICATE_VERSION,
          preset: result?.preset,
          imagesCount: Array.isArray(result?.images) ? result.images.length : 0,
          seconds: result?.predictSeconds ?? result?.metrics?.predict_time ?? result?.metrics?.predictTime,
          userId: String(billingUserId || 'guest'),
          conversationId,
          operation: 'image_generate',
        });
      }

      return res.json({
        ok: true,
        provider: 'replicate',
        model: result?.model ?? req.body?.version ?? req.body?.model ?? REPLICATE_VERSION,
        preset: result.preset,
        prompt: {
          original: originalPrompt,
          english: promptEnglish,
          final: promptFinal,
          translation: translationMeta,
        },
        persisted,
        ...result,
      });
    } catch (err) {
      console.error('❌ /image/generate error:', err);
      return res.status(err.statusCode || 500).json({
        error: 'Image generation error',
        details: err.message,
        provider: 'replicate',
      });
    }
  });

  // GET /image/prediction/:id
  router.get('/image/prediction/:id', async (req, res) => {
    try {
      if (!replicateEnabled) {
        return res.status(503).json({
          error: 'Replicate is not configured',
          details: 'Missing REPLICATE_API_TOKEN',
        });
      }

      const { id } = req.params;
      const result = await pollPrediction(id);

      // Billing on poll (when async finish): log once when reaches final state
      const finalStatuses = new Set(['succeeded', 'failed', 'canceled']);
      if (finalStatuses.has(String(result?.status || ''))) {
        const billingUserId = req.headers['x-user-id'] || 'guest';
        await logReplicateBillingOnce({
          predictionId: result?.predictionId || id,
          status: result?.status,
          model: result?.version || null,
          preset: null,
          imagesCount: Array.isArray(result?.images) ? result.images.length : 0,
          seconds: result?.predictSeconds ?? result?.metrics?.predict_time ?? result?.metrics?.predictTime,
          userId: String(billingUserId || 'guest'),
          conversationId: req.query?.conversationId || req.query?.conversation_id || null,
          operation: 'image_poll',
        });
      }

      return res.json({ ok: true, provider: 'replicate', ...result });
    } catch (err) {
      console.error('❌ /image/prediction/:id error:', err);
      return res.status(err.statusCode || 500).json({
        error: 'Prediction fetch error',
        details: err.message,
        provider: 'replicate',
      });
    }
  });

  return router;
}

module.exports = { createImageRouter };
