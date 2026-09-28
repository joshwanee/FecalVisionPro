/* global process */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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

export default defineConfig({
  define: {
    __APP_BUILD__: JSON.stringify(`${commitId()} \u00b7 ${new Date().toISOString().slice(0, 16)}Z`),
  },
  plugins: [
    react(),
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,bin,woff2}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
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
});