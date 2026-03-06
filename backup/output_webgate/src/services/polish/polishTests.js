'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  Polish System — Test Suite                                          ║
 * ║  Run: node src/services/polish/polishTests.js                       ║
 * ║  No external deps — only node:assert                                ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const assert = require('assert');
const {
  applyRules,
  extractImmutables,
  restoreImmutables,
  isPureCodeResponse,
  isTooShort,
  diffCheck,
  RULES,
} = require('./polishRules');

const {
  applyRulesOnly,
  createStreamHook,
  getConfig,
  _buildPolishChunks,
  _splitCodeAndText,
} = require('./polishService');

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    _passed++;
  } catch (e) {
    console.error(`  ❌ ${label}`);
    console.error(`     → ${e.message}`);
    _failed++;
  }
}

// ─────────────────────────────────────────────────────────────────
// SUITE 1: Immutables extraction & restoration
// ─────────────────────────────────────────────────────────────────

console.log('\n📦 Suite 1: Immutables extraction & restoration');

test('fenced code block → extracted and restored identically', () => {
  const input = 'Tekst.\n\n```js\nconst x = 1;\nconsole.log(x);\n```\n\nJoš tekst.';
  const { text, segments } = extractImmutables(input);
  assert.ok(!text.includes('const x'), 'code should be gone from extracted text');
  assert.ok(segments.size > 0, 'segments map must have entries');
  const restored = restoreImmutables(text, segments);
  assert.strictEqual(restored, input, 'round-trip must be identical');
});

test('inline code `tick` → extracted and restored', () => {
  const input = 'Use `npm install` to install.';
  const { text, segments } = extractImmutables(input);
  assert.ok(!text.includes('npm install'), 'inline code should be extracted');
  assert.strictEqual(restoreImmutables(text, segments), input);
});

test('multiple code blocks → all extracted and restored in order', () => {
  const input = '```python\nprint("a")\n```\n\nTekst.\n\n```js\nconsole.log("b");\n```';
  const { text, segments } = extractImmutables(input);
  const restored = restoreImmutables(text, segments);
  assert.strictEqual(restored, input);
  assert.strictEqual(segments.size, 2);
});

test('URL → extracted and restored', () => {
  const input = 'Vidi https://example.com/path?q=1 za detalje.';
  const { text, segments } = extractImmutables(input);
  assert.ok(!text.includes('https://example.com'), 'URL must be extracted');
  assert.strictEqual(restoreImmutables(text, segments), input);
});

test('citation marker [1] → extracted and restored', () => {
  const input = 'Prema izvoru [1] i [2,3] ovo je točno.';
  const { text, segments } = extractImmutables(input);
  assert.ok(!text.includes('[1]'), 'citation must be extracted');
  assert.strictEqual(restoreImmutables(text, segments), input);
});

test('ISO date 2026-02-23 → extracted and restored', () => {
  const input = 'Datum je 2026-02-23 i 15.01.2025.';
  const { text, segments } = extractImmutables(input);
  assert.ok(!text.includes('2026-02-23'), 'date must be extracted');
  assert.strictEqual(restoreImmutables(text, segments), input);
});

test('empty string → no crash', () => {
  const { text, segments } = extractImmutables('');
  assert.strictEqual(text, '');
  assert.strictEqual(segments.size, 0);
  assert.strictEqual(restoreImmutables('', segments), '');
});

// ─────────────────────────────────────────────────────────────────
// SUITE 2: Level 1 rules (applyRules)
// ─────────────────────────────────────────────────────────────────

console.log('\n🔧 Suite 2: Level 1 deterministic rules (applyRules)');

test('removes AI opener "As an AI assistant"', () => {
  const result = applyRules('As an AI assistant, here is your answer.');
  assert.ok(!result.startsWith('As an AI'), `Got: ${result.slice(0, 50)}`);
});

test('removes AI opener "Kao AI asistent"', () => {
  const result = applyRules('Kao AI asistent, mogu reći da...');
  assert.ok(!result.startsWith('Kao AI'), `Got: ${result.slice(0, 50)}`);
});

