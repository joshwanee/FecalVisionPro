import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Opens the rear camera and attaches it to a <video> element.
 *
 * state:
 *   'starting'    waiting for permission / camera to warm up
 *   'live'        the preview is running
 *   'denied'      the user (or browser policy) refused camera access
 *   'unavailable' no camera, or the page is not on https
 *   'error'       anything else
 *
 * The camera is switched off when the component unmounts and whenever the tab
 * is hidden, so the phone's camera light does not stay on in the background.
 * Nothing from the camera is sent anywhere; frames are only drawn to canvases.
 */
export function useCamera(videoRef) {
  const [state, setState] = useState('starting');
  const [detail, setDetail] = useState('');
  const streamRef = useRef(null);
  // Each start/stop bumps this number. If an older start finishes after a newer
  // one (or after unmount), it sees the mismatch and shuts its stream down.
  const runRef = useRef(0);

  const stop = useCallback(() => {
    runRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

  const start = useCallback(async () => {
    const run = ++runRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      setDetail(
        window.isSecureContext
          ? 'This browser cannot open the camera.'
          : 'The camera only works on a secure (https) connection.',
      );
      return;
    }

    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // "ideal" means: prefer these, but accept whatever the device offers.
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (run !== runRef.current || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop()); // superseded or unmounted
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (run === runRef.current) setState('live');
    } catch (e) {
      if (run !== runRef.current) return;
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        setState('denied');
        setDetail('Camera access was blocked. You can allow it in the browser settings, or choose a photo instead.');
      } else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
        setState('unavailable');
        setDetail('No camera was found on this device.');
      } else {
        setState('error');
        setDetail('The camera could not be started.');
      }
    }
  }, [videoRef]);

  useEffect(() => {
    // Opening the camera is syncing with an external device, which is what
    // effects are for; the state changes are just reporting how that went.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start();
    // Release the camera while the app is in the background.
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [start, stop]);

  return { state, detail, restart: start };
}
