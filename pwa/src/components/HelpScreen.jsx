import { useEffect, useRef } from 'react';
import { useFirstVisitTour } from '../hooks/useFirstVisitTour';
import { ACTIVE_MODEL } from '../content/models';
import { TEST_RESULTS } from '../content/performance';
import CoachTour from './CoachTour';

const pct = (p, digits = 0) => `${(p * 100).toFixed(digits)}%`;

/**
 * Built-in help (HCI: help and documentation). Short sections that open on tap,
 * so the screen is not a wall of text (progressive disclosure).
 */
export default function HelpScreen({ onViewGuide, onViewDiseases }) {
  const titleRef = useRef(null);
  const guideBtnRef = useRef(null);
  const diseaseBtnRef = useRef(null);
  const [tourSeen, markTourSeen] = useFirstVisitTour('fecalvision-tour-help-seen');
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="screen">
      <h1 ref={titleRef} tabIndex={-1}>
        Help
      </h1>
      <p className="lead">FecalVision screens photos of chicken droppings. It does not diagnose disease.</p>

      <div className="help-links">
        <button ref={guideBtnRef} type="button" className="button button--secondary" onClick={onViewGuide}>
          View guide again
        </button>
        <button ref={diseaseBtnRef} type="button" className="button button--secondary" onClick={onViewDiseases}>
          Disease guide
        </button>
      </div>

      <CoachTour
        steps={[
          { ref: guideBtnRef, title: 'View guide again', text: 'Replay the app introduction any time.' },
          { ref: diseaseBtnRef, title: 'Disease guide', text: 'Look up what each disease looks like in droppings.' },
        ]}
        active={!tourSeen}
        onFinish={markTourSeen}
      />

      <div className="accordion">
        <details open>
          <summary>Taking a good photo</summary>
          <ol>
            <li>Use daylight, and keep shadow and direct glare off the dropping.</li>
            <li>Get close so one dropping fills the square. Move the phone; do not zoom.</li>
            <li>Use a fresh dropping. Dry ones lose the colour the app relies on.</li>
            <li>Hold still until Light, Focus and Distance all show a tick.</li>
          </ol>
          <p>
            The square on the camera screen is a framing guide: put the dropping inside it. What part
            of the photo is checked (the whole photo, or only that centre square) is set in the menu
            under &ldquo;What part of the photo is checked&rdquo;.
          </p>
          {ACTIVE_MODEL.defaultInput === 'square' && (
            <p>
              This works best with {ACTIVE_MODEL.trainedOn}, so fill the square with the dropping. If
              it looks small in the frame, move closer.
            </p>
          )}
        </details>

        <details>
          <summary>Reading a result</summary>
          <ul>
            <li>
              <strong>A class and a percentage:</strong> the app found signs it associates with that
              class. The percentage is how sure it is.
            </li>
            <li>
              <strong>&ldquo;Not clear enough to call&rdquo;:</strong> the app is deliberately not
              guessing. Retake the photo following the tips shown.
            </li>
            <li>
              <strong>Close call:</strong> two classes scored nearly the same. Do not rely on the
              photo.
            </li>
            <li>
              <strong>The red tick</strong> on the score bars is the confidence the app needs before it
              will name a result.
            </li>
          </ul>
        </details>

        <details>
          <summary>How far to trust it</summary>
          <p>
            On test photos the app had never seen, it was {pct(TEST_RESULTS.overallAccuracy, 1)} accurate
            overall.{' '}
            {TEST_RESULTS.answeredShare
              ? `It agreed to answer ${pct(TEST_RESULTS.answeredShare, 1)} of them, and was right ${pct(TEST_RESULTS.answeredAccuracy, 1)} of the time on those.`
              : `When it agreed to give an answer, it was right ${pct(TEST_RESULTS.answeredAccuracy, 1)} of the time.`}
          </p>
          <p>
            That still means some confident answers are wrong. Always have a veterinarian confirm before treating birds, and call one
            straight away if birds are sick or dying.
          </p>
        </details>

        <details>
          <summary>Using it without internet</summary>
          <p>
            Open the app once with a connection so it can save itself (4.6 MB). When the top bar says
            &ldquo;Works offline&rdquo;, it is ready. Install it from the menu to open it from your home
            screen.
          </p>
        </details>

        <details>
          <summary>Privacy</summary>
          <p>
            Photos are analysed on this phone. They are not uploaded, and there is no account.
            History is stored only on this phone and can be exported or cleared from the History
            screen. Sharing a result sends it only where you choose.
          </p>
        </details>
      </div>
    </div>
  );
}
