/**
 * What is known about the trained model in public/model-cap2000_over/ (the
 * only model this app uses - see MODEL_DIR in src/lib/fecalvision.js).
 *
 * The temperature and confidence threshold are NOT here: the model's folder
 * has its own calibration.json and the app reads it at runtime. This file
 * holds only facts that come from how the model was trained and tested.
 *
 *   trainedOn    what kind of photo the model learned from
 *   defaultInput which part of the photo it should be shown (see analysisInput.js):
 *                  'whole'  - a model trained on whole photographs
 *                  'square' - a model trained on tight crops of the dropping,
 *                             which expects the dropping to fill the frame
 *   tests        held-out test-set results. UPDATE THIS FILE if the model is
 *                retrained.
 */
export const ACTIVE_MODEL = {
  name: 'System B',
  trainedOn: 'close-up crops of the dropping',
  defaultInput: 'square',
  tests: {
    overallAccuracy: 0.95,
    macroF1: 0.9436,
    answeredAccuracy: 0.994,
  },
};
