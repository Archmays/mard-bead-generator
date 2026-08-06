import { deltaE00, labDistanceSquared } from './colorMatching'
import { EMPTY_ALPHA_THRESHOLD, unpackSample, weightedMetrics } from './metrics'
import type { ErrorMetrics, GenerationMode, PackedSampleGrid, PreparedMardColor } from '../types'

export const MINIMAL_QUALITY_LIMITS = {
  meanFloor: 2.5,
  meanRatio: 0.3,
  p95Increment: 7,
  maximumK: 24,
} as const

export const BALANCED_QUALITY_LIMITS = {
  meanFloor: 1.3,
  meanRatio: 0.18,
  p95Increment: 4,
  minimumK: 4,
  preferredFloorK: 8,
  maximumK: 32,
  marginalGain: 0.35,
} as const

export interface RepresentativeCluster {
  lab: { mode: 'lab65'; l: number; a: number; b: number }
  weight: number
  count: number
  meanEdgeWeight: number
}

interface MutableCluster {
  l: number
  a: number
  b: number
  weight: number
  count: number
  edgeWeight: number
}

export interface CurvePoint {
  k: number
  selectedIndices: number[]
  metrics: ErrorMetrics
}

export interface OptimizationResult {
  selectedIndices: number[]
  autoSelectedK?: number
  representativeMetrics: ErrorMetrics
  fullRepresentativeMetrics: ErrorMetrics
}

function mutableToRepresentative(cluster: MutableCluster): RepresentativeCluster {
  return {
    lab: {
      mode: 'lab65',
      l: cluster.l / cluster.weight,
      a: cluster.a / cluster.weight,
      b: cluster.b / cluster.weight,
    },
    weight: cluster.weight,
    count: cluster.count,
    meanEdgeWeight: cluster.edgeWeight / cluster.weight,
  }
}

export function buildRepresentativeClusters(grid: PackedSampleGrid, maximum = 128): RepresentativeCluster[] {
  const bins = new Map<string, MutableCluster>()
  for (let index = 0; index < grid.width * grid.height; index += 1) {
    const sample = unpackSample(grid, index)
    if (sample.alpha < EMPTY_ALPHA_THRESHOLD) continue
    const weight = 1 + sample.edgeWeight * 1.75 + Math.min(1, sample.variance * 8)
    const key = `${Math.round(sample.lab.l / 2)}:${Math.round(sample.lab.a / 3)}:${Math.round(sample.lab.b / 3)}`
    const bin = bins.get(key) ?? { l: 0, a: 0, b: 0, weight: 0, count: 0, edgeWeight: 0 }
    bin.l += sample.lab.l * weight
    bin.a += sample.lab.a * weight
    bin.b += sample.lab.b * weight
    bin.weight += weight
    bin.count += 1
    bin.edgeWeight += sample.edgeWeight * weight
    bins.set(key, bin)
  }

  const points = [...bins.values()].map(mutableToRepresentative)
  if (points.length <= maximum) return points

  const totalWeight = points.reduce((sum, point) => sum + point.weight, 0)
  const weightedMean = {
    mode: 'lab65' as const,
    l: points.reduce((sum, point) => sum + point.lab.l * point.weight, 0) / totalWeight,
    a: points.reduce((sum, point) => sum + point.lab.a * point.weight, 0) / totalWeight,
    b: points.reduce((sum, point) => sum + point.lab.b * point.weight, 0) / totalWeight,
  }
  let firstIndex = 0
  let firstDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < points.length; index += 1) {
    const distance = labDistanceSquared(points[index].lab, weightedMean)
    if (distance < firstDistance) {
      firstDistance = distance
      firstIndex = index
    }
  }

  const centers = [{ ...points[firstIndex].lab }]
  const nearestDistances = points.map((point) => labDistanceSquared(point.lab, centers[0]))
  while (centers.length < maximum) {
    let nextIndex = 0
    let nextScore = -1
    for (let index = 0; index < points.length; index += 1) {
      const score = nearestDistances[index] * Math.sqrt(points[index].weight)
      if (score > nextScore) {
        nextScore = score
        nextIndex = index
      }
    }
    centers.push({ ...points[nextIndex].lab })
    for (let index = 0; index < points.length; index += 1) {
      nearestDistances[index] = Math.min(
        nearestDistances[index],
        labDistanceSquared(points[index].lab, centers.at(-1)!),
      )
    }
  }

  let assignments = new Int16Array(points.length)
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const accumulators = Array.from({ length: maximum }, () => ({ l: 0, a: 0, b: 0, weight: 0, count: 0, edgeWeight: 0 }))
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      let bestCenter = 0
      let bestDistance = Number.POSITIVE_INFINITY
      for (let centerIndex = 0; centerIndex < centers.length; centerIndex += 1) {
        const distance = labDistanceSquared(points[pointIndex].lab, centers[centerIndex])
        if (distance < bestDistance) {
          bestDistance = distance
          bestCenter = centerIndex
        }
      }
      assignments[pointIndex] = bestCenter
      const accumulator = accumulators[bestCenter]
      const point = points[pointIndex]
      accumulator.l += point.lab.l * point.weight
      accumulator.a += point.lab.a * point.weight
      accumulator.b += point.lab.b * point.weight
      accumulator.weight += point.weight
      accumulator.count += point.count
      accumulator.edgeWeight += point.meanEdgeWeight * point.weight
    }
    for (let centerIndex = 0; centerIndex < centers.length; centerIndex += 1) {
      const accumulator = accumulators[centerIndex]
      if (accumulator.weight > 0) {
        centers[centerIndex] = {
          mode: 'lab65',
          l: accumulator.l / accumulator.weight,
          a: accumulator.a / accumulator.weight,
          b: accumulator.b / accumulator.weight,
        }
      }
    }
  }

  const finalClusters = Array.from({ length: maximum }, () => ({ l: 0, a: 0, b: 0, weight: 0, count: 0, edgeWeight: 0 }))
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    const cluster = finalClusters[assignments[index]]
    cluster.l += point.lab.l * point.weight
    cluster.a += point.lab.a * point.weight
    cluster.b += point.lab.b * point.weight
    cluster.weight += point.weight
    cluster.count += point.count
    cluster.edgeWeight += point.meanEdgeWeight * point.weight
  }
  return finalClusters.filter((cluster) => cluster.weight > 0).map(mutableToRepresentative)
}

