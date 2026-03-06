'use strict';

const express = require('express');
const { requireAuth, isAdminUser, clearAdminCache } = require('../middleware/auth');
const { getFirestore } = require('../billing/firestore');

function safeString(v) {
  return v == null ? '' : String(v);
}

function createAdminAccessRouter() {
  const router = express.Router();

  /**
   * GET /admin/whoami
   * Debug endpoint da odmah vidiš: uid + email + isAdmin
   */
  router.get('/whoami', requireAuth, async (req, res) => {
    try {
      const u = req.user || {};
      const admin = await isAdminUser(u);
      return res.json({
        ok: true,
        uid: u.uid || null,
        email: u.email || null,
        isAdmin: admin,
        hasAdminClaim: u.admin === true,
      });
    } catch (_) {
      return res.status(500).json({ ok: false, error: 'whoami_failed' });
    }
  });

  /**
   * POST /admin/bootstrap
   * Omogućuje da sebi (ili target uid-u) upišeš admin flag u Firestore
   * Zaštita: ADMIN_BOOTSTRAP_SECRET mora biti postavljen u env, i poslati se kroz header.
   * Header: x-admin-bootstrap: <secret>
   * Body (optional): { uid: "targetUid" }
   */
  router.post('/bootstrap', requireAuth, async (req, res) => {
    try {
      const secretEnv = safeString(process.env.ADMIN_BOOTSTRAP_SECRET);
      if (!secretEnv) {
        return res.status(500).json({ ok: false, error: 'bootstrap_secret_not_set' });
      }

      const secret =
        safeString(req.headers['x-admin-bootstrap']) ||
        safeString(req.headers['x-admin-secret']) ||
        safeString(req.body?.secret);

      if (!secret || secret !== secretEnv) {
        return res.status(403).json({ ok: false, error: 'bad_bootstrap_secret' });
      }

      const db = getFirestore();
      if (!db) return res.status(500).json({ ok: false, error: 'firestore_not_available' });

      const requesterUid = req.user?.uid || null;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'unauthorized' });

      const targetUid = safeString(req.body?.uid).trim() || requesterUid;

      const col = String(process.env.USERS_COLLECTION || 'users').trim() || 'users';
      const adminSdk = require('firebase-admin');

      const ref = db.collection(col).doc(targetUid);
      await ref.set(
        {
          is_admin: true,
          role: 'admin',
          roles: adminSdk.firestore.FieldValue.arrayUnion('admin'),
          admin_updated_at: adminSdk.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // očisti cache da odmah proradi
      clearAdminCache(targetUid);

      return res.json({ ok: true, uid: targetUid, note: 'Admin prava upisana u Firestore (is_admin=true)' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'bootstrap_failed' });
    }
  });

  return router;
}

module.exports = { createAdminAccessRouter };
