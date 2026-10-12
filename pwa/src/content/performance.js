import { ACTIVE_MODEL } from './models';

/**
 * Documented test-set results of the model in use, for honest "how far to trust
 * this" wording. Comes from models.js, so the numbers always belong to the
 * model actually loaded.
 */
export const TEST_RESULTS = ACTIVE_MODEL.tests;

/**
 * If the top two classes are closer than this, the result screen points out
 * that two classes competed. This only controls a notice; it never changes
 * what the app reports.
 */
export const CLOSE_MARGIN = 0.15;

/** Size of the model download, for the first-launch message. */
export const MODEL_DOWNLOAD_MB = 4.6;
