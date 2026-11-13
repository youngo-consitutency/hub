// lightens the dark greens of the logos so they stay legible on deep surfaces; teal and lime are kept
import sharp from 'sharp'

const lift = [207, 238, 221]
for (const name of ['youngo-logo', 'youngo-hub-logo']) {
  const { data, info } = await sharp(`public/brand/${name}.png`)
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    const luma = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
    if (luma >= 0.45) continue
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * 0.35 + lift[c] * 0.65)
  }
  await sharp(data, { raw: info }).png().toFile(`public/brand/${name}-on-dark.png`)
}
