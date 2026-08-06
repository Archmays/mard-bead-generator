import { requireCanvasContext, safeCellSize } from './canvasUtils'
import type { GenerationResult, MardColor } from '../types'

export interface BeadPreviewOptions {
  cellSize?: number
  showGrid?: boolean
  opaqueBackground?: boolean
}

export function renderBeadPreview(
  result: GenerationResult,
  palette: MardColor[],
  options: BeadPreviewOptions = {},
): HTMLCanvasElement {
  const cellSize = safeCellSize(result.width, result.height, options.cellSize ?? 28)
  const canvas = document.createElement('canvas')
  canvas.width = result.width * cellSize
  canvas.height = result.height * cellSize
  const context = requireCanvasContext(canvas)
  if (options.opaqueBackground) {
    context.fillStyle = '#f7f8f6'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  const colorByCode = new Map(palette.map((color) => [color.code, color]))

  for (let index = 0; index < result.codes.length; index += 1) {
    const code = result.codes[index]
    if (!code) continue
    const color = colorByCode.get(code)
    if (!color) throw new Error(`效果图找不到 MARD 色号：${code}`)
    const x = (index % result.width) * cellSize
    const y = Math.floor(index / result.width) * cellSize
    const centerX = x + cellSize / 2
    const centerY = y + cellSize / 2
    const radius = cellSize * 0.43
    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.fillStyle = color.hex
    context.fill()
    context.lineWidth = Math.max(0.7, cellSize * 0.04)
    context.strokeStyle = 'rgba(18, 22, 31, 0.24)'
    context.stroke()
    context.beginPath()
    context.arc(centerX - radius * 0.22, centerY - radius * 0.28, radius * 0.15, 0, Math.PI * 2)
    context.fillStyle = 'rgba(255,255,255,.48)'
    context.fill()
    context.save()
    context.globalCompositeOperation = 'destination-out'
    context.beginPath()
    context.arc(centerX, centerY, radius * 0.34, 0, Math.PI * 2)
    context.fill()
    context.restore()
    context.beginPath()
    context.arc(centerX, centerY, radius * 0.34, 0, Math.PI * 2)
    context.lineWidth = Math.max(0.6, cellSize * 0.025)
    context.strokeStyle = 'rgba(18, 22, 31, 0.22)'
    context.stroke()
  }

  if (options.showGrid) {
    context.strokeStyle = 'rgba(18, 22, 31, 0.12)'
    context.lineWidth = 1
    for (let column = 1; column < result.width; column += 1) {
      context.beginPath()
      context.moveTo(column * cellSize + 0.5, 0)
      context.lineTo(column * cellSize + 0.5, canvas.height)
      context.stroke()
    }
    for (let row = 1; row < result.height; row += 1) {
      context.beginPath()
      context.moveTo(0, row * cellSize + 0.5)
      context.lineTo(canvas.width, row * cellSize + 0.5)
      context.stroke()
    }
  }
  return canvas
}
