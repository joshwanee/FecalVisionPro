/**
 * Picks which TensorFlow.js backend actually runs the model, by MEASURING each
 * device rather than guessing from a capability flag.
 *
 * WHY THIS EXISTS
 * TensorFlow.js normally runs on WebGL, which uses the phone's GPU and is
 * fast. Many mobile GPUs cannot compute in full 32-bit precision, though, and
 * silently round to 16-bit instead. Across the ~150 layers of this model,
 * those small rounding errors can add up enough to flip a borderline
 * prediction - the same photo can come out as a different class on a phone
 * than on a laptop, purely from arithmetic rounding, not from anything wrong
 * with the model or the photo.
 *
 * The WASM (WebAssembly) backend always computes in full 32-bit precision, on
 * the CPU, so it is used here as a trusted reference. On each device, this
 * module runs the SAME three deterministic inputs on both backends and
 * measures how far WebGL drifts from that reference. Only if the drift is
 * small enough is WebGL trusted; otherwise the device falls back to WASM.
 *
 * The test runs once per model per device (the folder name is part of the
 * cache key, so switching models retests) and is deliberately synthetic: it
 * measures the device's general numerical behaviour, not any one photo.
 */
import * as tf from '@tensorflow/tfjs';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';

// Serve the .wasm binaries from this app's own origin (see scripts/copy-wasm.mjs).
// Without this, the library defaults to loading them from a CDN, which would
// both fail offline and send a request this app must never make.
setWasmPaths('/wasm/');

// Tested and confirmed: the threaded WASM build (the one this library picks
// automatically once cross-origin isolation is on - see vite.config.js and
// vercel.json) has a bug in the version this app uses. Its worker start-up
// code throws "ReferenceError: e is not defined" inside its own generated
// code, repeatedly, and never resolves OR rejects - it hangs forever rather
// than failing cleanly. The single-threaded SIMD build is unaffected, still
// fast, and always numerically correct, so threading is turned off here.
// SIMD itself is untouched: WASM_HAS_SIMD_SUPPORT is a separate flag and is
// still auto-detected normally. If a future upgrade of
// @tensorflow/tfjs-backend-wasm fixes this, this line can simply be deleted.
tf.env().set('WASM_HAS_MULTITHREAD_SUPPORT', false);

const INPUT_SIZE = 224;
// A backend that is truly broken (not just slow) can hang instead of
// rejecting - exactly what the threaded-WASM bug above does. Without this,
// that would freeze model loading forever instead of falling back. 8 seconds
// is generous for three tiny synthetic inputs, even on a slow phone.
const TEST_TIMEOUT_MS = 8000;
// If WebGL's output for the same input differs from the WASM (full-precision)
// reference by more than this, at any of the 4 class probabilities, WebGL is
// not trusted on this device and WASM is used instead.
const MAX_ALLOWED_DIFF = 0.01;

/**
 * One deterministic, photo-shaped input, built from plain arithmetic (not a
 * random-number generator, whose exact output is not guaranteed to be
 * identical across devices or TF.js versions). `seed` only changes which of
 * three different patterns is produced; the same seed always gives the exact
 * same numbers, on every device.
 */
function syntheticInputData(seed) {
  const data = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
  let i = 0;
  for (let y = 0; y < INPUT_SIZE; y++) {
    for (let x = 0; x < INPUT_SIZE; x++) {
      for (let c = 0; c < 3; c++) {
        // A smooth wave, different per seed and per colour channel. The result
        // is always in 0-255, matching what a real preprocessed photo looks
        // like to the model (see the input contract at the top of fecalvision.js).
        const wave = Math.sin((x * (seed + 1) + y * (seed + 2) + c * 37) / 19);
        data[i++] = 127.5 + 127.5 * wave;
      }
    }
  }
  return data;
}

const SYNTHETIC_INPUTS = [syntheticInputData(0), syntheticInputData(1), syntheticInputData(2)];

/**
 * Runs the model on `backendName` for every synthetic input and returns each
 * result as a plain array of 4 numbers. Every tensor created is disposed:
 * tf.tidy() only keeps whatever a callback RETURNS as a Tensor, so returning
 * plain numbers (read out with dataSync, since tidy's callback must be
 * synchronous) lets it dispose the input and output tensors automatically.
 */
