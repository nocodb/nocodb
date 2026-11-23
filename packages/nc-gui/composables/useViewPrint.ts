import type { TableType, ViewType } from 'nocodb-sdk'

// Print is EE-only (ee/composables/useViewPrint.ts). In CE nothing is provided, so the menu hides Print.
function useProvideViewPrint(_meta: Ref<TableType | undefined>, _view: Ref<ViewType | undefined>) {}

function useViewPrint(): { openSettings: () => void } | undefined {
  return undefined
}

export { useProvideViewPrint, useViewPrint }