export function buildDistanceMatrix(clusters: RepresentativeCluster[], palette: PreparedMardColor[]): number[][] {
  return clusters.map((cluster) => palette.map((color) => deltaE00(cluster.lab, color.lab)))
}

function metricsForSelection(
  clusters: RepresentativeCluster[],
  distances: number[][],
  selectedIndices: readonly number[],
): ErrorMetrics {
  return weightedMetrics(clusters.map((cluster, clusterIndex) => ({
    weight: cluster.weight,
    distance: Math.min(...selectedIndices.map((index) => distances[clusterIndex][index])),
  })))
}

export function buildGreedyCurve(
  clusters: RepresentativeCluster[],
  palette: PreparedMardColor[],
  maximumK: number,
): { curve: CurvePoint[]; distances: number[][]; fullMetrics: ErrorMetrics } {
  const distances = buildDistanceMatrix(clusters, palette)
  const selected: number[] = []
  const selectedSet = new Set<number>()
  const currentDistances = new Float64Array(clusters.length)
  currentDistances.fill(Number.POSITIVE_INFINITY)
  const curve: CurvePoint[] = []

  for (let step = 0; step < Math.min(maximumK, palette.length); step += 1) {
    let bestPaletteIndex = -1
    let bestTotal = Number.POSITIVE_INFINITY
    for (let paletteIndex = 0; paletteIndex < palette.length; paletteIndex += 1) {
      if (selectedSet.has(paletteIndex)) continue
      let total = 0
      for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex += 1) {
        total += Math.min(currentDistances[clusterIndex], distances[clusterIndex][paletteIndex]) * clusters[clusterIndex].weight
      }
      if (total < bestTotal) {
        bestTotal = total
        bestPaletteIndex = paletteIndex
      }
    }
    if (bestPaletteIndex < 0) break
    selected.push(bestPaletteIndex)
    selectedSet.add(bestPaletteIndex)
    for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex += 1) {
      currentDistances[clusterIndex] = Math.min(currentDistances[clusterIndex], distances[clusterIndex][bestPaletteIndex])
    }
    curve.push({
      k: selected.length,
      selectedIndices: [...selected],
      metrics: metricsForSelection(clusters, distances, selected),
    })
  }

  const fullMetrics = weightedMetrics(clusters.map((cluster, clusterIndex) => ({
    weight: cluster.weight,
    distance: Math.min(...distances[clusterIndex]),
  })))
  return { curve, distances, fullMetrics }
}

