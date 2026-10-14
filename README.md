# FecalVision

**From droppings to decisions.** FecalVision is a mobile web app that screens photos of chicken droppings for signs of three common poultry diseases. It runs entirely on the phone: photos are never uploaded, and once it has been opened online one time it works with no signal, in the coop.

> FecalVision is a screening aid, not a diagnosis. Always have a veterinarian confirm a result before treating birds, and call one straight away if birds are sick or dying.

## What it detects

The model sorts a dropping photo into one of four classes:

| Class | What the dropping typically looks like |
| --- | --- |
| Healthy | Brown, firm, with a white urate cap |
| Coccidiosis | Bloody or red-tinged |
| Newcastle Disease | Greenish and watery |
| Salmonella | Whitish or greenish, chalky |

The app's **Disease guide** (under Help) explains each disease: general signs, how it spreads, and how to tell them apart.

## How a scan works

1. **Live photo checks.** While the camera is open, the app checks light, focus and distance a few times per second and says what to fix before you take the photo.
2. **Dropping check.** A small model first asks *"is there a chicken dropping in this photo at all?"*, so a photo of a shoe or a hand is refused instead of being given a disease name.
3. **Disease model.** A MobileNetV2-based classifier scores the four classes.
4. **Honest answers.** The app only names a result when it is at least 90% confident. Otherwise it says *"Not clear enough to call"* and suggests how to retake the photo. It also flags close calls between two classes.
5. **History.** Every scan is saved on the phone with its photo and scores. You can filter, select, export (CSV, ZIP with photos, or JSON) or delete scans.

## Results

These are the results of the model the app ships, measured on test photos it never saw during training:

| Measure | Result |
| --- | --- |
| Overall accuracy (all test photos) | 95.0% |
| Macro F1 score | 0.944 |
| Accuracy when it gives an answer (≥ 90% confidence) | 99.4% |

The dropping check was tuned on validation photos to let through 98% of real droppings, and it rejected 89% of photos without one.

## Features

- Works fully **offline** after the first visit. The models, about 5 MB in total, are stored on the phone.
- **Installable** on Android, iPhone and desktop, so it opens like a normal app.
- **Private.** Analysis happens on the phone. There is no account, and nothing is uploaded.
- Camera **zoom** and **flashlight** (where the phone allows it), or pick an existing photo from the gallery.
- Shareable result reports.
- Light and dark mode, a first-time guided tour, and large touch targets for use with one hand.

## How it works

### Overview

FecalVision is a **static web app**. The server (Vercel) only hands out files: HTML, JavaScript, CSS, icons, the trained models and the WebAssembly binaries. Everything else happens inside the browser on the phone:

