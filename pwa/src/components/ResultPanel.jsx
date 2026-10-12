import { useEffect, useMemo, useRef, useState } from 'react';
import { GENERIC_GUIDANCE, GUIDANCE, RETAKE_TIPS } from '../content/guidance';
import { CLOSE_MARGIN, TEST_RESULTS } from '../content/performance';
import { describeBackend } from '../lib/backend';
import { belowThreshold } from '../lib/fecalvision';
import { renderReportCard, shareImage } from '../lib/report';
import { ShareIcon } from './icons';

const pct = (p, digits = 0) => `${(p * 100).toFixed(digits)}%`;

/**
 * The result screen, used right after a scan and when opening a saved scan.
 * Design rules from the project brief:
 *  - uncertainty is shown, never buried: a low-confidence result is a refusal
 *    to guess, not a weak guess;
 *  - the user sees ONE image, the photo they took, and (when only the centre
 *    square is analysed) an outline of exactly which part was used;
 *  - class, confidence and the all-four-classes bar chart are always visible;
 *    everything longer (full guidance, timing) sits behind a closed "Learn
 *    more" so that stays a glance while the chart stays in view. The chart
 *    is bars only - no percentage numbers, which read as clutter next to a
 *    bar that already shows the same thing.
 *
 * scan         : { result, photoUrl, photoBlob, inputMode, backend?, analysedAnyway?, quality?, timestamp }
 * primaryLabel : text of the main action button ("Scan another", "Back")
 * onPrimary    : what that button does
 * extra        : optional node shown above the buttons (saved note, delete...)
 */
