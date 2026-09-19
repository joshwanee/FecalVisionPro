import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Test the service worker with `npm run dev` too, not just after a build.
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FecalVision',
        short_name: 'FecalVision',
        description:
          'On-device screening of chicken droppings for signs of common poultry diseases',
        theme_color: '#1f3a2e',
        background_color: '#faf9f6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The weight shards are a few MB each; Workbox skips large files by default.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,bin}'],
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