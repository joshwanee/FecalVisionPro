/**
 * FecalVision - photo quality checks.
 *
 * The model was trained on close-up, well-lit photos of a single dropping, so
 * a photo that is dark, blurry or too far away will give a poor result.
 * These checks run on every camera frame, so they are kept deliberately cheap:
 *   1. copy ONLY the centre-square region (the part the model sees) ...
 *   2. ... into a tiny 64x64 canvas (4,096 pixels instead of ~1 million)
 *   3. do a few simple sums over those pixels.
 * Nothing here touches the classification path; it only advises the user.
 *
 * All the numbers that decide "good" or "poor" are in LIMITS below. They are a
 * sensible starting point and are meant to be tuned on real photos: open the
 * app with ?debug in the address bar to see the raw measurements live.
 */

export const LIMITS = {
  /** Side length (px) of the tiny canvas the frame is shrunk to. */
  SAMPLE_SIZE: 64,
  /** How often the live preview is analysed (ms). About 4 times a second. */
  CHECK_INTERVAL_MS: 250,

  /** Average brightness (0-255) below this is "too dark". */
  MIN_BRIGHTNESS: 70,
  /** Average brightness above this is "too bright". */
  MAX_BRIGHTNESS: 190,
  /** Pixels brighter than this count as blown-out white (glare). */
  BLOWN_OUT_LEVEL: 250,
  /** If more than this fraction of pixels are blown out, report glare. */
  MAX_BLOWN_OUT_FRACTION: 0.2,

  /**
   * Laplacian variance below this is "blurry". The value depends on the
   * 64x64 sample size; a sharp, textured close-up scores far higher than a
   * soft one. Tune with ?debug.
   */
  MIN_SHARPNESS: 35,

  /** A pixel is "subject" if its colour is this far from the border colour. */
  SUBJECT_COLOUR_DISTANCE: 40,
  /** Width (px, on the 64x64 sample) of the border ring used as background. */
  BORDER_WIDTH: 4,
  /** The subject must cover at least this fraction of the square. */
  MIN_FILL: 0.25,
};

/** One reusable tiny canvas, created the first time it is needed. */
let sampler = null;
function getSampler() {
  if (!sampler) {
    const canvas = document.createElement('canvas');
    canvas.width = LIMITS.SAMPLE_SIZE;
    canvas.height = LIMITS.SAMPLE_SIZE;
    // willReadFrequently keeps the pixels in memory we can read cheaply.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    sampler = { canvas, ctx };
  }
  return sampler;
}

/** Width and height of a <video>, <img> or <canvas>, in source pixels. */
export function sourceSize(el) {
  return {
    w: el.videoWidth || el.naturalWidth || el.width,
    h: el.videoHeight || el.naturalHeight || el.height,
  };
}

/**
 * Measure a video frame or image. Returns raw numbers only; evaluate() turns
 * them into advice.
 */
