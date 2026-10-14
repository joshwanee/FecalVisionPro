import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFirstVisitTour } from '../hooks/useFirstVisitTour';
import { buildCsv, buildJson, buildZip, download, exportName, photoFileName } from '../lib/export';
import { clearScans, deleteScan, listScans, recordToResult, restoreScan } from '../lib/history';
import CoachTour from './CoachTour';
import ConfirmDialog from './ConfirmDialog';
import ResultPanel from './ResultPanel';
import { ArrowLeftIcon, CheckIcon, ChevronIcon, DownloadIcon, TrashIcon, WaitIcon, WarnIcon } from './icons';

/**
 * Which colour a row's result gets, so a disease result stands out while
 * scanning down the list, not just on reading it closely - matching the
 * app's own colour rule (green = fine, amber = be careful, red = talk to a
 * vet). Never colour-only: each tone also gets its own icon.
 */
function resultTone(r) {
  if (!r.reported) return 'caution';
  return r.label === 'Healthy' ? 'ok' : 'alert';
}

const UNCLEAR = '__unclear__';
const HOLD_MS = 500; // press and hold this long on a scan to start selecting
const HOLD_SLOP = 10; // px a finger may drift before it counts as a scroll
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
 * Press-and-hold on a list row. Returns pointer handlers for a row, plus
 * `consumeClick()`, which says whether the click that ends a hold should be
 * ignored (the hold already did something).
 */
function useLongPress(onHold) {
  const timer = useRef(null);
  const start = useRef(null);
  const held = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  const handlers = (id) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      held.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        held.current = true;
        navigator.vibrate?.(30);
        onHold(id);
      }, HOLD_MS);
    },
    onPointerMove: (e) => {
      if (!timer.current || !start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > HOLD_SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // Phones open a context menu on a long press; the hold replaces it.
    onContextMenu: (e) => e.preventDefault(),
  });

  const consumeClick = () => {
    const wasHeld = held.current;
    held.current = false;
    return wasHeld;
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  return { handlers, consumeClick };
}

/** Pick an export format for the selected scans. */
function ExportDialog({ open, count, onPick, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onCancel={onCancel} aria-labelledby="export-title">
      <h2 id="export-title">
        Export {count} {count === 1 ? 'scan' : 'scans'}
      </h2>
      <div className="dialog__body export-choices">
        <button type="button" className="button button--secondary" onClick={() => onPick('zip')}>
          <DownloadIcon /> Spreadsheet + photos (.zip)
        </button>
        <button type="button" className="button button--secondary" onClick={() => onPick('json')}>
          <DownloadIcon /> JSON with photos inside
        </button>
        <button type="button" className="button button--secondary" onClick={() => onPick('csv')}>
          <DownloadIcon /> Spreadsheet only (CSV)
        </button>
      </div>
      <div className="dialog__actions">
        <button type="button" className="button button--quiet" onClick={onCancel} autoFocus>
          Cancel
        </button>
      </div>
    </dialog>
  );
}

/**
 * Scan history: thumbnails, filters, a full result view for each entry,
 * delete (with Undo), clear all (with confirmation) and export.
 *
 * Select mode (the Select button, or press and hold a scan) lets the user pick
 * several scans and export or delete just those.
 */
