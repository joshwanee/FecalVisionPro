import { useCallback, useEffect, useRef, useState } from 'react';
import { belowThreshold, classify, loadModel } from '../lib/fecalvision';
import CaptureView from './CaptureView';
import ReviewView from './ReviewView';
import { CameraIcon, ImageIcon } from './icons';

/**
 * FecalVision - scan flow.
 *
 * One screen that moves through five phases:
 *   idle       -> instructions and the two ways to start
 *   capturing  -> live camera with framing guide and quality checks
 *   reviewing  -> look at the photo, retake or analyse
 *   analysing  -> the model is running (a fraction of a second)
 *   result     -> what the model found
 *
 * Everything runs on this device; nothing is uploaded.
 */
export default function ScanScreen() {
  const [phase, setPhase] = useState('idle');
  const [model, setModel] = useState({ status: 'loading', progress: 0, error: null });
  const [photoUrl, setPhotoUrl] = useState(null); // object URL of the current photo
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  // Start loading the model straight away so the first scan is not the slow one.
  useEffect(() => {
    loadModel({ onProgress: (p) => setModel((m) => ({ ...m, progress: p })) })
      .then(() => setModel((m) => ({ ...m, status: 'ready', progress: 1 })))
      .catch((e) => setModel((m) => ({ ...m, status: 'error', error: e.message })));
  }, []);

  // An object URL holds the photo in memory until it is revoked, so release
  // the old one whenever the photo changes or the screen closes.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const setPhoto = useCallback((blob) => {
    setResult(null);
    setError(null);
    setPhotoUrl(URL.createObjectURL(blob));
    setPhase('reviewing');
  }, []);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow picking the same file again later
    if (file) setPhoto(file);
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setPhotoUrl(null);
    setPhase('idle');
  };

  const analyse = async (imgElement) => {
    if (!imgElement?.complete) return;
    setPhase('analysing');
    setError(null);
    try {
      setResult(await classify(imgElement));
      setPhase('result');
    } catch (e) {
      setError(`Analysis failed: ${e.message}`);
      setPhase('reviewing');
    }
  };

  const modelReady = model.status === 'ready';

  return (
    <div className="scan">
      {/* One hidden file input, opened by real buttons so keyboard users can reach it. */}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />

      {phase === 'idle' && (
        <section aria-labelledby="scan-title">
          <h1 id="scan-title">Check a dropping</h1>
          <ol className="steps">
            <li>Use daylight. Avoid shadow and direct glare.</li>
            <li>Get close: one dropping should fill the square.</li>
            <li>Hold steady until every check turns green.</li>
          </ol>

          <ModelStatus model={model} />

          <div className="actions">
            <button
              type="button"
              className="button button--big button--primary"
              onClick={() => setPhase('capturing')}
            >
              <CameraIcon /> Open camera
            </button>
            <button type="button" className="button" onClick={() => fileRef.current?.click()}>
              <ImageIcon /> Choose a photo
            </button>
          </div>
          <p className="fine">The photo is analysed on this phone. It is never uploaded.</p>
        </section>
      )}

      {phase === 'capturing' && (
        <CaptureView
          onCapture={setPhoto}
          onPickFile={() => fileRef.current?.click()}
          onCancel={reset}
        />
      )}

      {(phase === 'reviewing' || phase === 'analysing') && photoUrl && (
        <>
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
          <ReviewView
            url={photoUrl}
            busy={phase === 'analysing'}
            modelReady={modelReady}
            onAnalyse={analyse}
            onRetake={() => setPhase('capturing')}
          />
        </>
      )}

      {phase === 'result' && result && <Result result={result} onRetake={reset} />}
    </div>
  );
}

/** Real download progress for the ~4.6 MB model, plus a clear error if it fails. */
function ModelStatus({ model }) {
  if (model.status === 'ready') return null;
  if (model.status === 'error') {
    return (
      <p className="notice notice--error" role="alert">
        The analysis model could not be loaded. {model.error}
      </p>
    );
  }
  const pct = Math.round(model.progress * 100);
  return (
    <div className="notice" role="status">
      <label htmlFor="model-progress">Preparing the on-device model… {pct}%</label>
      <progress id="model-progress" max="100" value={pct} />
    </div>
  );
}

/* ---- Temporary result view: replaced by ResultPanel in the next increment ---- */

function Result({ result, onRetake }) {
  const { label, confidence, ranked, advice, threshold } = result;

  // Use the validated threshold rule only (see belowThreshold in fecalvision.js).
  if (belowThreshold(result)) {
    return (
      <section className="result result--uncertain" aria-live="polite">
        <h2>Not clear enough to call</h2>
        <p>
          The closest match was {label} at {(confidence * 100).toFixed(0)}% confidence, below the{' '}
          {(threshold * 100).toFixed(0)}% the app requires before reporting a result.
        </p>
        <Breakdown ranked={ranked} />
        <button type="button" className="button" onClick={onRetake}>
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
      <button type="button" className="button" onClick={onRetake}>
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
