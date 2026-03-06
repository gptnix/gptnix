'use strict';

const fs = require('fs');
const path = require('path');

const { openai } = require('../clients/openai');
const {
  OPENAI_API_KEY,
  VOICE_STT_MODEL,
  VOICE_TTS_MODEL,
  VOICE_TTS_VOICE,
  VOICE_TTS_FORMAT,
  VOICE_TTS_SPEED,
} = require('../config/env');

const { logUsageEvent } = require('../billing/logger');
const { usdFromVoiceStt, usdFromVoiceTts, estimateTokens } = require('../billing/cost');
const { getPricing } = require('../billing/pricing');

function _safeLang(languageHint) {
  const l = String(languageHint || '').trim().toLowerCase();
  // OpenAI expects ISO-639-1 (e.g., "en", "hr"). FlutterFlow usually sends that.
  if (/^[a-z]{2}$/.test(l)) return l;
  // Sometimes we get "hr-HR".
  if (/^[a-z]{2}-[a-z]{2}$/.test(l)) return l.slice(0, 2);
  return null;
}

function _tmpFilePath(ext) {
  const safeExt = (ext || 'wav').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'wav';
  return path.join(
    '/tmp',
    `gptnix-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`,
  );
}

function _mimeToExt(mime, fallback = 'wav') {
  const m = String(mime || '').toLowerCase();
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('m4a') || m.includes('mp4')) return 'm4a';
  if (m.includes('aac')) return 'aac';
  if (m.includes('webm')) return 'webm';
  return fallback;
}

function _ttsFormatToMime(format) {
  const f = String(format || '').toLowerCase();
  if (f === 'wav') return 'audio/wav';
  if (f === 'aac') return 'audio/aac';
  if (f === 'm4a' || f === 'mp4') return 'audio/mp4';
  // default mp3
  return 'audio/mpeg';
}


function _resolveCtx(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  return {
    userId: (c.userId || c.uid || c.user || null) || 'guest',
    conversationId: c.conversationId || null,
    requestId: c.requestId || c.reqId || null,
    operation: c.operation || null,
    route: c.route || null,
  };
}

