'use strict';

function centerInBox(text, width) {
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  const right = width - text.length - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

// ── BUILD FINGERPRINT ─────────────────────────────────────────────────────
// Mijenjaj BUILD_TAG svaki deploy. U logovima ćeš odmah vidjeti koja verzija radi.
const BUILD_TAG  = 'v5.2.2-FIX19';
const BUILD_DATE = '2026-02-14';

function printBanner(mode) {
  const title = mode === 'production'
    ? 'GPTNiX BACKEND V5 - PRODUCTION MODE'
    : 'GPTNiX BACKEND V5 - DEVELOPMENT MODE';

  const width = 47;
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log(`║${centerInBox(title, width)}║`);
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`🏷️  BUILD: ${BUILD_TAG}  (${BUILD_DATE})\n`);
}

module.exports = { printBanner, BUILD_TAG, BUILD_DATE };
