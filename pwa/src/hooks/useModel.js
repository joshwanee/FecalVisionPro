import { useCallback, useEffect, useState } from 'react';
import { loadModel } from '../lib/fecalvision';

/**
 * Loads the model and reports honest progress.
 *
 * stage: 'checking'    looking for a copy already saved on this phone
 *        'downloading' first launch: fetching the ~4.6 MB model (progress is real)
 *        'cached'      found on this phone, so no download is needed
 *        'warming'     one practice run so the first scan is fast
 * status: 'loading' | 'ready' | 'error'
 */
export function useModel() {
  const [state, setState] = useState({ status: 'loading', stage: 'checking', progress: 0, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    loadModel({
      onProgress: (p) => setState((s) => ({ ...s, progress: p })),
      onStage: (stage) => setState((s) => ({ ...s, stage })),
    })
      .then(() => setState((s) => ({ ...s, status: 'ready', progress: 1 })))
      .catch((e) => setState((s) => ({ ...s, status: 'error', error: e.message })));
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading', stage: 'checking', progress: 0, error: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
