import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PNG } from 'pngjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(root, 'tests', 'fixtures')

function image(width, height, paint) {
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha = 255] = paint(x, y, width, height)
      const offset = (y * width + x) * 4
      png.data[offset] = red
      png.data[offset + 1] = green
      png.data[offset + 2] = blue
      png.data[offset + 3] = alpha
    }
  }
  return PNG.sync.write(png)
}

const transparentShapes = image(160, 120, (x, y) => {
  if (x >= 18 && x < 70 && y >= 18 && y < 88) return [255, 84, 61, 255]
  if ((x - 113) ** 2 + (y - 54) ** 2 < 31 ** 2) return [15, 84, 192, 255]
  if (Math.abs(y - (0.52 * x + 20)) < 2) return [22, 111, 65, 255]
  if (x >= 72 && x < 84 && y >= 88 && y < 100) return [255, 243, 101, 150]
  return [0, 0, 0, 0]
})

const gradientPortrait = image(192, 144, (x, y, width, height) => {
  const horizontal = x / (width - 1)
  const vertical = y / (height - 1)
  let red = 35 + 155 * horizontal
  let green = 60 + 105 * vertical
  let blue = 128 + 95 * (1 - horizontal)
  const face = ((x - 98) / 38) ** 2 + ((y - 71) / 50) ** 2
  if (face < 1) {
    const shade = Math.max(0, Math.min(1, (x - 62) / 76))
    red = 235 - shade * 44
    green = 178 - shade * 54
    blue = 145 - shade * 36
    if (((x - 84) ** 2 + (y - 62) ** 2 < 12) || ((x - 112) ** 2 + (y - 62) ** 2 < 12)) return [48, 43, 50, 255]
  }
  return [Math.round(red), Math.round(green), Math.round(blue), 255]
})

const checkerEdges = image(160, 160, (x, y) => {
  const block = (Math.floor(x / 4) + Math.floor(y / 4)) % 2
  if (x > 42 && x < 118 && y > 42 && y < 118) {
    return (Math.floor(x / 10) + Math.floor(y / 10)) % 2 ? [254, 255, 139, 255] : [47, 31, 144, 255]
  }
  return block ? [248, 249, 250, 255] : [23, 27, 34, 255]
})

const backgroundSubject = image(180, 140, (x, y) => {
  const noise = ((x * 17 + y * 13) % 5) - 2
  if (x > 50 && x < 130 && y > 28 && y < 116) {
    if (y < 61) return [255, 107, 53, 255]
    if (x < 90) return [40, 87, 244, 255]
    return [8, 161, 122, 255]
  }
  return [218 + noise, 239 + noise, 247 + noise, 255]
})

await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(path.join(outputDirectory, 'transparent-shapes.png'), transparentShapes),
  writeFile(path.join(outputDirectory, 'gradient-portrait.png'), gradientPortrait),
  writeFile(path.join(outputDirectory, 'checker-edges.png'), checkerEdges),
  writeFile(path.join(outputDirectory, 'background-subject.png'), backgroundSubject),
])

console.log('Generated four deterministic, original PNG fixtures.')
