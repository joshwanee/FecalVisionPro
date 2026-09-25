import { useCallback, useEffect, useRef, useState } from 'react';
import HelpScreen from './components/HelpScreen';
import HistoryScreen from './components/HistoryScreen';
import ScanScreen from './components/ScanScreen';
import Sidebar from './components/Sidebar';
import { StatusPill } from './components/StatusPanels';
import { MenuIcon } from './components/icons';
import { NAV_ITEMS } from './components/navItems';
import { useInputMode } from './hooks/useInputMode';
import { useInstall } from './hooks/useInstall';
import { useModel } from './hooks/useModel';
import { useOfflineReady } from './hooks/useOfflineReady';
import './tokens.css';
import './styles.css';

/**
 * App shell.
 *
 *  - top bar: menu (burger) button, name, and the offline-readiness pill
 *  - the current screen (Scan, History, Help)
 *  - bottom navigation on phones, where the thumb is; on wide screens the same
 *    links live in a permanent sidebar instead
 *
 * While a task is under way (camera, reviewing, a result) the bottom navigation
 * steps out of the way, so the task has the whole screen.
 */
export default function App() {
  const [view, setView] = useState('scan');
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [toast, setToast] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const menuButtonRef = useRef(null);
  const mainRef = useRef(null);

  const model = useModel();
  const { ready: offlineReady } = useOfflineReady(model.status === 'ready');
  const install = useInstall();
  const [inputMode, setInputMode] = useInputMode();
  const installAvailable = !install.installed && (install.canPrompt || install.showIosHelp);

  // Online / offline status.
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // The menu is a slide-over on phones only; if the window becomes wide (for
  // example a tablet rotated), close it so no dialog state is left behind.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 64rem)');
    const onChange = () => wide.matches && setMenuOpen(false);
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  // A toast (short confirmation, sometimes with Undo) disappears by itself.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  const navigate = (id) => {
    setView(id);
    setMenuOpen(false);
    setFocusMode(false);
    mainRef.current?.scrollTo({ top: 0 });
  };

  const showToast = useCallback((t) => setToast(t), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  return (
    <div className={focusMode ? 'app app--task' : 'app'}>
      <a className="skip" href="#main">
        Skip to content
      </a>

      <header className="topbar" inert={menuOpen}>
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-button topbar__menu"
          aria-label={installAvailable ? 'Open menu (install available)' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="menu"
          onClick={openMenu}
        >
          <MenuIcon />
          {installAvailable && <span className="dot" aria-hidden="true" />}
        </button>
        <span className="topbar__title">FecalVision</span>
        <StatusPill offline={offline} offlineReady={offlineReady} />
      </header>

      <div className="app__body">
        <Sidebar
          open={menuOpen}
          onClose={closeMenu}
          view={view}
          onNavigate={navigate}
          model={model}
          offline={offline}
          offlineReady={offlineReady}
          install={install}
          inputMode={inputMode}
          onInputMode={setInputMode}
        />
        <div className="scrim" hidden={!menuOpen} onClick={closeMenu} />

        <main id="main" ref={mainRef} className="app__main" inert={menuOpen}>
          {view === 'scan' && (
            <ScanScreen
              model={model}
              offline={offline}
              offlineReady={offlineReady}
              install={install}
              inputMode={inputMode}
              onOpenMenu={openMenu}
              onViewHistory={() => navigate('history')}
              onFocusChange={setFocusMode}
            />
          )}
          {view === 'history' && (
            <HistoryScreen
              showToast={showToast}
              onFocusChange={setFocusMode}
              onGoScan={() => navigate('scan')}
            />
          )}
          {view === 'help' && <HelpScreen />}
        </main>
      </div>

      <nav className="bottomnav" aria-label="Main" inert={menuOpen}>
        {NAV_ITEMS.filter((item) => item.id !== 'help').map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="bottomnav__link"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => navigate(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
