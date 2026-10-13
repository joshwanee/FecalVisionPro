import { useCallback, useEffect, useRef, useState } from 'react';
import CoachTour from './components/CoachTour';
import DiagnosticsScreen from './components/DiagnosticsScreen';
import DiseasesScreen from './components/DiseasesScreen';
import GetStartedScreen from './components/GetStartedScreen';
import HelpScreen from './components/HelpScreen';
import HistoryScreen from './components/HistoryScreen';
import OnboardingDialog from './components/OnboardingDialog';
import ScanScreen from './components/ScanScreen';
import Sidebar from './components/Sidebar';
import { StatusPill } from './components/StatusPanels';
import { MenuIcon, MoonIcon, SunIcon } from './components/icons';
import { NAV_ITEMS } from './components/navItems';
import { useFirstVisitTour } from './hooks/useFirstVisitTour';
import { useInputMode } from './hooks/useInputMode';
import { useInstall } from './hooks/useInstall';
import { useModel } from './hooks/useModel';
import { useOfflineReady } from './hooks/useOfflineReady';
import { useTheme } from './hooks/useTheme';
import './tokens.css';
import './styles.css';

const DESKTOP_QUERY = '(min-width: 64rem)';
const GET_STARTED_SEEN_KEY = 'fecalvision-get-started-seen';

