'use strict';

/**
 * Chat Router — wiring only
 * Business logic lives in handler.js
 */

const express = require('express');
const { chatHandler } = require('./handler');

function createChatRouter() {
  const router = express.Router();
  router.post('/chat', chatHandler);
  return router;
}

module.exports = { createChatRouter };
