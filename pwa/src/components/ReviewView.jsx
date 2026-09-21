import { useRef, useState } from 'react';
import { useCropGuide } from '../hooks/useCropGuide';
import { evaluate, measureFrame } from '../lib/quality';
import QualityChecklist from './QualityChecklist';
import { RetakeIcon } from './icons';

/**
 * Shows the photo that was taken (or picked) so the user can retake it before
 * anything is analysed. The quality checks are re-run on the still, so a photo
 * chosen from the gallery gets the same advice as a camera capture.
 *
 * onAnalyse(imgElement, quality) : run the model on this photo
 * onRetake()                     : throw it away and go back
 */
export default function ReviewView({ url, busy, modelReady, onAnalyse, onRetake }) {
  const imgRef = useRef(null);
  const frameRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [quality, setQuality] = useState(null);
  const guideSide = useCropGuide(frameRef, size.w, size.h);

  const handleLoad = (e) => {
    const img = e.currentTarget;
    setSize({ w: img.naturalWidth, h: img.naturalHeight });
    setQuality(evaluate(measureFrame(img)));
  };

  const hasProblems = quality && !quality.ok;

  return (
    <section className="capture" aria-label="Review photo">
      <div className="frame" ref={frameRef}>
        <img
          ref={imgRef}
          className="frame__media"
          src={url}
          alt="The photo you took, ready to analyse"
          onLoad={handleLoad}
        />
        {guideSide > 0 && (
          <div
            className={`frame__guide ${quality?.ok ? 'frame__guide--ok' : 'frame__guide--bad'}`}
            style={{ width: guideSide, height: guideSide }}
            aria-hidden="true"
          >
            <span className="frame__tag">Only this square is analysed</span>
          </div>
        )}
      </div>

      <QualityChecklist quality={quality} />

      <div className="capture__controls">
        <button
          type="button"
          className="button button--big button--primary"
          onClick={() => onAnalyse(imgRef.current, quality)}
          disabled={busy || !modelReady || !size.w}
        >
          {busy ? 'Analysing…' : modelReady ? 'Analyse this photo' : 'Model still loading…'}
        </button>
        {hasProblems && (
          <p className="capture__hint">
            This photo has problems: {quality.problems[0].message.toLowerCase()}. Retaking will
            give a clearer result.
          </p>
        )}
        <button type="button" className="button" onClick={onRetake} disabled={busy}>
          <RetakeIcon /> Retake
        </button>
      </div>
    </section>
  );
}
