'use strict';

const { extractPublishDate } = require('../../utils/extractPublishDate');

/**
 * Direct URL reader for GPTNiX.
 *
 * Why this exists:
 * - If the user provides a URL, we MUST read it (instead of guessing from search snippets)
 * - We extract a clean text version and pass it to the LLM as rawContent (citable)
 *
 * Security:
 * - Blocks localhost/private IP ranges to reduce SSRF risk
 */

const { WEBSEARCH_TIMEOUT_MS } = require('../../config/env');
const { safeUrl, displayUrl } = require('../../utils/url');
// Fallback reader: if direct fetch is blocked from server IPs, try Tavily raw_content.
const { tavilyAvailable, tavilySearch } = require('./providers/tavily');
const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_BYTES = 1_200_000; // ~1.2MB max read per page
const MAX_TEXT_CHARS = 18_000; // hard cap injected into prompt (rawContent)

function stripMarkdown(md) {
  let s = String(md || '');
  // remove code blocks
  s = s.replace(/```[\s\S]*?```/g, ' ');
  // images
  s = s.replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ');
  // links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1');
  // headings/bullets
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  s = s.replace(/^\s*[-*+]\s+/gm, '');
  // blockquotes
  s = s.replace(/^\s*>\s?/gm, '');
  // horizontal rules
  s = s.replace(/^\s*---+\s*$/gm, '');
  // collapse whitespace
  s = s.replace(/\r/g, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]{2,}/g, ' ');
  return s.trim();
}

function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  // IPv6 localhost
  if (ip === '::1') return true;

  if (net.isIP(ip) === 4) {
    const parts = ip.split('.').map((x) => Number(x));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  // IPv6 private ranges (very conservative)
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // unique local
  if (ip.startsWith('fe80')) return true; // link-local
  return false;
}

async function isSafePublicUrl(urlStr) {
  const u = safeUrl(urlStr);
  if (!u) return false;
  if (!['http:', 'https:'].includes(u.protocol)) return false;

  const host = (u.hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return false;

  // If hostname is an IP, check it directly
  if (net.isIP(host)) return !isPrivateIp(host);

  // Resolve DNS (best-effort). If resolution fails, we still allow (some envs block DNS).
  try {
    const answers = await dns.lookup(host, { all: true });
    if (Array.isArray(answers) && answers.length) {
      for (const a of answers) {
        if (a && a.address && isPrivateIp(a.address)) return false;
      }
    }
  } catch (_e) {
    // ignore
  }

  return true;
}

function decodeHtmlEntities(str) {
  // Minimal decoder (enough for most CMS pages)
  return String(str || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return '';
      }
    });
}

function htmlToText(html) {
  let s = String(html || '');

  // drop scripts/styles
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<!--([\s\S]*?)-->/g, ' ');

  // add line breaks for common block tags
  s = s.replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section|\/article|\/header|\/footer)\b[^>]*>/gi, '\n');

  // strip remaining tags
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeHtmlEntities(s);

  // normalize whitespace
  s = s.replace(/\r/g, '');
  s = s.replace(/[\t\f\v]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ ]{2,}/g, ' ');

  return s.trim();
}

