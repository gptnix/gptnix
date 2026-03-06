'use strict';

const express = require('express');

function createRootRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.send('GPTNiX backend is running.');
  });

  return router;
}

module.exports = { createRootRouter };
