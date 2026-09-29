import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const inputIcon = path.join(process.cwd(), 'public', 'brand', 'youngo-hub-app-icon.png')
const outputDir = path.join(process.cwd(), 'public', 'icons')

const sizes = [70, 72, 96, 128, 144, 150, 152, 192, 310, 384, 512]

async function generateIcons() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`)
    await sharp(inputIcon).resize(size, size).png().toFile(outputPath)
    console.log(`Generated: icon-${size}.png`)
  }

  // Also generate apple-touch-icon (180x180)
  await sharp(inputIcon).resize(180, 180).png().toFile(path.join(outputDir, 'apple-touch-icon.png'))
  console.log('Generated: apple-touch-icon.png')

  // Generate maskable icon (512x512 with safe zone)
  await sharp(inputIcon)
    .resize(512, 512)
    .png()
    .toFile(path.join(outputDir, 'icon-maskable-512.png'))
  console.log('Generated: icon-maskable-512.png')

  await sharp(inputIcon).resize(32, 32).png().toFile(path.join(outputDir, 'favicon-32.png'))
  console.log('Generated: favicon-32.png')

  console.log('\nAll icons generated!')
}

generateIcons().catch(console.error)
