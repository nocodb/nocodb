import { ViewTypes } from 'nocodb-sdk'
import { iconMap } from './iconUtils'
import type { Language } from '~/lib/types'
import UsersIcon from '~icons/nc-icons/users'
import LockIcon from '~icons/nc-icons-v2/lock'
import PersonalIcon from '~icons/nc-icons/personal'

export const viewIcons: Record<number | string, { icon: any; color: string }> = {
  [ViewTypes.GRID]: { icon: iconMap.grid, color: '#36BFFF' },
  [ViewTypes.FORM]: { icon: iconMap.form, color: '#7D26CD' },
  [ViewTypes.CALENDAR]: { icon: iconMap.calendar, color: '#B33771' },
  [ViewTypes.GALLERY]: { icon: iconMap.gallery, color: '#FC3AC6' },
  [ViewTypes.MAP]: { icon: iconMap.map, color: 'blue' },
  [ViewTypes.KANBAN]: { icon: iconMap.kanban, color: '#FF9052' },
  view: { icon: iconMap.view, color: 'blue' },
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

export const viewLockIcons = {
  [LockType.Personal]: {
    title: 'title.personal',
    icon: PersonalIcon,
    subtitle: 'msg.info.personalView',
  },
  [LockType.Collaborative]: {
    title: 'title.collaborative',
    icon: UsersIcon,
    subtitle: 'msg.info.collabView',
  },
  [LockType.Locked]: {
    title: 'title.locked',
    icon: LockIcon,
    subtitle: 'msg.info.lockedView',
  },
}
