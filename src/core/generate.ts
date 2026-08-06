import { getPalette } from '../data/palettes'
import { nearestPaletteIndex, preparePalette } from './colorMatching'
import { cleanupSmallRegions } from './regionCleanup'
import { optimizeMardSubset } from './paletteOptimization'
import {
  calculateErrorMetrics,
  countNonEmpty,
  deterministicCodeHash,
  EMPTY_ALPHA_THRESHOLD,
  unpackSample,
} from './metrics'
import type {
  GenerationResult,
  GenerationSettings,
  PackedSampleGrid,
  PreparedMardColor,
  WorkerStage,
} from '../types'

export interface GenerationHooks {
  onProgress?: (stage: WorkerStage, progress: number) => void
}

export function mapGridToPalette(
  grid: PackedSampleGrid,
  palette: PreparedMardColor[],
  allowedIndices?: readonly number[],
  onProgress?: (progress: number) => void,
): Array<string | null> {
  const codes: Array<string | null> = new Array(grid.width * grid.height).fill(null)
  for (let index = 0; index < codes.length; index += 1) {
    const sample = unpackSample(grid, index)
    if (sample.alpha >= EMPTY_ALPHA_THRESHOLD) {
      const match = nearestPaletteIndex(sample.lab, palette, allowedIndices)
      codes[index] = palette[match.index].code
    }
    if (onProgress && index % Math.max(1, Math.floor(codes.length / 20)) === 0) {
      onProgress(index / codes.length)
    }
  }
  onProgress?.(1)
  return codes
}

export function generatePattern(
  grid: PackedSampleGrid,
  settings: GenerationSettings,
  hooks: GenerationHooks = {},
): GenerationResult {
  if (grid.data.length !== grid.width * grid.height * 6) {
    throw new Error('采样网格数据长度不正确。')
  }
  const palette = preparePalette(getPalette(settings.paletteId))
  hooks.onProgress?.('matching', 0)
  const fullCodes = mapGridToPalette(grid, palette, undefined, (progress) => {
    hooks.onProgress?.('matching', progress)
  })
  const fullPaletteMetrics = calculateErrorMetrics(grid, fullCodes, palette)

  let mappedCodes = fullCodes
  let autoSelectedK: number | undefined
  if (settings.mode !== 'closest') {
    hooks.onProgress?.('optimizing', 0.05)
    const optimization = optimizeMardSubset(
      grid,
      palette,
      settings.mode,
      settings.mode === 'minimal' ? settings.maxColors : 'auto',
    )
    autoSelectedK = optimization.autoSelectedK
    hooks.onProgress?.('optimizing', 0.75)
    mappedCodes = mapGridToPalette(grid, palette, optimization.selectedIndices)
    hooks.onProgress?.('optimizing', 1)
  }

  hooks.onProgress?.('cleaning', 0)
  const cleanedCodes = cleanupSmallRegions(mappedCodes, grid, palette, settings.mode)
  hooks.onProgress?.('cleaning', 1)
  const metrics = calculateErrorMetrics(grid, cleanedCodes, palette)
  const selectedCodes = palette
    .map((color) => color.code)
    .filter((code) => cleanedCodes.includes(code))
  const beadCount = countNonEmpty(cleanedCodes)

  return {
    width: grid.width,
    height: grid.height,
    codes: cleanedCodes,
    mode: settings.mode,
    paletteId: settings.paletteId,
    metrics,
    fullPaletteMetrics,
    colorCount: selectedCodes.length,
    beadCount,
    selectedCodes,
    autoSelectedK,
    deterministicHash: deterministicCodeHash(cleanedCodes, grid.width, grid.height),
  }
}