export function measureFrame(source) {
  const N = LIMITS.SAMPLE_SIZE;
  const { ctx } = getSampler();
  const { w, h } = sourceSize(source);

  // The centre square: the same region preprocess() in fecalvision.js keeps.
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  ctx.drawImage(source, sx, sy, side, side, 0, 0, N, N);
  const px = ctx.getImageData(0, 0, N, N).data; // RGBA, 4 bytes per pixel

  // --- brightness -------------------------------------------------------
  // Convert each pixel to grey ("luma") using the standard weights, since
  // the eye is most sensitive to green.
  const grey = new Float32Array(N * N);
  let sum = 0;
  let blownOut = 0;
  for (let i = 0; i < N * N; i++) {
    const g = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    grey[i] = g;
    sum += g;
    if (g > LIMITS.BLOWN_OUT_LEVEL) blownOut++;
  }
  const brightness = sum / (N * N);
  const blownOutFraction = blownOut / (N * N);

  // --- sharpness: variance of the Laplacian ------------------------------
  // The Laplacian is "this pixel minus the average of its four neighbours".
  // On a sharp image edges make it swing a lot; on a blurry one it stays near
  // zero. The variance (spread) of those values is therefore a blur score.
  let lapSum = 0;
  let lapSumSq = 0;
  let count = 0;
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      const lap = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - N] - grey[i + N];
      lapSum += lap;
      lapSumSq += lap * lap;
      count++;
    }
  }
  const lapMean = lapSum / count;
  const sharpness = lapSumSq / count - lapMean * lapMean;

  // --- how much of the square the subject fills --------------------------
  // Assume the outer ring of the square is background (litter). Anything whose
  // colour is clearly different from that background counts as the subject.
  const B = LIMITS.BORDER_WIDTH;
  const ring = { r: [], g: [], b: [] };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (x < B || x >= N - B || y < B || y >= N - B) {
        const i = (y * N + x) * 4;
        ring.r.push(px[i]);
        ring.g.push(px[i + 1]);
        ring.b.push(px[i + 2]);
      }
    }
  }
  const bg = [median(ring.r), median(ring.g), median(ring.b)];
  const maxDistSq = LIMITS.SUBJECT_COLOUR_DISTANCE ** 2;
  let subject = 0;
  let inner = 0;
  for (let y = B; y < N - B; y++) {
    for (let x = B; x < N - B; x++) {
      const i = (y * N + x) * 4;
      const dr = px[i] - bg[0];
      const dg = px[i + 1] - bg[1];
      const db = px[i + 2] - bg[2];
      if (dr * dr + dg * dg + db * db > maxDistSq) subject++;
      inner++;
    }
  }
  const fill = subject / inner;

  return { brightness, blownOutFraction, sharpness, fill };
}

function median(values) {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Blend the newest measurement with the previous smoothed one so the on-screen
 * advice does not flicker from frame to frame ("exponential moving average").
 */
export function smoothMetrics(previous, latest, alpha = 0.5) {
  if (!previous) return latest;
  const out = {};
  for (const key of Object.keys(latest)) {
    out[key] = alpha * latest[key] + (1 - alpha) * previous[key];
  }
  return out;
}

/**
 * Turn raw measurements into three checks, each with plain, actionable text.
 * `ok` is true (passed), false (a problem) or null (cannot judge yet).
 */
export function evaluate(m) {
  // Light
  let light;
  if (m.brightness < LIMITS.MIN_BRIGHTNESS) {
    light = { ok: false, message: 'Too dark, move into daylight' };
  } else if (
    m.brightness > LIMITS.MAX_BRIGHTNESS ||
    m.blownOutFraction > LIMITS.MAX_BLOWN_OUT_FRACTION
  ) {
    light = { ok: false, message: 'Too bright or glare, shade the dropping or tilt the phone' };
  } else {
    light = { ok: true, message: 'Light is good' };
  }

  // Sharpness and framing are meaningless in bad light (a dark frame always
  // looks "blurry"), so wait until the light is fixed before judging them.
  const lightOk = light.ok === true;

  let sharpness;
  if (!lightOk) {
    sharpness = { ok: null, message: 'Sharpness: fix the light first' };
  } else if (m.sharpness < LIMITS.MIN_SHARPNESS) {
    sharpness = { ok: false, message: 'Blurry, hold steady and let the camera focus' };
  } else {
    sharpness = { ok: true, message: 'Sharp' };
  }

  let framing;
  if (!lightOk) {
    framing = { ok: null, message: 'Distance: fix the light first' };
  } else if (m.fill < LIMITS.MIN_FILL) {
    framing = { ok: false, message: 'Too far, move closer so one dropping fills the square' };
  } else {
    framing = { ok: true, message: 'Dropping fills the square' };
  }

  const checks = [
    { id: 'light', label: 'Light', ...light },
    { id: 'sharpness', label: 'Focus', ...sharpness },
    { id: 'framing', label: 'Distance', ...framing },
  ];
  const problems = checks.filter((c) => c.ok === false);
  return { checks, problems, ok: problems.length === 0, metrics: m };
}
