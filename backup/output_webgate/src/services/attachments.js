'use strict';

const { getBucket, getBucketName } = require('../config/firebase');

function normalizeAttachments(raw) {
  if (!raw) return [];

  // Accept multiple shapes:
  // - { attachments: [...] }
  // - { files: [...] } / { uploads: [...] } / { images: [...] }
  // - raw is already an array
  // - legacy: { fileUrls: [...] } / { imageUrls: [...] }
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (Array.isArray(raw.attachments)) arr = raw.attachments;
  else if (Array.isArray(raw.files)) arr = raw.files;
  else if (Array.isArray(raw.uploads)) arr = raw.uploads;
  else if (Array.isArray(raw.images)) arr = raw.images;
  else if (Array.isArray(raw.items)) arr = raw.items;

  // Convert URL lists into attachment objects
  const urlList = [];
  const fileUrls = raw.fileUrls || raw.file_urls || raw.urls || null;
  const imageUrls = raw.imageUrls || raw.image_urls || null;

  if (Array.isArray(fileUrls)) urlList.push(...fileUrls);
  if (Array.isArray(imageUrls)) urlList.push(...imageUrls);

  if (urlList.length) {
    for (const u of urlList) {
      if (!u) continue;
      arr.push({ url: u, type: 'file', name: String(u).split('/').pop() });
    }
  }

  const out = [];

  for (const a of arr) {
    if (!a) continue;

const filename = a.filename || a.name || a.originalName || a.path || 'upload';
const mimetype = a.mimetype || a.mimeType || a.contentType || 'application/octet-stream';
const mt = String(mimetype || '').toLowerCase();
const isImage = mt.startsWith('image/');

const kind =
  a.kind ||
  a.type ||
  (isImage
    ? 'image'
    : mt.includes('pdf')
      ? 'pdf'
      : mt.includes('word')
        ? 'docx'
        : mt.includes('sheet')
          ? 'xlsx'
          : mt.includes('csv')
            ? 'csv'
            : mt.startsWith('audio/')
              ? 'audio'
              : 'file');

// Prefer URL, but allow inline base64
const url = a.url || a.downloadUrl || a.downloadURL || a.publicUrl || a.storageUrl || '';
const base64 = a.base64 || a.data || '';
const storagePath = a.storagePath || a.storage_path || a.storagepath || a.storage?.path || a.storage?.storagePath || a.path || a.storage?.fullPath || '';
const bucket = a.bucket || a.storageBucket || a.storage?.bucket || (typeof getBucketName === 'function' ? getBucketName() : null) || null;

    out.push({
      kind,
      isImage,
      filename,
      mimetype,
      url,
      base64,
      storagePath,
      bucket,
      size: a.size || null,
      meta: a.meta || {},
    });
  }

  return out;
}

function pickImageUrls(attachments, limit = 4) {
  const imgs = (attachments || []).filter((a) => a && a.kind === 'image');
  return imgs
    .map((a) => a.url)
    .filter((u) => typeof u === 'string' && u.trim().length > 0)
    .slice(0, limit);
}

function getImageUrlForVision(att) {
  if (!att) return '';
  if (att.url) return att.url;

  // If we have inline base64, convert to data URL
  if (att.base64 && typeof att.base64 === 'string') {
    const mime =
      (att.mimetype && String(att.mimetype).startsWith('image/')) ? att.mimetype : 'image/jpeg';
    const b64 = att.base64.startsWith('data:') ? att.base64.split(',').pop() : att.base64;
    return `data:${mime};base64,${b64}`;
  }

  return '';
}

function isLikelyDescribeRequest(text) {
  const t = String(text || '').toLowerCase();
  return (
    /što\s+vidiš|sta\s+vidis|što\s+je\s+na\s+slici|sta\s+je\s+na\s+slici|op[ií]ši\s+sliku|opisi\s+sliku|describe\s+the\s+image|what\s+do\s+you\s+see|analyze\s+this\s+image|analyse\s+this\s+image|ocr|izvuci\s+tekst|izvuci\s+tekst/i.test(
      t,
    ) || t.trim() === ''
  );
}

function isLikelyEditRequest(text) {
  const t = String(text || '').toLowerCase();
  return (
    /promijeni|izmijeni|uredi|dodaj|ukloni|makni|zamijeni|napravi\s+isto|napravi\s+slično|kao\s+ova\s+slika|edit\s+this|change\s+this|modify\s+this|make\s+it\s+like|in\s+this\s+image|samo\s+da|ali\s+da/i.test(
      t,
    ) && t.trim().length > 0
  );
}

function buildDefaultAutoPromptForAttachment(att) {
  if (!att) return 'Analiziraj učitani sadržaj i reci što je najvažnije.';
  if (att.kind === 'image') return 'Što vidiš na slici? Opiši detaljno i izvuci sav tekst (OCR).';
  if (att.kind === 'pdf' || att.mimetype === 'application/pdf')
    return 'Sažmi PDF i izvuci ključne informacije (naslovi, datumi, točke, zaključci).';
  if (att.kind === 'docx' || String(att.mimetype).includes('word'))
    return 'Sažmi dokument i izvuci ključne točke.';
  if (att.kind === 'xlsx' || String(att.mimetype).includes('sheet'))
    return 'Analiziraj tablicu: objasni strukturu, ključne vrijednosti i zaključke.';
  return 'Analiziraj učitani fajl i objasni što je unutra, sa sažetkom i ključnim točkama.';
}

async function fetchAttachmentBuffer(att, { maxBytes = 15 * 1024 * 1024 } = {}) {
  if (!att) throw new Error('attachment missing');

  // Inline base64
  if (att.base64 && typeof att.base64 === 'string') {
    const b64 = att.base64.startsWith('data:') ? att.base64.split(',').pop() : att.base64;
    return Buffer.from(b64, 'base64');
  }

  // URL fetch (http/https)
  if (att.url && typeof att.url === 'string') {
    const r = await fetch(att.url);
    if (!r.ok) throw new Error(`fetch failed (${r.status})`);
    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length > maxBytes) throw new Error(`file too large (${buf.length} bytes)`);
    return buf;
  }

  // Firebase Storage fetch by storagePath / gs://
  const sp = String(att.storagePath || '').trim();
  if (sp) {
    try {
      let bucketName = null;
      let objectPath = sp;

      // gs://bucket/path/to/file
      if (sp.startsWith('gs://')) {
        const rest = sp.slice('gs://'.length);
        const slash = rest.indexOf('/');
        bucketName = slash > 0 ? rest.slice(0, slash) : rest;
        objectPath = slash > 0 ? rest.slice(slash + 1) : '';
      } else {
        bucketName = att.bucket || null;
      }

      // Default bucket from Firebase config
      const defaultBucket = getBucket();
      const bucket = bucketName ? defaultBucket.storage.bucket(bucketName) : defaultBucket;
      const file = bucket.file(objectPath);

      const [buf] = await file.download();
      if (!buf) throw new Error('download returned empty buffer');
      if (buf.length > maxBytes) throw new Error(`file too large (${buf.length} bytes)`);
      return buf;
    } catch (e) {
      throw new Error(`firebase storage download failed: ${String(e?.message || e)}`);
    }
  }

  throw new Error('attachment has no url/base64/storagePath');
}

module.exports = {
  normalizeAttachments,
  pickImageUrls,
  getImageUrlForVision,
  isLikelyDescribeRequest,
  isLikelyEditRequest,
  buildDefaultAutoPromptForAttachment,
  fetchAttachmentBuffer,
};
