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

/**
 * Thrown when a photo file cannot be turned into pixels at all - a decode
 * failure, not a low-quality photo. `code` lets the UI show specific,
 * actionable text instead of one generic sentence.
 */
export class DecodeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DecodeError';
    this.code = code; // 'empty' | 'not-image' | 'heic' | 'undecodable'
  }
}

function decodeErrorFor(blob) {
  const type = (blob.type || '').toLowerCase();
  const name = (blob.name || '').toLowerCase();
  if (type.includes('heic') || type.includes('heif') || /\.(heic|heif)$/.test(name)) {
    return new DecodeError(
      'heic',
      'This photo is saved in HEIC/HEIF format, which this browser cannot open directly. ' +
        'This is common on iPhone photos, and on some Android cameras set to save storage space. ' +
        'Share or save the photo as a JPEG first, or take a new photo with the camera button in this app.',
    );
  }
  if (type && !type.startsWith('image/')) {
    return new DecodeError('not-image', `That file (${type}) is not a photo this app can read. Please choose an image file.`);
  }
  return new DecodeError(
    'undecodable',
    'This browser could not open this photo. It may be damaged, or saved in a format this browser ' +
      'does not support. Try a different photo, or use the camera button in this app.',
  );
}

/**
 * Loads a blob as an <img>. This is a browser image-decoding path separate
 * from createImageBitmap(); a few phones and browsers accept a photo here
 * that createImageBitmap refuses (unusual EXIF/colour-profile data in
 * particular), so it is tried as a fallback before giving up.
 */
function loadAsImageElement(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  return img.decode().then(
    () => img,
    (e) => {
      URL.revokeObjectURL(url);
      throw e;
    },
  );
}

/**
 * Turns a photo file into something drawImage() accepts, trying the fast path
 * first and a fallback path before reporting failure. Returns a uniform
 * { drawable, width, height, close, via } so the rest of this file does not
 * need to know which path succeeded.
 */
async function decodeSource(blob) {
  if (!blob || blob.size === 0) {
    throw new DecodeError('empty', 'That file is empty (0 bytes), so there is nothing to analyse. Try picking the photo again.');
  }

  try {
    // "from-image" applies the photo's rotation tag, so portrait photos are upright.
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return { drawable: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close(), via: 'standard' };
  } catch {
    try {
      const img = await loadAsImageElement(blob);
      return {
        drawable: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(img.src),
        via: 'fallback (createImageBitmap refused this file)',
      };
    } catch {
      throw decodeErrorFor(blob);
    }
  }
}

function newCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/** Draw a region of `drawable` into a WORK_SIZE square, halving big photos step by step. */
function shrinkToWorkSize(drawable, sx, sy, sw, sh) {
  let current = drawable;
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
 * throws DecodeError if the file cannot be turned into pixels at all.
 */
export async function prepareInput(blob, mode) {
  const source = await decodeSource(blob);
  const { width: w, height: h } = source;

  let region;
  if (mode === 'square') {
    const side = Math.min(w, h);
    region = [(w - side) / 2, (h - side) / 2, side, side];
  } else {
    region = [0, 0, w, h];
  }
  const { canvas, ctx, steps } = shrinkToWorkSize(source.drawable, ...region);
  source.close();

  return {
    canvas,
    details: {
      fileBytes: blob.size,
      fileType: blob.type || 'unknown',
      decoded: `${w} x ${h}`,
      decodedVia: source.via,
      halvingSteps: steps,
      ...fingerprint(ctx),
    },
  };
}

/**
 * A small JPEG of the whole photo for History and sharing (about 640px on the
 * long side, tens of kilobytes). Storage on a phone is finite.
 * throws DecodeError if the file cannot be turned into pixels at all.
 */
export async function makeStoredPhoto(blob, maxSide = 640) {
  const source = await decodeSource(blob);
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source.drawable, 0, 0, canvas.width, canvas.height);
  source.close();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}
