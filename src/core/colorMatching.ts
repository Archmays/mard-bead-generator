import { converter, differenceCiede2000 } from 'culori'
import type { Lab65 } from 'culori'
import type { LabColor, MardColor, PreparedMardColor } from '../types'

const toLab65 = converter('lab65')
const ciede2000 = differenceCiede2000()
const PRESELECT_COUNT = 12

export function rgbToLab(red: number, green: number, blue: number): LabColor {
  const converted = toLab65({
    mode: 'rgb',
    r: red / 255,
    g: green / 255,
    b: blue / 255,
  })
  return {
    mode: 'lab65',
    l: converted.l,
    a: converted.a,
    b: converted.b,
  }
}

export function preparePalette(colors: MardColor[]): PreparedMardColor[] {
  return colors.map((color) => {
    const lab = toLab65(color.hex)
    if (!lab) throw new Error(`无法解析 MARD 色值：${color.code} ${color.hex}`)
    return {
      ...color,
      lab: { mode: 'lab65', l: lab.l, a: lab.a, b: lab.b },
    }
  })
}

export function deltaE00(first: LabColor, second: LabColor): number {
  return ciede2000(first as Lab65, second as Lab65)
}

export function labDistanceSquared(first: LabColor, second: LabColor): number {
  const dl = first.l - second.l
  const da = first.a - second.a
  const db = first.b - second.b
  return dl * dl + da * da + db * db
}

function insertCandidate(candidates: Array<{ index: number; distance: number }>, candidate: { index: number; distance: number }) {
  let position = candidates.length
  for (let index = 0; index < candidates.length; index += 1) {
    if (candidate.distance < candidates[index].distance) {
      position = index
      break
    }
  }
  candidates.splice(position, 0, candidate)
  if (candidates.length > PRESELECT_COUNT) candidates.pop()
}

export function nearestPaletteIndex(
  lab: LabColor,
  palette: PreparedMardColor[],
  allowedIndices?: readonly number[],
): { index: number; distance: number } {
  if (palette.length === 0) throw new Error('当前 MARD 色板为空。')

  const indices = allowedIndices ?? palette.map((_, index) => index)
  const candidates: Array<{ index: number; distance: number }> = []

  if (indices.length <= PRESELECT_COUNT) {
    for (const index of indices) {
      insertCandidate(candidates, { index, distance: 0 })
    }
  } else {
    for (const index of indices) {
      insertCandidate(candidates, {
        index,
        distance: labDistanceSquared(lab, palette[index].lab),
      })
    }
  }

  let bestIndex = candidates[0].index
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const distance = deltaE00(lab, palette[candidate.index].lab)
    if (distance < bestDistance || (distance === bestDistance && candidate.index < bestIndex)) {
      bestDistance = distance
      bestIndex = candidate.index
    }
  }
  return { index: bestIndex, distance: bestDistance }
}

export function paletteIndexByCode(palette: PreparedMardColor[]): Map<string, number> {
  return new Map(palette.map((color, index) => [color.code, index]))
}
