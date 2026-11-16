import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH: "/" na Vercel; "/nome-do-repo/" no GitHub Pages (o workflow já define).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Minha Estante',
        short_name: 'Estante',
        description: 'Portfólio e planner de leitura',
        lang: 'pt-BR',
        theme_color: '#4F6B47',
        background_color: '#F4EFE1',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/auth/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'capas', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 60 } }
          }
        ]
      }
    })
  ]
});
