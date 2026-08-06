import { describe, expect, it } from 'vitest'
import { deltaE00, rgbToLab } from '../../src/core/colorMatching'
import { sampleImageToGrid } from '../../src/core/imageSampling'
import { unpackSample } from '../../src/core/metrics'

function buffer(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = pixel(x, y)
      data.set(value, (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

describe('adaptive cell sampling', () => {
  it('does not let one center pixel replace the surrounding cell region', () => {
    const source = buffer(7, 7, (x, y) => x === 3 && y === 3 ? [0, 0, 255, 255] : [255, 0, 0, 255])
    const sample = unpackSample(sampleImageToGrid(source, 1, 1), 0)
    expect(deltaE00(sample.lab, rgbToLab(255, 0, 0))).toBeLessThan(2)
    expect(deltaE00(sample.lab, rgbToLab(0, 0, 255))).toBeGreaterThan(40)
  })

  it('keeps a sharp two-color block boundary', () => {
    const source = buffer(14, 7, (x) => x < 7 ? [255, 0, 0, 255] : [0, 0, 255, 255])
    const grid = sampleImageToGrid(source, 2, 1)
    expect(deltaE00(unpackSample(grid, 0).lab, rgbToLab(255, 0, 0))).toBeLessThan(1)
    expect(deltaE00(unpackSample(grid, 1).lab, rgbToLab(0, 0, 255))).toBeLessThan(1)
  })

  it('keeps fully transparent cells empty', () => {
    const source = buffer(7, 7, () => [255, 0, 0, 0])
    expect(unpackSample(sampleImageToGrid(source, 1, 1), 0).alpha).toBe(0)
  })
})
