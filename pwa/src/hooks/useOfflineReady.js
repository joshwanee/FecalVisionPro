import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const FLAG = 'fecalvision-precached';

/** localStorage can be unavailable (private mode); never let that break the app. */
function readFlag() {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * Is the app genuinely ready to work with no internet?
 * That needs BOTH: the service worker has saved every app file (its "precache",
 * reported by onOfflineReady) AND the model has loaded from this phone's
 * storage. Only then do we tell the user they can rely on it in the coop.
 */
export function useOfflineReady(modelReady) {
  const supported = 'serviceWorker' in navigator;
  const [precached, setPrecached] = useState(readFlag);

  useEffect(() => {
    if (!supported) return;
    registerSW({
      immediate: true,
      onOfflineReady() {
        try {
          localStorage.setItem(FLAG, '1');
        } catch {
          /* fine: it is simply detected again next launch */
        }
        setPrecached(true);
      },
    });
  }, [supported]);

  return { supported, precached, ready: supported && precached && modelReady };
}
