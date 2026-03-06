'use strict';

const express = require('express');

const { tmdbSearchMovie, movieReport } = require('../services/tools/movies');
const { TMDB_BEARER_TOKEN, TMDB_API_KEY, OMDB_API_KEY } = require('../config/env');

function _hasTmdbAuth() {
  return Boolean(String(TMDB_BEARER_TOKEN || '').trim() || String(TMDB_API_KEY || '').trim());
}

function createToolsMoviesRouter() {
  const router = express.Router();

  // GET /tools/movies/search?q=...&year=...&languageHint=...
  router.get('/search', async (req, res) => {
    try {
      const q = String(req.query.q || req.query.query || '').trim();
      const year = req.query.year ? Number(req.query.year) : undefined;
      const languageHint = req.query.languageHint || req.query.lang || null;
      const maxResults = req.query.maxResults ? Number(req.query.maxResults) : 6;

      if (!q) return res.status(400).json({ ok: false, error: 'q required' });
      if (!_hasTmdbAuth()) {
        return res.status(400).json({ ok: false, error: 'TMDB auth missing (TMDB_BEARER_TOKEN or TMDB_API_KEY)' });
      }

      const out = await tmdbSearchMovie(q, { year, languageHint, maxResults });
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /tools/movies/search { query, year?, languageHint?, maxResults? }
  router.post('/search', async (req, res) => {
    try {
      const { query, year, languageHint, maxResults } = req.body || {};
      const q = String(query || '').trim();
      if (!q) return res.status(400).json({ ok: false, error: 'query required' });

      if (!_hasTmdbAuth()) {
        return res.status(400).json({ ok: false, error: 'TMDB auth missing (TMDB_BEARER_TOKEN or TMDB_API_KEY)' });
      }

      const out = await tmdbSearchMovie(q, {
        year: year ? Number(year) : undefined,
        languageHint,
        maxResults: maxResults ? Number(maxResults) : 6,
      });
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /tools/movies/report
  // { query?, year?, tmdbId?, imdbId?, languageHint?, includeImages? }
  router.post('/report', async (req, res) => {
    try {
      if (!_hasTmdbAuth() && !OMDB_API_KEY) {
        return res.status(400).json({ ok: false, error: 'TMDB auth and OMDB_API_KEY are both missing' });
      }

      const {
        query,
        year,
        tmdbId,
        imdbId,
        languageHint,
        includeImages = true,
      } = req.body || {};

      const out = await movieReport({
        query: query ? String(query).trim() : '',
        year: year ? Number(year) : undefined,
        tmdbId,
        imdbId,
        languageHint,
        includeImages: includeImages !== false,
      });

      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}

module.exports = { createToolsMoviesRouter };
