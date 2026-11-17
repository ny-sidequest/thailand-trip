import sharp from 'sharp'
import { readFileSync } from 'node:fs'
const svg = readFileSync('public/icons/favicon.svg')
await sharp(svg).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/icons/icon-512.png')
// maskable: full-bleed background with the glyph inside the safe zone
const bg = sharp({ create: { width: 512, height: 512, channels: 4, background: '#0b1f3a' } })
const glyph = await sharp(svg).resize(360, 360).png().toBuffer()
await bg.composite([{ input: glyph, gravity: 'center' }]).png().toFile('public/icons/icon-maskable-512.png')
