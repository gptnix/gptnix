'use strict';

// buildFluxPrompt() is used as a general "image prompt enhancer" for all Replicate image models.
// It runs server-side only: the final prompt must NOT be shown to the user.
// NOTE: MiniMax image-01 does not support a dedicated negative_prompt field on Replicate,
// so we embed "avoid/negative" guidance directly into the prompt text.

function _wordCount(s = '') {
  return String(s || '').trim().split(/\s+/).filter(Boolean).length;
}

function _needsDetailBoost(base = '') {
  const t = String(base || '').trim();
  if (!t) return false;
  const wc = _wordCount(t);
  if (wc < 10) return true;
  if (t.length < 70) return true;
  return false;
}

function _uniqList(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const s = String(x || '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function _containsAny(text, needles = []) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  for (const n of needles) {
    if (!n) continue;
    if (t.includes(String(n).toLowerCase())) return true;
  }
  return false;
}

// Theme detection is intentionally simple and language-agnostic:
// upstream we translate user prompts to English, so keyword heuristics work for any user language.
function _detectThemes(promptEnglish = '', preset = '') {
  const p = String(promptEnglish || '');
  const pr = String(preset || '').toLowerCase();

  // "Packshot / catalog" intent: most common for your Stridon workflows.
  const packshot =
    _containsAny(p, [
      'catalog',
      'flyer',
      'supermarket',
      'kauffland',
      'kaufland',
      'spar style',
      'a4',
      'print-ready',
      'packshot',
      'product images',
      'packaging',
      'price tag',
      'shelf',
      'retail',
      'cm yk',
      'cmyk',
    ]) || _containsAny(pr, ['catalog', 'flyer', 'packshot']);

  const needsTextAccuracy =
    packshot ||
    _containsAny(p, [
      'label',
      'logo',
      'brand',
      'headline',
      'title',
      'text',
      'typography',
      'price',
      'caption',
    ]);

  const noIntruders =
    packshot ||
    _containsAny(p, ['only the provided', 'no props', 'no objects', 'no decorative', 'clean background']);

  const cleaning = _containsAny(p, [
    'toilet paper',
    'paper towels',
    'air freshener',
    'cleaning',
    'detergent',
    'disinfectant',
    'dish soap',
    'hand dishwashing',
    'bathroom cleaner',
  ]);

  const beer = _containsAny(p, ['beer', 'lager', 'pilsner', 'ipa', 'stout']);
  const food = beer || _containsAny(p, ['food', 'meal', 'restaurant', 'cooking', 'kitchen', 'pizza', 'burger', 'pasta']);

  const electronics = _containsAny(p, ['phone', 'smartphone', 'laptop', 'tablet', 'smartwatch', 'gadget', 'electronics']);
  const auto = _containsAny(p, ['car', 'vehicle', 'suv', 'wheel', 'headlight', 'license plate']);
  const human = _containsAny(p, ['person', 'people', 'man', 'woman', 'portrait', 'face', 'model', 'hands']);

  return { packshot, needsTextAccuracy, noIntruders, cleaning, food, beer, electronics, auto, human };
}

