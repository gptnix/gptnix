// utils/observability.js
// Lightweight structured logging without leaking raw content.

function _maskSensitive(text) {
  try {
    let s = String(text || '');
    // emails
    s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]');
    // urls
    s = s.replace(/https?:\/\/[^\s)]+/gi, '[URL]');
    // bearer/api keys (very rough)
    s = s.replace(/\b(sk-[A-Za-z0-9_-]{10,})\b/g, '[KEY]');
    s = s.replace(/\b(ghp_[A-Za-z0-9]{20,})\b/g, '[KEY]');
    // long tokens/ids
    s = s.replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[ID]');
    // phone-ish (basic)
    s = s.replace(/\+?\d[\d\s().-]{8,}\d/g, '[PHONE]');
    return s;
  } catch {
    return '';
  }
}

function _truncate(text, maxLen = 280) {
  const s = _maskSensitive(text);
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

/**
 * Logs a verifier event WITHOUT raw drafts.
 * Expected fields:
 * - changed: boolean
 * - deltaChars: number
 * - latencyMs: number
 * - draftLen / verifiedLen: number
 * - draftHash / verifiedHash: short hash strings (optional)
 * - provider / model: strings (optional)
 */
function logVerifierEvent({
  userId,
  conversationId,
  changed,
  deltaChars,
  latencyMs,
  draftLen,
  verifiedLen,
  draftHash,
  verifiedHash,
  provider,
  model,
}) {
  try {
    const evt = {
      type: 'accuracy_verifier',
      userId: userId || 'guest',
      conversationId: conversationId || null,
      changed: Boolean(changed),
      deltaChars: typeof deltaChars === 'number' ? deltaChars : null,
      latencyMs: typeof latencyMs === 'number' ? latencyMs : null,
      draftLen: typeof draftLen === 'number' ? draftLen : null,
      verifiedLen: typeof verifiedLen === 'number' ? verifiedLen : null,
      draftHash: draftHash || null,
      verifiedHash: verifiedHash || null,
      provider: provider || null,
      model: model || null,
      ts: new Date().toISOString(),
    };
    console.log('📈 [OBS]', JSON.stringify(evt));
  } catch (e) {
    console.warn('⚠️ [OBS] Failed to log verifier event:', e?.message || String(e));
  }
}

/**
 * Logs the copilot decision (no raw user text, only short masked why).
 */
function logCopilotDecision({
  userId,
  conversationId,
  copilotRisk,
  copilotWhy,
  heuristicRisk,
  finalModel,
  streamRequested,
  allowRealStream,
  finalVerify,
  latencyMs,
}) {
  try {
    const evt = {
      type: 'copilot_decision',
      userId: userId || 'guest',
      conversationId: conversationId || null,
      copilotRisk: copilotRisk || null,
      copilotWhy: _truncate(copilotWhy || '', 220),
      heuristicRisk: heuristicRisk || null,
      finalModel: finalModel || null,
      streamRequested: Boolean(streamRequested),
      allowRealStream: typeof allowRealStream === 'boolean' ? allowRealStream : null,
      finalVerify: Boolean(finalVerify),
      latencyMs: typeof latencyMs === 'number' ? latencyMs : null,
      ts: new Date().toISOString(),
    };
    console.log('📈 [OBS]', JSON.stringify(evt));
  } catch (e) {
    console.warn('⚠️ [OBS] Failed to log copilot decision:', e?.message || String(e));
  }
}

module.exports = {
  logVerifierEvent,
  logCopilotDecision,
};
