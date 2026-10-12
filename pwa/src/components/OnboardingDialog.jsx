import { useEffect, useRef, useState } from 'react';
import { CameraIcon, CheckIcon, ScanIcon, ShieldIcon, WarnIcon } from './icons';

const STEPS = [
  {
    icon: <ScanIcon />,
    title: 'What this app does',
    desc: 'Check a chicken dropping for signs of disease.',
  },
  {
    icon: <CameraIcon />,
    title: 'Taking the photo',
    desc: 'Get close. Fill the frame with one dropping. Use daylight.',
    camera: true,
  },
  {
    icon: <WarnIcon />,
    title: 'Reading a result',
    desc: 'A result is a guide, not a diagnosis. Always confirm with a veterinarian.',
  },
  {
    icon: <ShieldIcon />,
    title: 'Works offline',
    desc: 'After the first load, it works without internet.',
  },
];

// A left/right drag of at least this many pixels counts as a swipe.
const SWIPE_PX = 50;

/**
 * First-launch onboarding, also reopened from Help ("View guide again").
 * Uses the browser's <dialog>, which traps focus, closes on Escape and
 * returns focus to whatever opened it.
 *
 * Skip and Start scanning do the same thing (close); which one is on screen
 * just depends on the step. The caller (App.jsx) decides what closing means
 * - normally nothing, because the app is already on the Scan screen underneath.
 */
export default function OnboardingDialog({ open, onClose }) {
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const [cameraStatus, setCameraStatus] = useState('unasked'); // unasked | asking | granted | denied
  const touchStartX = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Leave it reset, so it starts from the first step next time.
  const close = () => {
    setStep(0);
    setCameraStatus('unasked');
    onClose();
  };

  const requestCamera = async () => {
    setCameraStatus('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCameraStatus('granted');
    } catch {
      setCameraStatus('denied');
    }
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx <= -SWIPE_PX && step < STEPS.length - 1) setStep(step + 1);
    else if (dx >= SWIPE_PX && step > 0) setStep(step - 1);
  };

  const { icon, title, desc, camera } = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <dialog
      ref={ref}
      className="dialog onboarding"
      aria-labelledby="onboarding-title"
      onCancel={close}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="onboarding__card" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="onboarding__step" aria-live="polite">
          <span className="onboarding__icon" aria-hidden="true">
            {icon}
          </span>
          <h2 id="onboarding-title">{title}</h2>
          <p>{desc}</p>

          {camera && (
            <div className="onboarding__camera">
              {cameraStatus === 'unasked' && (
                <button type="button" className="button button--secondary" onClick={requestCamera}>
                  <CameraIcon /> Allow camera
                </button>
              )}
              {cameraStatus === 'asking' && <p className="fine">Asking for camera access…</p>}
              {cameraStatus === 'granted' && (
                <p className="fine onboarding__camera-ok">
                  <CheckIcon /> Camera ready.
                </p>
              )}
              {cameraStatus === 'denied' && (
                <p className="fine">No camera access. You can still choose a photo from your gallery.</p>
              )}
            </div>
          )}
        </div>

        <ol className="onboarding__dots" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                className="onboarding__dot"
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-current={i === step ? 'step' : undefined}
                onClick={() => setStep(i)}
              />
            </li>
          ))}
        </ol>

        <div className="dialog__actions">
          <button type="button" className="button button--secondary" onClick={close}>
            Skip
          </button>
          {last ? (
            <button type="button" className="button button--primary" onClick={close} autoFocus>
              Start scanning
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => setStep(step + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
