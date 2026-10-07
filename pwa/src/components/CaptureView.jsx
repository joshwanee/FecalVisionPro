import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useCropGuide } from '../hooks/useCropGuide';
import { evaluate, LIMITS, measureFrame, smoothMetrics } from '../lib/quality';
import QualityChecklist from './QualityChecklist';
import { CameraIcon, CloseIcon, FlashIcon, ImageIcon, MinusIcon, PlusIcon } from './icons';

// Open the app with ?debug in the address bar to see the raw quality numbers.
const DEBUG = new URLSearchParams(window.location.search).has('debug');

// Without hardware zoom the preview is enlarged and the photo cropped to match.
const DIGITAL_ZOOM = { min: 1, max: 4 };
// Past this, hardware zoom is mostly blur; getting closer works better.
const MAX_HARDWARE_ZOOM = 8;
const ZOOM_STEP = 0.5;

/**
 * Live camera preview with a framing guide and real-time quality feedback.
 *
 * inputMode       : 'whole' or 'square' (only changes the guide's wording)
 * onCapture(blob)  : called with a full-frame JPEG when the user takes the photo
 * onPickFile()     : open the file picker instead (fallback path)
 * onCancel()       : go back
 */
export default function CaptureView({ inputMode, onCapture, onPickFile, onCancel }) {
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const smoothed = useRef(null); // smoothed measurements across frames
  const lastSignature = useRef('');

  const camera = useCamera(videoRef);
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
  const [quality, setQuality] = useState(null);
  const guideSide = useCropGuide(frameRef, videoSize.w, videoSize.h);

  // Zoom level, remembered per camera session: when the camera restarts it
  // starts again unzoomed, so the stored value is tied to the range it was for.
  const hardware = camera.zoomRange;
  const zoomMin = hardware ? hardware.min : DIGITAL_ZOOM.min;
  const zoomMax = hardware ? Math.min(hardware.max, MAX_HARDWARE_ZOOM) : DIGITAL_ZOOM.max;
  const [zoomState, setZoomState] = useState({ range: null, value: 1 });
  const zoom = zoomState.range === hardware ? zoomState.value : zoomMin;
  const digitalZoom = hardware ? 1 : zoom;
  // The quality timer reads the latest digital zoom without restarting.
  const digitalZoomRef = useRef(1);
  useEffect(() => {
    digitalZoomRef.current = digitalZoom;
  }, [digitalZoom]);

  const changeZoom = (direction) => {
    const next = Math.min(zoomMax, Math.max(zoomMin, Math.round((zoom + direction * ZOOM_STEP) * 10) / 10));
    if (next === zoom) return;
    setZoomState({ range: hardware, value: next });
    if (hardware) camera.setZoom(next);
  };

  // Analyse the preview a few times per second (not every frame): quality does
  // not change that fast, and it keeps the phone cool and the battery alive.
  useEffect(() => {
    if (camera.state !== 'live') return undefined;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || document.hidden) return;
      smoothed.current = smoothMetrics(smoothed.current, measureFrame(video, digitalZoomRef.current));
      const result = evaluate(smoothed.current);
      // Only re-render when the advice changes (or when debugging numbers).
      const signature = result.checks.map((c) => `${c.id}:${c.ok}`).join('|');
      if (DEBUG || signature !== lastSignature.current) {
        lastSignature.current = signature;
        setQuality(result);
      }
    }, LIMITS.CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [camera.state]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // Save the WHOLE frame at the camera's full resolution. What part of it the
    // model uses is decided later (see analysisInput.js), the same way as for a
    // photo picked from the gallery.
    // With digital zoom on, keep only the middle part that was on screen.
    const w = Math.round(video.videoWidth / digitalZoom);
    const h = Math.round(video.videoHeight / digitalZoom);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas
      .getContext('2d')
      .drawImage(video, (video.videoWidth - w) / 2, (video.videoHeight - h) / 2, w, h, 0, 0, w, h);
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', 0.95);
  };

  const live = camera.state === 'live';
  const hasProblems = quality && !quality.ok;
  const guideClass = !quality ? '' : quality.ok ? 'frame__guide--ok' : 'frame__guide--bad';

  // Camera unavailable: explain why and offer the file picker as the way on.
  if (camera.state === 'denied' || camera.state === 'unavailable' || camera.state === 'error') {
    return (
      <section className="capture capture--fallback" aria-labelledby="cam-title">
        <h2 id="cam-title">Camera not available</h2>
        <p>{camera.detail}</p>
        <div className="actions">
          <button type="button" className="button button--primary" onClick={onPickFile}>
            <ImageIcon /> Choose a photo
          </button>
          <button type="button" className="button button--secondary" onClick={camera.restart}>
            Try the camera again
          </button>
          <button type="button" className="button button--quiet" onClick={onCancel}>
            Back
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="capture" aria-label="Camera">
      <div className="frame" ref={frameRef}>
        <video
          ref={videoRef}
          className="frame__media"
          playsInline
          muted
          style={digitalZoom > 1 ? { transform: `scale(${digitalZoom})` } : undefined}
          onLoadedMetadata={(e) =>
            setVideoSize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })
          }
        />
        {live && guideSide > 0 && (
          <div
            className={`frame__guide ${guideClass}`}
            style={{ width: guideSide, height: guideSide }}
            aria-hidden="true"
          >
            <span className="frame__tag">
              {inputMode === 'square' ? 'The model sees this square' : 'Keep the dropping in this square'}
            </span>
          </div>
        )}
        {!live && <p className="frame__wait">Starting the camera…</p>}
        {DEBUG && quality && (
          <pre className="frame__debug">
            {`light ${quality.metrics.brightness.toFixed(0)} (${LIMITS.MIN_BRIGHTNESS}-${LIMITS.MAX_BRIGHTNESS})  ` +
              `glare ${(quality.metrics.blownOutFraction * 100).toFixed(0)}% (max ${LIMITS.MAX_BLOWN_OUT_FRACTION * 100})\n` +
              `sharp ${quality.metrics.sharpness.toFixed(0)} (min ${LIMITS.MIN_SHARPNESS})  ` +
              `fill ${(quality.metrics.fill * 100).toFixed(0)}% (min ${LIMITS.MIN_FILL * 100})`}
          </pre>
        )}
      </div>

      <div className="capture__panel">
        <QualityChecklist quality={quality} />

        {live && (
          <div className="camtools">
            {camera.torchAvailable && (
              <button
                type="button"
                className="camtools__button camtools__torch"
                aria-pressed={camera.torchOn}
                onClick={camera.toggleTorch}
              >
                <FlashIcon /> {camera.torchOn ? 'Light on' : 'Light off'}
              </button>
            )}
            <div className="camtools__zoom" role="group" aria-label="Zoom">
              <button
                type="button"
                className="camtools__button"
                aria-label="Zoom out"
                onClick={() => changeZoom(-1)}
                disabled={zoom <= zoomMin}
              >
                <MinusIcon />
              </button>
              <span className="camtools__level" aria-live="polite">
                {zoom.toFixed(1)}×
              </span>
              <button
                type="button"
                className="camtools__button"
                aria-label="Zoom in"
                onClick={() => changeZoom(1)}
                disabled={zoom >= zoomMax}
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        )}

        {/* Primary action at the bottom of the screen, where the thumb rests. */}
        <button
          type="button"
          className={`button button--big ${hasProblems ? 'button--caution' : 'button--primary'}`}
          onClick={capture}
          disabled={!live}
        >
          <CameraIcon /> {hasProblems ? 'Capture anyway' : 'Capture'}
        </button>
        <div className="capture__secondary">
          <button type="button" className="button button--quiet" onClick={onPickFile}>
            <ImageIcon /> Choose photo
          </button>
          <button type="button" className="button button--quiet" onClick={onCancel}>
            <CloseIcon /> Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