function pickRelevantExcerpt(text, { hint = '', maxLines = 18 } = {}) {
  const t = String(text || '');
  if (!t) return '';

  const fold = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/đ/g, 'd')
      .replace(/č/g, 'c')
      .replace(/ć/g, 'c')
      .replace(/š/g, 's')
      .replace(/ž/g, 'z');

  const suffixes = [
    'ovima', 'evima', 'ovima', 'ima', 'ama',
    'ovi', 'ove', 'ama', 'ima',
    'om', 'em', 'u', 'a', 'e', 'i', 'o',
  ];

  function stems(w) {
    const out = new Set();
    let x = fold(w).replace(/[^a-z0-9]+/g, '');
    if (!x) return [];
    out.add(x);

    // Common HR/BS/SR case endings
    for (const suf of suffixes) {
      if (x.endsWith(suf) && x.length - suf.length >= 3) out.add(x.slice(0, -suf.length));
    }

    // Light fallback stemming for longer words
    if (x.length >= 7) out.add(x.slice(0, -1));
    if (x.length >= 8) out.add(x.slice(0, -2));
    if (x.length >= 9) out.add(x.slice(0, -3));

    return Array.from(out);
  }

  const hintText = String(hint || '');

  // Pull extra tokens from any URLs inside the hint (path slug often contains relevant words)
  const urlTokens = [];
  const urlRe = /(https?:\/\/[^\s]+)/gi;
  let um;
  while ((um = urlRe.exec(hintText)) !== null) {
    try {
      const u = new URL(um[1].replace(/[).,;!?\]\}]+$/g, ''));
      const slug = decodeURIComponent(`${u.hostname} ${u.pathname}`.replace(/\/+/g, ' '));
      urlTokens.push(...slug.split(/[\s\-_]+/g).filter(Boolean));
    } catch {
      // ignore
    }
  }

  const rawWords = fold(hintText)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  // stopwords (keep place names / feast names!)
  const stop = new Set([
    'kad', 'kada', 'je', 'li', 'na', 'u', 'un', 'the', 'a', 'an', 'and', 'or',
    'za', 'o', 'od', 'do', 'da', 'se', 'su',
    'sati', 'sat', 'hours', 'time',
    'misa', 'mise', 'sveta', 'svete', 'svetom', 'svetoj', 'svetih',
    'u', 'u', 'i', 'ili', 'pa', 'te', 'jer',
  ]);

  const words = [];
  for (const w of [...rawWords, ...urlTokens]) {
    const fw = fold(w);
    if (!fw || fw.length < 3) continue;
    if (stop.has(fw)) continue;
    words.push(fw);
  }

  const needles = new Set();
  for (const w of words) {
    for (const s of stems(w)) needles.add(s);
  }

  // Split to lines and score
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';

  const timeRe = /\b(\d{1,2}[:.]\d{2}|\d{1,2}\s*sati)\b/i;

  const scores = lines.map((line) => {
    const fl = fold(line);
    let score = 0;

    for (const n of needles) {
      if (n.length >= 3 && fl.includes(n)) score += 2;
    }

    // bonus: lines with times are often the answer
    if (timeRe.test(line)) score += 1;

    return score;
  });

  // pick best window around top hits
  const topIdx = scores
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .filter((x) => x.s > 0)
    .slice(0, 6)
    .map((x) => x.i);

  const around = 3;
  const picked = new Set();

  if (topIdx.length) {
    for (const idx of topIdx) {
      for (let j = Math.max(0, idx - around); j <= Math.min(lines.length - 1, idx + around); j++) {
        picked.add(j);
      }
    }
  } else {
    // fallback: try to at least capture lines with time + any place/keyword mentions
    for (let i = 0; i < Math.min(lines.length, 120); i++) {
      if (timeRe.test(lines[i])) {
        picked.add(i);
        if (i + 1 < lines.length) picked.add(i + 1);
        if (i - 1 >= 0) picked.add(i - 1);
        if (picked.size >= maxLines) break;
      }
    }
    if (!picked.size) {
      for (let i = 0; i < Math.min(lines.length, maxLines); i++) picked.add(i);
    }
  }

  return Array.from(picked)
    .sort((a, b) => a - b)
    .map((i) => lines[i])
    .slice(0, maxLines)
    .join('\n')
    .trim();
}

async function fetchTextWithLimit(url, { timeoutMs = WEBSEARCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; GPTNiXBot/1.0; +https://example.com/bot) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
      },
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const finalUrl = res.url || url;

    // Read body with hard byte cap
    const reader = res.body?.getReader ? res.body.getReader() : null;
    if (!reader) {
      const txt = await res.text();
      const hdrs = {}; res.headers.forEach((v,k) => { hdrs[k.toLowerCase()] = v; });
      return { ok: res.ok, status: res.status, finalUrl, contentType, text: txt.slice(0, MAX_TEXT_CHARS), httpHeaders: hdrs };
    }

    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          controller.abort();
          break;
        }
        chunks.push(Buffer.from(value));
      }
    }

    const buf = Buffer.concat(chunks);
    const text = buf.toString('utf8');
    const hdrs = {}; res.headers.forEach((v,k) => { hdrs[k.toLowerCase()] = v; });
    return { ok: res.ok, status: res.status, finalUrl, contentType, text: text.slice(0, MAX_TEXT_CHARS), httpHeaders: hdrs };
  } finally {
    clearTimeout(t);
  }
}

function extractTitle(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return decodeHtmlEntities(m[1]).replace(/\s+/g, ' ').trim().slice(0, 140);
}

