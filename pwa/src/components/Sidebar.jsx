import { useEffect, useRef } from 'react';
import { InstallPanel, ModelStatus, PrivacyNote } from './StatusPanels';
import { INPUT_MODES } from '../lib/analysisInput';
import { BUILD } from '../lib/buildInfo';
import { CloseIcon } from './icons';
import { NAV_ITEMS } from './navItems';

/**
 * The menu. On a phone it slides in over the screen (the "burger" menu); on a
 * wide screen it is a permanent sidebar. It holds the things a farmer needs
 * less often but must be able to find: the install button, offline status,
 * help and privacy.
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
}) {
  const ref = useRef(null);
  const closeRef = useRef(null);

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

  return (
    <aside
      ref={ref}
      id="menu"
      className={open ? 'sidebar is-open' : 'sidebar'}
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
        <legend>What the model analyses</legend>
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
        <p className="fine">Version {BUILD}</p>
      </div>
    </aside>
  );
}
