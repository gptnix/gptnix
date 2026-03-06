'use strict';

const express = require('express');
const {
  geoapifyGeocode,
  geoapifyReverse,
  geoapifyAutocomplete,
  geoapifyPlaces,
  geoapifyRoute,
} = require('../services/tools/geoapify');

function _wrap(data, provider = 'geoapify') {
  // If service already returns {ok:...} (e.g., Nominatim fallback), keep it.
  if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'ok')) return data;
  return { ok: true, provider, data };
}

function createToolsGeoapifyRouter() {
  const router = express.Router();

  // GET /tools/geoapify/geocode?text=Tomislavgrad
  // Aliases: q, query, place
  router.get(['/', '/geocode'], async (req, res) => {
    try {
      const text = req.query.text || req.query.q || req.query.query || req.query.place || '';
      const limit = req.query.limit || 10;
      const lang = req.query.lang || req.query.languageHint || 'en';
      const filter = req.query.filter;
      const bias = req.query.bias;

      const out = await geoapifyGeocode({ text, limit, lang, filter, bias });
      return res.json(_wrap(out));
    } catch (e) {
      const code = Number(e.statusCode) || 500;
      return res.status(code).json({ ok: false, error: e.message });
    }
  });

  // GET /tools/geoapify/autocomplete?text=Tomis
  router.get('/autocomplete', async (req, res) => {
    try {
      const text = req.query.text || req.query.q || req.query.query || '';
      const limit = req.query.limit || 10;
      const lang = req.query.lang || req.query.languageHint || 'en';
      const filter = req.query.filter;
      const bias = req.query.bias;

      const out = await geoapifyAutocomplete({ text, limit, lang, filter, bias });
      return res.json(_wrap(out));
    } catch (e) {
      const code = Number(e.statusCode) || 500;
      return res.status(code).json({ ok: false, error: e.message });
    }
  });

  // GET /tools/geoapify/reverse?lat=43.7&lon=17.2
  router.get('/reverse', async (req, res) => {
    try {
      const lat = req.query.lat;
      const lon = req.query.lon || req.query.lng;
      const lang = req.query.lang || req.query.languageHint || 'en';
      const limit = req.query.limit || 1;

      const out = await geoapifyReverse({ lat, lon, lang, limit });
      return res.json(_wrap(out));
    } catch (e) {
      const code = Number(e.statusCode) || 500;
      return res.status(code).json({ ok: false, error: e.message });
    }
  });

  // GET /tools/geoapify/places?categories=catering.restaurant&filter=circle:17.184,43.717,5000&limit=20
  // You can also pass lat/lon/radius -> auto-build filter=circle:lon,lat,radius
  router.get('/places', async (req, res) => {
    try {
      const categories = req.query.categories || req.query.category || '';
      const limit = req.query.limit || 20;
      const lang = req.query.lang || req.query.languageHint || 'en';

      let filter = req.query.filter;
      const bias = req.query.bias;

      const lat = req.query.lat;
      const lon = req.query.lon || req.query.lng;
      const radius = req.query.radius;

      if (!filter && lat != null && lon != null && radius != null) {
        filter = `circle:${Number(lon)},${Number(lat)},${Number(radius)}`;
      }

      const out = await geoapifyPlaces({ categories, filter, bias, limit, lang });
      return res.json(_wrap(out));
    } catch (e) {
      const code = Number(e.statusCode) || 500;
      return res.status(code).json({ ok: false, error: e.message });
    }
  });

  // GET /tools/geoapify/route?waypoints=43.717,17.184|43.75,17.1&mode=drive
  router.get('/route', async (req, res) => {
    try {
      const waypoints = req.query.waypoints || '';
      const mode = req.query.mode || 'drive';
      const lang = req.query.lang || req.query.languageHint || 'en';

      const out = await geoapifyRoute({ waypoints, mode, lang });
      return res.json(_wrap(out));
    } catch (e) {
      const code = Number(e.statusCode) || 500;
      return res.status(code).json({ ok: false, error: e.message });
    }
  });

  return router;
}

module.exports = { createToolsGeoapifyRouter };
