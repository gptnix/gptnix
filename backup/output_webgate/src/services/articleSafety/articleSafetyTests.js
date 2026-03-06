'use strict';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║        Article Safety Tests — GPTNiX Test Suite              ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const { detectArticleInput } = require('./detectArticleInput');
const { classifySourceType, SOURCE_TYPES } = require('./classifySourceType');
const { scanDefamationRisk, RISK_LEVELS } = require('./defamationRisk');
const { checkAmplification, hasUnattributedClaims } = require('./noAmplify');
const { evaluateArticleSafety } = require('./index');

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 1: Article Input Detection
// ─────────────────────────────────────────────────────────────────────────────

function testArticleDetection() {
  console.log('\n📦 Test Suite 1: Article Input Detection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const cases = [
    // SHOULD DETECT
    {
      name: 'URL present',
      input: 'Pročitaj ovaj članak: https://index.hr/vijesti/clanak/123',
      expectDetected: true,
    },
    {
      name: 'Explicit article share',
      input: 'Analiziraj ovaj članak o klimatskim promjenama',
      expectDetected: true,
    },
    {
      name: 'Long text with news markers',
      input: 'A'.repeat(1500) + ' vijesti objavljene report analysis',
      expectDetected: true,
    },
    {
      name: 'Very long text',
      input: 'A'.repeat(3500),
      expectDetected: true,
    },
    // SHOULD NOT DETECT
    {
      name: 'Normal question',
      input: 'Kako radi blockchain?',
      expectDetected: false,
    },
    {
      name: 'Short message',
      input: 'Objasni mi AI',
      expectDetected: false,
    },
  ];
  
  let pass = 0, fail = 0;
  
  for (const tc of cases) {
    const result = detectArticleInput(tc.input);
    const ok = result.detected === tc.expectDetected;
    console.log(`${ok ? '✅' : '❌'} ${tc.name}: detected=${result.detected} (expected=${tc.expectDetected})`);
    ok ? pass++ : fail++;
  }
  
  console.log(`\n📊 Suite 1: ${pass}/${pass + fail} passed\n`);
  return fail === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 2: Source Type Classification
// ─────────────────────────────────────────────────────────────────────────────

function testSourceClassification() {
  console.log('\n📦 Test Suite 2: Source Type Classification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const cases = [
    // LOW RISK
    { url: 'https://www.gov.ba/page', expectType: SOURCE_TYPES.GOVERNMENT, expectLowRisk: true },
    { url: 'https://scholar.google.com/article', expectType: SOURCE_TYPES.ACADEMIC, expectLowRisk: true },
    { url: 'https://en.wikipedia.org/wiki/Article', expectType: SOURCE_TYPES.WIKI, expectLowRisk: true },
    
    // MEDIUM RISK
    { url: 'https://index.hr/vijesti/123', expectType: SOURCE_TYPES.MAINSTREAM_NEWS, expectLowRisk: false },
    { url: 'https://www.bbc.com/news/world', expectType: SOURCE_TYPES.MAINSTREAM_NEWS, expectLowRisk: false },
    
    // HIGH RISK
    { url: 'https://someuser.medium.com/article', expectType: SOURCE_TYPES.BLOG, expectLowRisk: false },
    { url: 'https://www.reddit.com/r/politics/comments/123', expectType: SOURCE_TYPES.FORUM, expectLowRisk: false },
    { url: 'https://twitter.com/user/status/123', expectType: SOURCE_TYPES.SOCIAL, expectLowRisk: false },
  ];
  
  let pass = 0, fail = 0;
  
  for (const tc of cases) {
    const result = classifySourceType(tc.url);
    const typeOk = result.sourceType === tc.expectType;
    const riskOk = tc.expectLowRisk ? result.riskScore < 0.4 : result.riskScore >= 0.4;
    const ok = typeOk && riskOk;
    
    console.log(
      `${ok ? '✅' : '❌'} ${tc.url.slice(0, 40)}: ` +
      `type=${result.sourceType} risk=${result.riskScore.toFixed(2)}`
    );
    ok ? pass++ : fail++;
  }
  
  console.log(`\n📊 Suite 2: ${pass}/${pass + fail} passed\n`);
  return fail === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 3: Defamation Risk Detection
// ─────────────────────────────────────────────────────────────────────────────

function testDefamationRisk() {
  console.log('\n📦 Test Suite 3: Defamation Risk Detection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const cases = [
    // HIGH/CRITICAL RISK
    {
      name: 'Person + accusation',
      text: 'Marko Marković je optužen za korupciju',
      expectHigh: true,
    },
    {
      name: 'Minister + scandal',
      text: 'Ministar finansija umiješan u aferu pranja novca',
      expectHigh: true,
    },
    {
      name: 'Severe accusation',
      text: 'CEO John Doe accused of fraud and embezzlement',
      expectHigh: true,
    },
    // LOW/MEDIUM RISK
    {
      name: 'Person only (no accusation)',
      text: 'Predsjednik Obama održao govor',
      expectHigh: false,
    },
    {
      name: 'General accusation (no person)',
      text: 'Korupcija je problem u sistemu',
      expectHigh: false,
    },
    {
      name: 'Normal text',
      text: 'Blockchain je tehnologija distribuiranih knjiga',
      expectHigh: false,
    },
  ];
  
  let pass = 0, fail = 0;
  
  for (const tc of cases) {
    const result = scanDefamationRisk(tc.text);
    const isHigh = result.level === RISK_LEVELS.HIGH || result.level === RISK_LEVELS.CRITICAL;
    const ok = isHigh === tc.expectHigh;
    
    console.log(
      `${ok ? '✅' : '❌'} ${tc.name}: ` +
      `level=${result.level} persons=${result.personCount} accusations=${result.accusationCount}`
    );
    ok ? pass++ : fail++;
  }
  
  console.log(`\n📊 Suite 3: ${pass}/${pass + fail} passed\n`);
  return fail === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 4: Amplification Detection
// ─────────────────────────────────────────────────────────────────────────────

function testAmplificationCheck() {
  console.log('\n📦 Test Suite 4: Amplification Detection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const cases = [
    // SHOULD DETECT AMPLIFICATION
    {
      name: 'Weak → Strong',
      source: 'Možda je to istina',
      ai: 'To je sigurno istina',
      expectAmplified: true,
    },
    {
      name: 'Allegedly → Fact',
      source: 'Navodno je korumpiran',
      ai: 'On je korumpiran',
      expectAmplified: true,
    },
    // SHOULD NOT DETECT
    {
      name: 'Preserved hedging',
      source: 'Možda je to problem',
      ai: 'Prema tekstu, možda je to problem',
      expectAmplified: false,
    },
    {
      name: 'Proper attribution',
      source: 'On je kriv',
      ai: 'Autor tvrdi da je on kriv',
      expectAmplified: false,
    },
  ];
  
  let pass = 0, fail = 0;
  
  for (const tc of cases) {
    const result = checkAmplification(tc.source, tc.ai);
    const ok = result.detected === tc.expectAmplified;
    
    console.log(
      `${ok ? '✅' : '❌'} ${tc.name}: ` +
      `detected=${result.detected} (expected=${tc.expectAmplified})`
    );
    ok ? pass++ : fail++;
  }
  
  console.log(`\n📊 Suite 4: ${pass}/${pass + fail} passed\n`);
  return fail === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 5: End-to-End Integration
// ─────────────────────────────────────────────────────────────────────────────

function testEndToEnd() {
  console.log('\n📦 Test Suite 5: End-to-End Integration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const cases = [
    {
      name: 'Political text with accusations',
      input: 'Analiziraj: https://somesite.ba/vijesti Minister Ivić optužen za korupciju i prevaru',
      expectEnabled: true,
      expectHighRisk: true,
    },
    {
      name: 'Wikipedia URL',
      input: 'Pročitaj https://wikipedia.org/wiki/Blockchain',
      expectEnabled: true,
      expectHighRisk: false,
    },
    {
      name: 'Normal question',
      input: 'Kako radi blockchain?',
      expectEnabled: false,
      expectHighRisk: false,
    },
    {
      name: 'Forum URL with person',
      input: 'https://reddit.com/r/politics Marko Marković kriv',
      expectEnabled: true,
      expectHighRisk: true,
    },
  ];
  
  let pass = 0, fail = 0;
  
  for (const tc of cases) {
    const result = evaluateArticleSafety(tc.input);
    const enabledOk = result.enabled === tc.expectEnabled;
    const riskOk = tc.expectEnabled 
      ? ((result.riskLevel === 'high' || result.riskLevel === 'critical') === tc.expectHighRisk)
      : true;
    const ok = enabledOk && riskOk;
    
    console.log(
      `${ok ? '✅' : '❌'} ${tc.name}: ` +
      `enabled=${result.enabled} riskLevel=${result.riskLevel}`
    );
    ok ? pass++ : fail++;
  }
  
  console.log(`\n📊 Suite 5: ${pass}/${pass + fail} passed\n`);
  return fail === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Test Runner
// ─────────────────────────────────────────────────────────────────────────────

function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║      Article Safety System — Test Suite                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  
  const results = [
    testArticleDetection(),
    testSourceClassification(),
    testDefamationRisk(),
    testAmplificationCheck(),
    testEndToEnd(),
  ];
  
  const allPassed = results.every(r => r === true);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Export for manual testing
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  runAllTests,
  testArticleDetection,
  testSourceClassification,
  testDefamationRisk,
  testAmplificationCheck,
  testEndToEnd,
};

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}
