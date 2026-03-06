'use strict';

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { getFirestore } = require('../billing/firestore');
const { computeProfitRow } = require('../billing/logger');
const { getPricing } = require('../billing/pricing');

function clampInt(n, min, max, fallback) {
  const x = parseInt(String(n), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function ymdToDateUTC(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [_, y, mo, d] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0));
}

function addDaysUTC(date, days) {
  return new Date(date.getTime() + days * 86400 * 1000);
}

function formatDay(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function listDays({ from, to }) {
  const days = [];
  let cur = ymdToDateUTC(from);
  const end = ymdToDateUTC(to);
  if (!cur || !end) return days;
  while (cur.getTime() <= end.getTime()) {
    days.push(formatDay(cur));
    cur = addDaysUTC(cur, 1);
  }
  return days;
}

function createAdminBillingRouter() {
  const router = express.Router();

  // sve u /admin/billing je admin-only
  router.use(requireAdmin);

  /**
   * GET /admin/billing/overview?days=30
   * GET /admin/billing/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  router.get('/overview', async (req, res) => {
    try {
      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore_not_available' });

      const daysParam = req.query.days;
      const fromParam = req.query.from;
      const toParam = req.query.to;

      let from;
      let to;
      if (fromParam && toParam) {
        from = String(fromParam);
        to = String(toParam);
      } else {
        const days = clampInt(daysParam, 1, 180, 30);
        const now = new Date();
        const end = formatDay(now);
        const start = formatDay(addDaysUTC(ymdToDateUTC(end), -(days - 1)));
        from = start;
        to = end;
      }

      const dayKeys = await listDays({ from, to });
      const refs = dayKeys.map((d) => db.collection('billing_daily').doc(d));
      const snaps = await db.getAll(...refs);

      const rows = [];
      for (let i = 0; i < snaps.length; i += 1) {
        const d = dayKeys[i];
        const data = snaps[i].exists ? snaps[i].data() : { day: d };
        rows.push(computeProfitRow({ day: d, ...data }));
      }

      // totals
      const totals = rows.reduce(
        (acc, r) => {
          acc.costUsd += Number(r.costUsd || 0);
          acc.infraUsd += Number(r.infraUsd || 0);
          acc.revenueUsd += Number(r.revenueUsd || 0);
          acc.profitUsd += Number(r.profitUsd || 0);
          acc.count += Number(r.count || 0);
          return acc;
        },
        { costUsd: 0, infraUsd: 0, revenueUsd: 0, profitUsd: 0, count: 0 },
      );

      return res.json({ ok: true, from, to, totals, days: rows, pricing: getPricing() });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'overview_failed' });
    }
  });

  /**
   * GET /admin/billing/integrations?days=30&limit=50
   * Vraća top integracije po costu.
   */
  router.get('/integrations', async (req, res) => {
    try {
      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore_not_available' });

      const days = clampInt(req.query.days, 1, 180, 30);
      const limit = clampInt(req.query.limit, 1, 200, 50);

      // naive pristup: uzmi zadnjih N dana, povuci docove i sumiraj u Node-u.
      // (Firestorov "group by" je ograničen, pa zato radimo preko daily_integrations.)
      const now = new Date();
      const end = formatDay(now);
      const start = formatDay(addDaysUTC(ymdToDateUTC(end), -(days - 1)));

      const snap = await db
        .collection('billing_daily_integrations')
        .where('day', '>=', start)
        .where('day', '<=', end)
        .get();

      const map = new Map();
      snap.forEach((doc) => {
        const d = doc.data() || {};
        const key = d.key || doc.id;
        const cur = map.get(key) || { key, kind: d.kind, provider: d.provider, model: d.model, costUsd: 0, count: 0 };
        cur.costUsd += Number(d.costUsd || 0);
        cur.count += Number(d.count || 0);
        map.set(key, cur);
      });

      const arr = Array.from(map.values()).sort((a, b) => b.costUsd - a.costUsd).slice(0, limit);
      return res.json({ ok: true, days, start, end, integrations: arr });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'integrations_failed' });
    }
  });

  /**
   * GET /admin/billing/users?days=30&limit=50
   * Top korisnici po costu (ili revenue).
   */
  router.get('/users', async (req, res) => {
    try {
      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore_not_available' });

      const days = clampInt(req.query.days, 1, 180, 30);
      const limit = clampInt(req.query.limit, 1, 200, 50);

      const now = new Date();
      const end = formatDay(now);
      const start = formatDay(addDaysUTC(ymdToDateUTC(end), -(days - 1)));

      const snap = await db
        .collection('billing_daily_users')
        .where('day', '>=', start)
        .where('day', '<=', end)
        .get();

      const map = new Map();
      snap.forEach((doc) => {
        const d = doc.data() || {};
        const uid = d.userId || 'unknown';
        const cur = map.get(uid) || { userId: uid, costUsd: 0, revenueUsd: 0, count: 0, revenueCount: 0 };
        cur.costUsd += Number(d.costUsd || 0);
        cur.revenueUsd += Number(d.revenueUsd || 0);
        cur.count += Number(d.count || 0);
        cur.revenueCount += Number(d.revenueCount || 0);
        map.set(uid, cur);
      });

      const arr = Array.from(map.values())
        .map((u) => ({ ...u, profitUsd: u.revenueUsd - u.costUsd }))
        .sort((a, b) => b.costUsd - a.costUsd)
        .slice(0, limit);

      return res.json({ ok: true, days, start, end, users: arr });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'users_failed' });
    }
  });

  /**
   * POST /admin/billing/infra
   * body: { day: "YYYY-MM-DD", usd: 2.5 }
   * Ručno postavi/inkrementiraj fiksni infra trošak (ako želiš).
   */
  router.post('/infra', async (req, res) => {
    try {
      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore_not_available' });

      const day = String(req.body.day || '');
      const usd = Number(req.body.usd || 0);
      if (!ymdToDateUTC(day)) return res.status(400).json({ ok: false, error: 'bad_day_format' });

      await db.collection('billing_daily').doc(day).set({ day }, { merge: true });
      const admin = require('firebase-admin');
      await db.collection('billing_daily').doc(day).set(
        { infraUsd: admin.firestore.FieldValue.increment(usd) },
        { merge: true },
      );

      return res.json({ ok: true, day, usd });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'infra_failed' });
    }
  });

  return router;
}

module.exports = { createAdminBillingRouter };
