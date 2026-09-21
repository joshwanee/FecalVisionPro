import { LIMITS } from '../lib/quality';
import { CheckIcon, WaitIcon, WarnIcon } from './icons';

/**
 * The three photo-quality checks as a list. Each row has an icon AND text, so
 * the state never depends on colour alone (useful in glare and for colour-blind
 * users). The whole list is one polite live region, so a screen reader hears
 * changes without being interrupted.
 */
export default function QualityChecklist({ quality, debug }) {
  if (!quality) return null;

  return (
    <div className="checks">
      <ul className="checks__list" aria-live="polite" aria-label="Photo quality checks">
        {quality.checks.map((c) => (
          <li
            key={c.id}
            className={`checks__row ${c.ok === false ? 'checks__row--bad' : c.ok ? 'checks__row--ok' : 'checks__row--wait'}`}
          >
            {c.ok === false ? <WarnIcon /> : c.ok ? <CheckIcon /> : <WaitIcon />}
            <span>
              <span className="checks__label">{c.label}</span> {c.message}
            </span>
          </li>
        ))}
      </ul>
      {debug && (
        <pre className="checks__debug">
          {`brightness ${quality.metrics.brightness.toFixed(0)}  (${LIMITS.MIN_BRIGHTNESS}-${LIMITS.MAX_BRIGHTNESS})\n` +
            `blown-out  ${(quality.metrics.blownOutFraction * 100).toFixed(0)}%  (max ${LIMITS.MAX_BLOWN_OUT_FRACTION * 100}%)\n` +
            `sharpness  ${quality.metrics.sharpness.toFixed(1)}  (min ${LIMITS.MIN_SHARPNESS})\n` +
            `fill       ${(quality.metrics.fill * 100).toFixed(0)}%  (min ${LIMITS.MIN_FILL * 100}%)`}
        </pre>
      )}
    </div>
  );
}
