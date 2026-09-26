import { useState } from 'react';
import TutorialDialog from './TutorialDialog';
import {
  CubeIcon,
  DocIcon,
  DownloadIcon,
  InfoIcon,
  LoginIcon,
  MenuIcon,
  MoonIcon,
  RewindIcon,
  SearchIcon,
  SunIcon,
  UserIcon,
} from './icons';

/** The four things the app does; each card opens the matching screen. */
const FEATURES = [
  { id: 'detect', label: 'Real-time detection', Icon: SearchIcon, view: 'scan' },
  { id: 'visual', label: 'Diagnostic visualization', Icon: CubeIcon, view: 'scan' },
  { id: 'guides', label: 'Treatment guides', Icon: DocIcon, view: 'help' },
  { id: 'history', label: 'Scan history', Icon: RewindIcon, view: 'history' },
];

/**
 * Landing screen, shown first whenever the app opens.
 *
 *  - menu button (top left) that reveals the sidebar with every other page
 *  - Tutorial (a step-by-step dialog) and light/dark switch (top right)
 *  - name, tagline and a one-line description
 *  - sign in, continue as guest, install
 *  - the four features, each a shortcut into the app
 */
export default function HomeScreen({
  install,
  theme,
  onToggleTheme,
  onLogin,
  onEnter,
  menuOpen,
  onOpenMenu,
  menuButtonRef,
}) {
  const [iosHelp, setIosHelp] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const dark = theme === 'dark';

  const onInstall = () => {
    if (install.canPrompt) install.install();
    else if (install.showIosHelp) setIosHelp((shown) => !shown);
  };

  return (
    <div className="home" inert={menuOpen}>
      <button
        ref={menuButtonRef}
        type="button"
        className="home__menu"
        aria-label="Open menu"
        aria-expanded={menuOpen}
        aria-controls="menu"
        onClick={onOpenMenu}
      >
        <MenuIcon />
      </button>

      <div className="home__corner">
        <button type="button" className="home__tutorial" onClick={() => setTutorialOpen(true)}>
          <InfoIcon size={18} /> Tutorial
        </button>
        <button
          type="button"
          className="home__theme"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={onToggleTheme}
        >
          {dark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>
      </div>

      <main className="home__main">
        <header className="home__brand">
          <h1 className="home__wordmark">FecalVision</h1>
          <p className="home__tagline">From droppings to decisions</p>
        </header>

        <p className="home__intro">
          Instantly diagnose flock health, access treatment guides, and monitor coop sanitation with our
          AI-powered diagnostics engine.
        </p>

        <div className="home__actions">
          <button type="button" className="home__button home__button--primary" onClick={onLogin}>
            <LoginIcon size={20} /> Login with Google
          </button>
          <button type="button" className="home__button home__button--outline" onClick={() => onEnter('scan')}>
            <UserIcon size={20} /> Continue as Guest
          </button>
          {!install.installed && (
            <button
              type="button"
              className="home__button home__button--muted"
              onClick={onInstall}
              disabled={!install.canPrompt && !install.showIosHelp}
              aria-expanded={install.showIosHelp ? iosHelp : undefined}
            >
              <DownloadIcon /> Add to Home Screen
            </button>
          )}
          {iosHelp && (
            <p className="home__hint" role="status">
              In Safari, tap Share, then <strong>Add to Home Screen</strong>.
            </p>
          )}
        </div>

        <ul className="home__features" aria-label="Features">
          {FEATURES.map(({ id, label, Icon, view }) => (
            <li key={id}>
              <button type="button" className="home__feature" onClick={() => onEnter(view)}>
                <Icon size={22} />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      <TutorialDialog
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onFinish={() => {
          setTutorialOpen(false);
          onEnter('scan');
        }}
      />
    </div>
  );
}
