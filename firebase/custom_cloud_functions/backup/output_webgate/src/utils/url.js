'use strict';

function safeUrl(u) {
  try {
    return new URL(String(u));
  } catch {
    return null;
  }
}

function getDomain(u) {
  const url = safeUrl(u);
  if (!url) return null;
  return url.hostname || null;
}

function guessFaviconUrl(u) {
  const domain = getDomain(u);
  if (!domain) return null;
  // Google s2 favicon service: lightweight and works for most domains.
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function displayUrl(u, maxLen = 60) {
  const url = safeUrl(u);
  if (!url) return String(u || '');
  const s = `${url.hostname}${url.pathname}`.replace(/\/$/, '');
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

// Canonicalize URLs for dedupe/ranking.
// - normalizes http/https (prefers https)
// - strips fragments
// - strips common tracking params (utm_*, fbclid, gclid, ...)
// - normalizes hostname casing and optional www
// - trims trailing slashes
function canonicalizeUrl(u, {
  dropQuery = false,
  stripWww = true,
  stripTracking = true,
} = {}) {
  const url = safeUrl(u);
  if (!url) return null;

  // Prefer https for canonical form
  if (url.protocol === 'http:') url.protocol = 'https:';

  // Strip hash
  url.hash = '';

  // Normalize host
  url.hostname = String(url.hostname || '').toLowerCase();
  if (stripWww && url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
  }

  // Remove default ports
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }

  // Normalize path: collapse trailing slash (except root)
  if (url.pathname && url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/+$/g, '');
    if (!url.pathname) url.pathname = '/';
  }

  if (dropQuery) {
    url.search = '';
  } else if (stripTracking && url.search) {
    // Remove common tracking/affiliate params
    const DROP_PREFIXES = ['utm_'];
    const DROP_KEYS = new Set([
      'fbclid', 'gclid', 'dclid', 'msclkid', 'igshid',
      'mc_cid', 'mc_eid',
      '_ga', '_gl',
      'ref', 'ref_src', 'ref_url',
      'spm', 'si',
    ]);

    const params = [];
    for (const [k, v] of url.searchParams.entries()) {
      const key = String(k || '').toLowerCase();
      if (!key) continue;
      if (DROP_KEYS.has(key)) continue;
      if (DROP_PREFIXES.some((p) => key.startsWith(p))) continue;
      // Keep non-empty; empty params add noise
      if (v == null || String(v).trim() === '') continue;
      params.push([key, String(v)]);
    }
    params.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
    const sp = new URLSearchParams();
    for (const [k, v] of params) sp.append(k, v);
    const qs = sp.toString();
    url.search = qs ? `?${qs}` : '';
  }

  // URL() will percent-encode where needed
  return url.toString();
}

module.exports = {
  getDomain,
  guessFaviconUrl,
  displayUrl,
  safeUrl,
  canonicalizeUrl,
  extractUrls,
};

// Extract http/https URLs from arbitrary text.
// - trims trailing punctuation
// - keeps order
function extractUrls(text) {
  const t = String(text || '');
  const re = /(https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+)(?!\w)/gi;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(t)) !== null) {
    let url = m[1];
    // strip common trailing punctuation/brackets
    url = url.replace(/[).,;!?\]\}]+$/g, '');
    const u = safeUrl(url);
    if (!u) continue;
    const norm = u.toString();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
    if (out.length >= 5) break; // hard cap
  }
  return out;
}
