'use strict';

const { publishedAgeLabel } = require('../utils/extractPublishDate');

const { getOpenAIClient } = require('../clients/openai');

function compactSources(webResults, { max = 8 } = {}) {
  const out = [];
  const seen = new Set();
  const results = Array.isArray(webResults?.results) ? webResults.results : [];

  for (const r of results) {
    if (out.length >= max) break;
    const url = String(r?.url || r?.link || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = String(r?.title || r?.name || '').trim();
    const snippet = String(r?.snippet || r?.description || r?.content || '').replace(/\s+/g, ' ').trim();
    const published   = String(r?.publishedAtIso || r?.publishedAt || r?.date || r?.created_at || '').slice(0, 10).trim();
    const dateType    = String(r?.dateType   || 'unknown');
    const domainClass = String(r?.domain     || 'general');
    const confidence  = String(r?.confidence || 'none');
    out.push({ title: title.slice(0, 160), url, snippet: snippet.slice(0, 420),
               published, dateType, domain: domainClass, confidence });
  }
  return out;
}

/**
 * Extract VERIFIED claims from web sources.
 * - Deterministic (temp=0)
 * - Returns JSON with claims + supporting_urls
 */
async function extractWebFacts({ userQuestion, webResults, languageHint = 'hr' }) {
  const openai = getOpenAIClient();
  const sources = compactSources(webResults, { max: 8 });
  if (!sources.length) {
    return { ok: false, error: 'no_sources', facts: null, sources: [] };
  }

  // Domain authority taxonomy — used by LLM to rank conflicting sources
  const domainAuthority = [
    'TIER 1 (authority=1.0) — official government, ministry, municipal sites (.gov, vlada., opcina., kanton., zupanija.)',
    'TIER 2 (authority=0.85) — reputable news (klix.ba, bljesak.info, hercegovina.info, avaz.ba, jutarnji.hr, index.hr)',
    'TIER 3 (authority=0.50) — Wikipedia, encyclopedias — OFTEN OUTDATED for current office holders, party affiliations',
    'TIER 4 (authority=0.30) — blogs, social media, aggregators',
  ].join('\n');

  const sys =
    'You are a strict fact extractor. Your job is to extract ONLY claims directly supported by the provided sources.\n' +
    'Rules (must follow):\n' +
    '- Output MUST be valid JSON. No markdown, no extra text.\n' +
    '- If a claim is not explicitly supported, DO NOT include it.\n' +
    '- For each claim add: supporting_urls (1-3), authority (0.0-1.0 using the taxonomy below), conflict (bool).\n' +
    '- If two sources disagree on the SAME fact (e.g. party name), extract BOTH claims — set conflict=true on BOTH.\n' +
    '  Mark the lower-authority source claim as conflict=true.\n' +
    '- Wikipedia is TIER 3 (authority=0.5) — treat its office-holder/party data as potentially stale.\n' +
    '- Official government/municipal domains are TIER 1 (authority=1.0).\n' +
    '- Language for claim text: ' + (languageHint || 'hr') + '.\n' +
    '\nDomain authority taxonomy:\n' + domainAuthority + '\n' +
    '\nReturn JSON schema exactly:\n' +
    '{"subject":"...","claims":[{"claim":"...","supporting_urls":["..."],"authority":1.0,"conflict":false}],"notes":"..."}';

  const user =
    'USER QUESTION:\n' + String(userQuestion || '').trim() +
    '\n\nSOURCES (use only these):\n' +
    sources
      .map((s, i) => {
        const dateTag  = s.published ? ` (published: ${s.published})` : ' (date unknown)';
        const domFlag  = s.domain === 'wiki'    ? ' [⚠ WIKI: edit-date ≠ fact-date, use with caution]'
                       : s.domain === 'archive' ? ' [⚠ ARCHIVE: crawl date only]'
                       : s.domain === 'gov'     ? ' [✓ GOV: authoritative source]'
                       : '';
        const typeFlag = s.dateType === 'modified' ? ' [date=page-modified, not published]' : '';
        return `[${i + 1}] ${s.title}${dateTag}${domFlag}${typeFlag}\nURL: ${s.url}\nSnippet: ${s.snippet}`;
      })
      .join('\n\n');

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 650,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });

    const raw = resp?.choices?.[0]?.message?.content || '';
    const jsonText = raw.trim();
    const facts = JSON.parse(jsonText);
    return { ok: true, facts, sources };
  } catch (e) {
    return { ok: false, error: String(e?.message || e), facts: null, sources };
  }
}

