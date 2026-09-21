import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useCropGuide } from '../hooks/useCropGuide';
import { evaluate, LIMITS, measureFrame, smoothMetrics } from '../lib/quality';
import QualityChecklist from './QualityChecklist';
import { CameraIcon, CloseIcon, ImageIcon } from './icons';

// Open the app with ?debug in the address bar to see the raw quality numbers.
const DEBUG = new URLSearchParams(window.location.search).has('debug');

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

  // Analyse the preview a few times per second (not every frame): quality does
  // not change that fast, and it keeps the phone cool and the battery alive.
  useEffect(() => {
    if (camera.state !== 'live') return undefined;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || document.hidden) return;
      smoothed.current = smoothMetrics(smoothed.current, measureFrame(video));
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
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
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
