import { useCallback, useEffect, useRef, useState } from 'react';
import { DecodeError, makeStoredPhoto, prepareInput } from '../lib/analysisInput';
import { BUILD } from '../lib/buildInfo';
import { classify, getCalibration, getRuntimeInfo } from '../lib/fecalvision';
import { checkDropping, loadGate } from '../lib/gate';
import { buildRecord, deleteScan, requestPersistence, saveScan } from '../lib/history';
import CaptureView from './CaptureView';
import ResultPanel from './ResultPanel';
import ReviewView from './ReviewView';
import { ModelStatus } from './StatusPanels';
import { CameraIcon, ImageIcon, InstallIcon, RetakeIcon, WarnIcon } from './icons';

/**
 * FecalVision - scan flow.
 *
 * One screen that moves through these phases:
 *   idle       -> instructions, the two ways to start, the dropping-check switch
 *   capturing  -> live camera with framing guide and quality checks
 *   reviewing  -> look at the photo, retake or analyse
 *   analysing  -> the model is running (a fraction of a second)
 *   rejected   -> the dropping check says this is not a dropping (not saved)
 *   result     -> what the model found, shown on the photo you took
 *
 * While capturing / reviewing / showing a result the rest of the app's
 * navigation steps out of the way (onFocusChange) so the task has the screen.
 * Every finished scan is saved to History on this phone; nothing is uploaded.
 */
