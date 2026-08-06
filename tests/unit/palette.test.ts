import { describe, expect, it } from 'vitest'
import { mard221, mard291 } from '../../src/data/palettes'

describe('MARD palette data gate', () => {
  it('contains the adopted 221 and 291 color versions', () => {
    expect(mard221).toHaveLength(221)
    expect(mard291).toHaveLength(291)
  })

  it.each([
    ['221', mard221],
    ['291', mard291],
  ])('%s palette has unique codes and valid six-digit HEX values', (_name, palette) => {
    const codes = palette.map((color) => color.code)
    expect(new Set(codes).size).toBe(palette.length)
    expect(palette.every((color) => color.code.length > 0)).toBe(true)
    expect(palette.every((color) => /^#[0-9A-F]{6}$/u.test(color.hex))).toBe(true)
    expect(new Set(palette.map((color) => `${color.code}|${color.hex}`)).size).toBe(palette.length)
  })

  it('defines the 221 palette as a strict, explainable subset of 291', () => {
    const complete = new Map(mard291.map((color) => [color.code, color.hex]))
    expect(mard221.every((color) => complete.get(color.code) === color.hex)).toBe(true)
    expect(new Set(mard221.map((color) => color.series))).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M']))
    expect(new Set(mard291.filter((color) => !complete.has(color.code)).map((color) => color.code))).toEqual(new Set())
  })

  it('marks the adopted extension families without pretending R material is known', () => {
    expect(mard291.find((color) => color.code === 'P1')?.material).toBe('pearl')
    expect(mard291.find((color) => color.code === 'T1')?.material).toBe('transparent')
    expect(mard291.find((color) => color.code === 'ZG1')?.material).toBe('glow')
    expect(mard291.find((color) => color.code === 'R1')?.material).toBe('unknown')
  })
})
