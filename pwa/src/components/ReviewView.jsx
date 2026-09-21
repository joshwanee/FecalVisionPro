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
 * onAnalyse(quality) : run the model on this photo
 * onRetake()         : throw it away and go back
 * inputMode          : 'whole' or 'square' (what part of the photo the model sees)
 */
export default function ReviewView({ url, busy, modelReady, inputMode, onAnalyse, onRetake }) {
  const frameRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [quality, setQuality] = useState(null);
  const guideSide = useCropGuide(frameRef, size.w, size.h);

  const handleLoad = (e) => {
    const img = e.currentTarget;
    setSize({ w: img.naturalWidth, h: img.naturalHeight });
    setQuality(evaluate(measureFrame(img)));
  };

  return (
    <section className="capture" aria-label="Review photo">
      <div className="frame" ref={frameRef}>
        <img
          className="frame__media"
          src={url}
          alt="The photo you took, ready to analyse"
          onLoad={handleLoad}
        />
        {/* The square is drawn only when the model really uses just the centre square. */}
        {inputMode === 'square' && guideSide > 0 && (
          <div
            className={`frame__guide ${quality?.ok ? 'frame__guide--ok' : 'frame__guide--bad'}`}
            style={{ width: guideSide, height: guideSide }}
            aria-hidden="true"
          >
            <span className="frame__tag">Only this square is analysed</span>
          </div>
        )}
      </div>

      <div className="capture__panel">
        <QualityChecklist quality={quality} />
        <button
          type="button"
          className="button button--big button--primary"
          onClick={() => onAnalyse(quality)}
          disabled={busy || !modelReady || !size.w}
        >
          {busy ? 'Analysing…' : modelReady ? 'Analyse this photo' : 'Model still loading…'}
        </button>
        <button type="button" className="button button--secondary" onClick={onRetake} disabled={busy}>
          <RetakeIcon /> Retake
        </button>
      </div>
    </section>
  );
}
