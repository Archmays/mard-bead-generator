import { deltaE00 } from './colorMatching'
import { labChroma, unpackSample } from './metrics'
import type { GenerationMode, PackedSampleGrid, PreparedMardColor } from '../types'

const CLEANUP_RULES = {
  closest: { maximumRegion: 1, maximumErrorIncrease: 1.5, edgeProtection: 0.2 },
  balanced: { maximumRegion: 2, maximumErrorIncrease: 3.5, edgeProtection: 0.5 },
  minimal: { maximumRegion: 3, maximumErrorIncrease: 6, edgeProtection: 0.68 },
} as const

function neighbours(index: number, width: number, height: number): number[] {
  const x = index % width
  const y = Math.floor(index / width)
  const result: number[] = []
  if (x > 0) result.push(index - 1)
  if (x + 1 < width) result.push(index + 1)
  if (y > 0) result.push(index - width)
  if (y + 1 < height) result.push(index + width)
  return result
}

export function cleanupSmallRegions(
  originalCodes: Array<string | null>,
  grid: PackedSampleGrid,
  palette: PreparedMardColor[],
  mode: GenerationMode,
): Array<string | null> {
  const codes = [...originalCodes]
  const visited = new Uint8Array(codes.length)
  const paletteByCode = new Map(palette.map((color) => [color.code, color]))
  const rules = CLEANUP_RULES[mode]

  for (let start = 0; start < codes.length; start += 1) {
    const regionCode = codes[start]
    if (!regionCode || visited[start]) continue
    const queue = [start]
    const region: number[] = []
    visited[start] = 1
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]
      region.push(current)
      for (const neighbour of neighbours(current, grid.width, grid.height)) {
        if (!visited[neighbour] && codes[neighbour] === regionCode) {
          visited[neighbour] = 1
          queue.push(neighbour)
        }
      }
    }

    if (region.length > rules.maximumRegion) continue
    const samples = region.map((index) => unpackSample(grid, index))
    const meanEdge = samples.reduce((sum, sample) => sum + sample.edgeWeight, 0) / samples.length
    if (meanEdge > rules.edgeProtection) continue
    const meanChroma = samples.reduce((sum, sample) => sum + labChroma(sample.lab), 0) / samples.length
    if (meanChroma > 50 && meanEdge > 0.13) continue

    const candidateCounts = new Map<string, number>()
    for (const index of region) {
      for (const neighbour of neighbours(index, grid.width, grid.height)) {
        const candidate = codes[neighbour]
        if (candidate && candidate !== regionCode) {
          candidateCounts.set(candidate, (candidateCounts.get(candidate) ?? 0) + 1)
        }
      }
    }
    if (candidateCounts.size === 0) continue

    const currentColor = paletteByCode.get(regionCode)
    if (!currentColor) throw new Error(`区域清理遇到色板外色号：${regionCode}`)
    let bestCandidate: string | undefined
    let bestIncrease = Number.POSITIVE_INFINITY
    let bestAdjacency = -1
    for (const [candidateCode, adjacency] of candidateCounts) {
      const candidateColor = paletteByCode.get(candidateCode)
      if (!candidateColor) continue
      const contrast = deltaE00(currentColor.lab, candidateColor.lab)
      if (contrast > 12 && meanEdge > 0.25) continue
      let increase = 0
      for (const sample of samples) {
        increase += deltaE00(sample.lab, candidateColor.lab) - deltaE00(sample.lab, currentColor.lab)
      }
      increase /= samples.length
      if (increase < bestIncrease || (increase === bestIncrease && adjacency > bestAdjacency)) {
        bestIncrease = increase
        bestAdjacency = adjacency
        bestCandidate = candidateCode
      }
    }

    if (bestCandidate && bestIncrease <= rules.maximumErrorIncrease) {
      for (const index of region) codes[index] = bestCandidate
    }
  }
  return codes
}
