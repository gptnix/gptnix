'use strict';

/**
 * SSE Writer
 * Server-Sent Events setup and management.
 * Extracted from chat.js — zero behavior change.
 */

/**
 * Safe flush helper — handles missing flush() method gracefully.
 * @param {import('express').Response} res
 */
function safeFlush(res) {
  try {
    if (typeof res.flush === 'function') res.flush();
    if (res.socket) res.socket.setNoDelay(true);
  } catch (_) {}
}

/**
 * Setup a Server-Sent Events stream.
 *
 * Features:
 *  - Correct headers for Cloud Run / CloudFlare / nginx
 *  - Keep-alive pings every 15 s (prevents proxy kill)
 *  - Configurable hard timeout
 *  - Auto-cleanup on client disconnect
 *
 * @param {import('express').Response} res
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {{ sendEvent: Function, heartbeat: NodeJS.Timeout, timeout: NodeJS.Timeout, cleanup: Function }}
 */
function setupSSE(res, { timeoutMs = 240000 } = {}) {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    try {
      res.flushHeaders?.();
    } catch (_) {}
  }

  const sendEvent = (type, payload = {}) => {
    try {
      if (res.writableEnded || res.destroyed) return;
      const out = JSON.stringify({ type, ...payload });
      res.write(`data: ${out}\n\n`);
      if (res.socket) res.socket.setNoDelay(true);
      safeFlush(res);
    } catch (_) {}
  };

  // Keep-alive pings so proxies don't kill the connection
  const heartbeat = setInterval(() => {
    try {
      if (res.writableEnded || res.destroyed) return;
      sendEvent('ping', { t: Date.now() });
    } catch (_) {}
  }, 15000);

  const timeout = setTimeout(() => {
    try {
      sendEvent('error', { message: 'SSE timeout' });
      res.end();
    } catch (_) {}
  }, timeoutMs);

  const cleanup = () => {
    clearInterval(heartbeat);
    clearTimeout(timeout);
  };

  res.on('close', cleanup);

  return { sendEvent, heartbeat, timeout, cleanup };
}

module.exports = { safeFlush, setupSSE };
