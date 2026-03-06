'use strict';

const express = require('express');
const { getWeather } = require('../services/tools/weather');

function createToolsWeatherRouter() {
  const router = express.Router();

  // GET /tools/weather?place=Tomislavgrad
  // GET /tools/weather?lat=43.7&lon=17.2
  router.get('/', async (req, res) => {
    try {
      const place = req.query.place || req.query.location || req.query.q;
      const latitude = req.query.lat || req.query.latitude;
      const longitude = req.query.lon || req.query.lng || req.query.longitude;
      const languageHint = req.query.languageHint || req.query.lang || 'en';
      const provider = req.query.provider || req.query.source || 'auto';

      const out = await getWeather({
        place,
        latitude,
        longitude,
        languageHint,
        provider,
      });

      if (!out?.ok) {
        return res.status(400).json({ ok: false, error: out?.error || 'weather failed' });
      }

      return res.json({ ok: true, ...out });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}

module.exports = { createToolsWeatherRouter };
