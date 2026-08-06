import { rgbToLab } from './colorMatching'
import { SAMPLE_FIELDS } from './metrics'
import type { BackgroundMode, ImageLayout, PackedSampleGrid } from '../types'

export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface BackgroundRemovalResult {
  imageData: ImageData
  removedPixels: number
  confidence: number
}

const ALPHA_CUTOFF = 32

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function srgbToLinear(value: number) {
  const normalized = value / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(value: number) {
  const normalized = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
  return clamp(Math.round(normalized * 255), 0, 255)
}

function samplingPositions(start: number, end: number): number[] {
  const size = Math.max(1, end - start)
  if (size <= 8) return Array.from({ length: size }, (_, index) => start + index)
  const points = 7
  return Array.from({ length: points }, (_, index) =>
    clamp(Math.floor(start + ((index + 0.5) * size) / points), start, end - 1),
  )
}

interface PixelSample {
  red: number
  green: number
  blue: number
  alpha: number
  linearRed: number
  linearGreen: number
  linearBlue: number
  luminance: number
}

function representativeColor(samples: PixelSample[]) {
  let sumRed = 0
  let sumGreen = 0
  let sumBlue = 0
  let minimumLuminance = 1
  let maximumLuminance = 0
  const buckets = new Map<number, { count: number; red: number; green: number; blue: number }>()

  for (const sample of samples) {
    sumRed += sample.linearRed
    sumGreen += sample.linearGreen
    sumBlue += sample.linearBlue
    minimumLuminance = Math.min(minimumLuminance, sample.luminance)
    maximumLuminance = Math.max(maximumLuminance, sample.luminance)
    const key = ((sample.red >> 4) << 8) | ((sample.green >> 4) << 4) | (sample.blue >> 4)
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 }
    bucket.count += 1
    bucket.red += sample.linearRed
    bucket.green += sample.linearGreen
    bucket.blue += sample.linearBlue
    buckets.set(key, bucket)
  }

  const mean = {
    red: sumRed / samples.length,
    green: sumGreen / samples.length,
    blue: sumBlue / samples.length,
  }
  let variance = 0
  for (const sample of samples) {
    variance +=
      (sample.linearRed - mean.red) ** 2 +
      (sample.linearGreen - mean.green) ** 2 +
      (sample.linearBlue - mean.blue) ** 2
  }
  variance /= samples.length

  const dominant = [...buckets.values()].sort((first, second) => second.count - first.count)[0]
  const dominantShare = dominant.count / samples.length
  const highVariation = variance > 0.012 || maximumLuminance - minimumLuminance > 0.24
  const chosen = highVariation && dominantShare >= 0.2
    ? {
        red: dominant.red / dominant.count,
        green: dominant.green / dominant.count,
        blue: dominant.blue / dominant.count,
      }
    : mean

  return {
    red: linearToSrgb(chosen.red),
    green: linearToSrgb(chosen.green),
    blue: linearToSrgb(chosen.blue),
    variance,
    edgeWeight: clamp((maximumLuminance - minimumLuminance) * 1.4 + Math.sqrt(variance) * 0.65, 0, 1),
  }
}

