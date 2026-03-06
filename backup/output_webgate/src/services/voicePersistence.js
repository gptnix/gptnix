'use strict';

const { uploadBufferToFirebaseStorage } = require('./storage');

function nowIsoCompact() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function guessExt(format) {
  const f = String(format || 'mp3').toLowerCase();
  if (f === 'wav') return 'wav';
  if (f === 'opus') return 'opus';
  if (f === 'aac') return 'aac';
  if (f === 'flac') return 'flac';
  if (f === 'pcm') return 'pcm';
  return 'mp3';
}

function contentTypeForFormat(format) {
  const f = String(format || 'mp3').toLowerCase();
  if (f === 'wav') return 'audio/wav';
  if (f === 'opus') return 'audio/opus';
  if (f === 'aac') return 'audio/aac';
  if (f === 'flac') return 'audio/flac';
  if (f === 'pcm') return 'audio/pcm';
  return 'audio/mpeg';
}

async function persistVoiceAudio({ userId, conversationId, audioBuffer, format = 'mp3', prefix = 'tts' }) {
  const ext = guessExt(format);
  const ts = nowIsoCompact();
  const uid = userId || 'anon';
  const conv = conversationId || 'no-conv';
  const destination = `gptnix/voice/${uid}/${conv}/${prefix}-${ts}.${ext}`;

  const uploaded = await uploadBufferToFirebaseStorage({
    buffer: audioBuffer,
    contentType: contentTypeForFormat(format),
    destination,
  });

  return {
    stored: true,
    ...uploaded,
  };
}

module.exports = {
  persistVoiceAudio,
  contentTypeForFormat,
};
