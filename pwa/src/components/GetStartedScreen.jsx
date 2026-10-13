import { useEffect, useRef } from 'react';
import { InstallPanel, ModelStatus } from './StatusPanels';

/**
 * First-launch landing page, shown exactly once per device before the app
 * settles into its normal Scan-first shell. Loading already starts the
 * moment the app opens - useModel() runs in App.jsx regardless of which
 * screen is shown - so this page just surfaces that real progress and offers
 * to install while the farmer reads it; nothing here blocks on it finishing.
 */
export default function GetStartedScreen({ model, offline, offlineReady, install, onGetStarted }) {
  const titleRef = useRef(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="get-started">
      <div className="get-started__card">
        <h1 ref={titleRef} tabIndex={-1} className="get-started__brand">
          FecalVision
        </h1>
        <p className="get-started__intro">
          Check a chicken dropping for signs of disease, right on your phone. Works offline once
          it&rsquo;s set up.
        </p>

        <ModelStatus model={model} offline={offline} offlineReady={offlineReady} />
        <InstallPanel install={install} />

        <button type="button" className="button button--big button--primary" onClick={onGetStarted}>
          Get started
        </button>
      </div>
    </div>
  );
}