export default function ScanScreen({
  model,
  offline,
  offlineReady,
  install,
  inputMode,
  gateEnabled,
  onGateChange,
  onOpenMenu,
  onViewHistory,
  onFocusChange,
}) {
  const [phase, setPhase] = useState('idle');
  const [photo, setPhoto] = useState(null); // { blob, url } the photo taken or picked
  const [scan, setScan] = useState(null); // the finished analysis (see ResultPanel)
  const [saved, setSaved] = useState({ state: 'idle', id: null }); // idle | saved | failed | removed
  const [error, setError] = useState(null);
  const [rejection, setRejection] = useState(null); // { probability, threshold, quality } when the check says no
  const fileRef = useRef(null);
  const titleRef = useRef(null);

  // Tell the app shell whether to hide the bottom navigation.
  useEffect(() => {
    onFocusChange?.(phase !== 'idle');
    return () => onFocusChange?.(false);
  }, [phase, onFocusChange]);

  // Load the dropping check ahead of the first scan, so it adds no wait later.
  useEffect(() => {
    if (gateEnabled) loadGate().catch(() => {}); // a failure is reported at scan time
  }, [gateEnabled]);

  // Move focus to the heading of the start screen and of the "not a dropping"
  // screen, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (phase === 'idle' || phase === 'rejected') titleRef.current?.focus();
  }, [phase]);

  // An object URL keeps its image in memory until revoked, so release it when
  // the photo is replaced or the screen closes.
  const photoUrl = photo?.url;
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const takePhoto = useCallback((blob) => {
    setScan(null);
    setError(null);
    setPhoto({ blob, url: URL.createObjectURL(blob) });
    setPhase('reviewing');
  }, []);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow picking the same file again later
    if (file) takePhoto(file);
  };

  const reset = () => {
    setScan(null);
    setError(null);
    setRejection(null);
    setPhoto(null);
    setSaved({ state: 'idle', id: null });
    setPhase('idle');
  };

  // skipGate: the user chose "Analyse anyway" after the dropping check said no.
  const analyse = async (quality, { skipGate = false } = {}) => {
    if (!photo) return;
    setPhase('analysing');
    setError(null);
    setRejection(null);
    try {
      // Build the model's input from the photo's real pixels (not from the
      // on-screen <img>, whose size depends on the layout). See analysisInput.js.
      const input = await prepareInput(photo.blob, inputMode);

      // Dropping check first: a face or an object must not get a diagnosis.
      let gate = null;
      if (gateEnabled && !skipGate) {
        try {
          gate = await checkDropping(input.canvas);
        } catch (e) {
          throw new Error(`the dropping check could not run (${e.message}). Turn it off on the Scan screen to continue.`, {
            cause: e,
          });
        }
        if (!gate.isDropping) {
          setRejection({ probability: gate.probability, threshold: gate.threshold, quality });
          setPhase('rejected');
          return;
        }
      }

      const result = await classify(input.canvas);
      const runtime = await getRuntimeInfo();
      const calibration = getCalibration();

      // A small JPEG of the whole photo for History and sharing.
      const storedPhoto = await makeStoredPhoto(photo.blob);

      const finished = {
        result,
        quality,
        inputMode,
        timestamp: Date.now(),
        photoBlob: storedPhoto,
        photoUrl: photo.url,
        backend: runtime.backend,
        // For the "Technical details" panel: everything that could make two
        // devices disagree about the same photo.
        details: [
          `Build: ${BUILD}`,
          `What the model analysed: ${inputMode === 'square' ? 'centre square' : 'whole photo'}`,
          `File: ${input.details.fileBytes} bytes, ${input.details.fileType}`,
          `Decoded photo: ${input.details.decoded} via ${input.details.decodedVia} (${input.details.halvingSteps} halving steps)`,
          `Model input fingerprint: ${input.details.hash}, average colour ${input.details.mean}`,
          `Model: ${runtime.modelSource}, weights checksum ${runtime.weightsChecksum}`,
          `Calculation: ${runtime.backend} (${runtime.backendFromCache ? 'cached choice' : 'freshly tested'})` +
            (runtime.backendMaxDiff != null ? `, WebGL vs full-precision diff ${runtime.backendMaxDiff.toFixed(4)}` : ''),
          `Dropping check: ${
            gate
              ? `passed, ${(gate.probability * 100).toFixed(1)}% dropping (needs ${(gate.threshold * 100).toFixed(0)}%)`
              : skipGate
                ? 'said not a dropping; analysed anyway at the user\'s request'
                : 'off'
          }`,
          `Calibration: temperature ${calibration.temperature.toFixed(2)}, threshold ${calibration.confidence_threshold}`,
          `Scores: ${result.ranked.map((r) => `${r.label} ${(r.probability * 100).toFixed(1)}%`).join(', ')}`,
          `Browser: ${navigator.userAgent}`,
        ].join('\n'),
      };
      setScan(finished);
      setPhase('result');

      // Keep the scan (photo + all four probabilities) in History.
      try {
        const record = await saveScan(buildRecord(finished));
        requestPersistence();
        setSaved({ state: 'saved', id: record.id });
      } catch {
        setSaved({ state: 'failed', id: null });
      }
    } catch (e) {
      // A DecodeError already reads as a complete, specific sentence (what
      // went wrong and what to try). Anything else is unexpected, so it keeps
      // the generic "Analysis failed" framing rather than guessing at a cause.
      setError(e instanceof DecodeError ? e.message : `Analysis failed: ${e.message}`);
      setPhase('reviewing');
    }
  };

  const removeSaved = async () => {
    try {
      await deleteScan(saved.id);
      setSaved({ state: 'removed', id: null });
    } catch {
      setSaved({ state: 'failed', id: saved.id });
    }
  };

  const modelReady = model.status === 'ready';

  return (
    <div className={phase === 'idle' ? 'screen' : 'screen screen--task'}>
      {/* One hidden file input, opened by real buttons so keyboard users can reach it. */}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />

      {phase === 'idle' && (
        <section className="idle" aria-labelledby="scan-title">
          <div>
            <h1 id="scan-title" ref={titleRef} tabIndex={-1}>
              Check a dropping
            </h1>
            <p className="lead">
              Photograph one fresh dropping in daylight. The check runs on this phone.
            </p>
          </div>

          <ModelStatus model={model} offline={offline} offlineReady={offlineReady} />

          {!install.installed && (install.canPrompt || install.showIosHelp) && (
            <div className="install-banner">
              <InstallIcon />
              <div>
                <p className="install-banner__title">Install to use without internet</p>
                <p className="install-banner__sub">Adds FecalVision to your home screen.</p>
              </div>
              <button
                type="button"
                className="button button--secondary button--compact"
                onClick={install.canPrompt ? install.install : onOpenMenu}
              >
                {install.canPrompt ? 'Install' : 'How'}
              </button>
            </div>
          )}

          <ol className="steps">
            <li>Use daylight. Avoid shadow and direct glare.</li>
            <li>Get close: one dropping should fill the square.</li>
            <li>Hold steady until every check turns green.</li>
          </ol>

          <label className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={gateEnabled}
              onChange={(e) => onGateChange(e.target.checked)}
            />
            <span className="switch__text">
              <strong>Check that the photo is a dropping</strong>
              <span className="switch__help">
                Stops faces, objects and other photos from getting a diagnosis.
              </span>
            </span>
          </label>

          <div className="actions">
            <button
              type="button"
              className="button button--big button--primary"
              onClick={() => setPhase('capturing')}
            >
              <CameraIcon /> Open camera
            </button>
            <button type="button" className="button button--secondary" onClick={() => fileRef.current?.click()}>
              <ImageIcon /> Choose a photo
            </button>
          </div>
        </section>
      )}

      {phase === 'capturing' && (
        <CaptureView
          inputMode={inputMode}
          onCapture={takePhoto}
          onPickFile={() => fileRef.current?.click()}
          onCancel={reset}
        />
      )}

      {(phase === 'reviewing' || phase === 'analysing') && photo && (
        <>
          {error && (
            <p className="callout callout--alert" role="alert">
              <WarnIcon />
              <span>{error}</span>
            </p>
          )}
          <ReviewView
            url={photo.url}
            busy={phase === 'analysing'}
            modelReady={modelReady}
            inputMode={inputMode}
            onAnalyse={analyse}
            onRetake={() => setPhase('capturing')}
          />
        </>
      )}

      {phase === 'rejected' && photo && rejection && (
        <section className="rejected" aria-labelledby="rejected-title">
          <div className="callout callout--caution">
            <WarnIcon />
            <div className="callout__grow">
              <h1 id="rejected-title" ref={titleRef} tabIndex={-1} className="rejected__title">
                This doesn't look like a chicken dropping
              </h1>
              <p>
                The dropping check gave it {(rejection.probability * 100).toFixed(0)}%, below the{' '}
                {(rejection.threshold * 100).toFixed(0)}% needed, so no diagnosis was made and nothing was
                saved. Frame one fresh dropping so it fills the square, then try again.
              </p>
            </div>
          </div>
          <img className="rejected__photo" src={photo.url} alt="The photo you took" />
          <div className="actions">
            <button type="button" className="button button--big button--primary" onClick={() => setPhase('capturing')}>
              <RetakeIcon /> Retake photo
            </button>
            <button type="button" className="button button--secondary" onClick={() => fileRef.current?.click()}>
              <ImageIcon /> Choose another photo
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => analyse(rejection.quality, { skipGate: true })}
            >
              It is a dropping, analyse anyway
            </button>
          </div>
        </section>
      )}

      {phase === 'result' && scan && (
        <ResultPanel
          scan={scan}
          primaryLabel="Scan another"
          onPrimary={reset}
          extra={
            <p className="saved" role="status">
              {saved.state === 'saved' && (
                <>
                  Saved to History on this phone.{' '}
                  <button type="button" className="link" onClick={removeSaved}>
                    Remove
                  </button>{' '}
                  <button type="button" className="link" onClick={onViewHistory}>
                    View history
                  </button>
                </>
              )}
              {saved.state === 'removed' && 'Removed from History.'}
              {saved.state === 'failed' &&
                'This scan could not be saved to History (the phone may be low on storage). The result above is still valid.'}
            </p>
          }
        />
      )}
    </div>
  );
}