export function sampleImageToGrid(buffer: PixelBuffer, gridWidth: number, gridHeight: number): PackedSampleGrid {
  if (gridWidth < 1 || gridHeight < 1) throw new Error('图纸尺寸必须大于 0。')
  const packed = new Float32Array(gridWidth * gridHeight * SAMPLE_FIELDS)

  for (let gridY = 0; gridY < gridHeight; gridY += 1) {
    const startY = Math.floor((gridY * buffer.height) / gridHeight)
    const endY = Math.max(startY + 1, Math.ceil(((gridY + 1) * buffer.height) / gridHeight))
    const positionsY = samplingPositions(startY, Math.min(buffer.height, endY))
    for (let gridX = 0; gridX < gridWidth; gridX += 1) {
      const startX = Math.floor((gridX * buffer.width) / gridWidth)
      const endX = Math.max(startX + 1, Math.ceil(((gridX + 1) * buffer.width) / gridWidth))
      const positionsX = samplingPositions(startX, Math.min(buffer.width, endX))
      const samples: PixelSample[] = []
      let alphaSum = 0

      for (const y of positionsY) {
        for (const x of positionsX) {
          const offset = (y * buffer.width + x) * 4
          const alpha = buffer.data[offset + 3]
          if (alpha < ALPHA_CUTOFF) continue
          const red = buffer.data[offset]
          const green = buffer.data[offset + 1]
          const blue = buffer.data[offset + 2]
          const linearRed = srgbToLinear(red)
          const linearGreen = srgbToLinear(green)
          const linearBlue = srgbToLinear(blue)
          samples.push({
            red,
            green,
            blue,
            alpha,
            linearRed,
            linearGreen,
            linearBlue,
            luminance: 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue,
          })
          alphaSum += alpha / 255
        }
      }

      const targetIndex = (gridY * gridWidth + gridX) * SAMPLE_FIELDS
      if (samples.length === 0) {
        packed[targetIndex + 3] = 0
        continue
      }

      const representative = representativeColor(samples)
      const lab = rgbToLab(representative.red, representative.green, representative.blue)
      const coverage = samples.length / (positionsX.length * positionsY.length)
      packed[targetIndex] = lab.l
      packed[targetIndex + 1] = lab.a
      packed[targetIndex + 2] = lab.b
      packed[targetIndex + 3] = coverage * (alphaSum / samples.length)
      packed[targetIndex + 4] = representative.variance
      packed[targetIndex + 5] = representative.edgeWeight
    }
  }

  return { width: gridWidth, height: gridHeight, data: packed }
}

function rgbDistance(first: [number, number, number], second: [number, number, number]) {
  return Math.sqrt(
    (first[0] - second[0]) ** 2 +
    (first[1] - second[1]) ** 2 +
    (first[2] - second[2]) ** 2,
  )
}

export function removeEdgeConnectedBackground(input: ImageData, tolerance = 30): BackgroundRemovalResult {
  const data = new Uint8ClampedArray(input.data)
  const { width, height } = input
  const edgeColors: Array<[number, number, number]> = []
  const bucketCounts = new Map<number, { count: number; red: number; green: number; blue: number }>()

  const addEdge = (x: number, y: number) => {
    const offset = (y * width + x) * 4
    if (data[offset + 3] < ALPHA_CUTOFF) return
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    edgeColors.push([red, green, blue])
    const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4)
    const bucket = bucketCounts.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 }
    bucket.count += 1
    bucket.red += red
    bucket.green += green
    bucket.blue += blue
    bucketCounts.set(key, bucket)
  }

  for (let x = 0; x < width; x += 1) {
    addEdge(x, 0)
    if (height > 1) addEdge(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    addEdge(0, y)
    if (width > 1) addEdge(width - 1, y)
  }

  const dominant = [...bucketCounts.values()].sort((first, second) => second.count - first.count)[0]
  const confidence = dominant && edgeColors.length > 0 ? dominant.count / edgeColors.length : 0
  if (!dominant || confidence < 0.55) {
    return { imageData: new ImageData(data, width, height), removedPixels: 0, confidence }
  }

  const background: [number, number, number] = [
    dominant.red / dominant.count,
    dominant.green / dominant.count,
    dominant.blue / dominant.count,
  ]
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  const enqueue = (x: number, y: number) => {
    const pixel = y * width + x
    if (visited[pixel]) return
    const offset = pixel * 4
    if (data[offset + 3] < ALPHA_CUTOFF) {
      visited[pixel] = 1
      return
    }
    if (rgbDistance([data[offset], data[offset + 1], data[offset + 2]], background) > tolerance) return
    visited[pixel] = 1
    queue[tail] = pixel
    tail += 1
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    if (height > 1) enqueue(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y)
    if (width > 1) enqueue(width - 1, y)
  }

  let removedPixels = 0
  while (head < tail) {
    const pixel = queue[head]
    head += 1
    const x = pixel % width
    const y = Math.floor(pixel / width)
    const offset = pixel * 4
    data[offset + 3] = 0
    removedPixels += 1
    if (x > 0) enqueue(x - 1, y)
    if (x + 1 < width) enqueue(x + 1, y)
    if (y > 0) enqueue(x, y - 1)
    if (y + 1 < height) enqueue(x, y + 1)
  }

  return { imageData: new ImageData(data, width, height), removedPixels, confidence }
}

