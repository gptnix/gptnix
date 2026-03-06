'use strict';

const { REPLICATE_API_TOKEN } = require('../config/env'); // token or key alias handled in env.js

const replicateEnabled = Boolean(REPLICATE_API_TOKEN);

function getAuthHeaders() {
  if (!REPLICATE_API_TOKEN) return {};
  const t = String(REPLICATE_API_TOKEN || '').trim();
  // Replicate HTTP API uses Bearer tokens. Keep compatibility if a full header value is provided.
  if (/^Bearer\s+/i.test(t) || /^Token\s+/i.test(t)) return { Authorization: t };
  return { Authorization: `Bearer ${t}` };
}

async function replicateRequest(url, { method = 'GET', body, waitSeconds } = {}) {
  if (!REPLICATE_API_TOKEN) {
    const err = new Error('REPLICATE_API_TOKEN missing');
    err.statusCode = 500;
    throw err;
  }

  const headers = {
    ...getAuthHeaders(),
    'Content-Type': 'application/json',
  };

  // Replicate sync mode: Prefer: wait=n (1..60)
  if (typeof waitSeconds === 'number' && waitSeconds > 0) {
    const n = Math.max(1, Math.min(60, Math.floor(waitSeconds)));
    headers.Prefer = `wait=${n}`;
  }

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!resp.ok) {
    const err = new Error(data?.detail || data?.error || `Replicate HTTP ${resp.status}`);
    err.statusCode = resp.status;
    err.details = data;
    throw err;
  }

  return data;
}

function looksLikeVersionHash(ref) {
  // Replicate version ids are long hex hashes (commonly 64 chars).
  return typeof ref === 'string' && /^[a-f0-9]{32,}$/i.test(ref) && !ref.includes('/');
}

function parseModelRef(ref) {
  // Accept:
  // - "<hash>" (version id)
  // - "owner/model" (model slug)
  // - "owner/model:<hash>" (model slug + version id)
  if (!ref || typeof ref !== 'string') return { kind: 'version', version: '' };
  const trimmed = ref.trim();
  if (looksLikeVersionHash(trimmed)) return { kind: 'version', version: trimmed };
  if (!trimmed.includes('/')) return { kind: 'version', version: trimmed };
  if (trimmed.includes(':')) {
    const idx = trimmed.lastIndexOf(':');
    const model = trimmed.slice(0, idx);
    const version = trimmed.slice(idx + 1);
    return { kind: 'model', model, version: version || null };
  }
  return { kind: 'model', model: trimmed, version: null };
}

async function createPrediction({ version, input, waitSeconds }) {
  const parsed = parseModelRef(version);

  // 1) Classic: POST /v1/predictions { version: <hash>, input }
  //    Also support "owner/model:<hash>" by routing it through the version endpoint.
  if (parsed.kind === 'version' || (parsed.kind === 'model' && looksLikeVersionHash(parsed.version))) {
    return replicateRequest('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      body: { version: parsed.kind === 'version' ? (parsed.version || version) : parsed.version, input },
      waitSeconds,
    });
  }

  // 2) Model endpoint: POST /v1/models/{owner}/{name}/predictions { input, (optional) version }
  return replicateRequest(`https://api.replicate.com/v1/models/${parsed.model}/predictions`, {
    method: 'POST',
    body: { input },
    waitSeconds,
  });
}

async function getPrediction(predictionId) {
  return replicateRequest(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    method: 'GET',
  });
}

module.exports = {
  replicateEnabled,
  createPrediction,
  getPrediction,
};
