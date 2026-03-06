'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { getBucket } = require('../config/firebase');

function safeName(name) {
  return String(name || 'export')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

/**
 * Create a ZIP from provided files (in-memory) and upload to Firebase Storage.
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.conversationId]
 * @param {string} [opts.zipName]
 * @param {Array<{name:string, content:string}>} opts.files
 */
async function createZipAndUpload({ userId, conversationId, zipName, files }) {
  if (!userId) throw new Error('Missing userId');
  if (!Array.isArray(files) || files.length === 0) throw new Error('No files to zip');

  const zip = new AdmZip();

  const maxFiles = 50;
  const maxTotalChars = 700_000;

  let total = 0;
  let used = 0;

  for (const f of files.slice(0, maxFiles)) {
    const name = safeName(f?.name || `file_${used + 1}.txt`);
    const content = String(f?.content || '');

    total += content.length;
    if (total > maxTotalChars) break;

    zip.addFile(name, Buffer.from(content, 'utf8'));
    used += 1;
  }

  if (used === 0) throw new Error('No eligible files after limits');

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const finalName = safeName(zipName || 'gptnix_export') + '.zip';

  const relPath = path.posix.join(
    'exports',
    safeName(userId),
    safeName(conversationId || 'no_conversation'),
    `${ts}_${finalName}`,
  );

  const tmpPath = path.join(os.tmpdir(), `${ts}_${finalName}`);
  zip.writeZip(tmpPath);

  const bucket = getBucket();
  await bucket.upload(tmpPath, {
    destination: relPath,
    metadata: { contentType: 'application/zip' },
  });

  // Public URL (works if bucket permissions allow; otherwise use signed URL approach)
  const file = bucket.file(relPath);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  try { fs.unlinkSync(tmpPath); } catch {}

  return { path: relPath, url, filesZipped: used };
}

module.exports = { createZipAndUpload };