```text
            ┌───────────────────────── Vercel (HTTPS) ─────────────────────────┐
            │  index.html · JS/CSS bundle · icons · models (.json/.bin) · .wasm │
            └───────────────────────────────┬──────────────────────────────────┘
                                            │ downloaded once, on the first online visit
                                            ▼
┌──────────────────────────────────── The phone ─────────────────────────────────────┐
│                                                                                     │
│  Service worker (Workbox) ── keeps a copy of every app file in Cache Storage        │
│          │                    and answers requests from it when there is no signal  │
│          ▼                                                                          │
│  React UI ──► Camera (getUserMedia) ──► Canvas: quality checks, crop, resize        │
│                                               │                                     │
│                                               ▼                                     │
│                         TensorFlow.js (WebGL GPU or WASM CPU)                       │
│                           1. dropping check model  ──► "is this a dropping?"        │
│                           2. disease model         ──► 4 class scores               │
│                                               │                                     │
│                                               ▼                                     │
│  IndexedDB: scan history + cached model weights     localStorage: small settings    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

There is no API call during a scan, so a scan works the same with or without internet.

### What happens during a scan

| Step | What happens | Technology doing it |
| --- | --- | --- |
| 1. Open the camera | The browser asks for camera permission and streams live video. Zoom and flashlight are used if the phone supports them. | `getUserMedia` (needs HTTPS, which Vercel provides) |
| 2. Live photo checks | A few times per second, a frame is drawn to a small canvas and checked for brightness, sharpness and distance. The app tells you what to fix. | Canvas API ([src/lib/quality.js](pwa/src/lib/quality.js)) |
| 3. Prepare the photo | The photo is decoded, centre-cropped to a square and resized to 224 × 224 pixels. | Canvas API ([src/lib/analysisInput.js](pwa/src/lib/analysisInput.js)) |
| 4. Dropping check | The small gate model gives a "dropping or not" score. Below the threshold, the photo is refused, though the user can choose to analyse it anyway. | TensorFlow.js ([src/lib/gate.js](pwa/src/lib/gate.js)) |
| 5. Disease model | The MobileNetV2 classifier scores the four classes. The scores are calibrated (temperature scaling) so the confidence shown is realistic. | TensorFlow.js ([src/lib/fecalvision.js](pwa/src/lib/fecalvision.js)) |
| 6. Decide what to say | At ≥ 90% confidence the app names the class. Below that it says "Not clear enough to call" and gives retake tips. | React ([src/components/ResultPanel.jsx](pwa/src/components/ResultPanel.jsx)) |
| 7. Save | The result, a small copy of the photo and all four scores are stored on the phone. | IndexedDB ([src/lib/history.js](pwa/src/lib/history.js)) |

### How each part of the stack fits in

- **React** draws every screen (Scan, History, Help, Disease guide, Diagnostics) and re-renders them as state changes, for example when the model finishes loading or a result arrives. Custom hooks in [pwa/src/hooks/](pwa/src/hooks/) keep browser features (camera, install, theme, offline status) apart from the screens.
- **Vite** is only used while developing and building. `npm run build` turns the JSX and CSS into small, optimised files in `dist/`, and those files are what Vercel serves. Vite isn't part of the running app.
- **TensorFlow.js** runs the two trained models in the browser. It can compute on the **GPU through WebGL** (fast) or the **CPU through WebAssembly** (slower, but always full precision). Many phone GPUs round numbers to lower precision, which can change a close result. So on first launch, [src/lib/backend.js](pwa/src/lib/backend.js) runs the same test inputs on both and only keeps WebGL if its answers match. The choice is saved, so the test runs once per device.
- **Python + TensorFlow** are used only on the developers' computers, to train, evaluate and calibrate the models. The **TensorFlow.js Converter** then exports them as `model.json` plus binary weight files, which go into `pwa/public/`.
- **IndexedDB** is the browser's built-in database. It holds the scan history (photos included) and a second copy of the model weights. The app also asks the browser for persistent storage (`navigator.storage.persist()`) so records aren't deleted when the phone runs low on space.
- **localStorage** holds small values: theme, which tours were seen, the chosen TF.js backend, and whether the offline download has finished.
- **The service worker, Workbox and the Web App Manifest** make the app work offline and installable. See the next section.
- **Vercel** serves the built files over HTTPS. HTTPS is needed for the camera and for service workers. [pwa/vercel.json](pwa/vercel.json) also sends every URL to `index.html`, and it turns on cross-origin isolation, which is why every file, the font included, is self-hosted.

### How the PWA works offline

A **Progressive Web App (PWA)** is a website that can also behave like an installed app. Two browser features make this possible:

1. **Service worker.** A script the browser keeps running in the background for this site, separate from the page. It sits between the app and the network and can answer any request from its own saved copy. FecalVision's service worker is generated at build time by **vite-plugin-pwa** using **Workbox**. It is registered on the first visit ([src/hooks/useOfflineReady.js](pwa/src/hooks/useOfflineReady.js)).
2. **Web App Manifest.** A file that gives the app its name, icons, colours and `display: standalone` mode (no browser address bar). It is defined in [pwa/vite.config.js](pwa/vite.config.js).

#### First visit (needs internet, once)

1. The page loads normally from Vercel.
2. The service worker installs and **precaches** every file the app needs into the browser's Cache Storage: HTML, JS, CSS, icons, the font, the two models in use (about 5 MB) and the `.wasm` files. Old comparison models in `public/` are left out on purpose (`EXCLUDED_MODEL_GLOBS` in `vite.config.js`).
3. The disease model is loaded and also saved into IndexedDB. The dropping-check model is saved the same way.
4. When the precache is complete **and** the model has loaded from the phone's own storage, the status pill changes to **"Works offline"**. From then on the app doesn't need the internet.

#### Later visits, with or without signal

- The service worker answers every request from the cache, so the app opens straight away even in airplane mode. Any URL (for example `/history`) falls back to the cached `index.html`, so every screen works offline.
- Models load from IndexedDB first (`indexeddb://…`). If that copy is missing, they're fetched from `/model-…/`, and the service worker serves those files from its cache too. The two copies back each other up.
- Scans, history, export and the disease guide all work offline. Only sharing to other apps may need a connection, depending on the app you share to.

#### Updates

The service worker uses `registerType: 'autoUpdate'`. When the phone is online, it checks for a newer build in the background, downloads it, and the new version is used **the next time the app is opened**. Scan history is not affected, because it lives in IndexedDB rather than in the app files. The build id under menu → Diagnostics shows which version is running.

#### In the browser vs. installed

Offline mode works the same way in both. The service worker and storage belong to the website's address, not to the icon. What changes is how you open it and how safe the stored data is:

