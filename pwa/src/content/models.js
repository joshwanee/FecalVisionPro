import { MODEL_DIR } from '../lib/fecalvision';

/**
 * What is known about each trained model in public/. The app loads ONE of
 * them, chosen by MODEL_DIR at the top of src/lib/fecalvision.js.
 *
 * The temperature and confidence threshold are NOT here: each folder has its
 * own calibration.json and the app reads it at runtime. This file holds only
 * facts that come from how the model was trained and tested.
 *
 *   trainedOn    what kind of photo the model learned from
 *   defaultInput which part of the photo it should be shown (see analysisInput.js):
 *                  'whole'  - a model trained on whole photographs
 *                  'square' - a model trained on tight crops of the dropping,
 *                             which expects the dropping to fill the frame
 *   tests        held-out test-set results, or null when the model was never
 *                evaluated on the test set (then NO numbers are shown for it).
 *                UPDATE THIS FILE if a model is retrained.
 */
export const MODELS = {
  // System A: the first model. Trained on whole photographs, weighted loss.
  '/model': {
    name: 'System A',
    trainedOn: 'whole photographs',
    defaultInput: 'whole',
    tests: {
      images: 1206,
      overallAccuracy: 0.951,
      macroF1: 0.9317,
      // Of the photos the app agreed to answer, the share it got right.
      answeredAccuracy: 0.986,
      // Share of photos the app agreed to answer at its threshold.
      answeredShare: 0.896,
    },
  },

  // System B, oversampled: the primary model. Trained on crops of the dropping
  // (bounding box plus 20% padding), each class capped at 2,000 images, the rare
  // class (Newcastle Disease) repeated twice.
  '/model-cap2000_over': {
    name: 'System B',
    trainedOn: 'close-up crops of the dropping',
    defaultInput: 'square',
    tests: {
      overallAccuracy: 0.95,
      macroF1: 0.9436,
      answeredAccuracy: 0.994,
    },
  },

  // System B, weighted loss: comparison only. Lost to the oversampled model on
  // validation and was never evaluated on the test set, so no numbers exist.
  '/model-cap2000_weighted': {
    name: 'System B (weighted, comparison only)',
    trainedOn: 'close-up crops of the dropping',
    defaultInput: 'square',
    tests: null,
  },
};

const UNKNOWN = { name: MODEL_DIR, trainedOn: 'unknown', defaultInput: 'square', tests: null };

/** The model this build of the app is using. */
export const ACTIVE_MODEL = MODELS[MODEL_DIR] ?? UNKNOWN;
