'use strict';

const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Admin-Bootstrap', 'X-Admin-Secret'],
    }),
  );

  // Voice endpoints may send base64 audio (and websearch may include raw HTML), so keep a bit more headroom.
  // Cloud Run request size limits still apply.
  app.use(express.json({ limit: '25mb' }));

  return app;
}

module.exports = { createApp };
