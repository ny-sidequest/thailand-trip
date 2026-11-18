import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // GitHub Pages serves project sites from /<repo>/. Override with VITE_BASE.
  const base = env.VITE_BASE || '/thailand-trip/'
  // Content-Security-Policy (GitHub Pages cannot send headers, so it is a <meta> tag; production build only).
  const sb = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : ''
  const csp = [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "font-src 'self'", "img-src 'self' data: blob: https:",
    `connect-src 'self' ${sb} ${sb.replace(/^https/, 'wss')}`.trim(), `frame-src ${sb || "'none'"}`,
    "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  ].join('; ')
  return {
    base,
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [
      react(),
      {
        name: 'inject-csp',
        transformIndexHtml: { order: 'post', handler: (html, ctx) => (ctx.server ? html : html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)) },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png', 'icons/favicon.svg'],
        manifest: {
          name: 'Thailand Trip HQ',
          short_name: 'Trip HQ',
          description: 'Private group workspace for our Thailand trip',
          theme_color: '#0b1f3a',
          background_color: '#f6efe3',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: `${base}index.html`,
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // precache only the Latin font subsets (smaller offline cache)
          globIgnores: ['**/*-latin-ext-*', '**/*cyrillic*', '**/*greek*', '**/*vietnamese*'],
          // Never cache Supabase API / storage responses in the SW: private data.
          runtimeCaching: [],
        },
      }),
    ],
  }
})
