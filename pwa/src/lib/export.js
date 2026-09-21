/**
 * Exporting scan history for farm records. Everything is built on this phone
 * and saved through the browser's download; nothing is uploaded.
 *
 * Two formats, chosen for what each can carry:
 *
 *  JSON  - one file, photos embedded as data URIs (text encoding of the JPEG).
 *          Complete and self-contained, good for backup or other software.
 *
 *  CSV   - a spreadsheet, packaged in a .zip together with the photos as
 *          separate .jpg files, linked by the "photo_file" column.
 *          Photos are NOT embedded in the CSV itself: a single photo as text
 *          is ~20,000+ characters, and Excel refuses cells over 32,767.
 */
import { makeZip } from './zip';

const pct = (p) => +(p * 100).toFixed(2);

/** Read a Blob as a data: URI. */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Wrap a value in quotes if it contains a comma, quote or line break. */
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const photoName = (record) => `photos/${new Date(record.timestamp).toISOString().replace(/[:.]/g, '-')}_${record.id.slice(0, 8)}.jpg`;

export function buildCsv(records) {
  // Class columns come from the saved records, in class-index order.
  const classes = [...(records[0]?.ranked ?? [])].sort((a, b) => a.index - b.index).map((r) => r.label);
  const header = [
    'timestamp_utc',
    'local_time',
    'result',
    'best_match',
    'confidence_percent',
    'reported',
    'model_input',
    ...classes.map((c) => `${c}_percent`),
    'threshold_percent',
    'photo_file',
  ];
  const rows = records.map((r) => {
    const byLabel = Object.fromEntries(r.ranked.map((x) => [x.label, x.probability]));
    return [
      new Date(r.timestamp).toISOString(),
      new Date(r.timestamp).toLocaleString(),
      r.reported ? r.label : 'Not clear enough to call',
      r.label,
      pct(r.confidence),
      r.reported ? 'yes' : 'no',
      r.inputMode === 'square' ? 'centre square' : 'whole photo',
      ...classes.map((c) => pct(byLabel[c] ?? 0)),
      pct(r.threshold),
      photoName(r),
    ];
  });
  // The leading BOM character makes Excel read the file as UTF-8.
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export async function buildJson(records) {
  const items = await Promise.all(
    records.map(async (r) => ({
      id: r.id,
      timestamp: new Date(r.timestamp).toISOString(),
      result: r.reported ? r.label : 'Not clear enough to call',
      best_match: r.label,
      confidence: r.confidence,
      reported: r.reported,
      model_input: r.inputMode === 'square' ? 'centre square' : 'whole photo',
      probabilities: Object.fromEntries(r.ranked.map((x) => [x.label, x.probability])),
      threshold: r.threshold,
      temperature: r.temperature,
      photo_note: 'The photo that was analysed (about 640 px on the long side), as a JPEG data URI',
      photo: await blobToDataUrl(r.thumb),
    })),
  );
  return new Blob([JSON.stringify({ app: 'FecalVision', exported: new Date().toISOString(), scans: items }, null, 2)], {
    type: 'application/json',
  });
}

export async function buildZip(records) {
  const files = [{ name: 'scans.csv', data: new TextEncoder().encode(buildCsv(records)) }];
  for (const r of records) {
    files.push({ name: photoName(r), data: new Uint8Array(await r.thumb.arrayBuffer()) });
  }
  return makeZip(files);
}

/** Save a Blob to the phone via a temporary download link. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const exportName = (ext) => `fecalvision-history-${new Date().toISOString().slice(0, 10)}.${ext}`;