export function calculateGridDimensions(sourceWidth: number, sourceHeight: number, requestedWidth: number) {
  const width = clamp(Math.round(requestedWidth), 10, 200)
  const height = clamp(Math.round((sourceHeight / sourceWidth) * width), 1, 200)
  return { width, height }
}

export function drawImageLayout(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
  layout: ImageLayout,
) {
  const baseScale = layout.mode === 'cover'
    ? Math.max(destinationWidth / sourceWidth, destinationHeight / sourceHeight)
    : Math.min(destinationWidth / sourceWidth, destinationHeight / sourceHeight)
  const scale = baseScale * layout.zoom
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  const travelX = Math.max(destinationWidth * 0.35, Math.abs(drawWidth - destinationWidth) / 2)
  const travelY = Math.max(destinationHeight * 0.35, Math.abs(drawHeight - destinationHeight) / 2)
  const drawX = (destinationWidth - drawWidth) / 2 + layout.offsetX * travelX
  const drawY = (destinationHeight - drawHeight) / 2 + layout.offsetY * travelY
  context.clearRect(0, 0, destinationWidth, destinationHeight)
  context.drawImage(source, drawX, drawY, drawWidth, drawHeight)
}

export function prepareAnalysisImage(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  gridWidth: number,
  gridHeight: number,
  layout: ImageLayout,
  backgroundMode: BackgroundMode,
): { imageData: ImageData; removedPixels: number; backgroundConfidence: number } {
  const sourceScale = Math.min(1, 4096 / Math.max(sourceWidth, sourceHeight), Math.sqrt(16_000_000 / (sourceWidth * sourceHeight)))
  const safeWidth = Math.max(1, Math.round(sourceWidth * sourceScale))
  const safeHeight = Math.max(1, Math.round(sourceHeight * sourceScale))
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = safeWidth
  sourceCanvas.height = safeHeight
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (!sourceContext) throw new Error('浏览器无法创建图片分析画布。')
  sourceContext.imageSmoothingEnabled = true
  sourceContext.imageSmoothingQuality = 'high'
  sourceContext.drawImage(source, 0, 0, safeWidth, safeHeight)

  let removedPixels = 0
  let backgroundConfidence = 0
  if (backgroundMode === 'edge-remove') {
    const removal = removeEdgeConnectedBackground(sourceContext.getImageData(0, 0, safeWidth, safeHeight))
    removedPixels = removal.removedPixels
    backgroundConfidence = removal.confidence
    sourceContext.putImageData(removal.imageData, 0, 0)
  }

  const analysisCanvas = document.createElement('canvas')
  analysisCanvas.width = Math.min(1600, Math.max(gridWidth, gridWidth * 7))
  analysisCanvas.height = Math.min(1600, Math.max(gridHeight, gridHeight * 7))
  const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true })
  if (!analysisContext) throw new Error('浏览器无法创建采样画布。')
  analysisContext.imageSmoothingEnabled = true
  analysisContext.imageSmoothingQuality = 'high'
  drawImageLayout(
    analysisContext,
    sourceCanvas,
    safeWidth,
    safeHeight,
    analysisCanvas.width,
    analysisCanvas.height,
    layout,
  )
  return {
    imageData: analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height),
    removedPixels,
    backgroundConfidence,
  }
}
