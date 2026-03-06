'use strict';

// Wikipedia (MediaWiki) — free, no key
// Search API: https://www.mediawiki.org/wiki/API:Search
// Summary REST: https://www.mediawiki.org/wiki/REST_API

const { WIKI_USER_AGENT, WIKI_TIMEOUT_MS } = require('../../config/env');

const { wikidataLookup } = require('./wikidata');
const { dbpediaLookup } = require('./dbpedia');

// Tiny in-memory cache to keep it fast
const _cache = new Map();

function _now() {
  return Date.now();
}

function _cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (e.exp && e.exp < _now()) {
    _cache.delete(key);
    return null;
  }
  return e.val;
}

function _cacheSet(key, val, ttlMs) {
  _cache.set(key, { val, exp: _now() + ttlMs });
}

function _pickWikiLang(languageHint) {
  const raw = String(languageHint || '').trim().toLowerCase();
  const lang = raw.split(/[-_]/)[0];
  const allow = new Set([
    'en', 'hr', 'bs', 'sr',
    'de', 'fr', 'it', 'es', 'pt', 'nl', 'pl', 'cs', 'sk', 'sl', 'hu', 'ro', 'bg', 'el', 'tr',
    'ru', 'uk',
    'sv', 'no', 'da', 'fi',
    'ar', 'he', 'fa',
    'zh', 'ja', 'ko',
  ]);
  return allow.has(lang) ? lang : 'en';
}

function _guessWikiLangFromText(text) {
  const t = String(text || '').toLowerCase();
  // If we see local diacritics or typical words, prefer hr/bs.
  if (/[čćžšđ]/.test(t) || /\b(tko|što|sta|kako|gdje|kada|povijest|biografija)\b/.test(t)) {
    if (/\bšta\b/.test(t)) return 'bs';
    return 'hr';
  }
  return null;
}

function _wikiBase(lang) {
  return `https://${lang}.wikipedia.org`;
}


function _toUnicodeUrl(u) {
  const url = String(u || '').trim();
  if (!url) return '';
  try {
    // decodeURI keeps URL structure while turning %C4%8D into č etc.
    return decodeURI(url);
  } catch {
    return url;
  }
}

function _looksPercentEncoded(s) {
  return /%[0-9A-Fa-f]{2}/.test(String(s || ''));
}

function _safeDecodeURIComponent(s) {
  const str = String(s || '');
  if (!_looksPercentEncoded(str)) return str;
  try {
    // decodeURIComponent is stricter than decodeURI; guard it.
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

function _normalizeTextForWiki(input) {
  let s = String(input || '').trim();
  if (!s) return '';

  // If someone passed a full URL, try to extract the title-ish part.
  // Examples:
  // - https://hr.wikipedia.org/wiki/Kova%C4%8Di_(Tomislavgrad)
  // - https://hr.wikipedia.org/wiki/Kova%C4%8Di_(Tomislavgrad)?oldformat=true
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1] || '';
      if (last) s = last;
    }
  } catch {
    // ignore
  }

  // Convert underscores and pluses back to spaces for searching.
  s = s.replace(/_/g, ' ').replace(/\+/g, ' ');

  // Fix cases where we receive a percent-encoded title.
  s = _safeDecodeURIComponent(s);

  // Normalize unicode (prevents weird composed/combined chars).
  try {
    s = s.normalize('NFC');
  } catch {
    // ignore
  }

  return s.trim();
}

function _titleToEncodedPath(title) {
  // Wikipedia URLs work best with underscores.
  const t = String(title || '').trim().replace(/\s+/g, '_');
  return encodeURIComponent(t);
}

function _makeWikiUrls({ lang, title }) {
  const base = _wikiBase(lang);
  const enc = `${base}/wiki/${_titleToEncodedPath(title)}`;
  return {
    pageUrlEncoded: enc,
    pageUrl: _toUnicodeUrl(enc),
  };
}

