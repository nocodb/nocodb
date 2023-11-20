import { ViewTypes } from 'nocodb-sdk'
import type { Language } from '../lib'
import { iconMap } from './iconUtils'

export const viewIcons: Record<number | string, { icon: any; color: string }> = {
  [ViewTypes.GRID]: { icon: iconMap.grid, color: '#36BFFF' },
  [ViewTypes.FORM]: { icon: iconMap.form, color: '#7D26CD' },
  calendar: { icon: iconMap.calendar, color: 'purple' },
  [ViewTypes.GALLERY]: { icon: iconMap.gallery, color: '#FC3AC6' },
  [ViewTypes.MAP]: { icon: iconMap.map, color: 'blue' },
  [ViewTypes.KANBAN]: { icon: iconMap.kanban, color: '#FF9052' },
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

export function applyNonSelectable() {
  document.body.classList.add('non-selectable')
}
