'use strict';

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const { getBucket } = require('../config/firebase');

function requestBuffer(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      const err = new Error(`Invalid URL: ${url}`);
      err.statusCode = 400;
      return reject(err);
    }

    const lib = u.protocol === 'http:' ? http : https;

    const req = lib.request(
      u,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'GPTNiX/1.0',
          Accept: '*/*',
        },
      },
      (res) => {
        const status = res.statusCode || 0;

        // Redirect handling
        if (status >= 300 && status < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            const err = new Error('Too many redirects while downloading image');
            err.statusCode = 502;
            res.resume();
            return reject(err);
          }
          const nextUrl = new URL(res.headers.location, u).toString();
          res.resume();
          return resolve(requestBuffer(nextUrl, redirectsLeft - 1));
        }

        if (status < 200 || status >= 300) {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            const err = new Error(`Failed to download image: ${status} ${body}`.trim());
            err.statusCode = 502;
            reject(err);
          });
          return;
        }

        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const contentType = res.headers['content-type'] || 'application/octet-stream';
          resolve({ buf, contentType });
        });
      },
    );

    req.on('error', (e) => {
      const err = new Error(`Download error: ${e.message}`);
      err.statusCode = 502;
      reject(err);
    });

    req.end();
  });
}

function makeFirebaseDownloadUrl(bucketName, objectPath, token) {
  const encoded = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
}

async function uploadBufferToFirebaseStorage({ buffer, contentType, destination, cacheControl }) {
  const bucket = getBucket();
  const file = bucket.file(destination);

  const token = crypto.randomUUID();

  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      contentType,
      cacheControl: cacheControl || 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const downloadUrl = makeFirebaseDownloadUrl(bucket.name, destination, token);

  return {
    bucket: bucket.name,
    path: destination,
    downloadUrl,
    token,
  };
}

async function uploadImageFromUrl({ url, destination, cacheControl }) {
  const { buf, contentType } = await requestBuffer(url);
  return uploadBufferToFirebaseStorage({
    buffer: buf,
    contentType,
    destination,
    cacheControl,
  });
}

module.exports = {
  uploadImageFromUrl,
  uploadBufferToFirebaseStorage,
  makeFirebaseDownloadUrl,
};