function _generateSearchVariants(q) {
  const s = String(q || '').trim();
  if (!s) return [];

  // Cloud logs/UI sometimes show diacritics as '?' even when the original was UTF-8.
  // If we truly receive '?' in place of a diacritic, try a few likely replacements.
  if (!/[?\uFFFD]/.test(s)) return [s];

  const replacements = ['č', 'ć', 'š', 'ž', 'đ', 'c', 's', 'z', 'd'];
  const idxs = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '?' || ch === '\uFFFD') idxs.push(i);
  }
  if (!idxs.length) return [s];

  // Keep this bounded; we don't want a combinatorial explosion.
  const maxVariants = 10;
  const out = new Set([s]);

  // Simple: replace ALL '?' with one candidate at a time.
  for (const rep of replacements) {
    if (out.size >= maxVariants) break;
    out.add(s.replace(/[?\uFFFD]/g, rep));
  }

  // Also try removing '?' completely (rarely helps).
  if (out.size < maxVariants) out.add(s.replace(/[?\uFFFD]/g, ''));

  return Array.from(out).slice(0, maxVariants);
}

function _headers(lang) {
  return {
    'user-agent': String(WIKI_USER_AGENT || 'gptnix-backend'),
    accept: 'application/json; charset=utf-8',
    'accept-language': String(lang || 'en'),
  };
}

async function _fetchWithTimeout(url, opts = {}, timeoutMs = Number(WIKI_TIMEOUT_MS || 6500)) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(to);
  }
}

