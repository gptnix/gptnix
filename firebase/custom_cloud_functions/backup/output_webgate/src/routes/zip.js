'use strict';

const express = require('express');
const { isRateLimited } = require('../middleware/rateLimit');
const { createZipAndUpload } = require('../services/zipTool');

function createZipRouter() {
  const router = express.Router();

  // POST /tools/zip/create
  router.post('/create', async (req, res) => {
    try {
      const { userId, conversationId, zipName, files } = req.body || {};

      if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });
      if (await isRateLimited(userId)) {
        return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
      }

      const result = await createZipAndUpload({ userId, conversationId, zipName, files });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('❌ /tools/zip/create error:', err);
      return res.status(500).json({ ok: false, error: err?.message || 'Zip creation failed' });
    }
  });

  return router;
}

module.exports = { createZipRouter };