function _clamp(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function _estimateWavSeconds(buf) {
  try {
    if (!buf || buf.length < 44) return null;
    if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
    if (buf.toString('ascii', 8, 12) !== 'WAVE') return null;

    let offset = 12;
    let byteRate = null;
    let dataSize = null;

    while (offset + 8 <= buf.length) {
      const id = buf.toString('ascii', offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      offset += 8;

      if (id === 'fmt ') {
        if (offset + 16 <= buf.length) {
          // const audioFormat = buf.readUInt16LE(offset);
          // const numChannels = buf.readUInt16LE(offset + 2);
          // const sampleRate = buf.readUInt32LE(offset + 4);
          byteRate = buf.readUInt32LE(offset + 8);
          // const blockAlign = buf.readUInt16LE(offset + 12);
          // const bitsPerSample = buf.readUInt16LE(offset + 14);
        }
      } else if (id === 'data') {
        dataSize = size;
      }

      offset += size;
      // chunks are word-aligned
      if (offset % 2 === 1) offset += 1;

      if (byteRate && dataSize != null) break;
    }

    if (!byteRate || !dataSize) return null;
    const seconds = dataSize / byteRate;
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return seconds;
  } catch (_) {
    return null;
  }
}

function _estimateAudioSeconds(buffer, mime, filename, declaredSeconds) {
  const declared = Number(declaredSeconds);
  if (Number.isFinite(declared) && declared > 0) {
    return { seconds: declared, estimated: false, method: 'declared' };
  }

  const m = String(mime || '').toLowerCase();
  const name = String(filename || '').toLowerCase();

  // WAV exact duration
  const isWav = m.includes('wav') || name.endsWith('.wav');
  if (isWav) {
    const wavSeconds = _estimateWavSeconds(buffer);
    if (wavSeconds != null) return { seconds: wavSeconds, estimated: false, method: 'wav' };
  }

  // Heuristics by typical bitrate (very rough)
  let bitrate = 96_000; // bits/sec default
  if (m.includes('webm') || m.includes('opus') || name.endsWith('.webm')) bitrate = 48_000;
  else if (m.includes('ogg') || name.endsWith('.ogg')) bitrate = 64_000;
  else if (m.includes('mp3') || name.endsWith('.mp3')) bitrate = 128_000;
  else if (m.includes('m4a') || m.includes('mp4') || name.endsWith('.m4a') || name.endsWith('.mp4')) bitrate = 96_000;

  const bytes = buffer ? buffer.length : 0;
  const seconds = bytes > 0 ? (bytes * 8) / bitrate : 0;
  const clamped = _clamp(seconds, 0.2, 20 * 60); // max 20 min safety
  return { seconds: clamped, estimated: true, method: 'bitrate' };
}

function _estimateTtsSeconds(text, speed) {
  const pricing = getPricing();
  const base = Number(pricing?.voice?.estimate_chars_per_second || 14);
  const sp = _clamp(speed || 1, 0.5, 2.0);
  const cps = base * sp;
  const chars = String(text || '').length;
  const seconds = chars > 0 ? chars / cps : 0;
  return { seconds: _clamp(seconds, 0.5, 20 * 60), estimated: true, chars, charsPerSecond: cps };
}

/**
 * Transcribe audio buffer using OpenAI STT.
 * Returns plain transcript text.
 */
async function transcribeAudioBuffer(
  buffer,
  { mime, filename, languageHint, detectLanguage = true, returnLanguage = true, billing } = {},
) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY missing (voice STT requires OpenAI)');
  }
  if (!openai) {
    throw new Error('OpenAI SDK not initialized');
  }
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 16) {
    throw new Error('Empty audio buffer');
  }

  const extFromName = filename ? String(filename).split('.').pop() : null;
  const ext = _mimeToExt(mime, extFromName || 'wav');
  const tmpPath = _tmpFilePath(ext);
  await fs.promises.writeFile(tmpPath, buffer);

  try {
    const langHint = _safeLang(languageHint);

    const is404 = (e) => {
      const msg = String(e?.message || '');
      return e?.status === 404 || e?.code === 404 || /\b404\b/.test(msg) || /not\s*found/i.test(msg);
    };

    // Prefer env-selected model, but gracefully fall back to whisper-1 if the account
    // doesn't have access to newer STT snapshots (OpenAI often returns 404 in that case).
    const primaryModel = VOICE_STT_MODEL || 'whisper-1';
    const candidates = Array.from(new Set([primaryModel, 'whisper-1'].filter(Boolean)));

    let transcript;
    let lastErr;
    let usedModel;
    for (const m of candidates) {
      try {
        // IMPORTANT: create a fresh stream each attempt
        const stream = fs.createReadStream(tmpPath);
        const response_format = returnLanguage ? 'verbose_json' : 'text';

        // If we want language detection, DO NOT force the language parameter.
        // If detectLanguage=false, we can still pass a hint (helps accuracy for short clips).
        const forcedLang = !detectLanguage ? (langHint || null) : null;

        transcript = await openai.audio.transcriptions.create({
          file: stream,
          model: m,
          response_format,
          ...(forcedLang ? { language: forcedLang } : {}),
        });
        lastErr = null;
        usedModel = m;
        break;
      } catch (e) {
        lastErr = e;
        if (!is404(e)) break; // if not a 404, don't retry
      }
    }

    if (lastErr) throw lastErr;

    // Normalize output
    const text =
      typeof transcript === 'string'
        ? transcript.trim()
        : transcript && typeof transcript.text === 'string'
          ? transcript.text.trim()
          : String(transcript || '').trim();

    const language =
      transcript && typeof transcript.language === 'string'
        ? transcript.language.trim().toLowerCase()
        : (langHint || '').trim().toLowerCase();

    // Billing (STT)
    if (billing) {
      try {
        const ctx = _resolveCtx(billing);
        const declared = billing.audioDurationSec || billing.durationSec || billing.durationSeconds || billing.audioSeconds || null;
        const dur = _estimateAudioSeconds(buffer, mime, filename, declared);
        const used = usedModel || VOICE_STT_MODEL || 'whisper-1';
        const { usd, breakdown } = usdFromVoiceStt({ model: used, seconds: dur.seconds || 0 });

        await logUsageEvent({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          requestId: ctx.requestId,
          kind: 'voice',
          provider: 'openai',
          model: used,
          operation: ctx.operation || 'stt',
          units: {
            seconds: dur.seconds,
            bytes: buffer.length,
          },
          costUsd: usd,
          meta: {
            route: ctx.route || null,
            durationEstimated: !!dur.estimated,
            durationMethod: dur.method,
            mime: mime || null,
            filename: filename || null,
            languageHint: _safeLang(languageHint) || null,
            detectedLanguage: language || null,
            breakdown,
          },
        });
      } catch (_) {}
    }

    if (returnLanguage) return { text, language: language || null };
    return text;
  } finally {
    fs.promises.unlink(tmpPath).catch(() => {});
  }
}

