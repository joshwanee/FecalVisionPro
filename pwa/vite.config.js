/* global process */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

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
 * public/ holds several trained models but the app loads only ONE, named by
 * MODEL_DIR in src/lib/fecalvision.js. Phones save everything the service worker
 * "precaches" for offline use, so the models that are NOT in use are left out
 * (about 4.4 MB each). They are still deployed; they just are not downloaded.
 * If MODEL_DIR cannot be read, nothing is excluded, which is the safe direction.
 */
function unusedModelGlobs() {
  try {
    const source = readFileSync('src/lib/fecalvision.js', 'utf8');
    const active = source.match(/^export const MODEL_DIR = '\/([^']+)'/m)[1];
    return readdirSync('public')
      .filter((name) => name.startsWith('model') && name !== active)
      .map((name) => `**/${name}/**`);
  } catch {
    return [];
  }
}

<<<<<<< HEAD
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

export default defineConfig({
=======
// `npm run dev:phone` (mode "phone"): serve over https on the local network,
// so a phone can open the dev server and still use the camera. Browsers only
// allow the camera on https or localhost. The certificate is self-signed, so
// the browser warns once; choose "Advanced" then "Proceed".
export default defineConfig(({ mode }) => ({
  server: mode === 'phone' ? { host: true } : undefined,
  preview: mode === 'phone' ? { host: true } : undefined,
>>>>>>> 340299129f19cb0b64ffdc043d6c8e60c4c1f011
  define: {
    __APP_BUILD__: JSON.stringify(`${commitId()} \u00b7 ${new Date().toISOString().slice(0, 16)}Z`),
  },
  server: { headers: CROSS_ORIGIN_ISOLATION_HEADERS },
  preview: { headers: CROSS_ORIGIN_ISOLATION_HEADERS },
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
        // Only the model in use is downloaded for offline use (see unusedModelGlobs).
        globIgnores: unusedModelGlobs(),
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
