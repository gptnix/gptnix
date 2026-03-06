'use strict';

const OpenAI = require('openai');
const { OPENAI_API_KEY } = require('../config/env');

// OpenAI SDK is used for: vision (image OCR/description) + audio transcription.
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Compatibility helper.
// Some services import a function accessor (legacy name) instead of the raw client.
function getOpenAIClient() {
  if (!openai) throw new Error('OpenAI client not configured');
  return openai;
}

module.exports = { openai, getOpenAIClient };
