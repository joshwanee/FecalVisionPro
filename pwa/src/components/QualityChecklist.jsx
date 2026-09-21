import { CheckIcon, WaitIcon, WarnIcon } from './icons';

/**
 * Photo-quality status, kept compact so the camera preview keeps most of the
 * screen:
 *   - three chips (Light / Focus / Distance), each with an icon AND a word, so
 *     nothing depends on colour alone (glare, colour blindness);
 *   - one line of plain advice for the most important problem.
 * The advice line is a polite live region, so a screen reader announces changes
 * without interrupting.
 */
export default function QualityChecklist({ quality }) {
  let message = 'Checking the picture…';
  if (quality) {
    if (!quality.ok) message = `${quality.problems[0].message}.`;
    else if (quality.checks.every((c) => c.ok)) message = 'All checks passed. Ready to capture.';
  }

  return (
    <div className="checks">
      <ul className="checks__chips" aria-label="Photo quality checks">
        {(quality?.checks ?? []).map((c) => (
          <li
            key={c.id}
            className={`chip ${c.ok === false ? 'chip--bad' : c.ok ? 'chip--ok' : 'chip--wait'}`}
          >
            {c.ok === false ? <WarnIcon /> : c.ok ? <CheckIcon /> : <WaitIcon />}
            <span>{c.label}</span>
            <span className="sr-only">{c.ok === false ? 'problem' : c.ok ? 'passed' : 'waiting'}</span>
          </li>
        ))}
      </ul>
      <p className={`checks__message ${quality && !quality.ok ? 'checks__message--bad' : ''}`} role="status">
        {message}
      </p>
    </div>
  );
}