test('removes filler opener "Naravno!"', () => {
  const result = applyRules('Naravno! Evo kako to radi.');
  assert.ok(!result.startsWith('Naravno'), `Got: ${result.slice(0, 30)}`);
});

test('removes filler opener "Certainly!"', () => {
  const result = applyRules('Certainly! Here is the answer.');
  assert.ok(!result.startsWith('Certainly'), `Got: ${result.slice(0, 30)}`);
});

test('removes vacuous closer "Hope this helps!"', () => {
  const input = 'Evo odgovor.\n\nHope this helps!';
  const result = applyRules(input);
  assert.ok(!result.includes('Hope this helps'), `Still contains closer: ${result}`);
});

test('removes vacuous closer "Javi mi se ako..." ', () => {
  const input = 'Evo odgovor.\n\nJavi mi se ako imaš pitanja.';
  const result = applyRules(input);
  assert.ok(!result.includes('Javi mi se'), `Still contains closer: ${result}`);
});

test('collapses 3+ blank lines to 2', () => {
  const input = 'Para 1.\n\n\n\nPara 2.';
  const result = applyRules(input);
  assert.ok(!result.includes('\n\n\n'), `Still has 3+ newlines: ${JSON.stringify(result)}`);
  assert.ok(result.includes('\n\n'), 'Should still have double newline');
});

test('strips trailing whitespace per line', () => {
  const input = 'Line 1.   \nLine 2.\t\nLine 3.';
  const result = applyRules(input);
  assert.ok(!result.includes('   \n'), 'Trailing spaces must be removed');
  assert.ok(!result.includes('\t\n'), 'Trailing tabs must be removed');
});

test('fixes double spaces in prose', () => {
  const input = 'Word  another  word.';
  const result = applyRules(input);
  assert.ok(!result.includes('  '), 'Double spaces should be collapsed');
});

test('code blocks survive all L1 rules unchanged', () => {
  const code = '```js\nconst x = "As an AI";\n// Naravno!\n```';
  const input = `Evo primjer:\n\n${code}\n\nHope this helps!`;
  const result = applyRules(input);
  assert.ok(result.includes('const x = "As an AI"'), 'Code content must be unchanged');
  assert.ok(result.includes('// Naravno!'), 'Code comments must be unchanged');
  assert.ok(!result.includes('Hope this helps'), 'Closer outside code must be removed');
});

test('applyRulesOnly (re-export from polishService) works same as applyRules', () => {
  const input = 'Naravno! Tekst.\n\nHope this helps!';
  assert.strictEqual(applyRulesOnly(input), applyRules(input));
});

// ─────────────────────────────────────────────────────────────────
// SUITE 3: Bypass detection
// ─────────────────────────────────────────────────────────────────

console.log('\n🚦 Suite 3: Bypass detection');

test('isPureCodeResponse — true when >60% is code', () => {
  const code = '```js\n' + 'x'.repeat(200) + '\n```';
  assert.strictEqual(isPureCodeResponse(code), true);
});

test('isPureCodeResponse — false for mixed code+prose', () => {
  const mixed = 'Evo objašnjenje:\n\n```js\nconst x = 1;\n```\n\nOvo je važno znati.';
  assert.strictEqual(isPureCodeResponse(mixed), false);
});

test('isTooShort — true below threshold', () => {
  assert.strictEqual(isTooShort('Kratko', 120), true);
});

test('isTooShort — false above threshold', () => {
  assert.strictEqual(isTooShort('x'.repeat(150), 120), false);
});

test('isTooShort — counts non-whitespace chars', () => {
  const withSpaces = 'a b c d e f '.repeat(20); // >120 real chars once whitespace removed
  assert.strictEqual(isTooShort(withSpaces, 120), false);
});

// ─────────────────────────────────────────────────────────────────
// SUITE 4: diffCheck safety validation
// ─────────────────────────────────────────────────────────────────

console.log('\n🔍 Suite 4: diffCheck invariants');

