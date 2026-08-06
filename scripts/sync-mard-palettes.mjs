import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SOURCE_COMMIT = '29229889daab404fb30531d4bb785fd73f7f58e3'
const SOURCE_FILE = 'raw/mard.csv'
const SOURCE_REF = `https://github.com/maxcleme/beadcolors/blob/${SOURCE_COMMIT}/${SOURCE_FILE}`
const RAW_URL = `https://raw.githubusercontent.com/maxcleme/beadcolors/${SOURCE_COMMIT}/${SOURCE_FILE}`
const BASIC_SERIES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'])

const seriesMetadata = {
  A: ['黄橙系', 'standard'],
  B: ['绿色系', 'standard'],
  C: ['蓝青系', 'standard'],
  D: ['紫色系', 'standard'],
  E: ['粉色系', 'standard'],
  F: ['红色系', 'standard'],
  G: ['肤棕系', 'standard'],
  H: ['黑白灰系', 'standard'],
  M: ['莫兰迪系', 'standard'],
  P: ['珠光系', 'pearl'],
  Q: ['荧光系', 'fluorescent'],
  R: ['特殊色系', 'unknown'],
  T: ['透明系', 'transparent'],
  Y: ['荧光系', 'fluorescent'],
  ZG: ['夜光系', 'glow'],
}

function familyOf(code) {
  return code.startsWith('ZG') ? 'ZG' : code[0]
}

function toHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => Number(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

async function readFixedSource() {
  try {
    const response = await fetch(RAW_URL)
    if (response.ok) return response.text()
  } catch {
    // Some managed Windows networks block raw.githubusercontent.com while
    // allowing the authenticated GitHub API. Keep the same immutable source.
  }

  return execFileSync(
    'gh',
    [
      'api',
      '-H',
      'Accept: application/vnd.github.raw+json',
      `repos/maxcleme/beadcolors/contents/${SOURCE_FILE}?ref=${SOURCE_COMMIT}`,
    ],
    { encoding: 'utf8' },
  )
}

const rows = (await readFixedSource())
  .trim()
  .split(/\r?\n/u)
  .map((line) => {
    const [code, _name, red, green, blue] = line.split(',')
    const series = familyOf(code)
    const [seriesName, material] = seriesMetadata[series] ?? ['未分类', 'unknown']
    return {
      code,
      hex: toHex(red, green, blue),
      series,
      displayNameZh: `${seriesName} ${code}`,
      material,
      sourceRef: SOURCE_REF,
    }
  })

const basic = rows.filter((color) => BASIC_SERIES.has(color.series))
if (basic.length !== 221 || rows.length !== 291) {
  throw new Error(`Unexpected palette counts: basic=${basic.length}, complete=${rows.length}`)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDirectory = path.join(root, 'src', 'data')
await mkdir(dataDirectory, { recursive: true })
await Promise.all([
  writeFile(path.join(dataDirectory, 'mard-221.json'), `${JSON.stringify(basic, null, 2)}\n`, 'utf8'),
  writeFile(path.join(dataDirectory, 'mard-291.json'), `${JSON.stringify(rows, null, 2)}\n`, 'utf8'),
])

console.log(`Generated MARD palettes from ${SOURCE_COMMIT}: 221 / 291 colors`)
