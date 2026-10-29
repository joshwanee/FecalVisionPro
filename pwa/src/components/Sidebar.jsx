import { useEffect, useRef } from 'react';
import { InstallPanel, ModelStatus, PrivacyNote } from './StatusPanels';
import { ACTIVE_MODEL } from '../content/models';
import { INPUT_MODES } from '../lib/analysisInput';
import { BUILD } from '../lib/buildInfo';
import { CloseIcon } from './icons';
import { NAV_ITEMS } from './navItems';

/**
 * The menu. On a phone it slides in over the screen (the "burger" menu); on a
 * wide screen it is a permanent sidebar. It holds the things a farmer needs
 * less often but must be able to find: the install button, offline status,
 * a setting, help and privacy.
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
  historyLinkRef,
  helpLinkRef,
  user,
  isGuest,
  syncStatus,
  syncError,
  authError,
  signingIn,
  onLinkGoogle,
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

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (isGuest ? 'Guest' : user?.email || null);
  const email = user?.email || null;

  return (
    <aside
      ref={ref}
      id="menu"
      className={['sidebar', open && 'is-open'].filter(Boolean).join(' ')}
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

      {/* User info */}
      {displayName && (
        <div className="sidebar__user">
          <img className="sidebar__avatar" src="/fecalvision-avatar-removebg.png" alt="" />
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">{displayName}</span>
            {email && <span className="sidebar__user-email">{email}</span>}
          </div>
        </div>
      )}
      {syncStatus && syncStatus !== 'idle' && (
        <p className="sidebar__sync" role="status">
          {syncStatus === 'syncing' && 'Syncing scan history…'}
          {syncStatus === 'synced' && 'Scan history synced to cloud.'}
          {syncStatus === 'offline' && 'Offline — scans are queued to sync.'}
          {syncStatus === 'error' && `Cloud sync failed: ${syncError || 'unknown error'}. Scans remain on this device.`}
        </p>
      )}
      {isGuest && onLinkGoogle && (
        <div className="sidebar__account-actions">
          <button type="button" className="sidebar__link-account" onClick={onLinkGoogle} disabled={signingIn}>
            {signingIn ? 'Copying scans and signing in…' : 'Transfer guest scans to Google'}
          </button>
          <p className="fine">Guest scans are copied to Google. The original guest history remains in the guest account.</p>
          {authError && <p className="sidebar__account-error" role="alert">{authError}</p>}
        </div>
      )}

      <nav aria-label="Sections">
        <ul className="sidebar__nav">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const linkRef = id === 'history' ? historyLinkRef : id === 'help' ? helpLinkRef : undefined;
            return (
              <li key={id}>
                <button
                  ref={linkRef}
                  type="button"
                  className="sidebar__link"
                  aria-current={view === id ? 'page' : undefined}
                  onClick={() => onNavigate(id)}
                >
                  <Icon /> {label}
                </button>
              </li>
            );
          })}
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
        <legend>What part of the photo is checked</legend>
        <p className="setting__note">
          This works best with {ACTIVE_MODEL.trainedOn}.
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
        <p className="fine">Version {BUILD}</p>
      </div>
    </aside>
  );
}
