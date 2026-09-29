/**
 * Dropping check ("gatekeeper") - runs BEFORE the disease model.
 *
 * The disease model can only answer one of its four classes, so a photo of a
 * face or a cup would still get a diagnosis. This small, separate model
 * (trained in Teachable Machine) answers only "is this a chicken dropping?".
 * If it says no, the disease model is not run.
 *
 * Files in public/gate/, exported from
 * https://teachablemachine.withgoogle.com/models/_y2DQFtZA/ (re-download all
 * three after retraining there):
 *   model.json, model.weights.bin : a Keras layers model (MobileNet base)
 *   metadata.json                 : { labels: ['Non-Fecal', 'Fecal'], imageSize: 224 }
 *
 * Its input differs from the disease model's. Photos are prepared exactly as
 * the @teachablemachine/image library does it (cropTo + capture): centre-crop
 * and resize by drawing onto a 224x224 canvas, then scale pixels to [-1, 1]
 * with x / 127 - 1. Resizing another way (e.g. tf.image.resizeBilinear) gives
 * noticeably different scores, so keep these steps in step with that library.
 */

import * as tf from '@tensorflow/tfjs';

const GATE_DIR = '/gate';
const DROPPING_LABEL = 'Fecal';

/**
 * A photo passes when the model gives "Fecal" at least this probability.
 * 0.5 is simply the model's own decision (the more likely of the two labels).
 * Raise it to reject more non-droppings at the cost of rejecting some real
 * droppings; choose the value on a test set the model has never seen.
 */
export const GATE_THRESHOLD = 0.5;

let gatePromise = null;

/** Load the model once; later calls reuse it. Precached, so it works offline. */
export function loadGate() {
  if (gatePromise) return gatePromise;

  gatePromise = (async () => {
    const res = await fetch(`${GATE_DIR}/metadata.json`);
    const meta = res.ok ? await res.json().catch(() => null) : null;
    const labels = meta?.labels;
    if (!Array.isArray(labels) || !labels.includes(DROPPING_LABEL)) {
      throw new Error(`gate/metadata.json is missing or has no "${DROPPING_LABEL}" label.`);
    }
    const size = meta.imageSize ?? 224;

    await tf.ready();
    const model = await tf.loadLayersModel(`${GATE_DIR}/model.json`);
    tf.tidy(() => model.predict(tf.zeros([1, size, size, 3]))); // warm up
    return { model, labels, size };
  })();

  // Let a later attempt retry instead of replaying the failure.
  gatePromise.catch(() => {
    gatePromise = null;
  });
  return gatePromise;
}

/** Teachable Machine's cropTo: scale the short side to `size`, centre, crop. */
function cropTo(source, size) {
  const scale = size / Math.min(source.width, source.height);
  const w = Math.ceil(source.width * scale);
  const h = Math.ceil(source.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas
    .getContext('2d')
    .drawImage(source, -Math.trunc((w - size) / 2), -Math.trunc((h - size) / 2), w, h);
  return canvas;
}

/**
 * Is this a chicken dropping? `source` is the same square canvas the disease
 * model analyses, so both models look at exactly the same pixels.
 *
 * Returns { isDropping, probability (of "Fecal"), threshold, latencyMs }.
 */
export async function checkDropping(source) {
  const { model, labels, size } = await loadGate();
  const started = performance.now();

  const output = tf.tidy(() => {
    const input = tf.browser.fromPixels(cropTo(source, size)).toFloat().div(127).sub(1).expandDims(0);
    return model.predict(input);
  });
  const probs = Array.from(await output.data());
  output.dispose();

  const probability = probs[labels.indexOf(DROPPING_LABEL)];
  return {
    isDropping: probability >= GATE_THRESHOLD,
    probability,
    threshold: GATE_THRESHOLD,
    latencyMs: Math.round(performance.now() - started),
  };
}
