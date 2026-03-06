'use strict';

const crypto = require('crypto');
const { getFirestore, getAdmin } = require('./firestore');
const { getPricing } = require('./pricing');

function todayKey(date = new Date()) {
  // YYYY-MM-DD (UTC) – najbolje za rollup
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function safeInc(db, ref, data) {
  const admin = getAdmin();
  if (!db || !admin) return Promise.resolve(false);
  const inc = admin.firestore.FieldValue.increment;
  const payload = {};
  for (const [k, v] of Object.entries(data)) payload[k] = inc(v);
  return ref.set(payload, { merge: true }).then(() => true).catch(() => false);
}

function hashId(input) {
  return crypto.createHash('sha1').update(String(input || '')).digest('hex').slice(0, 20);
}

/**
 * usage event schema:
 *  - ts, day
 *  - userId, conversationId, requestId
 *  - kind: llm|embeddings|websearch|image|vision|fetch|...
 *  - provider, model, operation
 *  - units: {promptTokens, completionTokens, credits, seconds, ...}
 *  - costUsd (number)
 *  - meta (object)
 */
async function logUsageEvent(evt) {
  try {
    const db = getFirestore();
    if (!db) return false;

    const ts = evt.ts ? new Date(evt.ts) : new Date();
    const day = evt.day || todayKey(ts);

    const doc = {
      ts,
      day,
      userId: evt.userId || null,
      conversationId: evt.conversationId || null,
      requestId: evt.requestId || evt.reqId || null,
      kind: evt.kind || 'unknown',
      provider: evt.provider || null,
      model: evt.model || null,
      operation: evt.operation || null,
      units: evt.units || {},
      costUsd: Number(evt.costUsd || 0),
      meta: evt.meta || {},
    };

    // 1) raw event
    await db.collection('billing_usage').add(doc);

    // 2) daily rollup (brz dashboard)
    const dailyRef = db.collection('billing_daily').doc(day);
    await safeInc(db, dailyRef, {
      costUsd: doc.costUsd,
      count: 1,
    });

    // 3) daily by integration/provider
    const integrationKey = `${doc.kind}:${doc.provider || 'na'}:${doc.model || 'na'}`;
    const intRef = db.collection('billing_daily_integrations').doc(`${day}_${hashId(integrationKey)}`);
    await intRef.set(
      {
        day,
        key: integrationKey,
        kind: doc.kind,
        provider: doc.provider,
        model: doc.model,
        operation: doc.operation || null,
      },
      { merge: true },
    );
    await safeInc(db, intRef, { costUsd: doc.costUsd, count: 1 });

    // 4) daily by user
    if (doc.userId) {
      const uRef = db.collection('billing_daily_users').doc(`${day}_${hashId(doc.userId)}`);
      await uRef.set({ day, userId: doc.userId }, { merge: true });
      await safeInc(db, uRef, { costUsd: doc.costUsd, count: 1 });
    }

    return true;
  } catch (_) {
    return false;
  }
}

async function logRevenueEvent(evt) {
  try {
    const db = getFirestore();
    if (!db) return false;

    const ts = evt.ts ? new Date(evt.ts) : new Date();
    const day = evt.day || todayKey(ts);

    const doc = {
      ts,
      day,
      userId: evt.userId || null,
      amountUsd: Number(evt.amountUsd || 0),
      currency: evt.currency || 'USD',
      productId: evt.productId || null,
      platform: evt.platform || null, // stripe|appstore|play|manual
      transactionId: evt.transactionId || null,
      meta: evt.meta || {},
    };

    await db.collection('billing_revenue').add(doc);

    const dailyRef = db.collection('billing_daily').doc(day);
    await safeInc(db, dailyRef, {
      revenueUsd: doc.amountUsd,
      revenueCount: 1,
    });

    if (doc.userId) {
      const uRef = db.collection('billing_daily_users').doc(`${day}_${hashId(doc.userId)}`);
      await uRef.set({ day, userId: doc.userId }, { merge: true });
      await safeInc(db, uRef, { revenueUsd: doc.amountUsd, revenueCount: 1 });
    }

    return true;
  } catch (_) {
    return false;
  }
}

async function logInfraFixedCost({ day, usd }) {
  const db = getFirestore();
  if (!db) return false;
  const dailyRef = db.collection('billing_daily').doc(day);
  return safeInc(db, dailyRef, { infraUsd: Number(usd || 0) });
}

/**
 * Helper: iz daily doc izračuna profit (bez da ga pišemo, samo za response).
 */
function computeProfitRow(dayDoc) {
  const pricing = getPricing();
  const cost = Number(dayDoc.costUsd || 0) + Number(dayDoc.infraUsd || 0);
  const revenue = Number(dayDoc.revenueUsd || 0);
  const profit = revenue - cost;
  const margin = revenue > 0 ? profit / revenue : null;
  return {
    ...dayDoc,
    costUsd: Number(dayDoc.costUsd || 0),
    infraUsd: Number(dayDoc.infraUsd || 0),
    revenueUsd: revenue,
    profitUsd: profit,
    profitMargin: margin,
    _pricingHint: {
      infraUsdPerDay: pricing.infra.usd_per_day,
    },
  };
}

module.exports = {
  logUsageEvent,
  logRevenueEvent,
  logInfraFixedCost,
  todayKey,
  computeProfitRow,
};
