// GitHub Pages has no SPA rewrites: serve index.html for unknown paths via 404.html.
import { copyFileSync } from 'node:fs'
copyFileSync('dist/index.html', 'dist/404.html')
console.log('dist/404.html created (SPA fallback)')
