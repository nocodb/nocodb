import { ViewTypes } from 'nocodb-sdk'

export default {
  [ViewTypes.GRID]: { icon: 'mdi-grid-large', color: 'blue' },
  // [ViewTypes.GRID]: { icon: "mdi-grid-large", color: "blue" },
  [ViewTypes.FORM]: { icon: 'mdi-form-select', color: 'pink' },
  calendar: { icon: 'mdi-calendar', color: 'purple' },
  [ViewTypes.GALLERY]: { icon: 'mdi-camera-image', color: 'orange' },
  [ViewTypes.KANBAN]: { icon: 'mdi-tablet-dashboard', color: 'green' },
  view: { icon: 'mdi-eye-circle-outline', color: 'blue' }
}
