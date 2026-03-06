// src/utils/sse.js
'use strict';

/**
 * Robust SSE (Server-Sent Events) parser helper.
 *
 * Why:
 * - Some providers use \r\n line endings.
 * - Some providers include "event:" / "id:" lines.
 * - SSE events can contain multiple "data:" lines.
 *
 * We only extract complete events (blank-line delimited) and return their
 * joined data payload.
 */

function pullSseEvents(buffer) {
  // Split on a blank line, supporting both \n\n and \r\n\r\n.
  const parts = String(buffer || '').split(/\r?\n\r?\n/);
  const remainder = parts.pop() || '';
  const events = [];

  for (const raw of parts) {
    const lines = raw.split(/\r?\n/);
    const dataLines = [];

    for (const ln of lines) {
      const line = String(ln || '');
      if (!line) continue;
      if (line.startsWith(':')) continue; // comment/heartbeat
      if (line.startsWith('data:')) {
        // Per SSE spec, a single leading space after ':' should be ignored.
        let v = line.slice(5);
        if (v.startsWith(' ')) v = v.slice(1);
        dataLines.push(v);
      }
    }

    const payload = dataLines.join('\n').trim();
    if (payload) events.push(payload);
  }

  return { events, remainder };
}

module.exports = { pullSseEvents };
