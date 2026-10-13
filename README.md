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
