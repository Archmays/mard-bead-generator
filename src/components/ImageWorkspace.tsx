import { useEffect, useRef, useState } from 'react'
import { drawImageLayout } from '../core/imageSampling'
import type { ImageLayout } from '../types'

export interface LoadedImage {
  bitmap: ImageBitmap
  name: string
  width: number
  height: number
}

interface ImageWorkspaceProps {
  source: LoadedImage | null
  layout: ImageLayout
  outputWidth: number
  outputHeight: number
  error: string | null
  onFile: (file: File) => void
  onLayout: (layout: ImageLayout) => void
}

function previewDimensions(width: number, height: number) {
  const maximum = 760
  if (height > width) return { width: Math.max(1, Math.round(maximum * width / height)), height: maximum }
  return { width: maximum, height: Math.max(1, Math.round(maximum * height / width)) }
}

const POSITION_STEP = 0.05

function clampPosition(value: number) {
  return Math.max(-1, Math.min(1, value))
}

export function ImageWorkspace({
  source,
  layout,
  outputWidth,
  outputHeight,
  error,
  onFile,
  onLayout,
}: ImageWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const [isFileHover, setIsFileHover] = useState(false)
  const dimensions = previewDimensions(outputWidth, outputHeight)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !source) return
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    drawImageLayout(
      context,
      source.bitmap,
      source.width,
      source.height,
      dimensions.width,
      dimensions.height,
      layout,
    )
  }, [dimensions.height, dimensions.width, layout, source])

  const acceptDroppedFile = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  const moveImage = (horizontal: number, vertical: number) => {
    onLayout({
      ...layout,
      offsetX: clampPosition(layout.offsetX + horizontal),
      offsetY: clampPosition(layout.offsetY + vertical),
    })
  }

  const positionLabel = `水平 ${Math.round(layout.offsetX * 100)}% · 垂直 ${Math.round(layout.offsetY * 100)}%`

  return (
    <div className="image-workspace">
      <input
        ref={fileRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={(event) => acceptDroppedFile(event.currentTarget.files)}
        aria-label="上传 JPG、PNG 或 WebP 图片"
        data-testid="image-upload"
      />
      <div
        className={`upload-stage ${source ? 'has-source' : ''} ${isFileHover ? 'is-file-hover' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsFileHover(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsFileHover(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsFileHover(false)
          acceptDroppedFile(event.dataTransfer.files)
        }}
      >
        {source ? (
          <div className="preview-shell">
            <canvas
              ref={canvasRef}
              className="source-canvas"
              aria-label="生成范围预览，可拖动图片位置，也可使用下方方向按钮精确调整"
              role="img"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                dragRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                  offsetX: layout.offsetX,
                  offsetY: layout.offsetY,
                }
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current
                if (!drag) return
                const bounds = event.currentTarget.getBoundingClientRect()
                onLayout({
                  ...layout,
                  offsetX: Math.max(-1, Math.min(1, drag.offsetX + (event.clientX - drag.x) / (bounds.width * 0.35))),
                  offsetY: Math.max(-1, Math.min(1, drag.offsetY + (event.clientY - drag.y) / (bounds.height * 0.35))),
                })
              }}
              onPointerUp={() => { dragRef.current = null }}
              onPointerCancel={() => { dragRef.current = null }}
            />
            <span className="preview-size-tag">{outputWidth} × {outputHeight} 格</span>
            <span className="drag-hint">拖动或用方向按钮调整</span>
          </div>
        ) : (
          <button className="empty-upload" type="button" onClick={() => fileRef.current?.click()}>
            <span className="empty-mosaic" aria-hidden="true">
              {Array.from({ length: 25 }, (_, index) => <i key={index} />)}
            </span>
            <strong>把图片放进豆格里</strong>
            <span>拖到这里，或点击选择图片</span>
            <small>JPG / JPEG / PNG / WebP · 最大 20 MB</small>
          </button>
        )}
      </div>

      {source && (
        <div className="image-controls">
          <div className="source-meta">
            <strong title={source.name}>{source.name}</strong>
            <span>{source.width.toLocaleString('zh-CN')} × {source.height.toLocaleString('zh-CN')} px</span>
          </div>
          <div className="control-row compact-actions">
            <button type="button" className={layout.mode === 'contain' ? 'is-active' : ''} onClick={() => onLayout({ ...layout, mode: 'contain' })}>适应</button>
            <button type="button" className={layout.mode === 'cover' ? 'is-active' : ''} onClick={() => onLayout({ ...layout, mode: 'cover' })}>填满</button>
            <button type="button" onClick={() => onLayout({ mode: 'contain', zoom: 1, offsetX: 0, offsetY: 0 })}>重置</button>
            <button type="button" onClick={() => fileRef.current?.click()}>换图</button>
          </div>
          <label className="zoom-control">
            <span>缩放 <output>{Math.round(layout.zoom * 100)}%</output></span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={layout.zoom}
              onChange={(event) => onLayout({ ...layout, zoom: Number(event.currentTarget.value) })}
            />
          </label>
          <div className="position-control">
            <div className="position-heading">
              <strong>精确位置</strong>
              <output aria-live="polite" data-testid="image-position">{positionLabel}</output>
            </div>
            <div className="nudge-controls" role="group" aria-label="调整图片位置">
              <button type="button" aria-label="图片向上移动" title="向上移动 5%" onClick={() => moveImage(0, -POSITION_STEP)}>↑</button>
              <button type="button" aria-label="图片向左移动" title="向左移动 5%" onClick={() => moveImage(-POSITION_STEP, 0)}>←</button>
              <button type="button" aria-label="图片向右移动" title="向右移动 5%" onClick={() => moveImage(POSITION_STEP, 0)}>→</button>
              <button type="button" aria-label="图片向下移动" title="向下移动 5%" onClick={() => moveImage(0, POSITION_STEP)}>↓</button>
            </div>
            <small>每次移动 5%；支持鼠标、触控和键盘操作，重置可恢复居中。</small>
          </div>
        </div>
      )}
      <p className="privacy-note"><span aria-hidden="true">●</span> 图片只在当前设备浏览器中处理，不会上传或保存。</p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