export default function HistoryScreen({ showToast, onFocusChange, onGoScan }) {
  const [records, setRecords] = useState(null); // null = still loading
  const [failed, setFailed] = useState(false);
  const [resultFilter, setResultFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const titleRef = useRef(null);
  const selectRef = useRef(null);
  const filtersRef = useRef(null);
  const manageRef = useRef(null);
  const [tourSeen, markTourSeen] = useFirstVisitTour('fecalvision-tour-history-seen');

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

  // The bottom navigation steps aside while one scan is open, and while
  // selecting (the Export / Delete bar takes its place).
  useEffect(() => {
    onFocusChange?.(openId !== null || selecting);
    return () => onFocusChange?.(false);
  }, [openId, selecting, onFocusChange]);

  // Escape leaves select mode.
  useEffect(() => {
    if (!selecting) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || exportOpen) return;
      setSelecting(false);
      setSelected(new Set());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selecting, exportOpen]);

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

  // Only scans the filters still show count as selected.
  const picked = useMemo(() => shown.filter((r) => selected.has(r.id)), [shown, selected]);
  const allPicked = shown.length > 0 && picked.length === shown.length;

  const startSelecting = (id) => {
    setSelected(new Set(id ? [id] : []));
    setSelecting(true);
  };

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const hold = useLongPress((id) => {
    if (selecting) setSelected((prev) => new Set(prev).add(id));
    else startSelecting(id);
  });

  const onRowClick = (id) => {
    if (hold.consumeClick()) return;
    if (selecting) toggle(id);
    else setOpenId(id);
  };

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

  const savePhoto = (record) => {
    download(record.thumb, photoFileName(record));
    showToast({ message: 'Photo saved to this phone.' });
  };

  const doExport = async (kind, list = shown) => {
    setExporting(true);
    try {
      if (kind === 'json') download(await buildJson(list), exportName('json'));
      else if (kind === 'zip') download(await buildZip(list), exportName('zip'));
      else download(new Blob([buildCsv(list)], { type: 'text/csv;charset=utf-8' }), exportName('csv'));
      showToast({ message: `Exported ${list.length} ${list.length === 1 ? 'scan' : 'scans'}.` });
      return true;
    } catch {
      showToast({ message: 'Export failed. Please try again.' });
      return false;
    } finally {
      setExporting(false);
    }
  };

  const exportPicked = async (kind) => {
    setExportOpen(false);
    if (await doExport(kind, picked)) stopSelecting();
  };

  const removePicked = async () => {
    const gone = picked;
    await Promise.all(gone.map((r) => deleteScan(r.id)));
    stopSelecting();
    await refresh();
    showToast({
      message: `${gone.length} ${gone.length === 1 ? 'scan' : 'scans'} deleted.`,
      actionLabel: 'Undo',
      onAction: async () => {
        await Promise.all(gone.map((r) => restoreScan(r)));
        await refresh();
      },
    });
  };

  // ---- one scan, full result ---------------------------------------------
  if (open) {
    const scan = {
      result: recordToResult(open),
      photoUrl: openUrl,
      photoBlob: open.thumb,
      inputMode: open.inputMode,
      backend: open.backend,
      analysedAnyway: open.analysedAnyway,
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
            <>
              <button type="button" className="button button--secondary" onClick={() => savePhoto(open)}>
                <DownloadIcon /> Save photo
              </button>
              <button type="button" className="button button--danger-quiet" onClick={() => remove(open)}>
                <TrashIcon /> Delete this scan
              </button>
            </>
          }
        />
      </div>
    );
  }

  // ---- the list ---------------------------------------------------------
  return (
    <div className="screen">
      <div className="history__head">
        <h1 ref={titleRef} tabIndex={-1}>
          History
        </h1>
        {(selecting || shown.length > 0) && (
          <button
            ref={selectRef}
            type="button"
            className="button button--quiet button--compact"
            onClick={selecting ? stopSelecting : () => startSelecting()}
          >
            {selecting ? 'Cancel' : 'Select'}
          </button>
        )}
      </div>
      <p className="lead">
        {selecting
          ? 'Tap scans to select them, then export or delete them below.'
          : 'Every scan is kept on this phone only. Tap one to see the full result, or press and hold to select.'}
      </p>

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
          <div className="filters" ref={filtersRef}>
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

          <div className="history__count">
            <p className="count" role="status">
              {selecting
                ? `${picked.length} selected`
                : shown.length === records.length
                  ? `${records.length} ${records.length === 1 ? 'scan' : 'scans'}`
                  : `${shown.length} of ${records.length} scans`}
            </p>
            {selecting && shown.length > 0 && (
              <button
                type="button"
                className="link"
                onClick={() => setSelected(allPicked ? new Set() : new Set(shown.map((r) => r.id)))}
              >
                {allPicked ? 'Select none' : 'Select all'}
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="empty">No scans match these filters.</p>
          ) : (
            <ul className="list">
              {shown.map((r) => {
                const tone = resultTone(r);
                const ToneIcon = tone === 'alert' ? WarnIcon : tone === 'ok' ? CheckIcon : WaitIcon;
                return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`row row--${tone}${selecting && selected.has(r.id) ? ' row--selected' : ''}`}
                    aria-pressed={selecting ? selected.has(r.id) : undefined}
                    onClick={() => onRowClick(r.id)}
                    {...hold.handlers(r.id)}
                  >
                    <img
                      className="row__thumb"
                      src={thumbUrls[r.id]}
                      alt=""
                      width="64"
                      height="64"
                      draggable={false}
                    />
                    <span className="row__text">
                      <span className="row__title">
                        <span className={`row__status row__status--${tone}`} aria-hidden="true">
                          <ToneIcon />
                        </span>
                        {r.reported ? r.label : 'Not clear enough to call'}
                        {r.analysedAnyway && (
                          <span className="badge badge--caution" title="The dropping check was unsure about this photo">
                            Analysed anyway
                          </span>
                        )}
                      </span>
                      <span className="row__sub">
                        {r.reported
                          ? `${(r.confidence * 100).toFixed(0)}% confidence`
                          : `Best match ${r.label}, ${(r.confidence * 100).toFixed(0)}%`}
                      </span>
                      <span className="row__when">{formatWhen(r.timestamp)}</span>
                    </span>
                    {selecting ? (
                      <span className="row__check" aria-hidden="true">
                        {selected.has(r.id) && <CheckIcon />}
                      </span>
                    ) : (
                      <>
                        <ChevronIcon />
                        <span className="sr-only">Open scan</span>
                      </>
                    )}
                  </button>
                </li>
                );
              })}
            </ul>
          )}

          {selecting && (
            <div className="dock">
              <div className="dock__row">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={exporting || picked.length === 0}
                  onClick={() => setExportOpen(true)}
                >
                  <DownloadIcon /> Export
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  disabled={picked.length === 0}
                  onClick={removePicked}
                >
                  <TrashIcon /> Delete
                </button>
              </div>
            </div>
          )}

          <details className="manage" hidden={selecting}>
            <summary ref={manageRef}>Export or clear history</summary>
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

          <CoachTour
            steps={[
              { ref: filtersRef, title: 'Filter', text: 'Narrow the list by result or date.' },
              {
                ref: selectRef,
                title: 'Select',
                text: 'Tap Select, or press and hold a scan, to export or delete several at once.',
              },
              { ref: manageRef, title: 'Export or clear', text: 'Save your records as a spreadsheet, or clear old scans.' },
            ]}
            active={!tourSeen}
            onFinish={markTourSeen}
          />
        </>
      )}

      <ExportDialog
        open={exportOpen}
        count={picked.length}
        onPick={exportPicked}
        onCancel={() => setExportOpen(false)}
      />

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
