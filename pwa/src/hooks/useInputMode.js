import { useCallback, useState } from 'react';
import { ACTIVE_MODEL } from '../content/models';
import { DEFAULT_INPUT_MODE, INPUT_MODES } from '../lib/analysisInput';
import { MODEL_DIR } from '../lib/fecalvision';

// The choice is remembered per model: what suits one model (whole photos) is
// wrong for another (close-up crops), so switching models must not carry it over.
const KEY = `fecalvision-input-mode:${MODEL_DIR}`;

// Until the user chooses, use what the model was trained for.
const DEFAULT = ACTIVE_MODEL.defaultInput in INPUT_MODES ? ACTIVE_MODEL.defaultInput : DEFAULT_INPUT_MODE;

function read() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved in INPUT_MODES ? saved : DEFAULT;
  } catch {
    return DEFAULT; // storage unavailable (private mode)
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
