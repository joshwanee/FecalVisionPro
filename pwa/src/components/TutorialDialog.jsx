import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from './icons';

const TUTORIAL_STEPS = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    ),
    title: 'Capture a Sample',
    desc: 'Use the Scanner tab to take a live photo or upload an image of a fecal sample from your flock.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    title: 'AI Analysis',
    desc: 'Our AI engine scans the image and detects signs of disease, parasites, or healthy digestion within seconds.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: 'Review the Report',
    desc: 'Check the Logs tab for a full diagnostic report with confidence score, diagnosis, and action plan.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    title: 'Monitor Your Flock',
    desc: 'The Dashboard gives you a live overview of scan history, health ratios, and anomaly trends over time.',
  },
];

/**
 * "How it works" walkthrough, one step at a time, opened from the Home
 * screen's Tutorial button. Uses the browser's <dialog>, which traps focus,
 * closes on Escape and returns focus to the Tutorial button.
 */
export default function TutorialDialog({ open, onClose, onFinish }) {
  const ref = useRef(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Leave the tutorial reset, so it starts from the first step next time.
  const close = () => {
    setStep(0);
    onClose();
  };
  const finish = () => {
    setStep(0);
    onFinish();
  };

  const { icon, title, desc } = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;

  return (
    <dialog
      ref={ref}
      className="dialog tutorial"
      aria-labelledby="tutorial-title"
      onCancel={close}
      // A click on the backdrop (outside the card) closes it too.
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="tutorial__card">
        <div className="tutorial__head">
          <span className="tutorial__count">
            Step {step + 1} of {TUTORIAL_STEPS.length}
          </span>
          <button type="button" className="icon-button" aria-label="Close tutorial" onClick={close}>
            <CloseIcon />
          </button>
        </div>

        <div className="tutorial__step" aria-live="polite">
          <span className="tutorial__icon" aria-hidden="true">
            {icon}
          </span>
          <h2 id="tutorial-title">{title}</h2>
          <p>{desc}</p>
        </div>

        <ol className="tutorial__dots" aria-label="Steps">
          {TUTORIAL_STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                className="tutorial__dot"
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-current={i === step ? 'step' : undefined}
                onClick={() => setStep(i)}
              />
            </li>
          ))}
        </ol>

        <div className="dialog__actions">
          {step === 0 ? (
            <button type="button" className="button button--secondary" onClick={close}>
              Skip
            </button>
          ) : (
            <button type="button" className="button button--secondary" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {last ? (
            <button type="button" className="button button--primary" onClick={finish}>
              Get started
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => setStep(step + 1)} autoFocus>
              Next
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
