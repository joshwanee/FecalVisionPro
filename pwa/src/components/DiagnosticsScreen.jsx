import { useEffect, useRef, useState } from 'react';
import { describeBackend } from '../lib/backend';
import { getBackendInfo, getCalibration, MODEL_DIR, retestBackend } from '../lib/fecalvision';
import { listScans } from '../lib/history';
import { ACTIVE_MODEL } from '../content/models';
import { ArrowLeftIcon, RewindIcon } from './icons';

/**
 * Reached from a small link, not the main navigation. Not a screen a farmer
 * needs day to day: it is here so cross-device results can be compared and
 * explained - which backend a phone is using, how far it measured from full
 * precision, and how fast scans are - designed to be easy to read and
 * screenshot for exactly that purpose.
 */
export default function DiagnosticsScreen({ onBack }) {
  const [backend, setBackend] = useState(getBackendInfo);
  const [retesting, setRetesting] = useState(false);
  const [latency, setLatency] = useState(null); // { avg, count } or null
  const titleRef = useRef(null);
  const calibration = getCalibration();

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Average of the most recent scans' latency, straight from History - no
  // separate store needed, every scan already records its own latencyMs.
  useEffect(() => {
    let cancelled = false;
    listScans().then((all) => {
      if (cancelled) return;
      const recent = all.slice(0, 10).map((r) => r.latencyMs).filter((n) => typeof n === 'number');
      setLatency(recent.length ? { avg: Math.round(recent.reduce((a, b) => a + b, 0) / recent.length), count: recent.length } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [backend]);

  const doRetest = async () => {
    setRetesting(true);
    setBackend(await retestBackend());
    setRetesting(false);
  };

  const desc = backend && describeBackend(backend.backend);
  const isolated = typeof window !== 'undefined' && window.crossOriginIsolated === true;

  return (
    <div className="screen">
      <button type="button" className="link link--back" onClick={onBack}>
        <ArrowLeftIcon /> Back
      </button>
      <h1 ref={titleRef} tabIndex={-1}>
        Diagnostics
      </h1>
      <p className="lead">
        Technical facts about this device and model. Useful for comparing results between devices, or
        for a written report.
      </p>

      <dl className="diagnostics">
        <div className="diagnostics__row">
          <dt>Backend in use</dt>
          <dd>
            {desc ? desc.label : 'Not yet determined'}
            {backend && <span className="diagnostics__note"> ({backend.fromCache ? 'cached choice' : 'freshly tested'})</span>}
          </dd>
          {desc?.detail && <p className="diagnostics__help">{desc.detail}</p>}
        </div>

        <div className="diagnostics__row">
          <dt>Measured difference vs full precision</dt>
          <dd>
            {backend?.maxDiff != null
              ? backend.maxDiff.toFixed(6)
              : backend?.backend === 'cpu'
                ? 'n/a (CPU is always full precision)'
                : backend?.webglAvailable === false
                  ? 'n/a (no GPU on this device/browser)'
                  : 'n/a'}
          </dd>
        </div>

        <div className="diagnostics__row">
          <dt>Cross-origin isolation</dt>
          <dd>{isolated ? 'Active' : 'Not active'}</dd>
          <p className="diagnostics__help">
            {isolated
              ? 'The WebAssembly backend can use its fastest path.'
              : 'WebAssembly still works, just single-threaded and therefore slower. It never fails because of this.'}
          </p>
        </div>

        <div className="diagnostics__row">
          <dt>Average inference time</dt>
          <dd>{latency ? `${latency.avg} ms` : 'No scans yet'}</dd>
          {latency && <p className="diagnostics__help">Over the last {latency.count} scan{latency.count === 1 ? '' : 's'} on this phone.</p>}
        </div>

        <div className="diagnostics__row">
          <dt>Active model</dt>
          <dd>{ACTIVE_MODEL.name}</dd>
          <p className="diagnostics__help">{MODEL_DIR}</p>
        </div>

        <div className="diagnostics__row">
          <dt>Temperature</dt>
          <dd>{calibration ? calibration.temperature.toFixed(2) : 'n/a'}</dd>
        </div>

        <div className="diagnostics__row">
          <dt>Confidence threshold</dt>
          <dd>{calibration ? calibration.confidence_threshold : 'n/a'}</dd>
        </div>
      </dl>

      <button type="button" className="button button--secondary" onClick={doRetest} disabled={retesting}>
        <RewindIcon /> {retesting ? 'Testing…' : 'Clear cached choice and test again'}
      </button>
    </div>
  );
}
