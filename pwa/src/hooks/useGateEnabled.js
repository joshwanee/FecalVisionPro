import { useCallback, useState } from 'react';

const KEY = 'fecalvision-gate';

function read() {
  try {
    return localStorage.getItem(KEY) !== 'off'; // on unless turned off
  } catch {
    return true; // storage unavailable (private mode)
  }
}

/** Whether the dropping check runs before each diagnosis; remembered on this phone. */
export function useGateEnabled() {
  const [enabled, setEnabled] = useState(read);
  const update = useCallback((next) => {
    setEnabled(next);
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      /* not remembered, but still applied for this session */
    }
  }, []);
  return [enabled, update];
}
