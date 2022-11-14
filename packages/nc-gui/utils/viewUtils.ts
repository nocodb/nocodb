import { ViewTypes } from 'nocodb-sdk'
import { themeV2Colors } from '~/utils'

import MdiGridIcon from '~icons/mdi/grid-large'
import MdiFormIcon from '~icons/mdi/form-select'
import MdiCalendarIcon from '~icons/mdi/calendar'
import MdiGalleryIcon from '~icons/mdi/camera-image'
import MdiKanbanIcon from '~icons/mdi/tablet-dashboard'
import MdiEyeIcon from '~icons/mdi/eye-circle-outline'
import type { Language } from '~/lib'

export const viewIcons: Record<number | string, { icon: any; color: string }> = {
  [ViewTypes.GRID]: { icon: MdiGridIcon, color: '#8f96f2' },
  [ViewTypes.FORM]: { icon: MdiFormIcon, color: themeV2Colors.pink['500'] },
  calendar: { icon: MdiCalendarIcon, color: 'purple' },
  [ViewTypes.GALLERY]: { icon: MdiGalleryIcon, color: 'orange' },
  [ViewTypes.KANBAN]: { icon: MdiKanbanIcon, color: 'green' },
  view: { icon: MdiEyeIcon, color: 'blue' },
}

export const viewTypeAlias: Record<number, string> = {
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.FORM]: 'form',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.KANBAN]: 'kanban',
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
