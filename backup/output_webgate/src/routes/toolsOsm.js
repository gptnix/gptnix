'use strict';

const express = require('express');
const { nominatimSearch, nominatimReverse, overpassNearby } = require('../services/tools/osm');

function createToolsOsmRouter() {
  const router = express.Router();

  // GET /tools/osm/geocode?query=Tomislavgrad
  // Aliases: q, place
  router.get(['/', '/geocode'], async (req, res) => {
    try {
      const query = req.query.query || req.query.q || req.query.place || '';
      const limit = req.query.limit;
      const countrycodes = req.query.countrycodes;
      const languageHint = req.query.languageHint || req.query.lang || 'en';

      const out = await nominatimSearch({ query, limit, countrycodes, languageHint });
      if (!out?.ok) {
        return res.status(400).json({ ok: false, error: out?.error || 'osm geocode failed' });
      }
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /tools/osm/reverse?lat=43.7&lon=17.2
  router.get('/reverse', async (req, res) => {
    try {
      const latitude = req.query.lat || req.query.latitude;
      const longitude = req.query.lon || req.query.lng || req.query.longitude;
      const zoom = req.query.zoom;
      const languageHint = req.query.languageHint || req.query.lang || 'en';

      const out = await nominatimReverse({ latitude, longitude, zoom, languageHint });
      if (!out?.ok) {
        return res.status(400).json({ ok: false, error: out?.error || 'osm reverse failed' });
      }
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /tools/osm/nearby?place=Tomislavgrad&key=amenity&value=pharmacy&radius=1500
  // Or: /tools/osm/nearby?lat=...&lon=...
  router.get('/nearby', async (req, res) => {
    try {
      const place = req.query.place || req.query.query || req.query.q || '';
      const latitude = req.query.lat || req.query.latitude;
      const longitude = req.query.lon || req.query.lng || req.query.longitude;
      const radius = req.query.radius;
      const limit = req.query.limit;
      const key = req.query.key;
      const value = req.query.value;
      const languageHint = req.query.languageHint || req.query.lang || 'en';

      const out = await overpassNearby({ place, latitude, longitude, radius, limit, key, value, languageHint });
      if (!out?.ok) {
        return res.status(400).json({ ok: false, error: out?.error || 'osm nearby failed' });
      }
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}

module.exports = { createToolsOsmRouter };
