import { MODEL_DOWNLOAD_MB } from '../content/performance';
import { CheckIcon, InstallIcon, ShieldIcon, WaitIcon, WarnIcon } from './icons';

/**
 * Top-bar pill: one glance says (a) whether there is signal and (b) whether the
 * app is ready to work without it. (HCI: visibility of system status.)
 */
export function StatusPill({ offline, offlineReady }) {
  let tone = 'wait';
  let text = 'Getting ready';
  let icon = <WaitIcon />;

  if (offlineReady) {
    tone = 'ok';
    text = offline ? 'Offline, ready' : 'Works offline';
    icon = <CheckIcon />;
  } else if (offline) {
    tone = 'bad';
    text = 'Offline, not ready';
    icon = <WarnIcon />;
  }

  return (
    <span className={`pill pill--${tone}`} role="status">
      {icon}
      <span>{text}</span>
    </span>
  );
}

/**
 * Model loading with real progress (bytes, not a spinner), then a permanent
 * "ready" line so the farmer can trust the app before going into the coop.
 */
export function ModelStatus({ model, offlineReady, offline }) {
  if (model.status === 'error') {
    return (
      <div className="callout callout--alert" role="alert">
        <WarnIcon />
        <div>
          <p>
            <strong>The analysis model could not be loaded.</strong>{' '}
            {offline
              ? 'You are offline and it is not saved on this phone yet. Connect once to download it.'
              : model.error}
          </p>
          <button type="button" className="button button--secondary button--compact" onClick={model.retry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (model.status === 'loading') {
    if (model.stage === 'downloading') {
      const pct = Math.round(model.progress * 100);
      const doneMb = (model.progress * MODEL_DOWNLOAD_MB).toFixed(1);
      return (
        <div className="callout" role="status">
          <WaitIcon />
          <div className="callout__grow">
            <p>
              <strong>Downloading the analysis model ({MODEL_DOWNLOAD_MB} MB).</strong> This happens
              once; afterwards the app works offline.
            </p>
            <progress max="100" value={pct} aria-label="Model download progress" />
            <p className="callout__meta">
              {doneMb} of {MODEL_DOWNLOAD_MB} MB &middot; {pct}%
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="callout" role="status">
        <WaitIcon />
        <p>{model.stage === 'checking' ? 'Checking this phone for the saved model…' : 'Starting the model…'}</p>
      </div>
    );
  }

  return offlineReady ? (
    <div className="callout callout--ok" role="status">
      <CheckIcon />
      <p>
        <strong>Ready to work without internet.</strong> The model is saved on this phone.
      </p>
    </div>
  ) : (
    <div className="callout" role="status">
      <WaitIcon />
      <p>
        <strong>Model loaded.</strong> Saving the app for offline use…
      </p>
    </div>
  );
}

/**
 * The install call to action. Says what installing GIVES the user, not just
 * "Install". Chrome/Edge/Android get a real button (the browser's own prompt);
 * iOS Safari has no such API, so it gets Add to Home Screen steps instead.
 * Renders nothing once the app is installed.
 */
export function InstallPanel({ install }) {
  if (install.installed) return null;
  if (!install.canPrompt && !install.showIosHelp) return null;

  return (
    <section className="install" aria-labelledby="install-title">
      <div className="install__head">
        <InstallIcon />
        <h3 id="install-title">Install to use without internet</h3>
      </div>
      {install.canPrompt ? (
        <>
          <p>
            Puts FecalVision on your home screen. Once installed and the model is saved, it opens in
            the coop with no signal.
          </p>
          <button type="button" className="button button--primary" onClick={install.install}>
            Install FecalVision
          </button>
        </>
      ) : (
        <>
          <p>To put FecalVision on your home screen so it works without signal:</p>
          <ol className="install__steps">
            <li>
              Tap the <strong>Share</strong> button in Safari (the square with an arrow).
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong>, then open FecalVision from your home screen.
            </li>
          </ol>
        </>
      )}
    </section>
  );
}

/** Reassurance line used in the menu: where the photos go (nowhere). */
export function PrivacyNote() {
  return (
    <p className="privacy">
      <ShieldIcon />
      <span>Photos are analysed on this phone and never uploaded.</span>
    </p>
  );
}