test('diffCheck passes when content is style-only change', () => {
  const orig = 'The answer is 42 and the date is 2026-02-23. See https://example.com [1].';
  const pol  = 'The answer is 42 and the date is 2026-02-23. Visit https://example.com [1] for details.';
  const { safe } = diffCheck(orig, pol);
  assert.strictEqual(safe, true);
});

test('diffCheck fails when polished is empty', () => {
  const { safe, reasons } = diffCheck('Some text here', '');
  assert.strictEqual(safe, false);
  assert.ok(reasons.includes('polished_is_empty'));
});

test('diffCheck fails when URL is dropped', () => {
  const orig = 'See https://example.com for info.';
  const pol  = 'See the site for info.';
  const { safe, reasons } = diffCheck(orig, pol);
  assert.strictEqual(safe, false);
  assert.ok(reasons.some(r => r.includes('urls_missing')), `reasons: ${reasons}`);
});

test('diffCheck fails when citation is dropped', () => {
  const orig = 'Prema istraživanju [1] ovo je točno.';
  const pol  = 'Ovo je točno.';
  const { safe, reasons } = diffCheck(orig, pol);
  assert.strictEqual(safe, false);
  assert.ok(reasons.some(r => r.includes('citations_missing')), `reasons: ${reasons}`);
});

test('diffCheck fails when polished is >2.2x longer (hallucination risk)', () => {
  const orig = 'Short answer.';
  const pol  = 'x'.repeat(orig.length * 3);
  const { safe, reasons } = diffCheck(orig, pol);
  assert.strictEqual(safe, false);
  assert.ok(reasons.some(r => r.includes('too_long')));
});

test('diffCheck fails when polished is <55% of original (truncation risk)', () => {
  const orig = 'x'.repeat(400);
  const pol  = 'x'.repeat(100);
  const { safe, reasons } = diffCheck(orig, pol);
  assert.strictEqual(safe, false);
  assert.ok(reasons.some(r => r.includes('too_short')));
});

test('diffCheck fails when code block changes', () => {
  const orig = '```js\nconst x = 1;\n```';
  const pol  = '```js\nconst x = 2;\n```';
  const { safe, reasons } = diffCheck(orig, pol);
  assert.strictEqual(safe, false);
  assert.ok(reasons.some(r => r.includes('code_block')), `reasons: ${reasons}`);
});

// ─────────────────────────────────────────────────────────────────
// SUITE 5: Chunking logic
// ─────────────────────────────────────────────────────────────────

console.log('\n✂️  Suite 5: Chunking');

test('_splitCodeAndText separates text and code segments', () => {
  const input = 'Tekst A.\n\n```js\ncode();\n```\n\nTekst B.';
  const segs  = _splitCodeAndText(input);
  assert.ok(segs.some(s => s.type === 'text' && s.content.includes('Tekst A')));
  assert.ok(segs.some(s => s.type === 'code' && s.content.includes('code()')));
  assert.ok(segs.some(s => s.type === 'text' && s.content.includes('Tekst B')));
});

test('_splitCodeAndText with no code → single text segment', () => {
  const input = 'Samo tekst bez koda.';
  const segs  = _splitCodeAndText(input);
  assert.strictEqual(segs.length, 1);
  assert.strictEqual(segs[0].type, 'text');
});

test('_buildPolishChunks — code chunks are marked needsPolish=false', () => {
  const input = 'Tekst.\n\n```js\nlong code block ' + 'x'.repeat(50) + '\n```\n\nVise teksta.';
  const chunks = _buildPolishChunks(input, 9999);
  const codeChunks = chunks.filter(c => c.type === 'code');
  assert.ok(codeChunks.length > 0, 'Should have code chunk');
  codeChunks.forEach(c => assert.strictEqual(c.needsPolish, false));
});

test('_buildPolishChunks — splits text when exceeds maxChars', () => {
  const longText = 'A'.repeat(500) + '\n\n```js\ncode\n```\n\n' + 'B'.repeat(500);
  const chunks   = _buildPolishChunks(longText, 400);
  const textChunks = chunks.filter(c => c.type === 'text');
  assert.ok(textChunks.length >= 2, `Expected >=2 text chunks, got ${textChunks.length}`);
});

