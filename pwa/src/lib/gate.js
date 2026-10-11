/**
 * Dropping check ("gate") - runs BEFORE the disease model.
 *
 * The disease model (public/model-cap2000_over/, loaded by fecalvision.js) is
 * closed-set: shown a shoe or a hand, it still answers one of its four
 * diseases. This separate, much smaller model (MobileNetV2, width 0.35,
 * ~0.9 MB) answers exactly one question - does this photo contain a chicken
 * dropping? - so the app can refuse to diagnose when the answer is no.
 *
 * Files in public/model-gate/ (a TF.js graph-model export, same format and
 * converter as the disease model):
 *   model.json, group1-shard1of1.bin : the graph and its weights
 *   gate.json                        : { threshold, validation stats, ... } -
 *                                       the decision threshold, fitted on a
 *                                       validation set. NEVER hardcode this;
 *                                       it is deliberately low (0.08) so very
 *                                       few real droppings are wrongly blocked.
 *
 * Same input contract as the disease model (see the top of fecalvision.js):
 * float32 [1, 224, 224, 3], values 0-255, centre-crop then resize. preprocess()
 * is IMPORTED from fecalvision.js, not reimplemented here, so both models see
 * exactly the same pixels from the same photo. Normalisation happens inside
 * this graph too, the same way it does for the disease model - never add /255
 * or any scaling in this file.
 *
 * Fails open: if the gate cannot load or run, checkDropping() returns
 * { gateAvailable: false, isDropping: true, ... } so the app keeps scanning
 * normally instead of blocking every photo because of a missing file.
 */

import * as tf from '@tensorflow/tfjs';
import { preprocess } from './fecalvision';

const GATE_DIR = '/model-gate';
const MODEL_URL = `${GATE_DIR}/model.json`;
const GATE_JSON_URL = `${GATE_DIR}/gate.json`;
const IDB_KEY = 'indexeddb://fecalvision-gate';

let gatePromise = null;
let gateLoaded = false; // true once loadGate() has resolved successfully at least once
let threshold = null;
let lastResult = null; // most recent checkDropping() outcome, for the diagnostics screen

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Loads the gate model once; later calls reuse the same promise. Call this
 * AFTER the disease model has finished loading (see useModel.js): TF.js has
 * one active backend for the whole page, not one per model, so by waiting
 * until after loadModel()'s own backend self-test has run, the gate
 * automatically runs on that same, already-chosen backend without needing a
 * second self-test of its own.
 */
export function loadGate() {
  if (gatePromise) return gatePromise;

  gatePromise = (async () => {
    const gateJson = await fetchJSON(GATE_JSON_URL);
    const t = gateJson?.threshold;
    // Never hardcode this value: if gate.json is missing or its threshold is
    // not a sane probability, the gate cannot be trusted to decide anything,
    // so this fails (caught below, by the caller) rather than guessing 0.5.
    if (!(t > 0 && t < 1)) {
      throw new Error('model-gate/gate.json is missing or has an invalid threshold.');
    }
    threshold = t;

    await tf.ready();
    let model;
    try {
      model = await tf.loadGraphModel(IDB_KEY);
    } catch {
      model = await tf.loadGraphModel(MODEL_URL);
      try {
        await model.save(IDB_KEY);
      } catch {
        // Private browsing or storage pressure: still usable this session.
      }
    }

    // Warm up once so the first real photo is not the slowest one.
    tf.tidy(() => {
      const probe = model.predict(tf.zeros([1, 224, 224, 3]));
      Array.isArray(probe) ? probe.forEach((p) => p.dispose()) : probe.dispose();
    });

    gateLoaded = true;
    return model;
  })();

  // Let a later attempt retry instead of replaying the failure, and let the
  // caller's own catch handle it (checkDropping() fails open; the app's
  // startup sequence in useModel.js just moves on without the gate).
  gatePromise.catch(() => {
    gatePromise = null;
  });

  return gatePromise;
}

/**
 * Is this a chicken dropping? `source` is the same square canvas the disease
 * model analyses (see prepareInput() in analysisInput.js); preprocess() here
 * is the exact function fecalvision.js uses for the disease model, so both
 * models are handed identical pixels.
 *
 * Always resolves, never throws: any failure (the model failed to load, a
 * corrupt file, anything) is caught here and turned into a fail-open result,
 * so one broken file cannot stop the app from scanning.
 *
 * Returns { gateAvailable, isDropping, score, threshold }.
 */
export async function checkDropping(source) {
  try {
    const model = await loadGate();
    const input = preprocess(source);
    const output = model.predict(input);
    const score = (await output.data())[0];
    tf.dispose([input, output]);

    const result = { gateAvailable: true, isDropping: score >= threshold, score, threshold };
    lastResult = { ...result, analysedAnyway: false };
    return result;
  } catch (e) {
    const result = { gateAvailable: false, isDropping: true, score: null, threshold };
    lastResult = { ...result, analysedAnyway: false, error: e.message };
    return result;
  }
}

/** Marks the most recent dropping check as overridden by the user, for the diagnostics screen. */
export function markAnalysedAnyway() {
  if (lastResult) lastResult.analysedAnyway = true;
}

/** True once the gate has loaded successfully at least once this session. */
export function isGateLoaded() {
  return gateLoaded;
}

/** The threshold from gate.json, or null before it has loaded. */
export function getGateThreshold() {
  return threshold;
}

/** The most recent checkDropping() result, or null before any scan. For the diagnostics screen. */
export function getGateInfo() {
  return lastResult ? { ...lastResult } : null;
}

/** Drop the cached weights - useful when a retrained gate ships. */
export async function clearGateCache() {
  gatePromise = null;
  gateLoaded = false;
  try {
    await tf.io.removeModel(IDB_KEY);
  } catch {
    /* nothing cached */
  }
}
