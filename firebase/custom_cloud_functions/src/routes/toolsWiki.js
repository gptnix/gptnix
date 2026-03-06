'use strict';

const express = require('express');
const { wikiLookup } = require('../services/tools/wiki');

function createToolsWikiRouter() {
  const router = express.Router();

  // GET /tools/wiki?query=Tomislavgrad
  // GET /tools/wiki?title=Bosna%20i%20Hercegovina
  // Optional: ?languageHint=hr or ?lang=hr
  router.get('/', async (req, res) => {
    try {
      const query = req.query.query || req.query.q || '';
      const title = req.query.title || '';
      const languageHint = req.query.languageHint || req.query.lang || '';

      const out = await wikiLookup({ query, title, languageHint });

      if (!out?.ok) {
        return res.status(400).json({ ok: false, error: out?.error || 'wiki failed' });
      }

      return res.json({ ok: true, ...out });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}

module.exports = { createToolsWikiRouter };
