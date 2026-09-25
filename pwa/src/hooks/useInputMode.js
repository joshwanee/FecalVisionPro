import { useCallback, useState } from 'react';
import { DEFAULT_INPUT_MODE, INPUT_MODES } from '../lib/analysisInput';

const KEY = 'fecalvision-input-mode';

function read() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved in INPUT_MODES ? saved : DEFAULT_INPUT_MODE;
  } catch {
    return DEFAULT_INPUT_MODE; // storage unavailable (private mode)
  }
}

/** Which part of the photo the model analyses; remembered on this phone. */
export function useInputMode() {
  const [mode, setMode] = useState(read);
  const update = useCallback((next) => {
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* not remembered, but still applied for this session */
    }
  }, []);
  return [mode, update];
}
