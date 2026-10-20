import { useEffect, useRef } from 'react';
import { useTheme } from '../hooks/useTheme';
import { MoonIcon, SunIcon, InfoIcon } from './icons';

const styles = {
  container: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1.5rem',
  },
  hero: {
    width: '100%',
    maxWidth: '480px',
    textAlign: 'center',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: '0 0 4px',
  },
  tagline: {
    fontSize: '12px',
    letterSpacing: '2px',
    fontWeight: 600,
    margin: '0 0 24px',
  },
  description: {
    fontSize: '14px',
    lineHeight: 1.7,
    margin: '0 auto 32px',
    maxWidth: '380px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '32px',
  },
  btnGoogle: {
    width: '100%',
    height: '50px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  btnGuest: {
    width: '100%',
    height: '50px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  gridCard: {
    borderRadius: '12px',
    padding: '20px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  cardText: {
    fontSize: '11px',
    letterSpacing: '0.5px',
    fontWeight: 600,
  },
  footer: {
    marginTop: '40px',
    fontSize: '12px',
  },
};

/**
 * Landing page — the first screen every visitor sees.
 *
 * Offers Login with Google, Continue as Guest, a 2×2 feature grid,
 * plus Tutorial and dark/light mode toggles in the top-right corner.
 */
export default function LandingPage({
  onLoginGoogle,
  authError,
  signingIn,
  onContinueGuest,
  onViewGuide,
}) {
  const titleRef = useRef(null);
  const [theme, toggleTheme] = useTheme();
  const dark = theme === 'dark';

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="lp" style={styles.container}>
      {/* Top-right controls */}
      <div className="lp__topbar">
        <button
          type="button"
          className="lp__topbtn"
          onClick={onViewGuide}
        >
          <InfoIcon size={18} />
          <span>Tutorial</span>
          
        </button>
        <button
          type="button"
          className="lp__theme-toggle"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          {dark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>
      </div>

      <div className="lp__hero" style={styles.hero}>
        <h1 ref={titleRef} tabIndex={-1} className="lp__title" style={styles.title}>
          FecalVision
        </h1>
        <p className="lp__tagline" style={styles.tagline}>SCAN IT. KNOW IT. SOLVE IT.</p>

        <p className="lp__desc" style={styles.description}>
          Insights at your fingertips. Instantly diagnose flock health, access treatment guides,
          and monitor coop sanitation with our AI-powered diagnostics engine.
        </p>

        <div style={styles.actions}>
          <button
            className="lp__btn-google"
            style={styles.btnGoogle}
            onClick={onLoginGoogle}
            disabled={signingIn}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            {signingIn ? 'Signing in…' : 'Login with Google'}
          </button>

          {authError && (
            <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: '13px', lineHeight: 1.5 }}>
              {authError}
            </p>
          )}

          <button className="lp__btn-guest" style={styles.btnGuest} onClick={onContinueGuest}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Continue as Guest
          </button>
        </div>

        <div style={styles.grid}>
          <div className="lp__card" style={styles.gridCard}>
            <svg className="lp__card-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="lp__card-text" style={styles.cardText}>REAL-TIME DETECTION</span>
          </div>

          <div className="lp__card" style={styles.gridCard}>
            <svg className="lp__card-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span className="lp__card-text" style={styles.cardText}>DIAGNOSTIC VISUALIZATION</span>
          </div>

          <div className="lp__card" style={styles.gridCard}>
            <svg className="lp__card-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="lp__card-text" style={styles.cardText}>STEP-BY-STEP GUIDES</span>
          </div>

          <div className="lp__card" style={styles.gridCard}>
            <svg className="lp__card-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3" />
              <path d="M3.05 11a9 9 0 1 1 .5 4" />
              <polyline points="3 4 3.05 11 10 10.5" />
            </svg>
            <span className="lp__card-text" style={styles.cardText}>SCAN HISTORY</span>
          </div>
        </div>
      </div>

      <footer className="lp__footer" style={styles.footer}>
        © 2026 FecalVision
      </footer>
    </div>
  );
}
