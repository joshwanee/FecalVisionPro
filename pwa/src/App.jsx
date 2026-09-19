import { useEffect, useState } from 'react';
import ScanScreen from './components/ScanScreen';
import './styles.css';

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
      <nav className="app__bar">
        <span className="app__mark">FecalVision</span>
        <span className={offline ? 'app__net app__net--off' : 'app__net'}>
          {offline ? 'Offline' : 'Online'}
        </span>
      </nav>
      <ScanScreen />
    </div>
  );
}