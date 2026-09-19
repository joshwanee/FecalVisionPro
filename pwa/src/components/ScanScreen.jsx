import { useCallback, useEffect, useRef, useState } from 'react';
import { classify, getClassNames, loadModel } from '../lib/fecalvision';

/**
 * FecalVision - scan screen.
 *
 * Capture or pick a photo, run it through the local model, show the result.
 * Everything runs in the browser; nothing is uploaded.
 *
 * Deliberate choices:
 *  - the model preloads on mount so the first scan is not the slow one
 *  - the full probability breakdown is always visible, not hidden behind a tap
 *  - a low-confidence result is shown as a refusal to guess, not as a weak guess
 *  - the veterinary referral line is permanent, not conditional
 */
export default function ScanScreen() {
  const [status, setStatus] = useState('loading'); // loading | ready | scanning | error
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);

  const imgRef = useRef(null);
  const fileRef = useRef(null);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadModel({ onProgress: (p) => !cancelled && setProgress(p) })
      .then(() => !cancelled && setStatus('ready'))
      .catch((e) => {
        if (cancelled) return;
        setError(`The analysis model could not be loaded: ${e.message}`);
        setStatus('error');
      });
    return () => {
      cancelled = true;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const handleFile = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setResult(null);
    setError(null);
    setPreview(objectUrlRef.current);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!imgRef.current || !imgRef.current.complete) return;
    setStatus('scanning');
    setError(null);
    try {
      setResult(await classify(imgRef.current));
      setStatus('ready');
    } catch (e) {
      setError(`Analysis failed: ${e.message}`);
      setStatus('ready');
    }
  }, []);

  const reset = () => {
    setResult(null);
    setPreview(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <main className="scan">
      <header className="scan__header">
        <h1>Check a dropping</h1>
        <p>
          Photograph a single fresh dropping against the litter, then run the check.
          The analysis happens on this device{online ? '' : ' — you are offline, which is fine'}.
        </p>
      </header>

      {status === 'loading' && (
        <p role="status" className="scan__status">
          Preparing the on-device model… {Math.round(progress * 100)}%
        </p>
      )}

      {status === 'error' && <p className="scan__error">{error}</p>}

      <div className="scan__actions">
        <label className="button button--primary">
          Take a photo
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            hidden
          />
        </label>
        <label className="button">
          Choose from gallery
          <input type="file" accept="image/*" onChange={handleFile} hidden />
        </label>
      </div>

      {preview && (
        <figure className="scan__preview">
          <img ref={imgRef} src={preview} alt="Dropping to be analysed" onLoad={runAnalysis} />
          <figcaption>
            {status === 'scanning' ? 'Analysing…' : result ? `${result.latencyMs} ms on this device` : ''}
          </figcaption>
        </figure>
      )}

      {error && status !== 'error' && <p className="scan__error">{error}</p>}

      {result && <Result result={result} onRetake={reset} />}

      <footer className="scan__footer">
        <p>
          FecalVision screens photographs for visual signs associated with three common
          poultry conditions. It does not diagnose disease. Confirm any result with a
          veterinarian or your local agriculture office before treating birds.
        </p>
      </footer>
    </main>
  );
}

function Result({ result, onRetake }) {
  const { label, confidence, lowConfidence, ranked, advice, threshold } = result;

  if (lowConfidence) {
    return (
      <section className="result result--uncertain" aria-live="polite">
        <h2>Not clear enough to call</h2>
        <p>
          The closest match was {label} at {(confidence * 100).toFixed(0)}% confidence,
          below the {(threshold * 100).toFixed(0)}% the app requires before reporting a result.
        </p>
        <ul>
          <li>Retake the photo in daylight, without shadow across the dropping.</li>
          <li>Fill the frame with one dropping; move closer rather than zooming.</li>
          <li>Use a fresh sample — dried droppings lose the colour the model relies on.</li>
        </ul>
        <p>If repeated photos stay unclear and the birds look unwell, consult a veterinarian.</p>
        <Breakdown ranked={ranked} />
        <button className="button" onClick={onRetake}>
          Take another photo
        </button>
      </section>
    );
  }

  return (
    <section className="result" aria-live="polite">
      <h2>{label}</h2>
      <p className="result__confidence">{(confidence * 100).toFixed(1)}% confidence</p>
      {advice && <p>{advice}</p>}
      <Breakdown ranked={ranked} />
      <button className="button" onClick={onRetake}>
        Check another dropping
      </button>
    </section>
  );
}

function Breakdown({ ranked }) {
  return (
    <div className="breakdown">
      <h3>All four scores</h3>
      {ranked.map((r) => (
        <div key={r.index} className="breakdown__row">
          <span className="breakdown__label">{r.label}</span>
          <span className="breakdown__bar" aria-hidden="true">
            <span style={{ width: `${Math.max(r.probability * 100, 1)}%` }} />
          </span>
          <span className="breakdown__value">{(r.probability * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export { getClassNames };