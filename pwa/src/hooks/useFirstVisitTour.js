import { useState } from 'react';

function read(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false; // storage unavailable (private mode): show it, just once per session
  }
}

function write(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* not remembered, but it has already been shown this session */
  }
}

/**
 * Has this on-screen guide already been shown on this device? Used to show a
 * CoachTour exactly once per device (per key), the same pattern as onboarding.
 */
export function useFirstVisitTour(key) {
  const [seen, setSeen] = useState(() => read(key));
  const markSeen = () => {
    write(key);
    setSeen(true);
  };
  return [seen, markSeen];
}
