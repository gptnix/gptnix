'use strict';

const admin = require('firebase-admin');
const { FIREBASE_STORAGE_BUCKET } = require('./env');

function isAllDigits(s) {
  return typeof s === 'string' && /^[0-9]+$/.test(s);
}

function inferFirebaseProjectId() {
  // Prefer explicit Firebase project id if the user set it.
  const explicit = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT || '';
  if (explicit && !isAllDigits(explicit)) return explicit;

  // Cloud Run sometimes exposes project NUMBER in GOOGLE_CLOUD_PROJECT.
  // If it's all digits, it is NOT a Firebase project id and cannot be used for <id>.appspot.com.
  const candidate =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.PROJECT_ID ||
    '';

  if (!candidate || isAllDigits(candidate)) return '';
  return candidate;
}

function inferDefaultBucket() {
  const projectId = inferFirebaseProjectId();
  if (!projectId) return '';
  // Firebase default storage bucket convention
  return `${projectId}.appspot.com`;
}

if (!admin.apps.length) {
  const bucket = FIREBASE_STORAGE_BUCKET || inferDefaultBucket();

  admin.initializeApp(
    bucket
      ? {
          storageBucket: bucket,
        }
      : undefined,
  );

  console.log('🔥 Firebase initialized');
  if (bucket) console.log('🪣 Storage bucket:', bucket);
}

const db = admin.firestore();

// IMPORTANT: Do NOT call admin.storage().bucket() at module load time.
// If the bucket isn't configured, it will crash the container at startup.
const bucketName = FIREBASE_STORAGE_BUCKET || inferDefaultBucket();

function getBucketName() {
  return bucketName || null;
}

function getBucket() {
  if (!bucketName) {
    const err = new Error(
      'Firebase Storage bucket nije konfiguriran. Postavi env var FIREBASE_STORAGE_BUCKET (npr. gptnix-390f1.appspot.com).',
    );
    err.statusCode = 400;
    throw err;
  }
  return admin.storage().bucket(bucketName);
}

module.exports = { admin, db, getBucket, getBucketName };
