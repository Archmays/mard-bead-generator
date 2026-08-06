import mard221Json from './mard-221.json'
import mard291Json from './mard-291.json'
import type { MardColor, PaletteId } from '../types'

export const MARD_PALETTE_VERSION = 'maxcleme-beadcolors-29229889-2026-08-06'
export const MARD_SOURCE_URL = 'https://github.com/maxcleme/beadcolors/tree/29229889daab404fb30531d4bb785fd73f7f58e3'

export const mard221 = mard221Json as MardColor[]
export const mard291 = mard291Json as MardColor[]

export function getPalette(id: PaletteId): MardColor[] {
  return id === '221' ? mard221 : mard291
}