function _cleanQuery(q) {
  let s = _normalizeTextForWiki(q);
  if (!s) return '';

  // Remove URLs and common "from Wikipedia" fillers
  s = s.replace(/https?:\/\/\S+/gi, ' ');

  // Strip Wikipedia mentions in multiple languages
  s = s.replace(/\b(wikipedia|wiki|wikipedija|vikipedija|wikipedie|wikipédia|wikipedia\.org)\b/gi, ' ');

  // Strip phrases like "na wikipediji", "sa wikipedije", "from wikipedia"
  s = s.replace(/\b(na|u|sa|s|iz|from|on)\s+(wikipedia|wiki|wikipedija|vikipedija)\b/gi, ' ');

  // Remove search-operator leftovers
  s = s.replace(/\bsite:\S+\b/gi, ' ');

  // Remove trailing question marks and extra punctuation
  s = s.replace(/[?！!]+$/g, ' ');
  s = s.replace(/[“”"']+/g, ' ');

  // Strip common question prefixes (HR/EN)
  s = s.replace(/^(tko|ko|što|sta)\s+(je|su)\s+/i, '');
  s = s.replace(/^(who|what)\s+(is|are)\s+/i, '');
  s = s.replace(/^(definicija|biografija|povijest|history)\s+(od|of)\s+/i, '');

  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}


async function _searchTitle(query, { lang = 'en' } = {}) {
  const baseQ = _cleanQuery(query);
  if (!baseQ) return null;

  const variants = _generateSearchVariants(baseQ);

  // Try variants in-order; first successful hit wins.
  for (const q of variants) {
    const cacheKey = `wiki:search:${lang}:${q.toLowerCase()}`;
    const cached = _cacheGet(cacheKey);
    if (cached) return cached;

    // Small multi-result search, then pick the best title with simple scoring.
    const url = new URL(_wikiBase(lang) + '/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', q);
    url.searchParams.set('srlimit', '5');
    url.searchParams.set('srnamespace', '0');
    url.searchParams.set('srprop', 'snippet|wordcount|timestamp');
    url.searchParams.set('format', 'json');
    url.searchParams.set('utf8', '1');

    const resp = await _fetchWithTimeout(url.toString(), { headers: _headers(lang) });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Wikipedia search ${resp.status}: ${txt}`);
    }

    const json = await resp.json();
    const results = Array.isArray(json?.query?.search) ? json.query.search : [];
    if (!results.length) continue;

  const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, ' ');
  const stripDia = (s) => {
    try {
      return String(s || '').normalize('NFD').replace(/\p{M}+/gu, '');
    } catch {
      return String(s || '');
    }
  };

  const qNorm = stripDia(q).toLowerCase();
  const tokens = qNorm.split(/\s+/).filter(Boolean);

  const scoreItem = (it) => {
    const title = String(it?.title || '').trim();
    const snippet = stripHtml(it?.snippet || '');
    const tNorm = stripDia(title).toLowerCase();
    const sNorm = stripDia(snippet).toLowerCase();

    let score = 0;

    if (tNorm === qNorm) score += 120;
    if (tNorm.startsWith(qNorm)) score += 60;

    for (const tok of tokens) {
      if (!tok || tok.length < 2) continue;
      if (tNorm.includes(tok)) score += 20;
      else if (sNorm.includes(tok)) score += 6;
    }

    // Penalize disambiguation pages
    if (/(disambiguation|razdvajanje|razdvojnica|višeznačno|viseznacno)/i.test(title)) score -= 40;

    // Slight preference for longer pages (usually "real" articles)
    const wc = Number(it?.wordcount || 0);
    if (Number.isFinite(wc)) score += Math.min(10, Math.floor(wc / 200));

    return score;
  };

  let best = results[0];
  let bestScore = scoreItem(best);

  for (const it of results.slice(1)) {
    const sc = scoreItem(it);
    if (sc > bestScore) {
      best = it;
      bestScore = sc;
    }
  }

    const title = best?.title ? String(best.title) : null;
    if (title) {
      _cacheSet(cacheKey, title, 30 * 60 * 1000); // 30 min
      return title;
    }
  }

  return null;
}


async function _pageExtractFallback(title, { lang = 'en' } = {}) {
  const t = _normalizeTextForWiki(title);
  if (!t) return null;

  const url = new URL(_wikiBase(lang) + '/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'extracts|pageimages|description');
  url.searchParams.set('redirects', '1');
  url.searchParams.set('titles', t);
  url.searchParams.set('exintro', '1');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('exchars', '1200');
  url.searchParams.set('pithumbsize', '500');
  url.searchParams.set('format', 'json');
  url.searchParams.set('utf8', '1');

  const resp = await _fetchWithTimeout(url.toString(), { headers: _headers(lang) });
  if (!resp.ok) return null;

  const json = await resp.json();
  const pages = json?.query?.pages || {};
  const firstKey = Object.keys(pages)[0];
  const p = pages[firstKey];
  if (!p || p.missing) return null;

  const realTitle = p.title || t;

  const urls = _makeWikiUrls({ lang, title: realTitle });
  return {
    title: realTitle,
    description: p.description || '',
    extract: p.extract || '',
    extract_html: '',
    pageUrl: urls.pageUrl,
    pageUrlEncoded: urls.pageUrlEncoded,
    thumbnail: p.thumbnail?.source || '',
    lang,
    type: '',
  };
}

async function _pageSummary(title, { lang = 'en' } = {}) {
  const t = _normalizeTextForWiki(title);
  if (!t) return null;

  const cacheKey = `wiki:summary:${lang}:${t.toLowerCase()}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const url = _wikiBase(lang) + '/api/rest_v1/page/summary/' + encodeURIComponent(t) + '?redirect=true';

  const resp = await _fetchWithTimeout(url, { headers: _headers(lang) });

  if (!resp.ok) {
    // REST endpoint is sometimes picky; fallback to action=query extract.
    if (resp.status === 404 || resp.status === 400) {
      const fallback = await _pageExtractFallback(t, { lang });
      if (fallback) {
        _cacheSet(cacheKey, fallback, 6 * 60 * 60 * 1000);
        return fallback;
      }
    }
    const txt = await resp.text().catch(() => '');
    throw new Error(`Wikipedia summary ${resp.status}: ${txt}`);
  }

  const json = await resp.json();

  const realTitle = json?.title || t;
  const urls = _makeWikiUrls({ lang, title: realTitle });

  // MediaWiki may provide canonical URLs; keep both.
  const canonicalEncoded =
    json?.content_urls?.desktop?.page ||
    json?.content_urls?.mobile?.page ||
    urls.pageUrlEncoded;

  const out = {
    title: realTitle,
    description: json?.description || '',
    extract: json?.extract || '',
    extract_html: json?.extract_html || '',
    pageUrl: _toUnicodeUrl(canonicalEncoded),
    pageUrlEncoded: canonicalEncoded,
    thumbnail: json?.thumbnail?.source || '',
    lang,
    type: json?.type || '',
  };

  _cacheSet(cacheKey, out, 6 * 60 * 60 * 1000); // 6h
  return out;
}

function formatWikiContext(summary) {
  if (!summary) return '';

  const lines = [];
  lines.push(`Naslov: ${summary.title}`);
  if (summary.description) lines.push(`Opis: ${summary.description}`);

  // Keep it short-ish for LLM context.
  const extract = String(summary.extract || '').trim();
  if (extract) {
    const cut = extract.length > 1200 ? extract.slice(0, 1200).trimEnd() + '…' : extract;
    lines.push('Sažetak:');
    lines.push(cut);
  }

  if (summary.pageUrl) lines.push(`URL: ${summary.pageUrl}`);
  if (summary.pageUrlEncoded) lines.push(`URL_SAFE: <${String(summary.pageUrlEncoded).trim()}>`);

  // NOTE for the model: some markdown auto-linkers break on percent-encoding/line-wrap.
  // The angle-bracket form tends to survive.
  lines.push('NAPOMENA ZA MODEL: Ako korisniku daješ link, koristi URL_SAFE (u <>).');

  // Disambiguation note
  if (String(summary.type || '').toLowerCase() === 'disambiguation') {
    lines.push('NAPOMENA: Ovo je stranica razdvajanja (više mogućih značenja).');
  }

  return lines.join('\n');
}


function _clipText(s, maxLen) {
  const str = String(s || '');
  if (!maxLen || maxLen <= 0) return str;
  return str.length > maxLen ? str.slice(0, maxLen).trimEnd() + '…' : str;
}

function formatWikidataMiniContext(w) {
  if (!w || !w.ok) return '';
  const f = w.facts || {};
  const lines = [];
  lines.push('=== WIKIDATA (strukturirani fakti) ===');
  if (w.label || w.entityId) {
    lines.push(`- Entitet: ${w.label || ''}${w.entityId ? ` (${w.entityId})` : ''}`.trim());
  }
  if (w.description) lines.push(`- Opis: ${w.description}`);
  if (f.born) lines.push(`- Rođen/a: ${f.born}`);
  if (f.died) lines.push(`- Umro/la: ${f.died}`);
  if (Array.isArray(f.occupation) && f.occupation.length) {
    lines.push(`- Zanimanje: ${f.occupation.slice(0, 8).join(', ')}`);
  }
  if (Array.isArray(f.citizenship) && f.citizenship.length) {
    lines.push(`- Državljanstvo: ${f.citizenship.slice(0, 6).join(', ')}`);
  }
  if (f.website) lines.push(`- Web: ${f.website}`);
  if (f.twitter) lines.push(`- Twitter/X: ${f.twitter}`);
  if (f.instagram) lines.push(`- Instagram: ${f.instagram}`);
  if (f.facebook) lines.push(`- Facebook: ${f.facebook}`);

  if (w.wikiUrl) lines.push(`- Wikipedia: ${w.wikiUrl}`);
  if (w.entityId) lines.push(`- Wikidata: https://www.wikidata.org/wiki/${w.entityId}`);
  return lines.join('\n');
}

function formatWikiLayerContext({ summary, wikidata, dbpedia } = {}) {
  const parts = [];
  if (summary) {
    parts.push('=== WIKIPEDIA (sažetak) ===');
    parts.push(formatWikiContext(summary));
  }
  if (wikidata && wikidata.ok) {
    parts.push(formatWikidataMiniContext(wikidata));
  }
  if (dbpedia && dbpedia.ok && dbpedia.context) {
    parts.push(_clipText(dbpedia.context, 900));
  }
  return parts.filter(Boolean).join('\n\n');
}

async function wikiLookup({ query, title, languageHint, includeWikidata = true, includeDbpedia = true } = {}) {
  const raw = _normalizeTextForWiki(String(title || '').trim() || String(query || '').trim());
  if (!raw) return { ok: false, error: 'Nedostaje query/title' };

  const cleaned = _cleanQuery(raw);

  const preferred = _pickWikiLang(languageHint);
  const guessed = _guessWikiLangFromText(raw);

  // Try a small fallback chain (kept deterministic & cheap)
  const tryLangs = [];
  for (const l of [preferred, guessed, 'hr', 'bs', 'sr', 'en']) {
    if (l && !tryLangs.includes(l)) tryLangs.push(l);
  }

  let lastErr = null;

  for (const lang of tryLangs) {
    try {
      // If the incoming query has broken diacritics ("?" placeholders), try a few variants.
      const variants = _generateSearchVariants(cleaned);

      let resolvedTitle = null;

      if (title) {
        resolvedTitle = _normalizeTextForWiki(title);
      } else {
        for (const v of variants) {
          resolvedTitle = await _searchTitle(v, { lang });
          if (resolvedTitle) break;
        }
      }

      if (!resolvedTitle) continue;

      const summary = await _pageSummary(resolvedTitle, { lang });
      if (!summary) continue;

      // Optional enrichments (Wikidata + DBpedia) — run in parallel and fail-soft.
      const tasks = [];
      if (includeWikidata) {
        tasks.push(
          wikidataLookup({ query: summary.title || cleaned, languageHint: lang, limit: 6 }).catch(() => null),
        );
      } else {
        tasks.push(Promise.resolve(null));
      }

      if (includeDbpedia) {
        // DBpedia is mostly EN, but still useful as a free KG fallback.
        tasks.push(dbpediaLookup({ query: summary.title || cleaned }).catch(() => null));
      } else {
        tasks.push(Promise.resolve(null));
      }

      const [wd, dbp] = await Promise.all(tasks);

      const sources = [];
      if (summary.pageUrl) {
        sources.push({
          title: summary.title ? `Wikipedia: ${summary.title}` : 'Wikipedia',
          url: summary.pageUrl,
          snippet: String(summary.extract || '').trim().slice(0, 220),
          domain: `${lang}.wikipedia.org`,
          provider: 'wikipedia',
          iconUrl: `${_wikiBase(lang)}/static/favicon/wikipedia.ico`,
          imageUrl: summary.thumbnail || '',
        });
      }
      if (wd && wd.ok && wd.entityId) {
        sources.push({
          title: wd.label ? `Wikidata: ${wd.label}` : `Wikidata: ${wd.entityId}`,
          url: `https://www.wikidata.org/wiki/${wd.entityId}`,
          snippet: String(wd.description || '').trim(),
          domain: 'wikidata.org',
          provider: 'wikidata',
          iconUrl: 'https://www.wikidata.org/static/favicon/wikidata.ico',
        });
      }
      if (dbp && dbp.ok && Array.isArray(dbp.sources) && dbp.sources.length) {
        sources.push(...dbp.sources);
      }

      const context = formatWikiLayerContext({
        summary,
        wikidata: wd && wd.ok ? wd : null,
        dbpedia: dbp && dbp.ok ? dbp : null,
      });

      return {
        ok: true,
        lang,
        resolvedTitle: summary.title,
        summary,
        wikidata: wd && wd.ok ? wd : null,
        dbpedia: dbp && dbp.ok ? dbp : null,
        sources,
        context: _clipText(context, 2400),
      };
    } catch (e) {
      lastErr = e;
      // continue trying other langs
    }
  }

  return { ok: false, error: lastErr ? lastErr.message : 'Nema rezultata na Wikipediji' };
}


module.exports = {
  wikiLookup,
  formatWikiContext,
  formatWikiLayerContext,
  formatWikidataMiniContext,
};
