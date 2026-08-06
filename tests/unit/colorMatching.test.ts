import { describe, expect, it } from 'vitest'
import { deltaE00, nearestPaletteIndex, preparePalette, rgbToLab } from '../../src/core/colorMatching'
import { mard221 } from '../../src/data/palettes'
import type { LabColor } from '../../src/types'

const lab = (l: number, a: number, b: number): LabColor => ({ mode: 'lab65', l, a, b })

describe('CIEDE2000 matching', () => {
  it.each([
    [lab(50, 2.6772, -79.7751), lab(50, 0, -82.7485), 2.0425],
    [lab(50, 3.1571, -77.2803), lab(50, 0, -82.7485), 2.8615],
    [lab(50, 2.8361, -74.02), lab(50, 0, -82.7485), 3.4412],
    [lab(50, -1.3802, -84.2814), lab(50, 0, -82.7485), 1],
  ])('matches a Sharma, Wu and Dalal supplementary pair', (first, second, expected) => {
    expect(deltaE00(first, second)).toBeCloseTo(expected, 4)
  })

  it('returns the exact MARD code for an exact palette color', () => {
    const palette = preparePalette(mard221)
    const exact = palette.find((color) => color.code === 'F5')!
    const match = nearestPaletteIndex(exact.lab, palette)
    expect(palette[match.index].code).toBe('F5')
    expect(match.distance).toBeCloseTo(0, 8)
  })

  it('converts sRGB primaries to distinct Lab colors', () => {
    expect(deltaE00(rgbToLab(255, 0, 0), rgbToLab(0, 0, 255))).toBeGreaterThan(40)
  })
})
