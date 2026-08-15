import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base берётся из переменной окружения VITE_BASE_PATH, которую
// подставляет GitHub Actions (см. .github/workflows/deploy.yml) —
// значение равно "/<имя-репозитория>/". Локально (npm run dev) base = "/".
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Findly',
        short_name: 'Findly',
        description: 'Findly — кросс-платформенный мессенджер',
        theme_color: '#4A46E0',
        background_color: '#FCFAFF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Кешируем интерфейс приложения на устройстве; сами данные (чаты,
        // сообщения) всегда идут напрямую в Supabase, не кешируются.
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg}'],
      },
    }),
  ],
  base: process.env.VITE_BASE_PATH || '/',
})
