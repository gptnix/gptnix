'use strict';

const express = require('express');
const { getPublicHolidays, getNextPublicHolidays } = require('../services/tools/holidays');

function createToolsHolidaysRouter() {
  const router = express.Router();

  // GET /tools/holidays?country=BA&year=2026
  router.get('/', async (req, res) => {
    try {
      const countryCode = req.query.country || req.query.countryCode || req.query.cc || '';
      const year = req.query.year;
      const hintText = req.query.hint || req.query.q || '';

      const out = await getPublicHolidays({ countryCode, year, hintText });
      if (!out?.ok) {
        return res.status(400).json({ ok: false, error: out?.error || 'holidays failed' });
      }
      return res.json({ ok: true, ...out });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /tools/holidays/next?country=BA
  router.get('/next', async (req, res) => {
    try {
      const countryCode = req.query.country || req.query.countryCode || req.query.cc || '';
      const hintText = req.query.hint || req.query.q || '';

      const out = await getNextPublicHolidays({ countryCode, hintText });
      if (!out?.ok) {
        return res.status(400).json({ ok: false, error: out?.error || 'holidays next failed' });
      }
      return res.json({ ok: true, ...out });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}

module.exports = { createToolsHolidaysRouter };
