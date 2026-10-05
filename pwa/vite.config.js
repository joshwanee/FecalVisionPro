/* global process */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Commit id for the build stamp: Vercel provides it; locally ask git.
function commitId() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

/**
 * public/ holds four model folders, but the app only ever offers three of
 * them to switch between (see src/content/models.js and the "Classification
 * model" picker in the menu). model-ablation is a leftover comparison
 * experiment from training, never shown in the app, so it is the only one
 * left out of the offline download. The three real models are ALL precached
 * - not just whichever one a phone happens to use first - so switching
 * models in the menu keeps working even with no connection at all.
 */
const EXCLUDED_MODEL_GLOBS = ['**/model-ablation/**'];

// The WASM backend can use multiple CPU threads, but only inside a
// "cross-origin isolated" page - a browser security mode a site opts into by
// promising it embeds nothing from another origin (true here: everything is
// self-hosted, confirmed by the absence of any CDN reference in this app).
// These two headers are what turn that mode on. Without them WASM still
// works, just single-threaded and therefore slower - it never fails outright.
const CROSS_ORIGIN_ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

// `npm run dev:phone` (mode "phone"): serve over https on the local network,
// so a phone can open the dev server and still use the camera. Browsers only
// allow the camera on https or localhost. The certificate is self-signed, so
// the browser warns once; choose "Advanced" then "Proceed".
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD__: JSON.stringify(`${commitId()} \u00b7 ${new Date().toISOString().slice(0, 16)}Z`),
  },
  server: { host: mode === 'phone' ? true : undefined, headers: CROSS_ORIGIN_ISOLATION_HEADERS },
  preview: { host: mode === 'phone' ? true : undefined, headers: CROSS_ORIGIN_ISOLATION_HEADERS },
  plugins: [
    react(),
    mode === 'phone' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      // Test the service worker with `npm run dev` too, not just after a build.
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'FecalVision',
        short_name: 'FecalVision',
        description:
          'On-device screening of chicken droppings for signs of common poultry diseases. Works offline.',
        theme_color: '#ffffff', // matches the top bar (--surface in src/tokens.css)
        background_color: '#f4f6f3', // --bg
        display: 'standalone',
        // No orientation lock: the capture screen has a landscape layout.
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // All three selectable models are downloaded for offline use (see
        // EXCLUDED_MODEL_GLOBS above).
        globIgnores: EXCLUDED_MODEL_GLOBS,
        // The weight shards are a few MB each; Workbox skips large files by default.
        // wasm: the WebAssembly backend's binaries (see src/lib/backend.js) must be
        // precached too, or a device that goes offline before its first successful
        // online launch would have no full-precision fallback to use.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,bin,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/model/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fecalvision-model-v1',
              expiration: { maxEntries: 40 },
            },
          },
        ],
      },
    }),
  ],
}));
