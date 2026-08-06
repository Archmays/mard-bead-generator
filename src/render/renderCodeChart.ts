import { requireCanvasContext, safeCellSize } from './canvasUtils'
import type { GenerationResult, MardColor } from '../types'

export interface CodeChartOptions {
  cellSize?: number
  startColumn?: number
  endColumn?: number
  startRow?: number
  endRow?: number
  showCodes?: boolean
  coordinateMargin?: number
}

function textColorForHex(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255
  const linear = (value: number) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
  return luminance > 0.42 ? '#151820' : '#ffffff'
}

export function renderCodeChart(
  result: GenerationResult,
  palette: MardColor[],
  options: CodeChartOptions = {},
): HTMLCanvasElement {
  const startColumn = options.startColumn ?? 0
  const endColumn = options.endColumn ?? result.width
  const startRow = options.startRow ?? 0
  const endRow = options.endRow ?? result.height
  const columns = endColumn - startColumn
  const rows = endRow - startRow
  const margin = options.coordinateMargin ?? 48
  const cellSize = safeCellSize(columns, rows, options.cellSize ?? 42, margin + 4, margin + 4)
  const canvas = document.createElement('canvas')
  canvas.width = margin + columns * cellSize + 2
  canvas.height = margin + rows * cellSize + 2
  const context = requireCanvasContext(canvas)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const colorByCode = new Map(palette.map((color) => [color.code, color]))

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `600 ${Math.max(8, Math.min(14, cellSize * 0.32))}px ui-monospace, Consolas, monospace`
  context.fillStyle = '#454b58'
  for (let column = startColumn; column < endColumn; column += 1) {
    const x = margin + (column - startColumn + 0.5) * cellSize
    context.fillText(String(column + 1), x, margin / 2)
  }
  for (let row = startRow; row < endRow; row += 1) {
    const y = margin + (row - startRow + 0.5) * cellSize
    context.fillText(String(row + 1), margin / 2, y)
  }

  for (let row = startRow; row < endRow; row += 1) {
    for (let column = startColumn; column < endColumn; column += 1) {
      const code = result.codes[row * result.width + column]
      const x = margin + (column - startColumn) * cellSize
      const y = margin + (row - startRow) * cellSize
      if (!code) {
        context.fillStyle = (row + column) % 2 === 0 ? '#f5f6f7' : '#eef0f2'
        context.fillRect(x, y, cellSize, cellSize)
        continue
      }
      const color = colorByCode.get(code)
      if (!color) throw new Error(`色号图纸找不到 MARD 色号：${code}`)
      context.fillStyle = color.hex
      context.fillRect(x, y, cellSize, cellSize)
      if (options.showCodes !== false && cellSize >= 10) {
        context.fillStyle = textColorForHex(color.hex)
        context.font = `700 ${Math.max(6, Math.min(15, cellSize * 0.32))}px ui-monospace, Consolas, monospace`
        context.fillText(code, x + cellSize / 2, y + cellSize / 2)
      }
    }
  }

  for (let column = 0; column <= columns; column += 1) {
    const absoluteColumn = startColumn + column
    context.beginPath()
    context.moveTo(margin + column * cellSize, margin)
    context.lineTo(margin + column * cellSize, margin + rows * cellSize)
    context.lineWidth = absoluteColumn % 10 === 0 ? 2.6 : absoluteColumn % 5 === 0 ? 1.7 : 0.65
    context.strokeStyle = absoluteColumn % 10 === 0 ? '#20242e' : absoluteColumn % 5 === 0 ? '#5e6470' : 'rgba(31,36,46,.35)'
    context.stroke()
  }
  for (let row = 0; row <= rows; row += 1) {
    const absoluteRow = startRow + row
    context.beginPath()
    context.moveTo(margin, margin + row * cellSize)
    context.lineTo(margin + columns * cellSize, margin + row * cellSize)
    context.lineWidth = absoluteRow % 10 === 0 ? 2.6 : absoluteRow % 5 === 0 ? 1.7 : 0.65
    context.strokeStyle = absoluteRow % 10 === 0 ? '#20242e' : absoluteRow % 5 === 0 ? '#5e6470' : 'rgba(31,36,46,.35)'
    context.stroke()
  }
  return canvas
}
