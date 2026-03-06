'use strict';

const express = require('express');

const { webSearch } = require('../services/websearch');

function createWebRouter() {
  const router = express.Router();

  // GET /web/search?q=...
  router.get('/web/search', async (req, res) => {
    try {
      const q = (req.query.q || '').toString();
      const mode = (req.query.mode || '').toString() || undefined;
      const maxResults = req.query.maxResults ? Number(req.query.maxResults) : undefined;
      const out = await webSearch(q, { mode, maxResults });
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /web/search { query, mode, maxResults, timeRange, searchDepth, includeAnswer, includeRawContent, country, prefer, serperGl, serperHl }
  router.post('/web/search', async (req, res) => {
    try {
      const {
        query,
        mode,
        maxResults,
        timeRange,
        searchDepth,
        includeAnswer,
        includeRawContent,
        country,
        prefer,
        serperGl,
        serperHl,
      } = req.body || {};

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ ok: false, error: 'query required' });
      }

      const out = await webSearch(query, {
        mode,
        maxResults,
        timeRange,
        searchDepth,
        includeAnswer,
        includeRawContent,
        country,
        prefer,
        serperGl,
        serperHl,
      });

      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}

module.exports = { createWebRouter };
