// Render the app icons in public/icons/ from public/favicon.svg. Usage: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const svg = readFileSync('public/favicon.svg')
const out = 'public/icons'
const render = (size) => sharp(svg, { density: 72 * (size / 64) * 1.01 }).resize(size, size)

await render(512).png().toFile(`${out}/icon-512.png`)
await render(192).png().toFile(`${out}/icon-192.png`)
// Opaque, for iOS, which puts transparent icons on black.
await render(180).flatten({ background: '#ff6b4a' }).png().toFile(`${out}/apple-touch-icon.png`)
// Maskable: the logo inside the safe zone (80%) on the brand colour.
const inner = await render(360).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#ff6b4a' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(`${out}/maskable-512.png`)
console.log('icons written')
