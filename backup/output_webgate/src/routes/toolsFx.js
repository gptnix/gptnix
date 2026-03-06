'use strict';

const express = require('express');
const { convertCurrency } = require('../services/tools/fx');

function createToolsFxRouter() {
  const router = express.Router();

  // GET /tools/fx?amount=100&from=EUR&to=BAM
  // GET /tools/fx?from=EUR&to=USD
  router.get('/', async (req, res) => {
    try {
      const amount = req.query.amount ?? req.query.value ?? 1;
      const from = req.query.from ?? req.query.base ?? 'EUR';
      const to = req.query.to ?? req.query.target;
      const symbols = req.query.symbols ? String(req.query.symbols).split(',') : undefined;
      const date = req.query.date;

      const out = await convertCurrency({ amount, from, to, symbols, date });
      if (!out?.ok) {
        return res.status(400).json({ ok: false, error: out?.error || 'fx failed' });
      }
      return res.json({ ok: true, ...out });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}

module.exports = { createToolsFxRouter };
