#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// test_date_harness.js — Date extraction test harness
//
// Usage:
//   node test_date_harness.js                    # uses built-in BiH/HR/DE URLs
//   node test_date_harness.js urls.txt           # one URL per line from file
//   node test_date_harness.js https://klix.ba/...  https://...  (inline URLs)
//
// Output: table of url | publishedAtIso | dateType | confidence | domain | src
// ═══════════════════════════════════════════════════════════════════════════════

const https = require('https');
const http  = require('http');
const { extractPublishDate } = require('./src/utils/extractPublishDate.js');

// ─── Default test URLs (BiH/HR/DE/EN portals) ──────────────────────────────────
const DEFAULT_URLS = [
  'https://klix.ba',
  'https://bljesak.info',
  'https://avaz.ba',
  'https://hercegovina.info',
  'https://slobodnadalmacija.hr',
  'https://index.hr',
  'https://jutarnji.hr',
  'https://vecernji.hr',
  'https://derstandard.at',
  'https://spiegel.de',
  'https://hr.wikipedia.org/wiki/Tomislavgrad',
  'https://vlada.gov.hr',
  'https://bbc.com/news',
];

async function fetchPage(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
    const t = setTimeout(() => resolve({ ok: false, error: 'timeout', headers: {} }), timeoutMs);
    try {
      const req = proto.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GPTNiXDateTestBot/1.0)',
          'Accept': 'text/html,*/*;q=0.8',
        },
        timeout: timeoutMs,
      }, (res) => {
        clearTimeout(t);
        const headers = {};
        Object.keys(res.headers).forEach(k => headers[k.toLowerCase()] = res.headers[k]);
        const chunks = [];
        res.on('data', d => { chunks.push(d); if (Buffer.concat(chunks).length > 300000) res.destroy(); });
        res.on('end', () => resolve({ ok: true, html: Buffer.concat(chunks).toString('utf8', 0, 200000), headers, status: res.statusCode, finalUrl: url }));
        res.on('error', e => resolve({ ok: false, error: e.message, headers }));
      });
      req.on('error', e => { clearTimeout(t); resolve({ ok: false, error: e.message, headers: {} }); });
    } catch (e) {
      clearTimeout(t);
      resolve({ ok: false, error: e.message, headers: {} });
    }
  });
}

function pad(s, n) { return String(s||'').slice(0,n).padEnd(n); }
function truncUrl(u, n=55) { return u.length>n ? u.slice(0,n-1)+'…' : u; }

async function main() {
  let urls;
  const args = process.argv.slice(2);
  if (args.length === 0) {
    urls = DEFAULT_URLS;
    console.log('Using built-in test URLs. Pass URLs as args or a .txt file.\n');
  } else if (args.length === 1 && args[0].endsWith('.txt')) {
    const fs = require('fs');
    urls = fs.readFileSync(args[0], 'utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  } else {
    urls = args;
  }

  console.log('─'.repeat(140));
  console.log(
    pad('URL', 56) + '│' +
    pad('publishedAtIso', 15) + '│' +
    pad('dateType', 14) + '│' +
    pad('confidence', 11) + '│' +
    pad('domain', 11) + '│' +
    pad('freshScore', 11) + '│' +
    'source'
  );
  console.log('─'.repeat(140));

  let found = 0, fallback = 0, missing = 0;

  for (const url of urls) {
    process.stdout.write(`Fetching ${truncUrl(url)}... `);
    const res = await fetchPage(url);
    if (!res.ok) {
      console.log(`ERROR: ${res.error}`);
      missing++;
      continue;
    }
    const r = extractPublishDate({ url: res.finalUrl || url, html: res.html, httpHeaders: res.headers });

    const srcRisk = r.source.includes('body') || r.source.includes('http_last') ? '⚠ ' : '✓ ';
    const domainFlag = r.domain === 'wiki' ? '🔴' : r.domain === 'gov' ? '🟢' : '⚪';

    // Stats
    if (!r.publishedAtIso) missing++;
    else if (r.source.startsWith('jsonld') || r.source.startsWith('meta_pub') || r.source.startsWith('time')) found++;
    else fallback++;

    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    console.log(
      pad(truncUrl(url), 56) + '│' +
      pad(r.publishedAtIso || '—', 15) + '│' +
      pad(r.dateType, 14) + '│' +
      pad(r.confidence, 11) + '│' +
      pad(domainFlag + ' ' + r.domain, 11) + '│' +
      pad(r.freshnessScore?.toFixed(2), 11) + '│' +
      srcRisk + r.source
    );
  }

  console.log('─'.repeat(140));
  const total = urls.length;
  console.log(`\nSummary: ${total} URLs | ✅ high-conf: ${found} | ⚠ fallback: ${fallback} | ❌ no date: ${missing}`);
  console.log('Legend: ✓ = reliable source | ⚠ = fallback (body/last-modified) | 🔴 wiki | 🟢 gov | ⚪ general');
}

main().catch(console.error);
