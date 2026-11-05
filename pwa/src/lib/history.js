/**
 * Scan history is stored locally first in IndexedDB, then synced to Supabase
 * when this device is online and has an authenticated Supabase session.
 *
 * One record per scan:
 *   id, timestamp, thumb (a small JPEG of the whole photo),
 *   inputMode (which part of the photo the model used),
 *   backend (which TF.js backend computed it - see src/lib/backend.js),
 *   analysedAnyway (the dropping check said no, but the user chose to see a
 *   result anyway - never set by the normal, passed-the-check path),
 *   label, confidence, reported (did it pass the threshold?),
 *   ranked (all four probabilities), threshold, temperature, margin,
 *   latencyMs, problems (quality issues noticed on the photo)
 *
 * Storing the threshold and temperature used means a record still makes sense
 * after the model is retrained and calibration.json changes.
 */
import { belowThreshold, getCalibration } from './fecalvision';
import { supabase } from './supabase';

const DB_NAME = 'fecalvision-history';
const STORE = 'scans';
const DELETIONS = 'pending-deletions';
const MIGRATIONS = 'guest-migrations';
const BUCKET = 'scan-images';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains(DELETIONS)) {
        db.createObjectStore(DELETIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(MIGRATIONS)) {
        db.createObjectStore(MIGRATIONS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Run one transaction. `work(store)` may return an IDBRequest whose result is
 * handed back once the transaction has fully committed.
 */
async function runStores(mode, storeNames, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
    let request;
    try {
      request = work(stores);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
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

async function run(mode, work, storeName = STORE) {
  return runStores(mode, [storeName], (stores) => work(stores[storeName]));
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
  const { result, photoBlob, timestamp, quality, inputMode, backend, analysedAnyway } = scan;
  const calibration = getCalibration();
  return {
    id: crypto.randomUUID?.() ?? `${timestamp}-${Math.random().toString(16).slice(2)}`,
    timestamp,
    thumb: photoBlob,
    inputMode,
    // Which TF.js backend computed this scan (see src/lib/backend.js). Kept per
    // scan, not just for the current session, so an old result's Technical
    // Details still say what actually computed it.
    backend: backend ?? null,
    // True only when the dropping check said no and the user chose "analyse
    // anyway" - see ScanScreen.jsx. Drives the warning flag in the History list.
    analysedAnyway: analysedAnyway ?? false,
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

function notifyLocalChange() {
  window.dispatchEvent(new Event('fecalvision:history-local-changed'));
}

export async function saveScan(record) {
  let cloudUserId = record.cloudUserId ?? null;
  if (supabase && !cloudUserId) {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn('Could not resolve scan owner before saving locally:', error);
    cloudUserId = data?.session?.user?.id ?? null;
  }
  const storedRecord = { ...record, cloudUserId, syncStatus: 'pending' };
  await runStores('readwrite', [STORE, DELETIONS], (stores) => {
    stores[STORE].put(storedRecord);
    return stores[DELETIONS].delete(record.id);
  });
  notifyLocalChange();
  return record;
}

export const restoreScan = saveScan;

export async function deleteScan(id) {
  const record = await getScan(id);
  if (record) {
    await runStores('readwrite', [STORE, DELETIONS], (stores) => {
      stores[DELETIONS].put({ id, userId: record.cloudUserId ?? null });
      return stores[STORE].delete(id);
    });
    notifyLocalChange();
  }
}

export async function clearScans(userId) {
  const records = await listScans(userId);
  await runStores('readwrite', [STORE, DELETIONS], (stores) => {
    for (const record of records) {
      stores[DELETIONS].put({ id: record.id, userId: record.cloudUserId ?? null });
      stores[STORE].delete(record.id);
    }
  });
  notifyLocalChange();
}

export const getScan = (id) => run('readonly', (s) => s.get(id));

/** All scans, newest first. Plenty fast for the few hundred a farm would keep. */
export async function listScans(userId) {
  const all = await run('readonly', (s) => s.getAll());
  return (all ?? [])
    .filter((record) => userId === undefined || !record.cloudUserId || record.cloudUserId === userId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function copyGuestHistoryToAccount(guestUserId, currentUserId) {
  const records = (await listScans()).filter((record) => record.cloudUserId === guestUserId);
  const completed = new Set(
    (await run('readonly', (store) => store.getAll(), MIGRATIONS)).map((migration) => migration.id),
  );
  const pending = records.filter((record) => !completed.has(`${guestUserId}:${record.id}`));

  await runStores('readwrite', [STORE, MIGRATIONS], (stores) => {
    for (const record of pending) {
      const newId = crypto.randomUUID();
      stores[STORE].put({
        ...record,
        id: newId,
        cloudUserId: currentUserId,
        syncStatus: 'pending',
      });
      stores[MIGRATIONS].put({
        id: `${guestUserId}:${record.id}`,
        newId,
        guestUserId,
        currentUserId,
      });
    }
  });
  notifyLocalChange();
}

export async function reassignGuestHistory(previousUserId, currentUserId) {
  const records = (await listScans()).filter((record) => record.cloudUserId === previousUserId);
  const deletions = (await run('readonly', (store) => store.getAll(), DELETIONS))
    .filter((deletion) => deletion.userId === previousUserId);

  await runStores('readwrite', [STORE, DELETIONS], (stores) => {
    for (const record of records) {
      stores[STORE].put({
        ...record,
        cloudUserId: currentUserId,
        syncStatus: 'pending',
      });
    }
    for (const deletion of deletions) {
      stores[DELETIONS].delete(deletion.id);
    }
  });
  notifyLocalChange();
}

function isScanOwnerConflict(error) {
  const message = error?.message ?? '';
  return error?.code === '42501' &&
    /row-level security policy.*USING expression/i.test(message) &&
    /scan_history/i.test(message);
}

async function replaceMigratedScanId(record, newId) {
  const migrations = (await run('readonly', (store) => store.getAll(), MIGRATIONS))
    .filter((migration) => migration.newId === record.id);
  const replacement = { ...record, id: newId, imagePath: null, syncStatus: 'pending' };

  await runStores('readwrite', [STORE, MIGRATIONS], (stores) => {
    stores[STORE].put(replacement);
    stores[STORE].delete(record.id);
    for (const migration of migrations) {
      stores[MIGRATIONS].put({ ...migration, newId });
    }
  });
  return replacement;
}

function isStorageObjectNotFound(error) {
  return error?.status === 404 ||
    error?.statusCode === '404' ||
    error?.error === 'not_found' ||
    /object not found/i.test(error?.message ?? '');
}

async function listStorageObjectNames(userId) {
  const names = new Set();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(userId, { limit: pageSize, offset });
    if (error) {
      if (isStorageObjectNotFound(error)) return names;
      throw error;
    }

    for (const item of data ?? []) names.add(item.name);
    if (!data || data.length < pageSize) return names;
    offset += pageSize;
  }
}

/**
 * Push local changes and cache this account's cloud scans for offline viewing.
 * Each cloud operation is scoped to the current Supabase Auth user.
 */
export async function syncScans(userId) {
  if (!supabase || !navigator.onLine) return;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user || user.id !== userId) return;

  const deletions = await run('readonly', (s) => s.getAll(), DELETIONS);
  for (const deletion of deletions ?? []) {
    if (deletion.userId && deletion.userId !== userId) continue;

    const { data: row, error: lookupError } = await supabase
      .from('scan_history')
      .select('image_path')
      .eq('id', deletion.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const { data: deletedRows, error: deleteError } = await supabase
      .from('scan_history')
      .delete()
      .eq('id', deletion.id)
      .eq('user_id', userId)
      .select('id');
    if (deleteError) throw deleteError;
    if (row && !deletedRows?.length) {
      throw new Error('Supabase did not delete the scan row. Check the scan_history DELETE policy.');
    }

    if (row?.image_path) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([row.image_path]);
      if (storageError) throw storageError;
    }
    await run('readwrite', (s) => s.delete(deletion.id), DELETIONS);
  }

  const localRecords = await listScans();
  for (const record of localRecords) {
    if (record.syncStatus === 'synced' ||
        (record.cloudUserId && record.cloudUserId !== userId)) continue;

    let uploadRecord = record;
    let imagePath = `${userId}/${uploadRecord.id}.jpg`;
    const uploadImage = async (path) => {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, uploadRecord.thumb, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
    };
    const writeScanRow = async (path) => supabase.from('scan_history').upsert({
      id: uploadRecord.id,
      user_id: userId,
      prediction: uploadRecord.label,
      confidence: uploadRecord.confidence,
      image_path: path,
      created_at: new Date(uploadRecord.timestamp).toISOString(),
      input_mode: uploadRecord.inputMode,
      backend: uploadRecord.backend,
      analysed_anyway: uploadRecord.analysedAnyway,
      reported: uploadRecord.reported,
      ranked: uploadRecord.ranked,
      threshold: uploadRecord.threshold,
      temperature: uploadRecord.temperature,
      margin: uploadRecord.margin,
      latency_ms: uploadRecord.latencyMs,
      problems: uploadRecord.problems,
    });

    await uploadImage(imagePath);
    let { error: upsertError } = await writeScanRow(imagePath);

    if (isScanOwnerConflict(upsertError)) {
      const previousPath = imagePath;
      uploadRecord = await replaceMigratedScanId(uploadRecord, crypto.randomUUID());
      imagePath = `${userId}/${uploadRecord.id}.jpg`;

      const { error: cleanupError } = await supabase.storage
        .from(BUCKET)
        .remove([previousPath]);
      if (cleanupError) throw cleanupError;

      await uploadImage(imagePath);
      ({ error: upsertError } = await writeScanRow(imagePath));
    }
    if (upsertError) throw upsertError;

    await run('readwrite', (s) => s.put({
      ...uploadRecord,
      cloudUserId: userId,
      imagePath,
      syncStatus: 'synced',
    }));
  }

  const { data: cloudRecords, error: listError } = await supabase
    .from('scan_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (listError) throw listError;

  const cachedRecords = await listScans(userId);
  const localRecordsById = new Map(cachedRecords.map((record) => [record.id, record]));
  const hasCachedImages = cachedRecords.some((record) => record.thumb);
  const storageObjectNames = hasCachedImages ? await listStorageObjectNames(userId) : null;

  for (const cloudRecord of cloudRecords ?? []) {
    const localRecord = localRecordsById.get(cloudRecord.id);
    if (localRecord?.syncStatus === 'pending') continue;

    let thumb = localRecord?.thumb ?? null;
    let imageMissing = !cloudRecord.image_path;
    if (cloudRecord.image_path) {
      const pathPrefix = `${userId}/`;
      const objectName = cloudRecord.image_path.startsWith(pathPrefix)
        ? cloudRecord.image_path.slice(pathPrefix.length)
        : null;
      const objectExists = storageObjectNames
        ? objectName !== null && storageObjectNames.has(objectName)
        : null;

      if (thumb && objectExists === false && objectName !== null) {
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(cloudRecord.image_path, thumb, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        storageObjectNames.add(objectName);
      } else if (objectName === null) {
        imageMissing = true;
      } else if (!thumb && objectExists !== false) {
        const { data, error: downloadError } = await supabase.storage
          .from(BUCKET)
          .download(cloudRecord.image_path);
        if (downloadError) {
          if (!isStorageObjectNotFound(downloadError)) throw downloadError;
          imageMissing = true;
        } else {
          thumb = data;
        }
      }
      imageMissing ||= !thumb;
    }

    await run('readwrite', (s) => s.put({
      id: cloudRecord.id,
      timestamp: Date.parse(cloudRecord.created_at),
      thumb,
      inputMode: cloudRecord.input_mode,
      backend: cloudRecord.backend,
      analysedAnyway: cloudRecord.analysed_anyway,
      label: cloudRecord.prediction,
      confidence: Number(cloudRecord.confidence),
      reported: cloudRecord.reported,
      ranked: cloudRecord.ranked,
      threshold: Number(cloudRecord.threshold),
      temperature: cloudRecord.temperature === null ? null : Number(cloudRecord.temperature),
      margin: cloudRecord.margin === null ? null : Number(cloudRecord.margin),
      latencyMs: cloudRecord.latency_ms,
      problems: cloudRecord.problems ?? [],
      cloudUserId: userId,
      imagePath: cloudRecord.image_path,
      imageMissing,
      syncStatus: 'synced',
    }));
  }

  window.dispatchEvent(new Event('fecalvision:history-synced'));
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
