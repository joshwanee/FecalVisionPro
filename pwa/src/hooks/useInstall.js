import { useCallback, useEffect, useState } from 'react';

/** True when the app runs as an installed app rather than in a browser tab. */
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // iOS Safari's own flag
  );
}

/** iPhone/iPad, where browsers never fire beforeinstallprompt. */
function isIos() {
  const ua = window.navigator.userAgent;
  const iPhoneOrPod = /iphone|ipod/i.test(ua);
  // iPads report themselves as Macs, but a real Mac has no touch screen.
  const iPad = /ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iPhoneOrPod || iPad;
}

/**
 * Install handling.
 *   canPrompt   : the browser offered its install prompt (Chrome/Edge/Android)
 *   showIosHelp : iOS, where the user must use Share, then Add to Home Screen
 *   installed   : already installed, so every install affordance is hidden
 */
export function useInstall() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault(); // stop the browser's own mini-bar; we show our own button
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const media = window.matchMedia('(display-mode: standalone)');
    const onMode = () => setInstalled(isStandalone());

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    media.addEventListener('change', onMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener('change', onMode);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // a prompt event can only be used once
    if (outcome === 'accepted') setInstalled(true);
  }, [deferred]);

  return {
    installed,
    canPrompt: !installed && deferred !== null,
    showIosHelp: !installed && isIos(),
    install,
  };
}
