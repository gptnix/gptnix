#!/usr/bin/env node
'use strict';

/**
 * 🧪 GPTNiX V4.1 - SMOKE TEST SUITE
 * 
 * Tests critical routing patterns to prevent regressions
 * Run before every deployment to ensure router works correctly
 * 
 * Usage:
 *   node smoke-test.js
 *   node smoke-test.js --url https://your-backend.run.app
 */

const BACKEND_URL = process.argv.includes('--url') 
  ? process.argv[process.argv.indexOf('--url') + 1]
  : process.env.BACKEND_URL || 'http://localhost:8080';

const TEST_USER_ID = 'smoke-test-user';
const TEST_CONVERSATION_ID = `smoke-${Date.now()}`;

// Test cases: [query, expected_tool, description]
const SMOKE_TESTS = [
  // Instant responses (< 5ms)
  ['Bok!', null, 'Instant greeting'],
  ['Hvala', null, 'Instant affirmation'],
  
  // Movies (TMDB)
  ['Avatar 3', 'movie_report', 'Movie query → TMDB'],
  ['The Batman 2022', 'movie_report', 'Movie with year → TMDB'],
  
  // Weather
  ['Kakvo je vrijeme u Tomislavgradu?', 'weather_forecast', 'Weather query → OpenWeather/MET'],
  
  // Currency
  ['100 EUR u BAM', 'fx_convert', 'Currency conversion → FX API'],
  
  // Current positions (V4.1 critical fix!)
  ['Tko je načelnik općine Kupres?', 'web_search', 'Current official → Web Search'],
  ['Who is the president of Croatia?', 'web_search', 'Current position → Web Search'],
  
  // Web search (current events)
  ['Najnovije vijesti o AI', 'web_search', 'Current news → Web Search'],
  ['Bitcoin price today', 'web_search', 'Real-time data → Web Search'],
];

async function runTest(query, expectedTool, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`   Query: "${query}"`);
  console.log(`   Expected: ${expectedTool || 'instant response'}`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: query,
        userId: TEST_USER_ID,
        conversationId: TEST_CONVERSATION_ID,
        stream: false, // Non-streaming for easier parsing
      }),
    });
    
    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status} - ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    
    // Check if expected tool was used
    if (expectedTool) {
      const toolsUsed = data.toolsUsed || [];
      const toolNames = toolsUsed.map(t => t.name || t);
      
      if (toolNames.includes(expectedTool)) {
        console.log(`   ✅ PASS - Tool ${expectedTool} was used`);
        return true;
      } else {
        console.log(`   ❌ FAIL - Expected ${expectedTool}, got: ${toolNames.join(', ') || 'none'}`);
        return false;
      }
    } else {
      // Instant response - should not use any tools
      const toolsUsed = data.toolsUsed || [];
      if (toolsUsed.length === 0) {
        console.log(`   ✅ PASS - Instant response (no tools)`);
        return true;
      } else {
        console.log(`   ❌ FAIL - Expected instant, but used tools: ${toolsUsed.map(t => t.name).join(', ')}`);
        return false;
      }
    }
  } catch (error) {
    console.log(`   ❌ ERROR - ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 GPTNiX V4.1 SMOKE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Tests: ${SMOKE_TESTS.length}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  let passed = 0;
  let failed = 0;
  
  for (const [query, expectedTool, description] of SMOKE_TESTS) {
    const result = await runTest(query, expectedTool, description);
    if (result) {
      passed++;
    } else {
      failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESULTS:');
  console.log(`   ✅ Passed: ${passed}/${SMOKE_TESTS.length}`);
  console.log(`   ❌ Failed: ${failed}/${SMOKE_TESTS.length}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  if (failed > 0) {
    console.log('\n⚠️  SMOKE TEST FAILED - DO NOT DEPLOY!');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED - READY FOR DEPLOYMENT! 🚀');
    process.exit(0);
  }
}

// Health check first
async function healthCheck() {
  console.log(`\n🏥 Health check: ${BACKEND_URL}/health`);
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Backend is healthy (v${data.version || 'unknown'})`);
      return true;
    } else {
      console.log(`   ❌ Backend returned ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Cannot connect to backend: ${error.message}`);
    console.log(`   💡 Make sure backend is running at ${BACKEND_URL}`);
    return false;
  }
}

// Run tests
(async () => {
  const healthy = await healthCheck();
  if (!healthy) {
    console.log('\n⚠️  Backend is not healthy, aborting tests');
    process.exit(1);
  }
  
  await runAllTests();
})();
