import { useEffect, useRef, useState } from 'react';
import { InstallPanel, ModelStatus, PrivacyNote } from './StatusPanels';
import ConfirmDialog from './ConfirmDialog';
import { ACTIVE_MODEL, MODELS } from '../content/models';
import { INPUT_MODES } from '../lib/analysisInput';
import { BUILD } from '../lib/buildInfo';
import { getAvailableModelDirs, MODEL_DIR, switchModel } from '../lib/fecalvision';
import { CloseIcon } from './icons';
import { NAV_ITEMS } from './navItems';

/**
 * The menu. On a phone it slides in over the screen (the "burger" menu); on a
 * wide screen it is a permanent sidebar. It holds the things a farmer needs
 * less often but must be able to find: the install button, offline status,
 * which model to use, help and privacy.
 *
 * With `overlay` (the Home screen) it stays a slide-over at every width, so it
 * can be hidden and revealed on a desktop too.
 *
 * On a phone, while it is open: focus moves inside, Tab stays inside, Escape
 * closes it, and focus returns to the burger button afterwards.
 */
export default function Sidebar({
  open,
  onClose,
  view,
  onNavigate,
  model,
  offline,
  offlineReady,
  install,
  inputMode,
  onInputMode,
  overlay = false,
}) {
  const ref = useRef(null);
  const closeRef = useRef(null);
  // The model the user just picked, awaiting confirmation (switching reloads
  // the app, so it is asked for rather than done the instant a radio is hit).
  const [pendingModelDir, setPendingModelDir] = useState(null);

  // Escape closes; Tab is kept inside the menu while it is open (phone layout).
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = ref.current.querySelectorAll('button, a[href], summary, [tabindex="0"]');
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const pendingModel = pendingModelDir && MODELS[pendingModelDir];

  return (
    <>
      <aside
        ref={ref}
        id="menu"
        className={['sidebar', overlay && 'sidebar--overlay', open && 'is-open'].filter(Boolean).join(' ')}
        aria-label="Menu"
        role={open ? 'dialog' : undefined}
        aria-modal={open ? 'true' : undefined}
      >
        <div className="sidebar__head">
          <span className="sidebar__brand">FecalVision</span>
          <button ref={closeRef} type="button" className="icon-button sidebar__close" onClick={onClose} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>

        <nav aria-label="Sections">
          <ul className="sidebar__nav">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  className="sidebar__link"
                  aria-current={view === id ? 'page' : undefined}
                  onClick={() => onNavigate(id)}
                >
                  <Icon /> {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__section">
          <h2>Use without internet</h2>
          <ModelStatus model={model} offline={offline} offlineReady={offlineReady} />
          <InstallPanel install={install} />
          {install.installed && (
            <p className="fine">Installed. Open FecalVision from your home screen any time.</p>
          )}
        </div>

        <fieldset className="setting">
          <legend>Classification model</legend>
          <p className="setting__note">
            Each model remembers its own photo-framing choice. Switching reloads the app.
          </p>
          {getAvailableModelDirs().map((dir) => {
            const info = MODELS[dir];
            const active = dir === MODEL_DIR;
            return (
              <label key={dir} className="setting__option">
                <input
                  type="radio"
                  name="model-dir"
                  value={dir}
                  checked={active}
                  onChange={() => !active && setPendingModelDir(dir)}
                />
                <span>
                  <strong>{info.name}</strong>
                  {active && <span className="setting__tag">Active</span>}
                  <span className="setting__help">
                    Trained on {info.trainedOn}.{' '}
                    {info.tests
                      ? `${(info.tests.overallAccuracy * 100).toFixed(1)}% accuracy on the test set.`
                      : 'Not evaluated on the test set - comparison only.'}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <fieldset className="setting">
          <legend>What the model analyses</legend>
          <p className="setting__note">
            This model was trained on {ACTIVE_MODEL.trainedOn}.
          </p>
          {Object.entries(INPUT_MODES).map(([value, { label, help }]) => (
            <label key={value} className="setting__option">
              <input
                type="radio"
                name="input-mode"
                value={value}
                checked={inputMode === value}
                onChange={() => onInputMode(value)}
              />
              <span>
                <strong>{label}</strong>
                {value === ACTIVE_MODEL.defaultInput && <span className="setting__tag">Recommended</span>}
                <span className="setting__help">{help}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="sidebar__foot">
          <p className="sidebar__vet">
            <strong>Screening aid, not a diagnosis.</strong> Have a veterinarian confirm before
            treating birds.
          </p>
          <PrivacyNote />
          <p className="fine">
            Version {BUILD} &middot;{' '}
            <button type="button" className="diagnostics-link" onClick={() => onNavigate('diagnostics')}>
              Diagnostics
            </button>
          </p>
        </div>
      </aside>

      {/* Rendered as a sibling, not a child of the aside above: a native
          <dialog> already traps Tab within itself while open, and nesting it
          inside the menu's own manual Tab-trap (the effect above) would mean
          two separate focus-trapping mechanisms watching the same keypresses. */}
      <ConfirmDialog
        open={pendingModelDir !== null}
        title={pendingModel ? `Switch to ${pendingModel.name}?` : 'Switch model?'}
        confirmLabel="Switch and reload"
        tone="primary"
        onConfirm={() => {
          // switchModel() reloads the whole app, which otherwise forgets
          // which screen was open and starts back at the Home/Tutorial
          // screen. Remembering it here (not inside fecalvision.js, which
          // has no business knowing about screens) lets App.jsx send the
          // user back to where they actually were.
          try {
            sessionStorage.setItem('fecalvision-return-view', view);
          } catch {
            /* the reload still switches the model; it just lands on Home */
          }
          switchModel(pendingModelDir);
        }}
        onCancel={() => setPendingModelDir(null)}
      >
        <p>
          The app will reload to start using this model. Your scan history is kept, and each model
          remembers its own settings, so you can switch back any time.
        </p>
      </ConfirmDialog>
    </>
  );
}
