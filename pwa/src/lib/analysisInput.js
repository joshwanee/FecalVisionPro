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
 * Drawing to a 448px canvas first (twice the model size) lets the browser
 * shrink big camera photos with proper smoothing. Feeding a 12-megapixel photo
 * straight into a 224px bilinear resize would sample too sparsely and give a
 * noisy, aliased picture.
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
 * blob : the photo (a JPEG from the camera, or the file the user picked)
 * mode : 'whole' | 'square'
 * returns a square canvas for classify()
 */
export async function prepareInput(blob, mode) {
  // "from-image" applies the photo's rotation tag, so portrait photos are upright.
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const { width: w, height: h } = bitmap;

  const canvas = document.createElement('canvas');
  canvas.width = WORK_SIZE;
  canvas.height = WORK_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (mode === 'square') {
    const side = Math.min(w, h);
    ctx.drawImage(bitmap, (w - side) / 2, (h - side) / 2, side, side, 0, 0, WORK_SIZE, WORK_SIZE);
  } else {
    ctx.drawImage(bitmap, 0, 0, w, h, 0, 0, WORK_SIZE, WORK_SIZE);
  }
  bitmap.close();
  return canvas;
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
