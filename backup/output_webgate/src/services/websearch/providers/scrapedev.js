'use strict';

const {
  SCRAPEDEV_TOKEN,
  SCRAPEDEV_API_BASE,
  WEBSEARCH_TIMEOUT_MS,
} = require('../../../config/env');

function scrapedevAvailable() {
  return Boolean(SCRAPEDEV_TOKEN);
}

function decodeEntities(input) {
  const s = String(input || '');
  // Minimal HTML entity decoding (enough for excerpts/snippets).
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ');
}

function extractTextFromHtml(html, { maxChars = 8000 } = {}) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<!--([\s\S]*?)-->/g, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxChars) s = s.slice(0, maxChars) + '…';
  return s;
}

async function scrapedevFetchHtml({ url, render = false, timeoutMs } = {}) {
  if (!scrapedevAvailable()) {
    const err = new Error('ScrapeDev token missing');
    err.code = 'SCRAPEDEV_TOKEN_MISSING';
    throw err;
  }

  if (!url || typeof url !== 'string') {
    throw new Error('url required');
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs || WEBSEARCH_TIMEOUT_MS);

  try {
    const base = String(SCRAPEDEV_API_BASE || '').replace(/\/$/, '');
    const apiUrl =
      `${base}?token=${encodeURIComponent(SCRAPEDEV_TOKEN)}` +
      `&url=${encodeURIComponent(url)}` +
      `&render=${render ? 'true' : 'false'}`;

    const res = await fetch(apiUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'gptnix-backend',
      },
    });

    const text = await res.text();

    if (!res.ok) {
      const err = new Error(`ScrapeDev HTTP ${res.status}`);
      err.status = res.status;
      err.body = text;
      throw err;
    }

    return { provider: 'scrapedev', url, html: text };
  } finally {
    clearTimeout(t);
  }
}

async function scrapedevFetchText({ url, render = false, timeoutMs, maxChars = 8000 } = {}) {
  const r = await scrapedevFetchHtml({ url, render, timeoutMs });
  const text = extractTextFromHtml(r.html, { maxChars });
  return { provider: 'scrapedev', url, text };
}

module.exports = {
  scrapedevAvailable,
  scrapedevFetchHtml,
  scrapedevFetchText,
};
