'use strict';

/**
 * Firestore accessor koji radi i kad imaš svoj existing firebase init.
 * Preferira:
 *  1) ../config/firebase (ako exporta db)
 *  2) default firebase-admin app (ako je već inicijaliziran negdje drugdje)
 *  3) inicijalizira firebase-admin (ako ima ADC u Cloud Run-u)
 */
let _db = null;

function getFirestore() {
  if (_db) return _db;

  // 1) pokuša ući u tvoj postojeći init
  try {
    // eslint-disable-next-line global-require
    const fb = require('../config/firebase');
    if (fb && fb.db) {
      _db = fb.db;
      return _db;
    }
  } catch (_) {
    // ignore
  }

  // 2) firebase-admin default app
  try {
    // eslint-disable-next-line global-require
    const admin = require('firebase-admin');
    if (admin.apps && admin.apps.length) {
      _db = admin.firestore();
      return _db;
    }
    // 3) inicijaliziraj (ADC)
    admin.initializeApp();
    _db = admin.firestore();
    return _db;
  } catch (e) {
    // nema Firestore-a (lokalno bez cred) -> null
    return null;
  }
}

function getAdmin() {
  try {
    // eslint-disable-next-line global-require
    return require('firebase-admin');
  } catch (_) {
    return null;
  }
}

module.exports = { getFirestore, getAdmin };
