/**
 * Scan history, stored ONLY on this device in IndexedDB (the browser's built-in
 * local database). Nothing here touches the network.
 *
 * One record per scan:
 *   id, timestamp, thumb (a small JPEG of the whole photo),
 *   inputMode (which part of the photo the model used),
 *   label, confidence, reported (did it pass the threshold?),
 *   ranked (all four probabilities), threshold, temperature, margin,
 *   latencyMs, problems (quality issues noticed on the photo)
 *
 * Storing the threshold and temperature used means a record still makes sense
 * after the model is retrained and calibration.json changes.
 */
import { belowThreshold, getCalibration } from './fecalvision';

const DB_NAME = 'fecalvision-history';
const STORE = 'scans';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('timestamp', 'timestamp');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Run one transaction. `work(store)` may return an IDBRequest whose result is
 * handed back once the transaction has fully committed.
 */
async function run(mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request?.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Ask the browser not to evict farm records when storage runs low. */
export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not supported: records are still saved, just not protected */
  }
}

/** Build the stored record from a finished scan (see ScanScreen). */
export function buildRecord(scan) {
  const { result, photoBlob, timestamp, quality, inputMode } = scan;
  const calibration = getCalibration();
  return {
    id: crypto.randomUUID?.() ?? `${timestamp}-${Math.random().toString(16).slice(2)}`,
    timestamp,
    thumb: photoBlob,
    inputMode,
    label: result.label,
    confidence: result.confidence,
    reported: !belowThreshold(result),
    ranked: result.ranked,
    threshold: result.threshold,
    temperature: calibration?.temperature ?? null,
    margin: result.margin,
    latencyMs: result.latencyMs,
    problems: (quality?.problems ?? []).map((p) => p.message),
  };
}

export const saveScan = (record) => run('readwrite', (s) => s.put(record)).then(() => record);
export const restoreScan = saveScan; // "undo delete" is simply saving it again
export const deleteScan = (id) => run('readwrite', (s) => s.delete(id));
export const clearScans = () => run('readwrite', (s) => s.clear());
export const getScan = (id) => run('readonly', (s) => s.get(id));

/** All scans, newest first. Plenty fast for the few hundred a farm would keep. */
export async function listScans() {
  const all = await run('readonly', (s) => s.getAll());
  return (all ?? []).sort((a, b) => b.timestamp - a.timestamp);
}

/** What a saved record needs to look like for the shared ResultPanel. */
export function recordToResult(record) {
  return {
    label: record.label,
    index: record.ranked[0]?.index,
    confidence: record.confidence,
    margin: record.margin,
    threshold: record.threshold,
    ranked: record.ranked,
    latencyMs: record.latencyMs,
  };
}
