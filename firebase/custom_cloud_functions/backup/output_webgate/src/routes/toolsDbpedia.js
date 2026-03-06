'use strict';

const express = require('express');
const { dbpediaLookup } = require('../services/tools/dbpedia');

function createToolsDbpediaRouter() {
  const router = express.Router();

  // GET /tools/dbpedia?query=OpenAI
  // GET /tools/dbpedia?q=Bosna%20i%20Hercegovina
  router.get('/', async (req, res) => {
    try {
      const query = req.query.query || req.query.q || '';
      const out = await dbpediaLookup({ query });

      if (!out?.ok) {
        return res.status(400).json({ ok: false, error: out?.error || 'dbpedia failed', ...out });
      }

      return res.json({ ok: true, ...out });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  return router;
}

module.exports = { createToolsDbpediaRouter };
