import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCsv, buildJson, buildZip, download, exportName } from '../lib/export';
import { clearScans, deleteScan, listScans, recordToResult, restoreScan } from '../lib/history';
import ConfirmDialog from './ConfirmDialog';
import ResultPanel from './ResultPanel';
import { ArrowLeftIcon, ChevronIcon, DownloadIcon, TrashIcon } from './icons';

const UNCLEAR = '__unclear__';
const DAY = 24 * 60 * 60 * 1000;

const DATE_OPTIONS = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

/** "Today, 14:32" or "21 Sep, 14:32". */
function formatWhen(timestamp) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

function passesDate(record, filter) {
  if (filter === 'all') return true;
  if (filter === 'today') return new Date(record.timestamp).toDateString() === new Date().toDateString();
  return record.timestamp >= Date.now() - Number(filter) * DAY;
}

/**
 * Scan history: thumbnails, filters, a full result view for each entry,
 * delete (with Undo), clear all (with confirmation) and export.
 */
export default function HistoryScreen({ showToast, onFocusChange, onGoScan }) {
  const [records, setRecords] = useState(null); // null = still loading
  const [failed, setFailed] = useState(false);
  const [resultFilter, setResultFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exporting, setExporting] = useState(false);
  const titleRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setRecords(await listScans());
      setFailed(false);
    } catch {
      setFailed(true);
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    // Loading from the on-device database, then storing what it returned.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // The bottom navigation steps aside while one scan is open.
  useEffect(() => {
    onFocusChange?.(openId !== null);
    return () => onFocusChange?.(false);
  }, [openId, onFocusChange]);

  // Small object URLs for the thumbnails, released when the list changes.
  const thumbUrls = useMemo(
    () => Object.fromEntries((records ?? []).map((r) => [r.id, URL.createObjectURL(r.thumb)])),
    [records],
  );
  useEffect(() => () => Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u)), [thumbUrls]);

  const resultOptions = useMemo(() => {
    const seen = new Map();
    (records ?? []).forEach((r) => r.reported && seen.set(r.label, r.ranked.find((x) => x.label === r.label)?.index ?? 0));
    const labels = [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
    return [
      { value: 'all', label: 'All results' },
      ...labels.map((label) => ({ value: label, label })),
      { value: UNCLEAR, label: 'Not clear enough to call' },
    ];
  }, [records]);

  const shown = useMemo(
    () =>
      (records ?? []).filter((r) => {
        const okResult =
          resultFilter === 'all' ||
          (resultFilter === UNCLEAR ? !r.reported : r.reported && r.label === resultFilter);
        return okResult && passesDate(r, dateFilter);
      }),
    [records, resultFilter, dateFilter],
  );

  const open = records?.find((r) => r.id === openId) ?? null;
  const openUrl = open ? thumbUrls[open.id] : null;

  const closeDetail = () => {
    setOpenId(null);
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const remove = async (record) => {
    await deleteScan(record.id);
    setOpenId(null);
    await refresh();
    showToast({
      message: 'Scan deleted.',
      actionLabel: 'Undo',
      onAction: async () => {
        await restoreScan(record);
        await refresh();
      },
    });
  };

  const clearAll = async () => {
    setConfirmClear(false);
    await clearScans();
    await refresh();
    showToast({ message: 'History cleared.' });
  };

  const doExport = async (kind) => {
    setExporting(true);
    try {
      if (kind === 'json') download(await buildJson(shown), exportName('json'));
      else if (kind === 'zip') download(await buildZip(shown), exportName('zip'));
      else download(new Blob([buildCsv(shown)], { type: 'text/csv;charset=utf-8' }), exportName('csv'));
      showToast({ message: `Exported ${shown.length} ${shown.length === 1 ? 'scan' : 'scans'}.` });
    } catch {
      showToast({ message: 'Export failed. Please try again.' });
    } finally {
      setExporting(false);
    }
  };

  // ---- one scan, full result ---------------------------------------------
  if (open) {
    const scan = {
      result: recordToResult(open),
      photoUrl: openUrl,
      photoBlob: open.thumb,
      inputMode: open.inputMode,
      timestamp: open.timestamp,
      quality: { problems: open.problems.map((message, i) => ({ id: i, message })) },
    };
    return (
      <div className="screen screen--task">
        <button type="button" className="link link--back" onClick={closeDetail}>
          <ArrowLeftIcon /> History
        </button>
        <ResultPanel
          scan={scan}
          primaryLabel="Back to history"
          onPrimary={closeDetail}
          extra={
            <button type="button" className="button button--danger-quiet" onClick={() => remove(open)}>
              <TrashIcon /> Delete this scan
            </button>
          }
        />
      </div>
    );
  }

  // ---- the list ---------------------------------------------------------
  return (
    <div className="screen">
      <h1 ref={titleRef} tabIndex={-1}>
        History
      </h1>
      <p className="lead">Every scan is kept on this phone only. Tap one to see the full result.</p>

      {records === null && <p className="fine">Loading…</p>}
      {failed && (
        <p className="callout callout--alert" role="alert">
          <span>History could not be opened on this phone.</span>
        </p>
      )}

      {records !== null && records.length === 0 && !failed && (
        <div className="empty">
          <h2>No scans yet</h2>
          <p>Scans you make are saved here automatically, with the photo and all four scores.</p>
          <button type="button" className="button button--primary" onClick={onGoScan}>
            Scan a dropping
          </button>
        </div>
      )}

      {records && records.length > 0 && (
        <>
          <div className="filters">
            <label>
              <span>Result</span>
              <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
                {resultOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                {DATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="count" role="status">
            {shown.length === records.length
              ? `${records.length} ${records.length === 1 ? 'scan' : 'scans'}`
              : `${shown.length} of ${records.length} scans`}
          </p>

          {shown.length === 0 ? (
            <p className="empty">No scans match these filters.</p>
          ) : (
            <ul className="list">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" className="row" onClick={() => setOpenId(r.id)}>
                    <img className="row__thumb" src={thumbUrls[r.id]} alt="" width="64" height="64" />
                    <span className="row__text">
                      <span className="row__title">
                        {r.reported ? r.label : 'Not clear enough to call'}
                      </span>
                      <span className="row__sub">
                        {r.reported
                          ? `${(r.confidence * 100).toFixed(0)}% confidence`
                          : `Best match ${r.label}, ${(r.confidence * 100).toFixed(0)}%`}
                      </span>
                      <span className="row__when">{formatWhen(r.timestamp)}</span>
                    </span>
                    <ChevronIcon />
                    <span className="sr-only">Open scan</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <details className="manage">
            <summary>Export or clear history</summary>
            <div className="manage__body">
              <p className="fine">
                Exports the {shown.length} {shown.length === 1 ? 'scan' : 'scans'} shown above, saved to
                this phone. Nothing is uploaded.
              </p>
              <button
                type="button"
                className="button button--secondary"
                disabled={exporting || shown.length === 0}
                onClick={() => doExport('zip')}
              >
                <DownloadIcon /> Spreadsheet (CSV) + photos (.zip)
              </button>
              <p className="fine">
                A spreadsheet plus each photo as a .jpg, linked by the photo_file column. Best for farm
                records.
              </p>
              <button
                type="button"
                className="button button--secondary"
                disabled={exporting || shown.length === 0}
                onClick={() => doExport('json')}
              >
                <DownloadIcon /> JSON with photos inside
              </button>
              <p className="fine">One file with the photos embedded. Best as a complete backup.</p>
              <button
                type="button"
                className="button button--secondary"
                disabled={exporting || shown.length === 0}
                onClick={() => doExport('csv')}
              >
                <DownloadIcon /> Spreadsheet only (CSV, no photos)
              </button>
              <hr />
              <button type="button" className="button button--danger-quiet" onClick={() => setConfirmClear(true)}>
                <TrashIcon /> Clear all history
              </button>
            </div>
          </details>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear all history?"
        confirmLabel="Clear all"
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      >
        <p>
          This deletes all {records?.length ?? 0} saved scans and their photos from this phone. It
          cannot be undone. Export first if you need a copy.
        </p>
      </ConfirmDialog>
    </div>
  );
}
