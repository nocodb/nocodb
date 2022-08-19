import { ViewTypes } from 'nocodb-sdk'

import MdiGridIcon from '~icons/mdi/grid-large'
import MdiFormIcon from '~icons/mdi/form-select'
import MdiCalendarIcon from '~icons/mdi/calendar'
import MdiGalleryIcon from '~icons/mdi/camera-image'
import MdiKanbanIcon from '~icons/mdi/tablet-dashboard'
import MdiEyeIcon from '~icons/mdi/eye-circle-outline'

export const viewIcons = {
  [ViewTypes.GRID]: { icon: MdiGridIcon, color: '#8f96f2' },
  [ViewTypes.FORM]: { icon: MdiFormIcon, color: '#ec4899' },
  calendar: { icon: MdiCalendarIcon, color: 'purple' },
  [ViewTypes.GALLERY]: { icon: MdiGalleryIcon, color: 'orange' },
  [ViewTypes.KANBAN]: { icon: MdiKanbanIcon, color: 'green' },
  view: { icon: MdiEyeIcon, color: 'blue' },
}
