/* global process */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
        // The alternative model kept for comparison must not be downloaded by users.
        globIgnores: ['**/model-ablation/**'],
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