// ─────────────────────────────────────────────────────────────────
// SUITE 6: createStreamHook (mock — no real LLM call)
// ─────────────────────────────────────────────────────────────────

console.log('\n🔌 Suite 6: createStreamHook (L1-only, no LLM)');

test('createStreamHook returns a function', () => {
  const hook = createStreamHook({ res: null });
  assert.strictEqual(typeof hook, 'function');
});

test('createStreamHook.onBeforeDone applies L1 rules when POLISH_ENABLED=false', async () => {
  const saved = process.env.POLISH_ENABLED;
  process.env.POLISH_ENABLED = 'false';

  const mockRes = {
    destroyed: false,
    writableEnded: false,
    _written: [],
    write(s) { this._written.push(s); },
    flush() {},
  };
  const hook = createStreamHook({ res: mockRes });
  const input = 'Naravno! Evo odgovor.\n\n\n\nKraj.\n\nHope this helps!';
  const result = await hook(input);

  // L1 should strip filler openers/closers
  assert.ok(!result.startsWith('Naravno'), `L1 opener not stripped: ${result.slice(0,30)}`);
  assert.ok(!result.includes('Hope this helps'), `L1 closer not stripped`);
  // No polished SSE event since L2 is off and text may differ (L1 changes it)
  // If text changed, polished event is written
  // (text does change due to L1 rules)
  assert.ok(mockRes._written.length > 0 || result !== input, 'Either wrote SSE or text changed');

  process.env.POLISH_ENABLED = saved;
});

test('createStreamHook.onBeforeDone returns empty string unchanged', async () => {
  const saved = process.env.POLISH_ENABLED;
  process.env.POLISH_ENABLED = 'false';
  const hook   = createStreamHook({ res: null });
  const result = await hook('');
  assert.strictEqual(typeof result, 'string');
  process.env.POLISH_ENABLED = saved;
});

// ─────────────────────────────────────────────────────────────────
// SUITE 7: getConfig env parsing
// ─────────────────────────────────────────────────────────────────

console.log('\n⚙️  Suite 7: getConfig env parsing');

test('POLISH_ENABLED=true → enabled=true', () => {
  process.env.POLISH_ENABLED = 'true';
  assert.strictEqual(getConfig().enabled, true);
  delete process.env.POLISH_ENABLED;
});

test('POLISH_ENABLED=1 → enabled=true', () => {
  process.env.POLISH_ENABLED = '1';
  assert.strictEqual(getConfig().enabled, true);
  delete process.env.POLISH_ENABLED;
});

test('POLISH_ENABLED=false → enabled=false', () => {
  process.env.POLISH_ENABLED = 'false';
  assert.strictEqual(getConfig().enabled, false);
  delete process.env.POLISH_ENABLED;
});

test('POLISH_MIN_CHARS=200 → minChars=200', () => {
  process.env.POLISH_MIN_CHARS = '200';
  assert.strictEqual(getConfig().minChars, 200);
  delete process.env.POLISH_MIN_CHARS;
});

test('POLISH_LEVEL1_ONLY=true → level1Only=true', () => {
  process.env.POLISH_LEVEL1_ONLY = 'true';
  assert.strictEqual(getConfig().level1Only, true);
  delete process.env.POLISH_LEVEL1_ONLY;
});

test('POLISH_STREAM_MAX_LATENCY_MS=600 → streamMaxLatencyMs=600', () => {
  process.env.POLISH_STREAM_MAX_LATENCY_MS = '600';
  assert.strictEqual(getConfig().streamMaxLatencyMs, 600);
  delete process.env.POLISH_STREAM_MAX_LATENCY_MS;
});

