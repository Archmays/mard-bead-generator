import { deltaE00 } from './colorMatching'
import type {
  ErrorMetrics,
  GenerationResult,
  LabColor,
  MardColor,
  PackedSampleGrid,
  PreparedMardColor,
  SampledCell,
  UsageRow,
} from '../types'

export const SAMPLE_FIELDS = 6
export const EMPTY_ALPHA_THRESHOLD = 0.08

export function unpackSample(grid: PackedSampleGrid, index: number): SampledCell {
  const offset = index * SAMPLE_FIELDS
  return {
    lab: {
      mode: 'lab65',
      l: grid.data[offset],
      a: grid.data[offset + 1],
      b: grid.data[offset + 2],
    },
    alpha: grid.data[offset + 3],
    variance: grid.data[offset + 4],
    edgeWeight: grid.data[offset + 5],
  }
}

export function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((first, second) => first - second)
  const position = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1))
  return sorted[position]
}

export function calculateErrorMetrics(
  grid: PackedSampleGrid,
  codes: Array<string | null>,
  palette: PreparedMardColor[],
): ErrorMetrics {
  const colorByCode = new Map(palette.map((color) => [color.code, color]))
  const errors: number[] = []
  let total = 0
  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index]
    if (!code) continue
    const color = colorByCode.get(code)
    if (!color) throw new Error(`算法输出了色板外色号：${code}`)
    const error = deltaE00(unpackSample(grid, index).lab, color.lab)
    errors.push(error)
    total += error
  }
  return {
    mean: errors.length === 0 ? 0 : total / errors.length,
    p95: percentile(errors, 0.95),
  }
}

export function getUsageRows(result: GenerationResult, palette: MardColor[]): UsageRow[] {
  const countByCode = new Map<string, number>()
  for (const code of result.codes) {
    if (code) countByCode.set(code, (countByCode.get(code) ?? 0) + 1)
  }
  const colorByCode = new Map(palette.map((color) => [color.code, color]))
  return [...countByCode.entries()].map(([code, count]) => {
    const color = colorByCode.get(code)
    if (!color) throw new Error(`用量表找不到色号：${code}`)
    return {
      code,
      color,
      count,
      percentage: result.beadCount === 0 ? 0 : count / result.beadCount,
    }
  })
}

export function countNonEmpty(codes: Array<string | null>): number {
  return codes.reduce((count, code) => count + (code ? 1 : 0), 0)
}

export function deterministicCodeHash(codes: Array<string | null>, width: number, height: number): string {
  let hash = 0x811c9dc5
  const input = `${width}x${height}|${codes.map((code) => code ?? '_').join(',')}`
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function weightedMetrics(
  entries: Array<{ distance: number; weight: number }>,
): ErrorMetrics {
  if (entries.length === 0) return { mean: 0, p95: 0 }
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  const mean = entries.reduce((sum, entry) => sum + entry.distance * entry.weight, 0) / totalWeight
  const sorted = [...entries].sort((first, second) => first.distance - second.distance)
  const target = totalWeight * 0.95
  let cumulative = 0
  let p95 = sorted.at(-1)?.distance ?? 0
  for (const entry of sorted) {
    cumulative += entry.weight
    if (cumulative >= target) {
      p95 = entry.distance
      break
    }
  }
  return { mean, p95 }
}

export function labChroma(lab: LabColor): number {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b)
}
