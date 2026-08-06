import { useEffect, useRef } from 'react'

interface CanvasSurfaceProps {
  source: HTMLCanvasElement | null
  label: string
  className?: string
  scale?: number
}

export function CanvasSurface({ source, label, className = '', scale = 1 }: CanvasSurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !source) return
    canvas.width = source.width
    canvas.height = source.height
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, 0, 0)
  }, [source])

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label={label}
      style={source ? { width: `${source.width * scale}px`, height: `${source.height * scale}px` } : undefined}
    />
  )
}