function refineBySwaps(
  clusters: RepresentativeCluster[],
  distances: number[][],
  paletteSize: number,
  initial: number[],
): number[] {
  let selected = [...initial]
  for (let round = 0; round < 2; round += 1) {
    const selectedSet = new Set(selected)
    let currentTotal = metricsForSelection(clusters, distances, selected).mean
    let bestTotal = currentTotal
    let bestPosition = -1
    let bestCandidate = -1

    for (let position = 0; position < selected.length; position += 1) {
      const otherSelected = selected.filter((_, index) => index !== position)
      const otherBest = clusters.map((_, clusterIndex) =>
        otherSelected.length === 0
          ? Number.POSITIVE_INFINITY
          : Math.min(...otherSelected.map((paletteIndex) => distances[clusterIndex][paletteIndex])),
      )
      for (let candidate = 0; candidate < paletteSize; candidate += 1) {
        if (selectedSet.has(candidate)) continue
        let weightedTotal = 0
        let totalWeight = 0
        for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex += 1) {
          weightedTotal += Math.min(otherBest[clusterIndex], distances[clusterIndex][candidate]) * clusters[clusterIndex].weight
          totalWeight += clusters[clusterIndex].weight
        }
        const mean = weightedTotal / totalWeight
        if (mean + 1e-9 < bestTotal) {
          bestTotal = mean
          bestPosition = position
          bestCandidate = candidate
        }
      }
    }
    if (bestPosition < 0 || currentTotal - bestTotal < 1e-6) break
    selected[bestPosition] = bestCandidate
    currentTotal = bestTotal
  }
  return selected.sort((first, second) => first - second)
}

function withinQuality(
  candidate: ErrorMetrics,
  full: ErrorMetrics,
  limits: { meanFloor: number; meanRatio: number; p95Increment: number },
) {
  return candidate.mean <= full.mean + Math.max(limits.meanFloor, limits.meanRatio * full.mean)
    && candidate.p95 <= full.p95 + limits.p95Increment
}

export function optimizeMardSubset(
  grid: PackedSampleGrid,
  palette: PreparedMardColor[],
  mode: Exclude<GenerationMode, 'closest'>,
  maximumColors: 'auto' | number,
): OptimizationResult {
  const clusters = buildRepresentativeClusters(grid)
  if (clusters.length === 0) {
    return {
      selectedIndices: [],
      representativeMetrics: { mean: 0, p95: 0 },
      fullRepresentativeMetrics: { mean: 0, p95: 0 },
    }
  }

  const maximumK = mode === 'minimal' ? MINIMAL_QUALITY_LIMITS.maximumK : BALANCED_QUALITY_LIMITS.maximumK
  const { curve, distances, fullMetrics } = buildGreedyCurve(clusters, palette, maximumK)
  let point: CurvePoint
  let autoSelectedK: number | undefined

  if (mode === 'minimal') {
    if (maximumColors === 'auto') {
      point = curve.find((candidate) => candidate.k >= 2 && withinQuality(candidate.metrics, fullMetrics, MINIMAL_QUALITY_LIMITS))
        ?? curve[Math.min(curve.length, MINIMAL_QUALITY_LIMITS.maximumK) - 1]
      autoSelectedK = point.k
    } else {
      point = curve[Math.max(0, Math.min(curve.length, maximumColors) - 1)]
    }
  } else {
    point = curve[Math.min(curve.length, BALANCED_QUALITY_LIMITS.maximumK) - 1]
    for (let index = BALANCED_QUALITY_LIMITS.minimumK - 1; index < curve.length; index += 1) {
      const candidate = curve[index]
      if (!withinQuality(candidate.metrics, fullMetrics, BALANCED_QUALITY_LIMITS)) continue
      const previousMean = index === 0 ? Number.POSITIVE_INFINITY : curve[index - 1].metrics.mean
      if (candidate.k >= BALANCED_QUALITY_LIMITS.preferredFloorK || previousMean - candidate.metrics.mean < BALANCED_QUALITY_LIMITS.marginalGain) {
        point = candidate
        autoSelectedK = candidate.k
        break
      }
    }
  }

  const refined = refineBySwaps(clusters, distances, palette.length, point.selectedIndices)
  return {
    selectedIndices: refined,
    autoSelectedK,
    representativeMetrics: metricsForSelection(clusters, distances, refined),
    fullRepresentativeMetrics: fullMetrics,
  }
}