| | In a browser tab | Installed to the home screen / desktop |
| --- | --- | --- |
| How to open it offline | Type or bookmark the same address in the **same browser** | Tap the app icon |
| Window | Normal browser tab with an address bar | Own full-screen window with no browser bar (`display: standalone`), listed among the phone's apps |
| Offline files and models | Cached by the service worker | Same cache, same service worker |
| Scan history | Stored in that browser's IndexedDB | **Android / desktop:** shared with the browser (same Chrome/Edge storage). **iPhone/iPad:** the installed app has its own storage, separate from Safari, so scans made in Safari don't show up in the installed app |
| Risk of the browser deleting data | Higher. Safari can clear a site's stored data after about 7 days without a visit, and any browser may clear it when the phone runs low on space | Lower. Installed apps are treated as more important, and persistent storage is more likely to be granted |

**Recommendation:** install the app before relying on it in the field.

#### How installing works

- **Android, desktop Chrome and Edge:** when the site qualifies (HTTPS, manifest, service worker), the browser fires a `beforeinstallprompt` event. [src/hooks/useInstall.js](pwa/src/hooks/useInstall.js) holds on to it and shows an **Install** button in the menu, which opens the browser's install dialog.
- **iPhone and iPad:** Safari doesn't offer an install prompt, so the app shows instructions instead: **Share → Add to Home Screen**.
- Once installed, the app detects that it's running standalone (`display-mode: standalone`) and hides the install button.

## Repository layout

```text
FecalVisionPro2/
├── README.md        this file
└── pwa/             the web app (React + Vite + TensorFlow.js)
    ├── public/      trained models, icons, WebAssembly files
    ├── src/         app source code
    └── scripts/     helper scripts (icon generation, WASM copy)
```

The model training pipeline is not part of this repository. Only the exported, trained models are included.

## Running it

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
cd pwa
npm install
npm run dev
```

Then open the address it prints (usually `http://localhost:5173`). To test on a phone with its real camera, see [pwa/README.md](pwa/README.md).

## Tech stack

### Frontend

| Technology | Used for |
| --- | --- |
| [React 19](https://react.dev/) | User interface |
| JavaScript (ES modules, JSX) | Programming language |
| HTML5 + CSS3 | Layout and styling (custom CSS with design tokens, light and dark themes; no UI framework) |
| [Inter](https://rsms.me/inter/) via Fontsource | Typeface, self-hosted so it works offline |
| Browser camera API (`getUserMedia`) | Live camera, zoom and flashlight |
| Canvas API | Photo quality checks, cropping, the shareable report image |
| Web Share API | Sharing results to other apps |

### Machine learning

| Technology | Used for |
| --- | --- |
| [TensorFlow](https://www.tensorflow.org/) 2.20 (Python) | Training the models |
| MobileNetV2 | Base architecture of both models (transfer learning) |
| TensorFlow.js Converter 4.22 | Converting the trained models to run in a browser |
| [TensorFlow.js](https://www.tensorflow.org/js) 4.22 | Running the models on the phone |
| WebGL and WebAssembly (WASM) backends | Running the models on the GPU, or on the CPU at full precision when the GPU is not accurate enough |

The app runs two models: a **disease classifier** (4 classes, about 4.4 MB) and a **dropping check** (MobileNetV2 at 0.35 width, about 0.9 MB).

### Backend

The backend has two parts:

- **Machine learning (Python)**, run on the developers' computers. This is where the models are trained, tested, calibrated and exported for the app.
- **Hosting and storage.** There is **no API server** and **no database server**, by design. Every scan is analysed on the phone, and photos never leave it. That is what lets the app work offline in the coop and keeps farm data private.

| Technology | Used for |
| --- | --- |
| [Python](https://www.python.org/) | Language of the machine-learning pipeline: preparing the dataset, training, evaluation and calibration |
| TensorFlow 2.20 + TensorFlow.js Converter | Training the models in Python and exporting them for the app (see Machine learning above) |
| [Vercel](https://vercel.com/) | Static hosting of the built app over HTTPS |
| IndexedDB (in the browser) | Scan history and cached model weights, stored on the phone only |
| localStorage (in the browser) | Small settings: theme, tours already seen |

### Offline and installable app (PWA)

| Technology | Used for |
| --- | --- |
| Progressive Web App (PWA) | Installing to the home screen on Android, iPhone and desktop |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) + Workbox | Service worker that stores the app and models for offline use |
| Web App Manifest | App name, icons and colours when installed |

### Development tools

| Technology | Used for |
| --- | --- |
| [Node.js](https://nodejs.org/) + npm | Running the build tools and managing packages |
| [Vite](https://vite.dev/) 8 | Development server and production build |
| ESLint | Checking code for mistakes |
| sharp | Generating the app icons from the logo |
| Git + GitHub | Version control |
| Visual Studio Code | Code editor |
