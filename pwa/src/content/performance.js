/**
 * Documented test-set results, used only for honest "how far to trust this"
 * wording in the UI. They come from the held-out test evaluation
 * (1,206 images). UPDATE THIS FILE if the model is retrained.
 *
 * These are facts about the model, not settings: the confidence threshold and
 * temperature are NOT here; they are read from calibration.json at runtime.
 */
export const TEST_RESULTS = {
  images: 1206,
  overallAccuracy: 0.951,
  /** Of the photos the app agreed to answer, the share it got right. */
  answeredAccuracy: 0.986,
  /** Share of photos the app agreed to answer at the fitted threshold. */
  answeredShare: 0.896,
};

/**
 * If the top two classes are closer than this, the result screen points out
 * that two classes competed. This only controls a notice; it never changes
 * what the app reports.
 */
export const CLOSE_MARGIN = 0.15;

/** Size of the model download, for the first-launch message. */
export const MODEL_DOWNLOAD_MB = 4.6;