function makeVerifiedFactsBlock(extracted) {
  if (!extracted?.ok || !extracted?.facts) return '';
  const f = extracted.facts;
  const claims = Array.isArray(f?.claims) ? f.claims : [];
  if (!claims.length) return '';

  // Build URL → metadata maps from sources
  const dateByUrl   = {};
  const domainByUrl = {};
  const typeByUrl   = {};
  for (const s of (Array.isArray(extracted.sources) ? extracted.sources : [])) {
    if (!s?.url) continue;
    if (s.published) dateByUrl[s.url]   = s.published;
    if (s.domain)    domainByUrl[s.url] = s.domain;
    if (s.dateType)  typeByUrl[s.url]   = s.dateType;
  }
  function getDate(urls) {
    for (const u of (Array.isArray(urls) ? urls : [])) {
      const d = dateByUrl[u];
      if (d) return d;
    }
    return null;
  }
  function getDomainClass(urls) {
    for (const u of (Array.isArray(urls) ? urls : [])) {
      const d = domainByUrl[u];
      if (d) return d;
    }
    return 'general';
  }

  const consensus  = claims.filter(c => !c.conflict).slice(0, 10);
  const conflicted = claims.filter(c =>  c.conflict).slice(0, 6);
  const hasConflict = conflicted.length > 0;

  const lines = [];
  lines.push('VERIFIED FACTS' + (hasConflict ? ' (conflict detected — read both sections)' : '') + ':');
  if (f.subject) lines.push('Subject: ' + String(f.subject).trim());
  lines.push('');

  // ── Section 1: USE ────────────────────────────────────────────────────────
  lines.push('--- USE (high authority — build answer from these only) ---');
  for (const c of consensus) {
    const claim = String(c?.claim || '').trim();
    const urls  = Array.isArray(c?.supporting_urls) ? c.supporting_urls : [];
    const auth  = typeof c?.authority === 'number' ? c.authority.toFixed(1) : '?';
    if (!claim || !urls.length) continue;
    const dateStr = getDate(urls);
    const datePart = dateStr ? ', published: ' + dateStr : '';
    const domCls   = getDomainClass(urls);
    const domTag   = domCls === 'gov' ? ' ✓GOV' : domCls === 'wiki' ? ' ⚠WIKI' : '';
    lines.push('  ✓ ' + claim + '  [auth:' + auth + domTag + ', source: ' + urls[0] + datePart + ']');
  }

  // ── Section 2: BLOCKED ────────────────────────────────────────────────────
  if (hasConflict) {
    lines.push('');
    lines.push('--- BLOCKED (lower authority — do not use, do not merge) ---');
    for (const c of conflicted) {
      const claim = String(c?.claim || '').trim();
      const urls  = Array.isArray(c?.supporting_urls) ? c.supporting_urls : [];
      const auth  = typeof c?.authority === 'number' ? c.authority.toFixed(1) : '?';
      if (!claim || !urls.length) continue;
      const dateStr  = getDate(urls);
      const ageLabel = publishedAgeLabel(dateStr);
      const agePart  = dateStr ? ', published: ' + dateStr + ' (' + ageLabel + ')' : ', date unknown';
      const domCls2  = getDomainClass(urls);
      const domTag2  = domCls2 === 'wiki' ? ' ⚠WIKI' : domCls2 === 'archive' ? ' ⚠ARCHIVE' : '';
      lines.push('  ✗ ' + claim + '  [auth:' + auth + domTag2 + ', source: ' + urls[0] + agePart + ']');
    }
    lines.push('');
    lines.push('RULE: BLOCKED facts must not appear in the final answer, not even partially.');
    lines.push('RULE: NEVER combine entity from USE section with attribute from BLOCKED section.');
    lines.push('RULE: If asked about discrepancy → say "Stariji izvori navode X, ali prema službenim stranicama Y je točno."');
  }

  if (f.notes) lines.push('\nNotes: ' + String(f.notes).trim());
  return lines.join('\n');
}

module.exports = { extractWebFacts, makeVerifiedFactsBlock };