async function readWebPage(url, { hint = '' } = {}) {
  const safe = await isSafePublicUrl(url);
  if (!safe) {
    return {
      ok: false,
      url,
      finalUrl: url,
      title: '',
      error: 'Blocked URL (unsafe/private network)'
    };
  }

  try {
    const res = await fetchTextWithLimit(url);
    if (!res.ok) {
      return {
        ok: false,
        url,
        finalUrl: res.finalUrl || url,
        title: '',
        error: `HTTP ${res.status}`,
      };
    }

    const title = extractTitle(res.text) || displayUrl(res.finalUrl || url, 80);
    const plain = htmlToText(res.text);

    const excerpt = pickRelevantExcerpt(plain, { hint });
    const rawContent = plain.length > MAX_TEXT_CHARS ? plain.slice(0, MAX_TEXT_CHARS) + '…' : plain;

    const dateInfo = extractPublishDate({
      url: res.finalUrl || url,
      html: res.text || '',
      httpHeaders: res.httpHeaders || {},
    });

    return {
      ok: true,
      url,
      finalUrl: res.finalUrl || url,
      title,
      excerpt,
      rawContent,
      contentType:    res.contentType || null,
      publishedAtMs:   dateInfo.publishedAtMs,
      publishedAtIso:  dateInfo.publishedAtIso,
      freshnessScore:  dateInfo.freshnessScore,
      dateType:        dateInfo.dateType,     // 'published' | 'modified' | 'unknown'
      domain:          dateInfo.domain,       // 'wiki' | 'gov' | 'archive' | 'general'
      confidence:      dateInfo.confidence,   // 'high' | 'med' | 'low' | 'none'  ← trustScoring koristi ovo
      dateSrc:         dateInfo.source,       // debug: 'jsonld(iso_rfc)' itd.
    };
  } catch (e) {
    return {
      ok: false,
      url,
      finalUrl: url,
      title: '',
      error: String(e?.message || e),
    };
  }
}

/**
 * Read a provided URL with fallback chain.
 * 
 * V5.2.0 CRITICAL FIX: Removed Tavily fallback that was creating ghost URLs.
 * 
 * Fallback chain:
 * 1. Direct fetch (scraper)
 * 2. JinaReader API (if available)
 * 3. Return failure (NO search provider fallback!)
 * 
 * Why NO Tavily fallback?
 * - Using Tavily with URL as query creates ghost URLs in logs
 * - Example: query='https://www.tomislavnews.com/kontakti' 
 * - This pollutes logs and wastes API calls
 * - Better to fail fast and skip unreadable pages
 */
async function readWebPageWithFallback(url, { hint = '', timeout = 4000 } = {}) {
  // 1) Try direct fetch first
  const direct = await readWebPage(url, { hint });
  if (direct.ok) return { ...direct, via: 'direct_fetch' };

  // 2) JinaReader fallback (if configured)
  // TODO: Add JinaReader integration here if JINA_API_KEY is set
  // try {
  //   const jina = await jinaReader(url, { timeout });
  //   if (jina.ok) return { ...jina, via: 'jina_reader' };
  // } catch (e) {
  //   console.log(`JinaReader failed for ${url}:`, e.message);
  // }

  // 3) No more fallbacks - return failure
  // This is intentional! We do NOT use search providers for reading URLs.
  console.log(`⚠️ [READER] Could not read ${url} (tried: direct fetch)`);
  return direct;
}

async function readProvidedUrlsAsResults(urls, { hint = '' } = {}) {
  const list = Array.isArray(urls) ? urls : [];
  const out = [];
  for (let i = 0; i < Math.min(list.length, 3); i++) {
    const u = String(list[i] || '').trim();
    if (!u) continue;
    const page = await readWebPageWithFallback(u, { hint });
    if (page.ok) {
      out.push({
        rank: i + 1,
        title: page.title,
        url: page.finalUrl || page.url,
        snippet: `${page.excerpt || ''}${page.via ? `\n(via: ${page.via})` : ''}`.trim(),
        rawContent: page.rawContent || '',
        provider: 'direct',
      });
    } else {
      out.push({
        rank: i + 1,
        title: page.title || displayUrl(u, 80) || 'Provided URL',
        url: page.finalUrl || u,
        snippet: `FAILED_TO_READ_URL: ${page.error || 'unknown error'}`,
        rawContent: '',
        provider: 'direct',
      });
    }
  }
  return out;
}

module.exports = {
  readWebPage,
  readWebPageWithFallback,
  readProvidedUrlsAsResults,
};
