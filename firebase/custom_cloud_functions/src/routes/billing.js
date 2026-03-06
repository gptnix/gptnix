'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { logRevenueEvent } = require('../billing/logger');

/**
 * User-side billing endpoints:
 * - POST /billing/revenue  (app zove nakon uspješne uplate)
 * (ne admin, ali mora biti autentificiran)
 */
function createBillingRouter() {
  const router = express.Router();

  router.post('/revenue', requireAuth, async (req, res) => {
    try {
      const uid = req.user?.uid || null;
      const amountUsd = Number(req.body.amountUsd || 0);
      if (!uid) return res.status(401).json({ ok: false, error: 'unauthorized' });
      if (!(amountUsd > 0)) return res.status(400).json({ ok: false, error: 'bad_amount' });

      await logRevenueEvent({
        userId: uid,
        amountUsd,
        currency: req.body.currency || 'USD',
        productId: req.body.productId || null,
        platform: req.body.platform || null,
        transactionId: req.body.transactionId || null,
        meta: req.body.meta || {},
      });

      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'revenue_log_failed' });
    }
  });

  return router;
}

module.exports = { createBillingRouter };
