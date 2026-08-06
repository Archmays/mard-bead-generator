import { jsPDF } from 'jspdf'
import { getUsageRows } from '../core/metrics'
import { renderBeadPreview } from './renderBeadPreview'
import { renderCodeChart } from './renderCodeChart'
import { requireCanvasContext } from './canvasUtils'
import type { GenerationResult, MardColor } from '../types'

const PAGE_WIDTH = 1240
const PAGE_HEIGHT = 1754
const MODE_LABELS = {
  balanced: '平衡推荐',
  closest: '最接近原图',
  minimal: '最少颜色拼豆',
} as const

function pageCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = PAGE_WIDTH
  canvas.height = PAGE_HEIGHT
  const context = requireCanvasContext(canvas)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  return { canvas, context }
}

function addCanvasPage(pdf: jsPDF, canvas: HTMLCanvasElement, firstPage: boolean) {
  if (!firstPage) pdf.addPage()
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
}

function fitRect(sourceWidth: number, sourceHeight: number, targetX: number, targetY: number, targetWidth: number, targetHeight: number) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  return {
    x: targetX + (targetWidth - width) / 2,
    y: targetY + (targetHeight - height) / 2,
    width,
    height,
  }
}

function drawPageHeader(context: CanvasRenderingContext2D, title: string, subtitle: string) {
  context.fillStyle = '#171a20'
  context.font = '700 42px "Microsoft YaHei", sans-serif'
  context.textAlign = 'left'
  context.fillText(title, 74, 82)
  context.fillStyle = '#59606c'
  context.font = '22px "Microsoft YaHei", sans-serif'
  context.fillText(subtitle, 74, 120)
  context.strokeStyle = '#d9dde3'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(74, 148)
  context.lineTo(PAGE_WIDTH - 74, 148)
  context.stroke()
}

export interface PdfOptions {
  sourceImage?: CanvasImageSource
  sourceWidth?: number
  sourceHeight?: number
  beadSizeMm: number
  packSize: number
}

