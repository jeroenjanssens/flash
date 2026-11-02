import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const BASE = '/'
/** The GitHub Actions run number that built this version (set in CI), or "dev". */
const VERSION = process.env.FLASH_VERSION || 'dev'

/** Write version.json, which the app fetches to see whether a newer version is out. */
function versionFile(): Plugin {
  return {
    name: 'flash-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: VERSION }),
      })
    },
  }
}

export default defineConfig({
  base: BASE,
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [
    svelte(),
    versionFile(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Flash — flashcards',
        short_name: 'Flash',
        description: 'Flashcards with spaced repetition, made for kids.',
        lang: 'nl',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#fff8ef',
        theme_color: '#3b5bdb',
        categories: ['education', 'kids'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app shell and the built-in decks; decks from the library live in IndexedDB.
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,webp,mp3,json}'],
        globIgnores: ['**/node_modules/**', 'version.json'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
})
