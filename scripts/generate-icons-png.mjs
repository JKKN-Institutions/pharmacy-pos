/**
 * Converts the generated SVG icons to PNG using sharp.
 * Run: node scripts/generate-icons-png.mjs
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  const svgPath = join(iconsDir, `icon-${size}x${size}.svg`)
  const pngPath = join(iconsDir, `icon-${size}x${size}.png`)
  const svgBuffer = readFileSync(svgPath)

  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(pngPath)

  console.log(`✓ ${pngPath}`)
}

console.log('\n✓ All PNG icons generated successfully.')
