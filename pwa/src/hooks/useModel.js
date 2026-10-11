import { useCallback, useEffect, useState } from 'react';
import { loadModel } from '../lib/fecalvision';
import { loadGate } from '../lib/gate';

/**
 * Loads the disease model, then the dropping-check gate, and reports honest
 * progress for both as one sequence.
 *
 * The gate is loaded strictly AFTER the disease model (not in parallel):
 * TF.js has one active backend for the whole page, not one per model, and the
 * disease model's own loading already measures and chooses that backend (see
 * selectBackend() in backend.js). Waiting means the gate runs on that same,
 * already-chosen backend for free, instead of needing a second self-test.
 *
 * gate.js fails open on its own (checkDropping() always resolves, even if the
 * gate never loaded), so a gate failure here is swallowed: the app still
 * becomes 'ready' and scans normally, just without the dropping check.
 *
 * stage: 'checking'    looking for a copy already saved on this phone
 *        'downloading' first launch: fetching the ~4.6 MB model (progress is real)
 *        'cached'      found on this phone, so no download is needed
 *        'testing'     measuring whether this device's WebGL can be trusted
 *                       (see src/lib/backend.js); skipped on later launches,
 *                       once the result is cached
 *        'warming'     one practice run so the first scan is fast
 *        'gate'        loading the separate, much smaller dropping-check model
 * status: 'loading' | 'ready' | 'error'
 */
export function useModel() {
  const [state, setState] = useState({ status: 'loading', stage: 'checking', progress: 0, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadModel({
          onProgress: (p) => !cancelled && setState((s) => ({ ...s, progress: p })),
          onStage: (stage) => !cancelled && setState((s) => ({ ...s, stage })),
        });
        if (cancelled) return;

        setState((s) => ({ ...s, stage: 'gate' }));
        try {
          await loadGate();
        } catch {
          // Recorded inside gate.js for the diagnostics screen; the disease
          // model is what matters for 'ready', so this is not fatal here.
        }

        if (!cancelled) setState((s) => ({ ...s, status: 'ready', progress: 1 }));
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, status: 'error', error: e.message }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading', stage: 'checking', progress: 0, error: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
