/**
 * Builds the picture that is handed to the model.
 *
 * WHY THIS EXISTS
 * TensorFlow.js does not read an <img> element's own pixels: it reads the size
 * the element is DRAWN at on screen and stretches the photo to fit that box.
 * So passing the on-screen <img> to the model meant the model saw a different,
 * distorted picture on every phone and every layout. Here the photo is instead
 * decoded from its file (real pixels, correct rotation) and drawn onto a square
 * canvas of a fixed size, so the model input is the same on every device.
 *
 * The model's own preprocess() in fecalvision.js is untouched: it still
 * centre-crops to a square and resizes to 224x224. Because the canvas built here
 * is already square, that step simply passes it through and resizes.
 *
 * Two ways of choosing what goes on the canvas (the user picks in the menu):
 *   'whole'  - the ENTIRE photo, squeezed into the square (what the earlier
 *              version of the app effectively did; nothing is cut off)
 *   'square' - only the centre square of the photo (the documented pipeline the
 *              accuracy figures were measured with; the edges are cut off)
 *
 * SHRINKING THE SAME WAY ON EVERY DEVICE
 * A phone photo is often 12 megapixels or more; the model wants 224 pixels.
 * Shrinking that in one drawImage() call is left to the browser and graphics
 * chip, and different devices do it differently (some skip pixels, which makes
 * a noisy picture). So the photo is halved repeatedly instead. Halving is an
 * exact 2 x 2 average on every device, so the result is the same everywhere.
 * The final 448px canvas (twice the model size) is then reduced to 224 by the
 * model's own resize.
 */

export const INPUT_MODES = {
  whole: {
    label: 'Whole photo',
    help: 'The model sees everything in your photo, nothing is cut off. Matches the earlier version of the app.',
  },
  square: {
    label: 'Centre square',
    help: 'The model sees only the middle square of your photo, the way its accuracy figures were measured. The edges are ignored.',
  },
};

export const DEFAULT_INPUT_MODE = 'whole';

const WORK_SIZE = 448; // 2 x the model's 224 input

function newCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/** Draw a region of `source` into a WORK_SIZE square, halving big photos step by step. */
function shrinkToWorkSize(source, sx, sy, sw, sh) {
  let current = source;
  let x = sx;
  let y = sy;
  let w = sw;
  let h = sh;
  let steps = 0;
  // Halve each side that is still at least twice the target size.
  while (w >= 2 * WORK_SIZE || h >= 2 * WORK_SIZE) {
    const nw = w >= 2 * WORK_SIZE ? Math.ceil(w / 2) : w;
    const nh = h >= 2 * WORK_SIZE ? Math.ceil(h / 2) : h;
    const step = newCanvas(nw, nh);
    step.ctx.drawImage(current, x, y, w, h, 0, 0, nw, nh);
    current = step.canvas;
    x = 0;
    y = 0;
    w = nw;
    h = nh;
    steps++;
  }
  const final = newCanvas(WORK_SIZE, WORK_SIZE);
  final.ctx.drawImage(current, x, y, w, h, 0, 0, WORK_SIZE, WORK_SIZE);
  return { canvas: final.canvas, ctx: final.ctx, steps };
}

/** A short fingerprint of the pixels (FNV-1a hash + average colour). */
function fingerprint(ctx) {
  const data = ctx.getImageData(0, 0, WORK_SIZE, WORK_SIZE).data;
  let hash = 0x811c9dc5;
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    for (let k = 0; k < 3; k++) {
      hash ^= data[i + k];
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return {
    hash: (hash >>> 0).toString(16).padStart(8, '0'),
    mean: [r, g, b].map((v) => (v / pixels).toFixed(1)).join(' '),
  };
}

/**
 * blob : the photo (a JPEG from the camera, or the file the user picked)
 * mode : 'whole' | 'square'
 * returns { canvas, details }: a square canvas for classify(), and facts about
 * how the photo was decoded (for the technical details panel)
 */
export async function prepareInput(blob, mode) {
  // "from-image" applies the photo's rotation tag, so portrait photos are upright.
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const { width: w, height: h } = bitmap;

  let region;
  if (mode === 'square') {
    const side = Math.min(w, h);
    region = [(w - side) / 2, (h - side) / 2, side, side];
  } else {
    region = [0, 0, w, h];
  }
  const { canvas, ctx, steps } = shrinkToWorkSize(bitmap, ...region);
  bitmap.close();

  return {
    canvas,
    details: {
      fileBytes: blob.size,
      fileType: blob.type || 'unknown',
      decoded: `${w} x ${h}`,
      halvingSteps: steps,
      ...fingerprint(ctx),
    },
  };
}

/**
 * A small JPEG of the whole photo for History and sharing (about 640px on the
 * long side, tens of kilobytes). Storage on a phone is finite.
 */
export async function makeStoredPhoto(blob, maxSide = 640) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}