/** Storage can be unavailable (private mode): then it just shows once per session. */
function hasSeenGetStarted() {
  try {
    return localStorage.getItem(GET_STARTED_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markGetStartedSeen() {
  try {
    localStorage.setItem(GET_STARTED_SEEN_KEY, '1');
  } catch {
    /* not remembered, but it has already been shown this session */
  }
}

/**
 * App shell.
 *
 *  - top bar: menu (burger) button, name, and the offline-readiness pill
 *  - the current screen (Scan, History, Disease guide, Help)
 *  - bottom navigation on phones, where the thumb is; on wide screens the same
 *    links live in a permanent sidebar instead
 *
 * The very first time the app opens on a device, a full-screen "Get started"
 * page takes over instead - loading has already begun underneath it
 * (useModel() below runs regardless of which screen is shown), so the page
 * just shows that real progress and offers to install. After that one time,
 * the app always opens straight on Scan, where a "where to click" guide
 * (CoachTour) points at the real buttons on screen, also once. Help has a
 * "View guide again" link that opens the longer concept walkthrough
 * (OnboardingDialog) on demand.
 *
 * While a task is under way (camera, reviewing, a result) the bottom navigation
 * steps out of the way, so the task has the whole screen.
 *
 * The device/browser back button steps back through the screens the user
 * actually visited (Scan -> History -> Help -> ...) rather than leaving the
 * app; see the history.pushState/popstate wiring below.
 */
export default function App() {
  const [view, setView] = useState('scan');
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [toast, setToast] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [showGetStarted, setShowGetStarted] = useState(() => !hasSeenGetStarted());
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  const menuButtonRef = useRef(null);
  const mainRef = useRef(null);
  const themeToggleRef = useRef(null);
  // Phones/tablets: History and Help live in the bottom nav, the menu is a
  // burger button. Desktop: those same two live in the permanent sidebar
  // instead, and there is no burger button to point at (nothing to reveal -
  // the sidebar is already on screen). The coach tour below picks the pair
  // that is actually visible at the current width.
  const historyNavRef = useRef(null);
  const helpNavRef = useRef(null);
  const historyLinkRef = useRef(null);
  const helpLinkRef = useRef(null);
  const openCameraRef = useRef(null);
  const choosePhotoRef = useRef(null);

  // "Where to click" guide: points at the real buttons on screen, once per
  // device, as soon as the Scan screen's own buttons are ready.
  const [shellTourSeen, markShellTourSeen] = useFirstVisitTour('fecalvision-tour-shell-seen');
  const [shellTourActive, setShellTourActive] = useState(false);
  const shellTourSteps = [
    { ref: openCameraRef, title: 'Take a photo', text: 'Tap here to open the camera and photograph a dropping.' },
    { ref: choosePhotoRef, title: 'Choose a photo', text: 'Or pick an existing photo from your gallery.' },
    {
      ref: isDesktop ? historyLinkRef : historyNavRef,
      title: 'History',
      text: 'Every past scan lives here, with its photo and result.',
    },
    {
      ref: isDesktop ? helpLinkRef : helpNavRef,
      title: 'Help',
      text: 'Guides, the disease reference, and this tour again are here.',
    },
    ...(isDesktop ? [] : [{ ref: menuButtonRef, title: 'Menu', text: 'Settings, install, and offline status are here.' }]),
    { ref: themeToggleRef, title: 'Light / dark', text: 'Switch between light and dark here.' },
  ];

  const model = useModel();
  const { ready: offlineReady } = useOfflineReady(model.status === 'ready');
  const install = useInstall();
  const [inputMode, setInputMode] = useInputMode();
  const [theme, toggleTheme] = useTheme();
  const dark = theme === 'dark';
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
  // example a tablet rotated), close it so no dialog state is left behind,
  // and switch the coach tour to the sidebar's own History/Help buttons.
  useEffect(() => {
    const wide = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      setIsDesktop(wide.matches);
      if (wide.matches) setMenuOpen(false);
    };
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  // A toast (short confirmation, sometimes with Undo) disappears by itself.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Make the device/browser back button return to the previous screen
  // (Scan, History, Help, ...) instead of leaving the app outright. Each
  // navigate() call below pushes one history entry per section; popstate
  // (back or forward) just follows it, without pushing anything itself.
  useEffect(() => {
    window.history.replaceState({ view: 'scan' }, '');
  }, []);

  useEffect(() => {
    const onPopState = (e) => {
      setView(e.state?.view ?? 'scan');
      setMenuOpen(false);
      setFocusMode(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    // Wait a frame: the button is inert until the closed menu has rendered.
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  const closeOnboarding = useCallback(() => setOnboardingOpen(false), []);

  const handleGetStarted = useCallback(() => {
    markGetStartedSeen();
    setShowGetStarted(false);
  }, []);

  // Start the button guide once Get started and onboarding are both out of
  // the way, the first time only. A short delay lets the Scan screen's own
  // buttons finish laying out.
  useEffect(() => {
    if (showGetStarted || onboardingOpen || shellTourSeen || view !== 'scan') return undefined;
    const t = setTimeout(() => setShellTourActive(true), 300);
    return () => clearTimeout(t);
  }, [showGetStarted, onboardingOpen, shellTourSeen, view]);

  const finishShellTour = useCallback(() => {
    setShellTourActive(false);
    markShellTourSeen();
  }, [markShellTourSeen]);

  const navigate = (id) => {
    if (id !== view) window.history.pushState({ view: id }, '');
    setView(id);
    setMenuOpen(false);
    setFocusMode(false);
    mainRef.current?.scrollTo({ top: 0 });
  };

  const showToast = useCallback((t) => setToast(t), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  const toastEl = toast && (
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
  );

  if (showGetStarted) {
    return <GetStartedScreen model={model} offline={offline} offlineReady={offlineReady} install={install} onGetStarted={handleGetStarted} />;
  }

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
        <button
          ref={themeToggleRef}
          type="button"
          className="theme-toggle"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          {dark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>
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
          historyLinkRef={historyLinkRef}
          helpLinkRef={helpLinkRef}
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
              openCameraRef={openCameraRef}
              choosePhotoRef={choosePhotoRef}
            />
          )}
          {view === 'history' && (
            <HistoryScreen
              showToast={showToast}
              onFocusChange={setFocusMode}
              onGoScan={() => navigate('scan')}
            />
          )}
          {view === 'diseases' && <DiseasesScreen onBack={() => navigate('help')} />}
          {view === 'help' && (
            <HelpScreen
              onViewGuide={() => setOnboardingOpen(true)}
              onViewDiseases={() => navigate('diseases')}
            />
          )}
          {view === 'diagnostics' && <DiagnosticsScreen onBack={() => navigate('scan')} />}
        </main>
      </div>

      <nav className="bottomnav" aria-label="Main" inert={menuOpen}>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const navRef = id === 'history' ? historyNavRef : id === 'help' ? helpNavRef : undefined;
          return (
            <button
              key={id}
              ref={navRef}
              type="button"
              className="bottomnav__link"
              aria-current={view === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <OnboardingDialog open={onboardingOpen} onClose={closeOnboarding} />
      <CoachTour steps={shellTourSteps} active={shellTourActive} onFinish={finishShellTour} />

      {toastEl}
    </div>
  );
}
