import { getUsageRows } from '../core/metrics'
import type { GenerationResult, MardColor } from '../types'

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function createUsageCsv(result: GenerationResult, palette: MardColor[], packSize: number): Blob {
  const header = ['mard_code', 'display_name', 'hex', 'count', 'percentage', 'estimated_packs']
  const rows = getUsageRows(result, palette)
    .sort((first, second) => second.count - first.count || first.code.localeCompare(second.code, 'en', { numeric: true }))
    .map((row) => [
      row.code,
      row.color.displayNameZh ?? row.code,
      row.color.hex,
      row.count,
      (row.percentage * 100).toFixed(2),
      Math.ceil(row.count / Math.max(1, packSize)),
    ])
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  return new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: 'text/csv;charset=utf-8' })
}
