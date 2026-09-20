/**
 * FecalVision - browser inference.
 *
 * Everything model-related lives here so the React components stay about UI.
 * No network calls after the first load: weights are cached in IndexedDB and
 * the service worker caches the original files too, so a farmer who installs
 * the app on Wi-Fi can use it in a coop with no signal.
 *
 * Contract with the training pipeline (artifacts/preprocessing.json):
 *   input  : float32 [1, 224, 224, 3], values in 0-255  (NOT 0-1)
 *   output : float32 [1, 4] softmax probabilities
 *   index  : 0 Coccidiosis, 1 Healthy, 2 Newcastle Disease, 3 Salmonella
 * Normalisation (x / 127.5 - 1) happens inside the graph, so it must NOT be
 * repeated here. Doing it twice is the single most common deployment bug.
 */

import * as tf from '@tensorflow/tfjs';

// const MODEL_URL = '/model/model.json';
// const META_URL = '/model/class_names.json';
// const CALIBRATION_URL = '/model/calibration.json';
// const IDB_KEY = 'indexeddb://fecalvision-v1';
const MODEL_DIR = '/model';          // '/model-ablation' to switch
const MODEL_URL = `${MODEL_DIR}/model.json`;
const META_URL = `${MODEL_DIR}/class_names.json`; 
const CALIBRATION_URL = `${MODEL_DIR}/calibration.json`;
const IDB_KEY = `indexeddb://fecalvision-${MODEL_DIR.slice(1)}`;
const INPUT_SIZE = 224;

/** Fallbacks if the metadata files are missing; the JSON always wins. */
const DEFAULT_CLASSES = ['Coccidiosis', 'Healthy', 'Newcastle Disease', 'Salmonella'];
const DEFAULT_CALIBRATION = { temperature: 1.0, confidence_threshold: 0.6 };

const ADVICE = {
  Coccidiosis:
    'Blood-streaked or rust-coloured droppings are consistent with coccidiosis. Check litter moisture and isolate affected birds, then have a veterinarian confirm before medicating.',
  Healthy:
    'This dropping looks within the normal range. Keep monitoring; one normal sample does not clear the whole flock.',
  'Newcastle Disease':
    'Greenish watery droppings can indicate Newcastle disease, which spreads fast and is reportable in many areas. Contact a veterinarian or your local agriculture office promptly.',
  Salmonella:
    'Whitish or sulphur-coloured droppings can indicate salmonellosis, which is a food-safety risk as well as a bird-health one. Handle birds and eggs with care and seek veterinary confirmation.',
};

let modelPromise = null;
let meta = { classes: DEFAULT_CLASSES, calibration: DEFAULT_CALIBRATION };

async function fetchJSON(url, fallback) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return fallback;
  }
}

/**
 * Load the graph model, preferring the IndexedDB copy so repeat launches are
 * instant and work with no connection at all.
 */
export async function loadModel({ onProgress } = {}) {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    const [classJson, calJson] = await Promise.all([
      fetchJSON(META_URL, null),
      fetchJSON(CALIBRATION_URL, null),
    ]);

    if (classJson?.index_to_class) {
      meta.classes = Object.keys(classJson.index_to_class)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => classJson.index_to_class[k]);
    }
    if (calJson) {
      meta.calibration = {
        temperature: calJson.temperature ?? 1.0,
        confidence_threshold: calJson.confidence_threshold ?? 0.6,
      };
    }

    await tf.ready();

    let model;
    try {
      model = await tf.loadGraphModel(IDB_KEY);
    } catch {
      model = await tf.loadGraphModel(MODEL_URL, {
        onProgress: (p) => onProgress?.(p),
      });
      try {
        await model.save(IDB_KEY);
      } catch {
        // Private browsing or storage pressure: still usable this session.
      }
    }

    // Warm up once so the first real photo is not the slowest one.
    tf.tidy(() => {
      const probe = model.predict(tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3]));
      Array.isArray(probe) ? probe.forEach((t) => t.dispose()) : probe.dispose();
    });

    return model;
  })();

    // Let a later attempt retry instead of replaying the failure.
  modelPromise.catch(() => {
    modelPromise = null;
  });

  return modelPromise;
}

/**
 * Centre-crop to a square, then resize to 224x224.
 * Cropping instead of squashing preserves the shape and texture of the
 * dropping, which matters because shape is part of what distinguishes classes.
 */
export function preprocess(source) {
  return tf.tidy(() => {
    const pixels = tf.browser.fromPixels(source); // [h, w, 3] uint8
    const [h, w] = pixels.shape;
    const side = Math.min(h, w);
    const top = Math.floor((h - side) / 2);
    const left = Math.floor((w - side) / 2);
    const square = pixels.slice([top, left, 0], [side, side, 3]);
    return tf.image
      .resizeBilinear(square, [INPUT_SIZE, INPUT_SIZE])
      .toFloat() // stays in 0-255 on purpose
      .expandDims(0);
  });
}

/** softmax(log(p) / T) - identical to temperature-scaling the logits. */
function applyTemperature(probs, T) {
  if (!T || Math.abs(T - 1) < 1e-6) return probs;
  const logits = probs.map((p) => Math.log(Math.max(p, 1e-12)) / T);
  const max = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/**
 * Classify one image element (img, canvas, or video frame).
 * Returns every probability, not just the winner, so the UI can show the
 * runner-up and the user can judge how close the call was.
 */
export async function classify(source) {
  const model = await loadModel();
  const started = performance.now();

  const input = preprocess(source);
  const output = model.predict(input);
  const raw = Array.from(await output.data());
  tf.dispose([input, output]);

  const { temperature, confidence_threshold: threshold } = meta.calibration;
  const probs = applyTemperature(raw, temperature);

  const ranked = probs
    .map((p, i) => ({ index: i, label: meta.classes[i] ?? `class_${i}`, probability: p }))
    .sort((a, b) => b.probability - a.probability);

  const [top, second] = ranked;
  const margin = top.probability - (second?.probability ?? 0);

  return {
    label: top.label,
    index: top.index,
    confidence: top.probability,
    margin,
    // Abstain when the top probability is below the validation-fitted threshold,
    // or when the top two classes are nearly tied.
    lowConfidence: top.probability < threshold || margin < 0.15,
    threshold,
    ranked,
    advice: ADVICE[top.label] ?? '',
    latencyMs: Math.round(performance.now() - started),
  };
}

export function isModelReady() {
  return modelPromise !== null;
}

export function getClassNames() {
  return [...meta.classes];
}

/** Drop the cached weights - useful when you ship a retrained model. */
export async function clearModelCache() {
  modelPromise = null;
  try {
    await tf.io.removeModel(IDB_KEY);
  } catch {
    /* nothing cached */
  }
}