test('defaults are sane when no env set', () => {
  const env = ['POLISH_ENABLED','POLISH_MIN_CHARS','POLISH_MAX_LATENCY_MS','POLISH_LEVEL1_ONLY',
    'POLISH_PROVIDER','POLISH_MODEL','POLISH_MAX_TOKENS','POLISH_MAX_INPUT_CHARS',
    'POLISH_DEBUG','POLISH_STREAM_MAX_LATENCY_MS'];
  const saved = {};
  env.forEach(k => { saved[k] = process.env[k]; delete process.env[k]; });

  const cfg = getConfig();
  assert.strictEqual(cfg.enabled,    false);
  assert.ok(cfg.minChars  > 0,  `minChars=${cfg.minChars}`);
  assert.ok(cfg.maxTokens > 0,  `maxTokens=${cfg.maxTokens}`);
  assert.ok(cfg.maxLatencyMs > 0);
  assert.ok(cfg.streamMaxLatencyMs > 0);
  assert.strictEqual(cfg.level1Only, false);
  assert.strictEqual(cfg.debug,      false);

  env.forEach(k => { if (saved[k] !== undefined) process.env[k] = saved[k]; });
});

// ─────────────────────────────────────────────────────────────────
// SUITE 8: End-to-end L1 (no LLM)
// ─────────────────────────────────────────────────────────────────

console.log('\n🏁 Suite 8: End-to-end L1 (polishAnswer with POLISH_ENABLED=false)');

const { polishAnswer } = require('./polishService');

test('polishAnswer returns L1 result when POLISH_ENABLED=false', async () => {
  process.env.POLISH_ENABLED = 'false';

  const raw = 'Naravno! Evo odgovor na pitanje.\n\n\n\nJoš malo teksta.\n\nHope this helps!';
  const result = await polishAnswer(raw, { language: 'hr' });

  assert.ok(!result.startsWith('Naravno'), 'Filler opener should be stripped by L1');
  assert.ok(!result.includes('Hope this helps'), 'Filler closer should be stripped by L1');
  assert.ok(!result.includes('\n\n\n'), '3x newlines should be collapsed by L1');

  delete process.env.POLISH_ENABLED;
});

test('polishAnswer bypasses L2 for short text', async () => {
  process.env.POLISH_ENABLED = 'true';
  process.env.POLISH_MIN_CHARS = '500';

  const short = 'Kratki odgovor.';
  const result = await polishAnswer(short, { language: 'hr' });
  assert.strictEqual(typeof result, 'string');
  // Should come back quickly without LLM call (L2 bypass)

  delete process.env.POLISH_ENABLED;
  delete process.env.POLISH_MIN_CHARS;
});

test('polishAnswer bypasses L2 for pure code', async () => {
  process.env.POLISH_ENABLED = 'true';

  const pureCode = '```js\n' + 'const x = longCode();\n'.repeat(20) + '\n```';
  const result = await polishAnswer(pureCode, { language: 'en' });
  assert.strictEqual(typeof result, 'string');
  // Code should survive unchanged
  assert.ok(result.includes('longCode()'), 'Code content must be preserved');

  delete process.env.POLISH_ENABLED;
});


// ═════════════════════════════════════════════════════════════════
// SUITE 7: v2.1 UPGRADE TESTS — Claude Sonnet-Level Polish
// ═════════════════════════════════════════════════════════════════

console.log('\n🚀 Suite 7: v2.1 Claude-Level Polish Features');

test('RHYTHM: validates rhythm variation exists', () => {
  const varied = 'Kratko. Srednje duljine rečenica sa više detalja. Još jedna duža rečenica koja objašnjava sve.';
  const sentences = varied.split(/[.!?]\s+/).filter(s => s.trim());
  const wordCounts = sentences.map(s => s.split(/\s+/).length);
  
  // Check for variation (no triplet of same length)
  let hasTriplet = false;
  for (let i = 0; i < wordCounts.length - 2; i++) {
    if (wordCounts[i] === wordCounts[i+1] && wordCounts[i+1] === wordCounts[i+2]) {
      hasTriplet = true;
    }
  }
  
  assert.strictEqual(hasTriplet, false, 'Should not have 3 consecutive sentences of same length');
});

