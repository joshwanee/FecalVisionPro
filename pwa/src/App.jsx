import { useEffect, useState } from 'react';
import '@fontsource/bitter/latin-600.css';
import '@fontsource/bitter/latin-800.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import ScanScreen from './components/ScanScreen';
import './tokens.css';
import './styles.css';

/**
 * App shell: header with the network indicator, the current screen, and a
 * veterinary-referral strip that is ALWAYS visible (it is not tied to any
 * result or confidence level).
 */
export default function App() {
  const [offline, setOffline] = useState(!navigator.onLine);

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

  return (
    <div className="app">
      <header className="app__bar">
        <span className="app__mark">FecalVision</span>
        <span className={offline ? 'app__net app__net--off' : 'app__net'} role="status">
          {offline ? 'Offline: works normally' : 'Online'}
        </span>
      </header>

      <main className="app__main">
        <ScanScreen />
      </main>

      <aside className="vet" aria-label="Veterinary referral">
        <strong>Screening aid, not a diagnosis.</strong> Have a veterinarian confirm before
        treating birds.
      </aside>
    </div>
  );
}
