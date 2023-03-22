import { ViewTypes } from 'nocodb-sdk'
import { themeV2Colors } from '#imports'

import MdiCalendarIcon from '~icons/mdi/calendar'
import MdiMapIcon from '~icons/mdi/map-outline'
import type { Language } from '~/lib'
import PhTableThin from '~icons/ph/TableThin'
import PhImageThin from '~icons/ph/ImageThin'
import PhComputerTowerThin from '~icons/ph/ComputerTowerThin'
import PhSquareHalfBottomThin from '~icons/ph/SquareHalfBottomThin'
import PhEyeThin from '~icons/ph/EyeThin'

export const viewIcons: Record<number | string, { icon: any; color: string }> = {
  [ViewTypes.GRID]: { icon: PhTableThin, color: '#8f96f2' },
  [ViewTypes.FORM]: { icon: PhComputerTowerThin, color: themeV2Colors.pink['500'] },
  calendar: { icon: MdiCalendarIcon, color: 'purple' },
  [ViewTypes.GALLERY]: { icon: PhImageThin, color: 'orange' },
  [ViewTypes.MAP]: { icon: MdiMapIcon, color: 'blue' },
  [ViewTypes.KANBAN]: { icon: PhSquareHalfBottomThin, color: 'green' },
  view: { icon: PhEyeThin, color: 'blue' },
}

export const viewTypeAlias: Record<number, string> = {
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.FORM]: 'form',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.KANBAN]: 'kanban',
  [ViewTypes.MAP]: 'map',
}

export const isRtlLang = (lang: keyof typeof Language) => ['fa', 'ar'].includes(lang)

const rtl = 'rtl' as const
const ltr = 'ltr' as const

export function applyLanguageDirection(dir: typeof rtl | typeof ltr) {
  const oppositeDirection = dir === ltr ? rtl : ltr

  document.body.classList.remove(oppositeDirection)
  document.body.classList.add(dir)
  document.body.style.direction = dir
}

export const getViewIcon = (key?: string | number) => {
  if (!key) return

  return viewIcons[key]
}
