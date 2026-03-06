'use strict';

const express = require('express');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

const { ragUpload, ragQuery } = require('../services/rag');

function createRagRouter() {
  const router = express.Router();

  router.post('/rag/upload', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { userId, conversationId } = req.body;

      const result = await ragUpload({ file, userId, conversationId });
      res.json(result);
    } catch (err) {
      console.error('❌ /rag/upload error:', err);
      res
        .status(err.statusCode || 500)
        .json({ error: 'RAG upload error', details: err.message });
    }
  });

  router.post('/rag/query', async (req, res) => {
    try {
      const { userId, query, conversationId, topK = 5 } = req.body || {};
      const result = await ragQuery({ userId, query, conversationId, topK });
      res.json(result);
    } catch (err) {
      console.error('❌ /rag/query error:', err);
      res
        .status(err.statusCode || 500)
        .json({ error: 'RAG query error', details: err.message });
    }
  });

  return router;
}

module.exports = { createRagRouter };
