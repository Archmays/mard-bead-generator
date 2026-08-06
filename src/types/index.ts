export type Material =
  | 'standard'
  | 'transparent'
  | 'fluorescent'
  | 'pearl'
  | 'glitter'
  | 'glow'
  | 'unknown'

export interface MardColor {
  code: string
  hex: `#${string}`
  series?: string
  displayNameZh?: string
  material?: Material
  sourceRef: string
}

export interface LabColor {
  mode: 'lab65'
  l: number
  a: number
  b: number
}

export interface PreparedMardColor extends MardColor {
  lab: LabColor
}

export type GenerationMode = 'balanced' | 'closest' | 'minimal'
export type PaletteId = '221' | '291'
export type BackgroundMode = 'keep' | 'alpha-only' | 'edge-remove'
export type LayoutMode = 'contain' | 'cover'

export interface PackedSampleGrid {
  width: number
  height: number
  /** Six float fields per cell: L, a, b, alpha, variance, edgeWeight. */
  data: Float32Array
}

export interface SampledCell {
  lab: LabColor
  alpha: number
  variance: number
  edgeWeight: number
}

export interface GenerationSettings {
  mode: GenerationMode
  paletteId: PaletteId
  maxColors: 'auto' | 4 | 6 | 8 | 12 | 16 | 24
}

export interface ErrorMetrics {
  mean: number
  p95: number
}

export interface UsageRow {
  code: string
  color: MardColor
  count: number
  percentage: number
}

export interface GenerationResult {
  width: number
  height: number
  codes: Array<string | null>
  mode: GenerationMode
  paletteId: PaletteId
  metrics: ErrorMetrics
  fullPaletteMetrics: ErrorMetrics
  colorCount: number
  beadCount: number
  selectedCodes: string[]
  autoSelectedK?: number
  deterministicHash: string
}

export interface WorkerGenerateRequest {
  type: 'generate'
  taskId: string
  grid: PackedSampleGrid
  settings: GenerationSettings
}

export interface WorkerCancelRequest {
  type: 'cancel'
  taskId: string
}

export type WorkerRequest = WorkerGenerateRequest | WorkerCancelRequest

export type WorkerStage = 'matching' | 'optimizing' | 'cleaning'

export type WorkerResponse =
  | { type: 'progress'; taskId: string; stage: WorkerStage; progress: number }
  | { type: 'complete'; taskId: string; result: GenerationResult }
  | { type: 'error'; taskId: string; message: string }

export interface ImageLayout {
  mode: LayoutMode
  zoom: number
  offsetX: number
  offsetY: number
}
