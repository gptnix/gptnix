'use strict';

const { getAdmin, getFirestore } = require('../billing/firestore');

function parseBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function _splitCsvEnv(name) {
  return String(process.env[name] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * ✅ Brzi (sinkroni) admin check iz tokena ili env liste.
 * - custom claim: decoded.admin === true
 * - ADMIN_UIDS: CSV list uid-ova
 * - ADMIN_EMAILS: CSV list emailova
 */
function isAdminDecoded(decoded) {
  if (!decoded) return false;
  if (decoded.admin === true) return true; // custom claim

  const uidList = _splitCsvEnv('ADMIN_UIDS');
  if (uidList.length && decoded.uid && uidList.includes(decoded.uid)) return true;

  const emailList = _splitCsvEnv('ADMIN_EMAILS').map((e) => e.toLowerCase());
  const email = String(decoded.email || '').toLowerCase();
  if (emailList.length && email && emailList.includes(email)) return true;

  return false;
}

// ─────────────────────────────────────────
// ✅ Firestore fallback (is_admin / role / roles)
// ─────────────────────────────────────────

const _adminCache = new Map(); // uid -> { v:boolean, exp:number }
const _pending = new Map(); // uid -> Promise<boolean>

function _cacheTtlMs() {
  const sec = Number(process.env.ADMIN_CACHE_TTL_SEC || 300);
  if (!Number.isFinite(sec) || sec <= 0) return 300000;
  return Math.min(Math.max(sec, 15), 3600) * 1000; // 15s .. 1h
}

function clearAdminCache(uid) {
  if (!uid) return;
  _adminCache.delete(uid);
  _pending.delete(uid);
}

function _normalizeRole(v) {
  return String(v || '').trim().toLowerCase();
}

async function _isAdminViaFirestore(uid) {
  try {
    const db = getFirestore();
    if (!db) return false;

    const col = String(process.env.USERS_COLLECTION || 'users').trim() || 'users';
    const snap = await db.collection(col).doc(uid).get();
    if (!snap.exists) return false;

    const data = snap.data() || {};

    // najčešći patterni u FlutterFlowu
    if (data.is_admin === true) return true;
    if (data.isAdmin === true) return true;
    if (data.admin === true) return true;

    const role = _normalizeRole(data.role);
    if (role === 'admin' || role === 'owner' || role === 'superadmin') return true;

    const roles = Array.isArray(data.roles) ? data.roles.map(_normalizeRole) : [];
    if (roles.includes('admin') || roles.includes('owner') || roles.includes('superadmin')) return true;

    // fallback: permissions map
    if (data.permissions && typeof data.permissions === 'object') {
      if (data.permissions.admin === true) return true;
      const pRole = _normalizeRole(data.permissions.role);
      if (pRole === 'admin' || pRole === 'owner' || pRole === 'superadmin') return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}

/**
 * ✅ Glavni admin check (token claim/env -> Firestore fallback)
 * Cache-a rezultat da billing endpointi ne čitaju Firestore na svaku request.
 */
async function isAdminUser(decoded) {
  if (!decoded || !decoded.uid) return false;

  // 1) brzi check
  if (isAdminDecoded(decoded)) return true;

  const uid = decoded.uid;
  const now = Date.now();

  // 2) cache
  const cached = _adminCache.get(uid);
  if (cached && cached.exp > now) return cached.v;

  // 3) de-dupe paralelne requeste
  if (_pending.has(uid)) return _pending.get(uid);

  const p = (async () => {
    const v = await _isAdminViaFirestore(uid);
    _adminCache.set(uid, { v, exp: Date.now() + _cacheTtlMs() });
    return v;
  })();

  _pending.set(uid, p);
  try {
    return await p;
  } finally {
    _pending.delete(uid);
  }
}

// ─────────────────────────────────────────
// ✅ Auth middleware
// ─────────────────────────────────────────

async function requireAuth(req, res, next) {
  try {

    const admin = getAdmin();
    if (!admin) return res.status(500).json({ ok: false, error: 'auth_not_configured' });

    // osiguraj init (u slučaju da auth middleware dođe prije config/firebase)
    try {
      if (!admin.apps || admin.apps.length === 0) {
        admin.initializeApp();
      }
    } catch (_) {
      // ignore
    }

    const token = parseBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: 'missing_bearer_token' });

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'invalid_token' });
  }
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    Promise.resolve(isAdminUser(req.user))
      .then((ok) => {
        if (!ok) return res.status(403).json({ ok: false, error: 'admin_only' });
        return next();
      })
      .catch(() => res.status(403).json({ ok: false, error: 'admin_only' }));
  });
}

module.exports = {
  requireAuth,
  requireAdmin,
  isAdminDecoded,
  isAdminUser,
  clearAdminCache,

  // backwards-compat aliases
  verifyFirebaseToken: requireAuth,
  verifyAdmin: requireAdmin,
};
