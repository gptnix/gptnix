'use strict';

const { db } = require('../config/firebase');

// Small in-memory TTL cache (per Cloud Run instance).
const CACHE_TTL_MS = 60 * 1000; // 60s
const CACHE_MAX = 500;

const _cache = new Map();

function _now() {
  return Date.now();
}

function _cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (e.exp <= _now()) {
    _cache.delete(key);
    return null;
  }
  return e.val;
}

function _cacheSet(key, val) {
  if (_cache.size >= CACHE_MAX) {
    const firstKey = _cache.keys().next().value;
    if (firstKey) _cache.delete(firstKey);
  }
  _cache.set(key, { val, exp: _now() + CACHE_TTL_MS });
}

function _safeString(v, max = 2000) {
  const s = typeof v === 'string' ? v : (v == null ? '' : String(v));
  return s.trim().slice(0, max);
}

function normalizePersonalization(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  // Language
  const languageCode =
    _safeString(data?.language?.code || data?.languageCode || data?.lang || data?.locale || '')
      .toLowerCase();

  // Basic profile
  // Flutter field names: nickname, occupation, about_you
  const nickname = _safeString(data?.nickname || data?.name || '');
  const occupation = _safeString(data?.occupation || data?.job || '');
  const about = _safeString(
    data?.about_you || data?.about || data?.bio || data?.moreAboutYou || '', 6000
  );

  // Style — Flutter sends: style | backend legacy: styleTone, baseStyle, tone
  const styleTone = _safeString(
    data?.style || data?.styleTone || data?.baseStyle || data?.tone || ''
  );
  const characteristics = Array.isArray(data?.characteristics)
    ? data.characteristics.map((x) => _safeString(x, 80)).filter(Boolean).slice(0, 15)
    : [];

  // Custom instructions — Flutter sends: custom_instructions | legacy: customInstructions
  const customInstructions = _safeString(
    data?.custom_instructions || data?.customInstructions || data?.instructions || data?.prompt || '',
    6000,
  );

  // Feature toggles — Flutter sends: web_search_enabled, code_enabled, image_gen_enabled, voice_enabled
  const toggles = {
    webSearch:
      data?.web_search_enabled ??
      data?.toggles?.webSearch ??
      data?.advanced?.webSearch ??
      data?.webSearch ??
      data?.web ??
      null,
    imageGeneration:
      data?.image_gen_enabled ??
      data?.toggles?.imageGeneration ??
      data?.toggles?.imageGen ??
      data?.advanced?.imageGeneration ??
      data?.imageGeneration ??
      data?.image ??
      null,
    codeInterpreter:
      data?.code_enabled ??
      data?.toggles?.code ??
      data?.toggles?.codeInterpreter ??
      data?.advanced?.code ??
      data?.code ??
      null,
    memories:
      data?.toggles?.memories ??
      data?.memories ??
      data?.memory ??
      null,
  };

  // Ensure booleans or null
  for (const k of Object.keys(toggles)) {
    if (toggles[k] === null || typeof toggles[k] === 'undefined') toggles[k] = null;
    else toggles[k] = Boolean(toggles[k]);
  }

  return {
    languageCode,
    nickname,
    occupation,
    about,
    styleTone,
    characteristics,
    customInstructions,
    toggles,
    _raw: data,
  };
}

/**
 * Firestore schema (recommended):
 * users/{userId}/personalization/main
 *
 * But we also fall back to: users/{userId} field "personalization".
 */
async function getUserPersonalization(userId) {
  const uid = _safeString(userId, 256);
  if (!uid) return null;

  const cacheKey = `p:${uid}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  try {
    // 1) Preferred: subcollection doc
    const doc = await db.collection('users').doc(uid).collection('personalization').doc('main').get();
    if (doc.exists) {
      const out = normalizePersonalization(doc.data());
      _cacheSet(cacheKey, out);
      return out;
    }

    // 2) Fallback: user doc has personalization map
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const udata = userDoc.data() || {};
      if (udata.personalization && typeof udata.personalization === 'object') {
        const out = normalizePersonalization(udata.personalization);
        _cacheSet(cacheKey, out);
        return out;
      }
    }
  } catch (e) {
    // keep it non-fatal
    console.warn('⚠️ personalization fetch failed:', e.message);
  }

  _cacheSet(cacheKey, null);
  return null;
}

module.exports = {
  getUserPersonalization,
  normalizePersonalization,
};