export async function createPatternPdf(
  result: GenerationResult,
  palette: MardColor[],
  options: PdfOptions,
): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const preview = renderBeadPreview(result, palette, { cellSize: 22, opaqueBackground: true })
  const overview = pageCanvas()
  drawPageHeader(overview.context, 'MARD 拼豆图纸', `${MODE_LABELS[result.mode]} · MARD ${result.paletteId} 色`)

  overview.context.fillStyle = '#f1f4f7'
  overview.context.fillRect(74, 188, 1092, 640)
  if (options.sourceImage && options.sourceWidth && options.sourceHeight) {
    const sourceRect = fitRect(options.sourceWidth, options.sourceHeight, 104, 224, 470, 530)
    overview.context.drawImage(options.sourceImage, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height)
    overview.context.fillStyle = '#3f4652'
    overview.context.font = '20px "Microsoft YaHei", sans-serif'
    overview.context.fillText('原图', 104, 792)
  }
  const previewRect = fitRect(preview.width, preview.height, 646, 224, 470, 530)
  overview.context.drawImage(preview, previewRect.x, previewRect.y, previewRect.width, previewRect.height)
  overview.context.fillStyle = '#3f4652'
  overview.context.font = '20px "Microsoft YaHei", sans-serif'
  overview.context.fillText('拼豆效果', 646, 792)

  const physicalWidth = (result.width * options.beadSizeMm / 10).toFixed(1)
  const physicalHeight = (result.height * options.beadSizeMm / 10).toFixed(1)
  const facts = [
    ['图纸尺寸', `${result.width} × ${result.height} 颗`],
    ['拼豆总数', `${result.beadCount.toLocaleString('zh-CN')} 颗`],
    ['实际颜色', `${result.colorCount} 色`],
    ['预计成品', `${physicalWidth} × ${physicalHeight} cm`],
    ['平均 ΔE00', result.metrics.mean.toFixed(2)],
    ['P95 ΔE00', result.metrics.p95.toFixed(2)],
  ]
  for (let index = 0; index < facts.length; index += 1) {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = 74 + column * 546
    const y = 900 + row * 142
    overview.context.fillStyle = '#6a7280'
    overview.context.font = '21px "Microsoft YaHei", sans-serif'
    overview.context.fillText(facts[index][0], x, y)
    overview.context.fillStyle = '#171a20'
    overview.context.font = '700 38px "Microsoft YaHei", sans-serif'
    overview.context.fillText(facts[index][1], x, y + 48)
  }
  overview.context.fillStyle = '#f7f2e7'
  overview.context.fillRect(74, 1360, 1092, 250)
  overview.context.fillStyle = '#55492f'
  overview.context.font = '21px "Microsoft YaHei", sans-serif'
  overview.context.fillText('使用提示', 104, 1410)
  overview.context.font = '19px "Microsoft YaHei", sans-serif'
  overview.context.fillText('按页面标注的绝对行列范围铺豆；每 5 格为辅助线，每 10 格为粗线。', 104, 1460)
  overview.context.fillText('屏幕 HEX 仅为近似参考，购买与铺豆请以 MARD 色号和实体色卡为准。', 104, 1504)
  overview.context.fillText('本工具与 MARD 品牌方无隶属或官方合作关系。', 104, 1548)
  addCanvasPage(pdf, overview.canvas, true)

  const tileColumns = 18
  const tileRows = 25
  const chartPages: Array<{ rowStart: number; rowEnd: number; columnStart: number; columnEnd: number }> = []
  for (let rowStart = 0; rowStart < result.height; rowStart += tileRows) {
    for (let columnStart = 0; columnStart < result.width; columnStart += tileColumns) {
      chartPages.push({
        rowStart,
        rowEnd: Math.min(result.height, rowStart + tileRows),
        columnStart,
        columnEnd: Math.min(result.width, columnStart + tileColumns),
      })
    }
  }

  chartPages.forEach((tile, index) => {
    const page = pageCanvas()
    drawPageHeader(
      page.context,
      `铺豆图 ${index + 1} / ${chartPages.length}`,
      `列 ${tile.columnStart + 1}–${tile.columnEnd} · 行 ${tile.rowStart + 1}–${tile.rowEnd}`,
    )
    const chart = renderCodeChart(result, palette, {
      cellSize: 48,
      startColumn: tile.columnStart,
      endColumn: tile.columnEnd,
      startRow: tile.rowStart,
      endRow: tile.rowEnd,
      coordinateMargin: 54,
    })
    const rect = fitRect(chart.width, chart.height, 74, 184, 1092, 1450)
    page.context.imageSmoothingEnabled = true
    page.context.imageSmoothingQuality = 'high'
    page.context.drawImage(chart, rect.x, rect.y, rect.width, rect.height)
    page.context.fillStyle = '#626a77'
    page.context.font = '18px "Microsoft YaHei", sans-serif'
    page.context.textAlign = 'right'
    page.context.fillText(`第 ${index + 2} 页`, PAGE_WIDTH - 74, PAGE_HEIGHT - 48)
    addCanvasPage(pdf, page.canvas, false)
  })

  const usage = getUsageRows(result, palette).sort((first, second) => second.count - first.count)
  const rowsPerPage = 42
  const usagePageCount = Math.max(1, Math.ceil(usage.length / rowsPerPage))
  for (let usagePage = 0; usagePage < usagePageCount; usagePage += 1) {
    const page = pageCanvas()
    drawPageHeader(page.context, 'MARD 色号用量', `按颗数降序 · 每包按 ${options.packSize} 颗估算`)
    const pageRows = usage.slice(usagePage * rowsPerPage, (usagePage + 1) * rowsPerPage)
    const columns = [90, 180, 580, 850, 1020]
    page.context.fillStyle = '#e9edf2'
    page.context.fillRect(74, 176, 1092, 50)
    page.context.fillStyle = '#363c47'
    page.context.font = '700 18px "Microsoft YaHei", sans-serif'
    ;['色块', '色号', '系列 / 名称', '颗数', '预计包数'].forEach((label, index) => page.context.fillText(label, columns[index], 208))
    pageRows.forEach((row, index) => {
      const y = 248 + index * 34
      if (index % 2 === 1) {
        page.context.fillStyle = '#f6f7f8'
        page.context.fillRect(74, y - 23, 1092, 34)
      }
      page.context.fillStyle = row.color.hex
      page.context.fillRect(columns[0], y - 18, 24, 24)
      page.context.strokeStyle = '#7b818b'
      page.context.strokeRect(columns[0], y - 18, 24, 24)
      page.context.fillStyle = '#20242b'
      page.context.font = '17px "Microsoft YaHei", sans-serif'
      page.context.fillText(row.code, columns[1], y)
      page.context.fillText(row.color.displayNameZh ?? row.code, columns[2], y)
      page.context.fillText(row.count.toLocaleString('zh-CN'), columns[3], y)
      page.context.fillText(String(Math.ceil(row.count / Math.max(1, options.packSize))), columns[4], y)
    })
    page.context.fillStyle = '#626a77'
    page.context.font = '18px "Microsoft YaHei", sans-serif'
    page.context.fillText(`用量页 ${usagePage + 1} / ${usagePageCount}`, 74, PAGE_HEIGHT - 48)
    addCanvasPage(pdf, page.canvas, false)
  }

  return pdf.output('blob')
}