function _buildNegativeList(promptEnglish = '', preset = '') {
  const themes = _detectThemes(promptEnglish, preset);

  // 1) Global quality / anti-mutavo
  const GLOBAL = [
    'blurry',
    'out of focus',
    'motion blur',
    'low resolution',
    'pixelated',
    'jpeg artifacts',
    'noisy',
    'grainy',
    'low quality',
    'worst quality',
    'bad quality',
    'amateur',
    'ugly',
    'overexposed',
    'underexposed',
    'harsh shadows',
    'blown highlights',
    'color banding',
    'posterization',
    'warped',
    'distorted',
    'stretched',
    'deformed',
    'melted',
    'glitch',
    'artifacting',
    'bad composition',
    'cluttered background',
    'messy',
    'distracting',
    'tilted horizon',
    'crooked',
    'extreme perspective',
    'watermark',
    'signature',
    'logo overlay',
    'username',
    'ui elements',
    'borders',
    'frame',
  ];

  // 2) Text / typography safety
  const TEXT = [
    'misspelled text',
    'gibberish text',
    'broken typography',
    'distorted letters',
    'random text',
    'unreadable text',
    'incorrect label',
    'wrong brand name',
    'altered logo',
    'changed packaging text',
    'text artifacts',
  ];

  // 3) Packshot / catalog lock
  const PACKSHOT = [
    'redesign',
    'rebrand',
    'changed packaging',
    'modified label',
    'wrong colors',
    'wrong logo',
    'crop product',
    'cut off product',
    'partially visible product',
    'floating product',
    'levitating',
    'unrealistic placement',
    'wrong proportions',
    'inconsistent scale',
    'exaggerated size',
    'weird reflections',
    'melted plastic',
    'warped bottle',
    'bent can',
    'extra products',
    'duplicated products',
    'missing products',
    'substituted products',
    'hand holding product',
    'person holding product',
  ];

  // 4) No intruders
  const NO_INTRUDERS = [
    'unrelated objects',
    'random props',
    'irrelevant items',
    'decorative objects',
    'clutter',
    'people',
    'hands',
    'animals',
    'toys',
    'gadgets',
    'tools',
    'weapons',
    'promo stickers',
    'banners',
  ];

  // 5) Human anatomy safety
  const HUMAN = [
    'deformed face',
    'asymmetrical face',
    'bad eyes',
    'cross-eyed',
    'extra teeth',
    'bad hands',
    'extra fingers',
    'missing fingers',
    'fused fingers',
    'deformed limbs',
    'extra limbs',
    'uncanny',
    'doll-like skin',
    'plastic skin',
  ];

  // 6) Food / drink
  const FOOD = [
    'fake food',
    'plastic food',
    'waxy texture',
    'gelatinous',
    'melted food',
    'messy plate',
    'dirty',
    'crumbs everywhere',
    'unnatural shine',
  ];

  const BEER = [
    'weird foam',
    'overflowing foam',
    'dirty glass',
    'fingerprint smudges',
    'wrong label',
  ];

  // 7) Cleaning / hygiene category safety (avoid "gadna" iznenađenja)
  const CLEANING = [
    'food',
    'fruits',
    'vegetables',
    'meat',
    'dirty toilet',
    'feces',
    'vomit',
    'bodily fluids',
    'medical imagery',
    'syringes',
    'pills',
  ];

  // 8) Electronics
  const ELECTRONICS = [
    'sci-fi',
    'cyberpunk',
    'unrealistic ports',
    'impossible buttons',
    'warped screen',
    'broken display',
    'glitch screen',
    'fake logo',
    'wrong brand',
  ];

  // 9) Auto
  const AUTO = [
    'warped wheels',
    'oval wheels',
    'misaligned headlights',
    'wrong badge',
    'fake logo',
    'unreadable license plate',
    'gibberish plate',
  ];

  const out = [...GLOBAL];
  if (themes.needsTextAccuracy) out.push(...TEXT);
  if (themes.packshot) out.push(...PACKSHOT);
  if (themes.noIntruders) out.push(...NO_INTRUDERS);
  if (themes.cleaning) out.push(...CLEANING);
  if (themes.food) out.push(...FOOD);
  if (themes.beer) out.push(...BEER);
  if (themes.electronics) out.push(...ELECTRONICS);
  if (themes.auto) out.push(...AUTO);
  if (themes.human) out.push(...HUMAN);

  // Keep it compact-ish (models can degrade if negatives are huge).
  // We uniq + cap to a sane limit.
  return _uniqList(out).slice(0, 120);
}

function buildFluxPrompt(englishPrompt, { extra = '', preset = '' } = {}) {
  const baseRaw = String(englishPrompt || '').trim();
  if (!baseRaw) return '';

  // If the user prompt is short/vague, quietly "fill in" quality/composition hints.
  const detailBoost = _needsDetailBoost(baseRaw)
    ? 'Highly detailed. Sharp focus. Natural lighting. Clean composition. Realistic textures. High resolution.'
    : '';

  // Positive guardrails (keep short; long guards can reduce adherence).
  const guard =
    'No text, no watermark, no logo unless explicitly requested. If people are present: natural skin, correct hands (5 fingers), correct anatomy.';

  // Hidden negative prompt (embedded as "Avoid: ...").
  // The list is theme-aware (catalog/packshot/cleaning/food/etc.) and language-agnostic
  // because prompts are translated to English upstream.
  const negative = _buildNegativeList(baseRaw, preset).join(', ');

  const extraLine = String(extra || '').trim();

  const parts = [baseRaw];
  if (detailBoost) parts.push(detailBoost);
  parts.push(guard);
  if (extraLine) parts.push(extraLine);
  parts.push(`Avoid: ${negative}`);

  return parts.join('\n\n').trim();
}

module.exports = {
  buildFluxPrompt,
};