async function predictOnBackend(model, backendName, inputs) {
  await tf.setBackend(backendName);
  await tf.ready();
  return inputs.map((data) =>
    tf.tidy(() => {
      const input = tf.tensor4d(data, [1, INPUT_SIZE, INPUT_SIZE, 3], 'float32');
      return Array.from(model.predict(input).dataSync());
    }),
  );
}

/** Races a promise against a timeout, so a backend that hangs instead of
 * cleanly failing (see the WASM_HAS_MULTITHREAD_SUPPORT comment above) cannot
 * freeze the app forever. This does not stop whatever is still running in the
 * background; it only stops waiting for it. */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/** The largest difference between two same-shaped sets of prediction results. */
function maxAbsDiff(a, b) {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i].length; j++) {
      max = Math.max(max, Math.abs(a[i][j] - b[i][j]));
    }
  }
  return max;
}

const cacheKey = (modelDir) => `fecalvision-backend:${modelDir}`;

function readCache(modelDir) {
  try {
    const raw = localStorage.getItem(cacheKey(modelDir));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // private browsing or storage disabled: the test just runs again
  }
}

function writeCache(modelDir, result) {
  try {
    localStorage.setItem(cacheKey(modelDir), JSON.stringify(result));
  } catch {
    /* not remembered; harmless, the test simply reruns next launch */
  }
}

/**
 * Plain-language explanation of a backend name, for the UI. Kept in one place
 * so the Scan screen, a result, and the diagnostics screen all say the same
 * thing about the same backend.
 */
export function describeBackend(name) {
  switch (name) {
    case 'webgl':
      return { label: 'GPU (WebGL)', detail: 'Tested on this device and found to match full precision closely enough to trust. Fastest option.' };
    case 'wasm':
      return { label: 'CPU, full precision (WASM)', detail: 'Used because this device’s GPU either is not close enough to full precision to trust, or is unavailable. Slower than the GPU, but always correct.' };
    case 'cpu':
      return { label: 'CPU, basic fallback', detail: 'The safest, slowest option. Used because neither the GPU nor the WebAssembly path would run on this device.' };
    default:
      return { label: name ?? 'unknown', detail: '' };
  }
}

/** Used by the diagnostics screen's "test again" button. */
export function clearBackendCache(modelDir) {
  try {
    localStorage.removeItem(cacheKey(modelDir));
  } catch {
    /* nothing to clear */
  }
}

/**
 * Chooses a backend for `model`, actually switches TF.js to it (later calls to
 * model.predict() will use it), and returns what it found:
 *   { backend, maxDiff, webglAvailable, fromCache }
 * maxDiff is null when WebGL was never compared (unavailable, or WASM itself
 * failed and CPU was used unconditionally as the last resort).
 */
export async function selectBackend(model, modelDir) {
  const cached = readCache(modelDir);
  if (cached) {
    await tf.setBackend(cached.backend);
    await tf.ready();
    return { ...cached, fromCache: true };
  }

  // WASM is the trusted, full-precision reference. Try it first: if it will
  // not even run on this device, there is nothing to compare WebGL against,
  // so fall back to CPU (TF.js's plain JS backend - always available, and
  // also always full precision, just slower than either WASM or WebGL).
  let wasmOutputs;
  try {
    wasmOutputs = await withTimeout(predictOnBackend(model, 'wasm', SYNTHETIC_INPUTS), TEST_TIMEOUT_MS, 'WASM self-test');
  } catch {
    await tf.setBackend('cpu');
    await tf.ready();
    const result = { backend: 'cpu', maxDiff: null, webglAvailable: false, fromCache: false };
    writeCache(modelDir, result);
    return result;
  }

  let webglAvailable = true;
  let maxDiff = null;
  try {
    const webglOutputs = await withTimeout(predictOnBackend(model, 'webgl', SYNTHETIC_INPUTS), TEST_TIMEOUT_MS, 'WebGL self-test');
    maxDiff = maxAbsDiff(wasmOutputs, webglOutputs);
  } catch {
    webglAvailable = false; // no WebGL on this device/browser
  }

  const backend = webglAvailable && maxDiff <= MAX_ALLOWED_DIFF ? 'webgl' : 'wasm';
  await tf.setBackend(backend); // whichever was tested last, end on the winner
  await tf.ready();

  const result = { backend, maxDiff, webglAvailable, fromCache: false };
  writeCache(modelDir, result);
  return result;
}
