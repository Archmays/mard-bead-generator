import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createUsageCsv } from '../../src/render/exportCsv'
import { canvasToBlob } from '../../src/render/canvasUtils'
import { renderBeadPreview } from '../../src/render/renderBeadPreview'
import { renderCodeChart } from '../../src/render/renderCodeChart'
import { createPatternPdf } from '../../src/render/exportPdf'
import { getPalette } from '../../src/data/palettes'
import type { GenerationResult } from '../../src/types'

const PNG_BYTES = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
const ONE_PIXEL_JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k='

class FakeContext {
  fillStyle = ''
  strokeStyle = ''
  font = ''
  lineWidth = 1
  textAlign = 'left'
  textBaseline = 'alphabetic'
  globalCompositeOperation = 'source-over'
  imageSmoothingEnabled = true
  imageSmoothingQuality = 'low'
  fillRect() {}
  clearRect() {}
  beginPath() {}
  arc() {}
  fill() {}
  stroke() {}
  save() {}
  restore() {}
  moveTo() {}
  lineTo() {}
  fillText() {}
  strokeRect() {}
  drawImage() {}
}

class FakeCanvas {
  width = 300
  height = 150
  context = new FakeContext()
  getContext() { return this.context }
  toDataURL(type = 'image/png') { return type === 'image/jpeg' ? `data:image/jpeg;base64,${ONE_PIXEL_JPEG}` : `data:image/png;base64,${Buffer.from(PNG_BYTES).toString('base64')}` }
  toBlob(callback: (blob: Blob) => void) { callback(new Blob([PNG_BYTES], { type: 'image/png' })) }
}

const result: GenerationResult = {
  width: 2,
  height: 2,
  codes: ['F5', 'C8', null, 'F5'],
  mode: 'closest',
  paletteId: '221',
  metrics: { mean: 1, p95: 2 },
  fullPaletteMetrics: { mean: 1, p95: 2 },
  colorCount: 2,
  beadCount: 3,
  selectedCodes: ['C8', 'F5'],
  deterministicHash: '12345678',
}

let originalDocument: typeof document | undefined

beforeEach(() => {
  originalDocument = globalThis.document
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: (tag: string) => tag === 'canvas' ? new FakeCanvas() : {} },
  })
})

afterEach(() => {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
})

describe('export functions', () => {
  it('creates UTF-8 BOM CSV with the required columns and correct count sum', async () => {
    const blob = createUsageCsv(result, getPalette('221'), 1000)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes.slice(3))
    expect(text).toContain('mard_code,display_name,hex,count,percentage,estimated_packs')
    expect(text).toContain('F5')
  })

  it('creates non-empty PNG blobs for bead and code chart canvases', async () => {
    const palette = getPalette('221')
    const previewBlob = await canvasToBlob(renderBeadPreview(result, palette))
    const chartBlob = await canvasToBlob(renderCodeChart(result, palette))
    expect([...new Uint8Array(await previewBlob.arrayBuffer()).slice(0, 8)]).toEqual([...PNG_BYTES.slice(0, 8)])
    expect(chartBlob.size).toBeGreaterThan(8)
  })

  it('creates a non-empty PDF file', async () => {
    const blob = await createPatternPdf(result, getPalette('221'), { beadSizeMm: 5, packSize: 1000 })
    const header = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 4))
    expect(header).toBe('%PDF')
    expect(blob.size).toBeGreaterThan(500)
  })
})