export default function ResultPanel({ scan, primaryLabel, onPrimary, extra }) {
  const { result, photoUrl, photoBlob, inputMode, quality, timestamp, details, backend, analysedAnyway } = scan;
  const backendDesc = backend && describeBackend(backend);
  const [aspect, setAspect] = useState(null); // photo width / height, known once it loads
  const headingRef = useRef(null);
  const [reportBlob, setReportBlob] = useState(null);
  const [shareNote, setShareNote] = useState('');
  const [copied, setCopied] = useState(false);

  // The validated rule only: below the threshold from calibration.json.
  const uncertain = belowThreshold(result);
  const [best, second] = result.ranked;
  const closeCall = second && result.margin < CLOSE_MARGIN;
  const guidance = GUIDANCE[result.label] ?? GENERIC_GUIDANCE;
  const verdict = uncertain ? 'Not clear enough to call' : result.label;
  const steps = uncertain ? RETAKE_TIPS : guidance.steps;
  const problems = quality?.problems ?? [];

  // One sentence for screen readers that says everything the screen shows.
  const spoken = uncertain
    ? `Not clear enough to call. The best match scored ${pct(best.probability)}, below the ${pct(result.threshold)} needed.`
    : `Signs associated with ${result.label}, ${pct(best.probability)} confidence.` +
      (closeCall ? ` Close call: ${second.label} scored ${pct(second.probability)}.` : '');

  // Move focus to the result so keyboard and screen-reader users land on it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Prepare the shareable image ahead of time so tapping Share is instant
  // (browsers only allow sharing straight after a tap).
  const record = useMemo(
    () => ({
      verdict,
      uncertain,
      confidence: result.confidence,
      ranked: result.ranked,
      threshold: result.threshold,
      timestamp,
      inputMode,
    }),
    [verdict, uncertain, result, timestamp, inputMode],
  );
  useEffect(() => {
    let cancelled = false;
    renderReportCard(record, photoBlob)
      .then((canvas) => canvas.toBlob((blob) => !cancelled && setReportBlob(blob), 'image/png'))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [record, photoBlob]);

  const share = async () => {
    if (!reportBlob) return;
    const outcome = await shareImage(reportBlob, {
      filename: `fecalvision-${new Date(timestamp).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`,
      title: 'FecalVision result',
      text: `FecalVision screening result: ${verdict}. Screening aid, not a diagnosis.`,
    });
    setShareNote(outcome === 'saved' ? 'Saved as an image on this phone.' : '');
  };

  return (
    <section className="result" aria-labelledby="result-title">
      <p className="sr-only" role="status">
        {spoken}
      </p>

      {/* ---- verdict: class, confidence, nothing longer ---- */}
      <div className={`verdict ${uncertain ? 'verdict--unsure' : ''}`}>
        <div className="verdict__badges">
          <p className="badge">{uncertain ? 'No result reported' : 'Screening result'}</p>
          {analysedAnyway && <p className="badge badge--caution">Analysed anyway</p>}
        </div>
        <h2 id="result-title" ref={headingRef} tabIndex={-1}>
          {verdict}
        </h2>
        {!uncertain && (
          <p className="verdict__figure">
            <span className="numeral">{pct(best.probability)}</span>
            <span>confidence</span>
          </p>
        )}
      </div>

      {analysedAnyway && (
        <p className="callout callout--caution">
          <span>The photo check wasn&rsquo;t sure this is a dropping. Treat this result with extra caution.</span>
        </p>
      )}

      {closeCall && (
        <p className="callout callout--caution">
          <span>
            <strong>Close call:</strong> {best.label} and {second.label} scored close together.
          </span>
        </p>
      )}

      {!uncertain && guidance.caution && (
        <p className="callout callout--caution">
          <span>{guidance.caution}</span>
        </p>
      )}

      {/* ---- what was analysed: the photo itself ---- */}
      <figure className="photo">
        <div className="photo__frame" style={aspect ? { aspectRatio: aspect } : undefined}>
          <img
            src={photoUrl}
            alt="The photo that was analysed"
            onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
          />
          {/* Only when just the centre square was checked: outline exactly that part. */}
          {inputMode === 'square' && aspect && (
            <span
              className="photo__square"
              style={{
                width: `${aspect >= 1 ? 100 / aspect : 100}%`,
                height: `${aspect >= 1 ? 100 : 100 * aspect}%`,
              }}
              aria-hidden="true"
            />
          )}
        </div>
        <figcaption>
          {inputMode === 'square' ? 'Only the outlined square was checked.' : 'The whole photo was checked.'}
        </figcaption>
      </figure>

      {/* ---- all four scores: always visible ---- */}
      <div className="scores">
        <h3>All four scores</h3>
        <ol className="scores__list" aria-label="Scores for each class, highest first">
          {result.ranked.map((r, i) => (
            <li key={r.index} className={i === 0 ? 'score score--top' : 'score'}>
              <span className="score__head">
                <span className="score__name">
                  {r.label}
                  {i === 0 && uncertain && <span className="score__tag">best match, not reported</span>}
                </span>
                <span className="score__value">{pct(r.probability, 1)}</span>
              </span>
              <span className="score__bar" aria-hidden="true">
                <span
                  className="score__fill"
                  style={{
                    width: `${Math.max(r.probability * 100, 1)}%`,
                    background: i === 0 && !uncertain ? 'var(--brand)' : undefined,
                  }}
                />
                <span className="score__tick" style={{ left: pct(result.threshold) }} />
              </span>
            </li>
          ))}
        </ol>
        <p className="fine">The red tick marks the confidence the app needs before it will name a result.</p>
      </div>

      {/* ---- everything longer, closed by default ---- */}
      <details className="tech">
        <summary>Learn more</summary>
        <div className="tech__body">
          {!uncertain && <p>{guidance.signs}</p>}

          <div>
            <h3>{uncertain ? 'How to get a clearer photo' : 'What to do next'}</h3>
            <ul>
              {uncertain && problems.map((p) => <li key={p.id}>This photo: {p.message.toLowerCase()}.</li>)}
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>

          {!uncertain && TEST_RESULTS && (
            <p className="fine">
              In testing, when the app agreed to give an answer it was right{' '}
              {pct(TEST_RESULTS.answeredAccuracy, 1)} of the time. Some confident answers are still wrong.
            </p>
          )}

          <p className="fine">
            Analysed on this phone in {result.latencyMs} ms
            {backendDesc && <> using {backendDesc.label}</>} &middot; {new Date(timestamp).toLocaleString()}
          </p>
        </div>
      </details>

      {details && (
        <details className="tech">
          <summary>Technical details</summary>
          <div className="tech__body">
            <p className="fine">
              If two devices give different answers for the same photo, compare these lines: the same
              file, fingerprint and checksum mean the input and model match.
            </p>
            <pre>{details}</pre>
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(details);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? 'Copied' : 'Copy details'}
            </button>
          </div>
        </details>
      )}

      {extra}

      {/* ---- actions, pinned to the bottom of the screen for the thumb ---- */}
      <div className="dock">
        {shareNote && (
          <p className="dock__note" role="status">
            {shareNote}
          </p>
        )}
        <div className="dock__row">
          <button type="button" className="button button--primary" onClick={onPrimary}>
            {primaryLabel}
          </button>
          <button type="button" className="button button--secondary" onClick={share} disabled={!reportBlob}>
            <ShareIcon /> Share
          </button>
        </div>
      </div>
    </section>
  );
}
