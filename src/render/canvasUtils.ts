export const MAX_CANVAS_SIDE = 8192

export function requireCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法创建导出画布。')
  return context
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片导出失败，可能超过当前浏览器的 Canvas 尺寸限制。'))
    }, type, quality)
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function safeCellSize(
  columns: number,
  rows: number,
  requested: number,
  horizontalPadding = 0,
  verticalPadding = 0,
) {
  const horizontal = Math.floor((MAX_CANVAS_SIDE - horizontalPadding) / Math.max(1, columns))
  const vertical = Math.floor((MAX_CANVAS_SIDE - verticalPadding) / Math.max(1, rows))
  return Math.max(4, Math.min(requested, horizontal, vertical))
}

export function timestampForFilename(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}
