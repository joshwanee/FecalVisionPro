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
 *
 * Also reports what the camera itself can do, so the screen only offers what
 * works on this phone:
 *   zoom   {min, max, step} when the camera zooms in hardware, otherwise null
 *          (the screen then zooms digitally instead)
 *   torch  true when the flashlight can be switched on from the browser
 */
export function useCamera(videoRef) {
  const [state, setState] = useState('starting');
  const [detail, setDetail] = useState('');
  const [caps, setCaps] = useState({ zoom: null, torch: false });
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef(null);
  // Each start/stop bumps this number. If an older start finishes after a newer
  // one (or after unmount), it sees the mismatch and shuts its stream down.
  const runRef = useRef(0);

  const stop = useCallback(() => {
    runRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    // Stopping the track switches the flashlight off too.
    setTorchOn(false);
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
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      if (run !== runRef.current || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop()); // superseded or unmounted
        return;
      }
      streamRef.current = stream;
      const c = stream.getVideoTracks()[0]?.getCapabilities?.() ?? {};
      setCaps({
        zoom: c.zoom && c.zoom.max > c.zoom.min ? { min: c.zoom.min, max: c.zoom.max, step: c.zoom.step || 0.1 } : null,
        torch: Array.isArray(c.torch) ? c.torch.includes(true) : Boolean(c.torch),
      });
      setTorchOn(false);
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

  /** Hardware zoom; only call when `zoom` is not null. */
  const setZoom = useCallback(async (value) => {
    const track = streamRef.current?.getVideoTracks()[0];
    try {
      await track?.applyConstraints({ advanced: [{ zoom: value }] });
    } catch {
      /* the camera refused this value: keep the previous one */
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      /* the flashlight is busy or not really available */
    }
  }, [torchOn]);

  return {
    state,
    detail,
    restart: start,
    zoomRange: caps.zoom,
    setZoom,
    torchAvailable: caps.torch,
    torchOn,
    toggleTorch,
  };
}