/**
 * Synthesize speech via OpenAI TTS.
 * Returns { buffer, mime, format, model, voice, speed }.
 */
async function synthesizeSpeech(text, opts = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY missing (voice TTS requires OpenAI)');
  }

  const input = String(text || '').trim();
  if (!input) {
    throw new Error('Empty TTS input');
  }

  const model = String(opts.model || VOICE_TTS_MODEL || 'gpt-4o-mini-tts');
  // Force a "male" voice by default, even if older deployments still have VOICE_TTS_VOICE=alloy.
  // You can override per-request by passing opts.voice.
  const envVoice = String(VOICE_TTS_VOICE || '').trim();
  const voice = String(opts.voice || (envVoice && envVoice !== 'alloy' ? envVoice : 'onyx'));
  const format = String(opts.format || VOICE_TTS_FORMAT || 'mp3');
  const speed = Number(opts.speed || VOICE_TTS_SPEED || 1.0);

  const is404 = (status, bodyText) => {
    if (status !== 404) return false;
    return /model/i.test(bodyText || '') || true;
  };

  async function callTTS(m) {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: m,
        voice,
        input,
        format,
        speed,
      }),
    });
    return r;
  }

  let usedModel = model;
  let resp = await callTTS(usedModel);
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    // If the selected model isn't available, fallback to tts-1 (broadly available).
    if (is404(resp.status, t) && usedModel !== 'tts-1') {
      usedModel = 'tts-1';
      resp = await callTTS(usedModel);
    } else {
      throw new Error(`OpenAI TTS error (${resp.status}): ${t}`);
    }
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`OpenAI TTS error (${resp.status}): ${t}`);
  }

  const ab = await resp.arrayBuffer();
  const buffer = Buffer.from(ab);
  const mime = _ttsFormatToMime(format);

    // Billing (TTS)
  if (opts && opts.billing) {
    try {
      const ctx = _resolveCtx(opts.billing);
      const ttsEst = _estimateTtsSeconds(input, speed);
      const textTokens = estimateTokens(input);
      const { usd, breakdown } = usdFromVoiceTts({
        model: usedModel,
        seconds: ttsEst.seconds || 0,
        chars: ttsEst.chars || input.length,
        textTokens,
      });

      await logUsageEvent({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        requestId: ctx.requestId,
        kind: 'voice',
        provider: 'openai',
        model: usedModel,
        operation: ctx.operation || 'tts',
        units: {
          seconds: ttsEst.seconds,
          chars: ttsEst.chars || input.length,
          textTokens,
          bytesOut: buffer.length,
        },
        costUsd: usd,
        meta: {
          route: ctx.route || null,
          format,
          mime,
          voice,
          speed,
          durationEstimated: true,
          charsPerSecond: ttsEst.charsPerSecond,
          breakdown,
        },
      });
    } catch (_) {}
  }

  return { buffer, mime, format, model: usedModel, voice, speed };
}

module.exports = {
  transcribeAudioBuffer,
  synthesizeSpeech,
  _ttsFormatToMime,
};
