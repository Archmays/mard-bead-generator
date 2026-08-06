import { describe, expect, it } from 'vitest'
import { rgbToLab } from '../../src/core/colorMatching'
import { generatePattern } from '../../src/core/generate'
import { cleanupSmallRegions } from '../../src/core/regionCleanup'
import { SAMPLE_FIELDS } from '../../src/core/metrics'
import { getPalette } from '../../src/data/palettes'
import { preparePalette } from '../../src/core/colorMatching'
import type { PackedSampleGrid } from '../../src/types'

function syntheticGrid(): PackedSampleGrid {
  const width = 12
  const height = 10
  const data = new Float32Array(width * height * SAMPLE_FIELDS)
  const colors = [[250, 84, 61], [15, 84, 192], [22, 111, 65], [255, 243, 101], [72, 70, 78]]
  for (let index = 0; index < width * height; index += 1) {
    const color = colors[(Math.floor(index / width / 2) + Math.floor((index % width) / 3)) % colors.length]
    const lab = rgbToLab(color[0], color[1], color[2])
    const offset = index * SAMPLE_FIELDS
    data[offset] = lab.l
    data[offset + 1] = lab.a
    data[offset + 2] = lab.b
    data[offset + 3] = index === 0 ? 0 : 1
    data[offset + 4] = 0.01
    data[offset + 5] = index % width === 5 ? 0.7 : 0.08
  }
  return { width, height, data }
}

describe('generation modes', () => {
  it('only emits codes from the selected palette', () => {
    const result = generatePattern(syntheticGrid(), { mode: 'closest', paletteId: '221', maxColors: 'auto' })
    const allowed = new Set(getPalette('221').map((color) => color.code))
    expect(result.codes.every((code) => code === null || allowed.has(code))).toBe(true)
  })

  it('strictly honors a user color cap', () => {
    const result = generatePattern(syntheticGrid(), { mode: 'minimal', paletteId: '221', maxColors: 4 })
    expect(result.colorCount).toBeLessThanOrEqual(4)
  })

  it('chooses automatic minimal colors deterministically', () => {
    const first = generatePattern(syntheticGrid(), { mode: 'minimal', paletteId: '221', maxColors: 'auto' })
    const second = generatePattern(syntheticGrid(), { mode: 'minimal', paletteId: '221', maxColors: 'auto' })
    expect(first.autoSelectedK).toBe(second.autoSelectedK)
    expect(first.deterministicHash).toBe(second.deterministicHash)
    expect(first.codes).toEqual(second.codes)
  })

  it('keeps usage and mode relationships internally consistent', () => {
    const grid = syntheticGrid()
    const closest = generatePattern(grid, { mode: 'closest', paletteId: '221', maxColors: 'auto' })
    const minimal = generatePattern(grid, { mode: 'minimal', paletteId: '221', maxColors: 4 })
    const balanced = generatePattern(grid, { mode: 'balanced', paletteId: '221', maxColors: 'auto' })
    expect(closest.beadCount).toBe(grid.width * grid.height - 1)
    expect(minimal.beadCount).toBe(closest.beadCount)
    expect(minimal.colorCount).toBeLessThanOrEqual(closest.colorCount)
    expect(closest.fullPaletteMetrics.mean).toBeLessThanOrEqual(minimal.metrics.mean + 1e-8)
    expect(balanced.colorCount).toBeGreaterThan(1)
    expect(balanced.colorCount).toBeLessThanOrEqual(32)
  })

  it('does not change transparent positions during cleanup', () => {
    const grid = syntheticGrid()
    const palette = preparePalette(getPalette('221'))
    const codes = Array<string | null>(grid.width * grid.height).fill('F5')
    codes[0] = null
    codes[11] = 'C8'
    const cleaned = cleanupSmallRegions(codes, grid, palette, 'minimal')
    expect(cleaned[0]).toBeNull()
    expect(cleaned.filter((code) => code === null)).toHaveLength(1)
    expect(cleaned.every((code) => code === null || palette.some((color) => color.code === code))).toBe(true)
  })
})
