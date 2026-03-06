'use strict';

const {
  REPLICATE_VERSION,
  REPLICATE_MODEL_QUALITY,
  REPLICATE_MODEL_FAST,
  IMAGEGEN_DEFAULT_PRESET,
} = require('../config/env');
const { createPrediction, getPrediction } = require('../clients/replicate');

function isMiniMaxImage01(modelRef) {
  return String(modelRef || '').toLowerCase().includes('minimax/image-01');
}

function getPreset(presetName) {
  const p = String(presetName || IMAGEGEN_DEFAULT_PRESET || 'quality').toLowerCase();
  if (p === 'fast') {
    return {
      name: 'fast',
      model: REPLICATE_MODEL_FAST || REPLICATE_VERSION,
      defaults: {
        num_inference_steps: 4,
        go_fast: true,
        output_quality: 85,
        output_format: 'webp',
        megapixels: 1,
      },
    };
  }

  if (p === 'balanced') {
    return {
      name: 'balanced',
      model: REPLICATE_MODEL_QUALITY || REPLICATE_VERSION,
      defaults: {
        num_inference_steps: 28,
        guidance: 3.0,
        go_fast: true,
        output_quality: 92,
        output_format: 'webp',
        megapixels: 1,
      },
    };
  }

  return {
    name: 'quality',
    model: REPLICATE_MODEL_QUALITY || REPLICATE_VERSION,
    defaults: {
      num_inference_steps: 36,
      guidance: 3.5,
      go_fast: false,
      output_quality: 100,
      output_format: 'webp',
      megapixels: 1,
    },
  };
}

function normalizeInput(body = {}, presetDefaults = {}, modelRef = '') {
  const prompt = body.prompt ?? body.text ?? '';
  const input = { prompt };

  // MiniMax image-01 input schema (Replicate)
  if (isMiniMaxImage01(modelRef)) {
    const aspect_ratio = body.aspect_ratio ?? body.aspectRatio;
    const number_of_images =
      body.number_of_images ?? body.numberOfImages ?? body.num_outputs ?? body.numOutputs;
    const prompt_optimizer =
      body.prompt_optimizer ?? body.promptOptimizer ?? body.optimizePrompt ?? presetDefaults.prompt_optimizer;
    const subject_reference =
      body.subject_reference ?? body.subjectReference ?? body.referenceImage ?? body.reference_image;

    if (aspect_ratio) input.aspect_ratio = String(aspect_ratio);
    if (number_of_images != null && !Number.isNaN(Number(number_of_images))) {
      const n = Math.max(1, Math.min(9, Math.floor(Number(number_of_images))));
      input.number_of_images = n;
    } else {
      input.number_of_images = presetDefaults.number_of_images ?? 1;
    }
    if (prompt_optimizer != null) input.prompt_optimizer = Boolean(prompt_optimizer);
    else input.prompt_optimizer = true;
    if (subject_reference) input.subject_reference = String(subject_reference);

    return input;
  }

  // Default (Flux etc.)
  const aspect_ratio = body.aspect_ratio ?? body.aspectRatio;
  const num_outputs = body.num_outputs ?? body.numOutputs;
  const num_inference_steps = body.num_inference_steps ?? body.steps ?? body.numInferenceSteps;
  const guidance = body.guidance;
  const prompt_strength = body.prompt_strength ?? body.promptStrength;
  const megapixels = body.megapixels;
  const seed = body.seed;
  const output_format = body.output_format ?? body.outputFormat;
  const output_quality = body.output_quality ?? body.outputQuality;
  const go_fast = body.go_fast ?? body.goFast;
  const disable_safety_checker = body.disable_safety_checker ?? body.disableSafetyChecker;

  if (aspect_ratio) input.aspect_ratio = String(aspect_ratio);
  if (num_outputs != null) input.num_outputs = Number(num_outputs);

  // Apply defaults first, allow request body to override.
  const stepsVal = num_inference_steps != null ? Number(num_inference_steps) : presetDefaults.num_inference_steps;
  if (stepsVal != null) input.num_inference_steps = Number(stepsVal);

  const guidanceVal = guidance != null ? Number(guidance) : presetDefaults.guidance;
  if (guidanceVal != null && !Number.isNaN(Number(guidanceVal))) input.guidance = Number(guidanceVal);

  const promptStrengthVal =
    prompt_strength != null ? Number(prompt_strength) : presetDefaults.prompt_strength;
  if (promptStrengthVal != null && !Number.isNaN(Number(promptStrengthVal))) {
    input.prompt_strength = Number(promptStrengthVal);
  }

  const megapixelsVal = megapixels != null ? Number(megapixels) : presetDefaults.megapixels;
  if (megapixelsVal != null && !Number.isNaN(Number(megapixelsVal))) input.megapixels = Number(megapixelsVal);

  if (seed != null) input.seed = Number(seed);

  const formatVal = output_format ? String(output_format) : presetDefaults.output_format;
  if (formatVal) input.output_format = String(formatVal);

  const qualityVal = output_quality != null ? Number(output_quality) : presetDefaults.output_quality;
  if (qualityVal != null && !Number.isNaN(Number(qualityVal))) input.output_quality = Number(qualityVal);

  const goFastVal = go_fast != null ? Boolean(go_fast) : presetDefaults.go_fast;
  if (goFastVal != null) input.go_fast = Boolean(goFastVal);

  if (disable_safety_checker != null) input.disable_safety_checker = Boolean(disable_safety_checker);

  return input;
}

