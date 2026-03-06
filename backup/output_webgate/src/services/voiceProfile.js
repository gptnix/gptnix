'use strict';

// Per-user voice profile + tiny "voice memory".
// Focus: simple, fast, practical.

const { admin, db } = require('../config/firebase');

const COLLECTION = 'voice_profiles';

function _normalizeLangCode(code) {
  const raw = String(code || '').trim().toLowerCase();
  if (!raw) return '';
  // Treat hr/bs/sr as the same bucket for UX.
  if (raw.startsWith('hr') || raw.startsWith('bs') || raw.startsWith('sr')) return 'hr';
  const primary = raw.split(/[-_]/)[0];
  return primary || '';
}

function _countWordHits(textLower, words) {
  let c = 0;
  for (const w of words) {
    const re = new RegExp(`\\b${w}\\b`, 'i');
    if (re.test(textLower)) c++;
  }
  return c;
}

function guessLanguageFromText(text, fallback) {
  const t = String(text || '').trim();
  if (!t) return _normalizeLangCode(fallback) || '';

  // Strong Croatian/BHS signal: diacritics.
  if (/[čćđšžČĆĐŠŽ]/.test(t)) return 'hr';

  const lower = t.toLowerCase();
  const hrWords = [
    'što', 'sta', 'jesi', 'ajde', 'može', 'moze', 'neću', 'necu', 'tko', 'kako',
    'gdje', 'jučer', 'jucer', 'danas', 'sutra', 'hvala', 'molim', 'više', 'vise',
    'nemoj', 'pričaj', 'pricaj', 'hrvatski', 'bosanski'
  ];
  const enWords = ['the', 'and', 'you', 'your', 'please', 'today', 'tomorrow', 'thanks', 'how', 'what', 'where'];

  const hrHits = _countWordHits(lower, hrWords);
  const enHits = _countWordHits(lower, enWords);

  if (hrHits >= 2 && hrHits >= enHits) return 'hr';
  if (enHits >= 2 && enHits > hrHits) return 'en';

  return _normalizeLangCode(fallback) || '';
}

function pickPreferredLanguage({ detectedLang, languageHint, profile }) {
  const d = _normalizeLangCode(detectedLang);
  const h = _normalizeLangCode(languageHint);
  const p = _normalizeLangCode(profile && profile.preferredLanguage);

  // Priority: actual detected speech > stored preference > UI hint > en
  return d || p || h || 'en';
}

function pickMaleVoice(profile) {
  const v = String(profile && profile.ttsVoice || '').trim();
  // Default male-ish voice on OpenAI TTS.
  return v || 'onyx';
}

function pickTtsSpeed(profile) {
  const s = Number(profile && profile.ttsSpeed);
  if (Number.isFinite(s) && s >= 0.7 && s <= 1.3) return s;
  return 1.0;
}

function inferVoiceStyleFromText(text) {
  const t = String(text || '').trim();
  const lower = t.toLowerCase();

  const casualMarkers = ['ajde', 'brate', 'stari', 'ma ', 'haha', 'lol', 'jup', 'pliz', 'nemoj'];
  const formalMarkers = ['poštovani', 'postovani', 'srdačan', 's poštovanjem', 'molim vas', 'vi '];

  const casual = casualMarkers.some((m) => lower.includes(m));
  const formal = formalMarkers.some((m) => lower.includes(m));

  let tone = 'neutral';
  if (formal && !casual) tone = 'formal';
  if (casual && !formal) tone = 'casual';

  // Very rough: short vs normal
  const style = t.length <= 80 ? 'short' : (t.length <= 220 ? 'normal' : 'detailed');

  return { tone, style };
}

function buildVoiceProfilePrompt(profile) {
  if (!profile) return '';

  const parts = [];
  const lang = _normalizeLangCode(profile.preferredLanguage);
  if (lang) parts.push(`Preferred language: ${lang}`);

  const tone = String(profile.tone || '').trim();
  if (tone) parts.push(`Tone: ${tone}`);

  const style = String(profile.style || '').trim();
  if (style) parts.push(`Style: ${style}`);

  const voice = String(profile.ttsVoice || '').trim();
  if (voice) parts.push(`TTS voice: ${voice}`);

  const speed = Number(profile.ttsSpeed);
  if (Number.isFinite(speed)) parts.push(`TTS speed: ${speed}`);

  if (!parts.length) return '';

  return `USER VOICE PROFILE:\n- ${parts.join('\n- ')}`;
}

async function getVoiceProfile(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return null;

  try {
    const doc = await db.collection(COLLECTION).doc(uid).get();
    if (!doc.exists) return null;
    return { userId: uid, ...doc.data() };
  } catch (_) {
    return null;
  }
}

async function updateVoiceProfile(userId, patch) {
  const uid = String(userId || '').trim();
  if (!uid) return;

  const clean = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === undefined) continue;
    clean[k] = v;
  }

  clean.updated_at = admin.firestore.FieldValue.serverTimestamp();
  clean.updated_at_ms = Date.now();

  await db.collection(COLLECTION).doc(uid).set(clean, { merge: true });
}

module.exports = {
  getVoiceProfile,
  updateVoiceProfile,
  guessLanguageFromText,
  pickPreferredLanguage,
  pickMaleVoice,
  pickTtsSpeed,
  buildVoiceProfilePrompt,
  inferVoiceStyleFromText,
};