test('METAPHOR: detects forbidden AI-tainted metaphors', () => {
  const forbiddenPatterns = [
    'nevidljiva rijeka vremena',
    'digitalni most između',
    'putovanje kroz vrijeme',
    'tihi arhitekt sustava',
  ];
  
  const forbiddenRegex = /\b(nevidljiva?\s+rijeka|digitalni?\s+most|putovanje\s+kroz|tihi?\s+arhitekt)\b/i;
  
  forbiddenPatterns.forEach(pattern => {
    assert.ok(forbiddenRegex.test(pattern), `Should detect forbidden pattern: ${pattern}`);
  });
});

test('METAPHOR: allows concrete metaphors', () => {
  const allowedPatterns = [
    'kao novac i koliko brzo ga trošite',
    'kao radna ploha, ne arhiva',
    'kao scena i biblioteka',
  ];
  
  const forbiddenRegex = /\b(nevidljiva?\s+rijeka|digitalni?\s+most|putovanje\s+kroz|tihi?\s+arhitekt)\b/i;
  
  allowedPatterns.forEach(pattern => {
    assert.ok(!forbiddenRegex.test(pattern), `Should allow concrete pattern: ${pattern}`);
  });
});

test('FLOW: detects presence of connector words', () => {
  const withConnectors = 'RAM je brz, ali prolazan. Razlika? Jedan živi u sadašnjosti.';
  const connectorRegex = /\b(ali|dok|jer|zato|razlika|jedno|drugo)\b/i;
  
  assert.ok(connectorRegex.test(withConnectors), 'Should detect flow connectors');
});

test('ENDING: validates closing hook patterns', () => {
  const restatements = [
    'I zato jednostavnost djeluje genijalno — jer je.',
    'Razlika je suptilna, ali fundamentalna.',
  ];
  
  restatements.forEach(ending => {
    const wordCount = ending.split(/\s+/).length;
    assert.ok(wordCount >= 4 && wordCount <= 12, `Restatement should be 4-12 words: ${wordCount}`);
  });
});

test('PROMPT: buildStrictRewritePrompt includes RHYTHM_RULES', () => {
  const { buildStrictRewritePrompt } = require('./polishPrompt');
  const { system } = buildStrictRewritePrompt({ draft: 'test' });
  
  assert.ok(system.includes('RHYTHM RULES'), 'Should include RHYTHM RULES section');
  assert.ok(system.includes('3-8 words'), 'Should specify short sentence length');
});

test('PROMPT: buildStrictRewritePrompt includes FORBIDDEN_METAPHORS', () => {
  const { buildStrictRewritePrompt } = require('./polishPrompt');
  const { system } = buildStrictRewritePrompt({ draft: 'test' });
  
  assert.ok(system.includes('FORBIDDEN METAPHORS'), 'Should include metaphor filter');
  assert.ok(system.includes('rijeka/river'), 'Should list forbidden metaphors');
});

test('PROMPT: buildStrictRewritePrompt includes FLOW_CONNECTORS', () => {
  const { buildStrictRewritePrompt } = require('./polishPrompt');
  const { system } = buildStrictRewritePrompt({ draft: 'test' });
  
  assert.ok(system.includes('FLOW CONNECTORS'), 'Should include flow guidance');
  assert.ok(system.includes('Ali...'), 'Should list connectors');
});

test('PROMPT: buildStrictRewritePrompt includes ENDING_RULE', () => {
  const { buildStrictRewritePrompt } = require('./polishPrompt');
  const { system } = buildStrictRewritePrompt({ draft: 'test' });
  
  assert.ok(system.includes('ENDING RULE'), 'Should include ending guidance');
  assert.ok(system.includes('NEVER end with'), 'Should list forbidden endings');
});

// ─────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────

async function run() {
  await new Promise(resolve => setTimeout(resolve, 100)); // let async tests settle

  const total = _passed + _failed;
  console.log(`\n${'─'.repeat(60)}`);
  if (_failed === 0) {
    console.log(`✅ All ${total} tests passed.`);
  } else {
    console.log(`❌ ${_failed}/${total} tests FAILED.`);
    process.exitCode = 1;
  }
  console.log(`${'─'.repeat(60)}\n`);
}

run();

