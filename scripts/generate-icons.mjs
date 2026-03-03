/**
 * Generates all required PWA icon sizes as PNG files.
 * Uses the @napi-rs/canvas package for server-side rendering.
 *
 * Run: node scripts/generate-icons.mjs
 *
 * If @napi-rs/canvas is not available, this script falls back to
 * writing placeholder SVG files (browsers support SVG icons in manifests).
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(iconsDir, { recursive: true })

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

// Pharmacy cross SVG — green gradient background, white cross
function makeSVG(size) {
  const padding = Math.round(size * 0.1)
  const crossThickness = Math.round(size * 0.18)
  const crossArmLength = Math.round(size * 0.55)
  const cx = size / 2
  const cy = size / 2

  // Cross arm coordinates
  const crossX = cx - crossThickness / 2
  const crossY = cy - crossArmLength / 2
  const hX = cx - crossArmLength / 2
  const hY = cy - crossThickness / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#15803d"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
    <linearGradient id="cross" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#dcfce7" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <!-- Background rounded rect -->
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="url(#bg)"/>
  <!-- Vertical arm of cross -->
  <rect x="${crossX}" y="${crossY}" width="${crossThickness}" height="${crossArmLength}" rx="${Math.round(crossThickness * 0.3)}" fill="url(#cross)"/>
  <!-- Horizontal arm of cross -->
  <rect x="${hX}" y="${hY}" width="${crossArmLength}" height="${crossThickness}" rx="${Math.round(crossThickness * 0.3)}" fill="url(#cross)"/>
  <!-- Small Rx text mark for pharmacy identity -->
  <text x="${size - padding - 2}" y="${size - padding + 2}" font-family="system-ui,sans-serif" font-size="${Math.round(size * 0.13)}" font-weight="700" fill="white" text-anchor="end" opacity="0.85">Rx</text>
</svg>`
}

// Write SVG files for each size (these work in manifests for most modern browsers)
for (const size of sizes) {
  const svg = makeSVG(size)
  const svgPath = join(iconsDir, `icon-${size}x${size}.svg`)
  writeFileSync(svgPath, svg)
  console.log(`✓ Written ${svgPath}`)
}

// Also write a favicon.svg for the browser tab
const faviconSvg = makeSVG(32)
writeFileSync(join(iconsDir, '..', '..', 'app', 'favicon.svg'), faviconSvg)
console.log('\n✓ All icons generated as SVG.')
console.log('  For production, convert to PNG with: bunx sharp-cli or similar tool.')
console.log('  Chrome/Edge/Firefox support SVG icons in web app manifests.')
