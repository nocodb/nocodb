import { ViewTypes } from 'nocodb-sdk'
import { themeV2Colors } from '#imports'
import { iconMap } from '~/utils/iconUtils'

import type { Language } from '~/lib'

export const viewIcons: Record<number | string, { icon: any; color: string }> = {
  [ViewTypes.GRID]: { icon: iconMap.grid, color: '#8f96f2' },
  [ViewTypes.FORM]: { icon: iconMap.form, color: themeV2Colors.pink['500'] },
  calendar: { icon: iconMap.calendar, color: 'purple' },
  [ViewTypes.GALLERY]: { icon: iconMap.gallery, color: 'orange' },
  [ViewTypes.MAP]: { icon: iconMap.map, color: 'blue' },
  [ViewTypes.KANBAN]: { icon: iconMap.kanban, color: 'green' },
  view: { icon: iconMap.view, color: 'blue' },
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
