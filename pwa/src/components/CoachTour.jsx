import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CloseIcon } from './icons';

const GUTTER = 12; // minimum gap kept from the screen edge
const PAD = 6; // spotlight padding around the target

function useTargetRect(ref, active) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    if (!active || !ref) return undefined;
    const update = () => setRect(ref.current ? ref.current.getBoundingClientRect() : null);
    update();
    // The target can still be settling into its final layout position
    // (fonts, images) when the tour first opens.
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [ref, active]);
  return rect;
}

/**
 * Points at a real button on screen and explains it, one step at a time -
 * the "where to click" guide. Dims everything else with the classic CSS
 * spotlight trick (a giant box-shadow around the highlighted element), and
 * blocks interaction with the rest of the page while it is open, so it never
 * leaves the app in an unexpected state mid-explanation.
 *
 * steps  : [{ ref, title, text }] - ref must already be attached to the
 *          element to highlight. A step whose ref has no element right now
 *          (not rendered on this screen / this phase) is skipped automatically.
 * active : whether the tour is showing.
 * onFinish : called once, when the last step is dismissed, Skip is pressed,
 *            Escape is pressed, or the backdrop is clicked.
 */
export default function CoachTour({ steps, active, onFinish }) {
  const [index, setIndex] = useState(0);
  const cardRef = useRef(null);
  const step = active ? steps[index] : null;
  const rect = useTargetRect(step?.ref, active);

  // Never leave the tour stuck on a step whose target is not on screen.
  useEffect(() => {
    if (!active || !step || step.ref?.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else onFinish();
  }, [active, step, index, steps, onFinish]);

  useEffect(() => {
    if (active) cardRef.current?.focus();
  }, [active, index]);

  const finish = () => {
    setIndex(0);
    onFinish();
  };

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active || !step) return null;

  const last = index === steps.length - 1;
  const spot = rect && {
    left: Math.max(rect.left - PAD, 0),
    top: Math.max(rect.top - PAD, 0),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // Tooltip card: below the target if there is room, else above it; always
  // kept inside the viewport so it cannot be clipped on a small phone.
  let cardStyle = { maxWidth: `min(20rem, calc(100vw - ${GUTTER * 2}px))` };
  if (spot) {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const belowTop = spot.top + spot.height + GUTTER;
    const placeBelow = vh - belowTop > 180 || spot.top < 180;
    cardStyle = {
      ...cardStyle,
      ...(placeBelow ? { top: belowTop } : { bottom: vh - spot.top + GUTTER }),
      left: Math.min(Math.max(spot.left, GUTTER), Math.max(vw - GUTTER - 20 * 16, GUTTER)),
    };
  }

  return (
    <div className="coach" role="presentation" onClick={(e) => e.target === e.currentTarget && finish()}>
      {spot && (
        <div
          className="coach__spot"
          style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height }}
          aria-hidden="true"
        />
      )}
      <div ref={cardRef} className="coach__card" style={cardStyle} role="dialog" aria-modal="true" aria-labelledby="coach-title" tabIndex={-1}>
        <div className="coach__head">
          <span className="coach__count">
            {index + 1} / {steps.length}
          </span>
          <button type="button" className="icon-button" aria-label="Skip guide" onClick={finish}>
            <CloseIcon />
          </button>
        </div>
        <h3 id="coach-title">{step.title}</h3>
        <p>{step.text}</p>
        <div className="coach__actions">
          <button type="button" className="button button--secondary" onClick={finish}>
            Skip
          </button>
          <button type="button" className="button button--primary" onClick={last ? finish : () => setIndex((i) => i + 1)}>
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