function extractImagesFromPrediction(prediction) {
  const out = prediction?.output;
  if (!out) return [];
  // Flux returns list of image URLs
  if (Array.isArray(out)) return out.filter(Boolean);
  // some models return single URL
  if (typeof out === 'string') return [out];
  return [];
}

function extractPredictSeconds(prediction) {
  const m = prediction?.metrics || {};
  const v =
    m.predict_time ??
    m.predictTime ??
    m.total_time ??
    m.totalTime ??
    m.inference_time ??
    m.inferenceTime ??
    null;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function generateImageWithReplicate(body, { waitSeconds = 60 } = {}) {
  const preset = getPreset(body.preset);
  const modelRef = body.version ?? body.model ?? preset.model ?? REPLICATE_VERSION;
  const input = normalizeInput(body, preset.defaults, modelRef);

  if (!input.prompt || !String(input.prompt).trim()) {
    const err = new Error('Missing prompt');
    err.statusCode = 400;
    throw err;
  }

  console.log('🤖 [REPLICATE] Creating prediction...');
  console.log('   Model:', modelRef);
  console.log('   Preset:', preset.name);
  console.log('   Input:', JSON.stringify(input).substring(0, 200));

  let prediction;
  try {
    prediction = await createPrediction({
      version: modelRef,
      input,
      waitSeconds,
    });
    console.log('✅ [REPLICATE] Prediction created:', prediction.id);
    console.log('   Status:', prediction.status);
  } catch (err) {
    console.error('❌ [REPLICATE] Failed to create prediction:', err.message);
    console.error('   Details:', err.details);
    throw err;
  }

  const images = extractImagesFromPrediction(prediction);
  const seconds = extractPredictSeconds(prediction);

  return {
    predictionId: prediction.id,
    status: prediction.status,
    images,
    output: prediction.output ?? null,
    error: prediction.error ?? null,
    logs: prediction.logs ?? null,
    metrics: prediction.metrics ?? null,
    predictSeconds: seconds,
    version:
      prediction.version ?? modelRef,
    model: modelRef,
    preset: preset.name,
    input,
  };
}

async function pollPrediction(predictionId) {
  const prediction = await getPrediction(predictionId);
  const images = extractImagesFromPrediction(prediction);
  const seconds = extractPredictSeconds(prediction);
  return {
    predictionId: prediction.id,
    status: prediction.status,
    images,
    output: prediction.output ?? null,
    error: prediction.error ?? null,
    metrics: prediction.metrics ?? null,
    predictSeconds: seconds,
    version: prediction.version ?? null,
  };
}

module.exports = {
  generateImageWithReplicate,
  pollPrediction,
};
