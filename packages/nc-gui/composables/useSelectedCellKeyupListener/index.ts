import { isClient } from '@vueuse/core'
import type { ComputedRef, Ref } from 'vue'

function useSelectedCellKeydownListener(
  selected: Ref<boolean | undefined> | ComputedRef<boolean | undefined>,
  handler: (e: KeyboardEvent) => void,
  { immediate = false, isGridCell = true }: { immediate?: boolean; isGridCell?: boolean } = {},
) {
  const finalHandler = (e: KeyboardEvent) => {
    if (cmdKActive()) return

    /**
     * If `useSelectedCellKeydownListener` used for grid cell and active element is not in grid then prevent
     */
    if (isGridCell) {
      if (isExpandedFormOpenExist() || isExpandedCellInputExist() || isFieldEditOrAddDropdownOpen()) {
        return
      }

      if (
        isActiveInputElementExist() &&
        !(document.activeElement as HTMLElement).closest('table, .nc-group-table, .nc-grid-wrapper')
      ) {
        return
      }
    }

    handler(e)
  }

  if (isClient) {
    watch(
      selected,
      (nextVal: boolean | undefined, _: boolean | undefined, cleanup) => {
        // bind listener when `selected` is truthy
        if (nextVal) {
          document.addEventListener('keydown', finalHandler, true)
          // if `selected` is falsy then remove the event handler
        } else {
          document.removeEventListener('keydown', finalHandler, true)
        }

        // cleanup is called whenever the watcher is re-evaluated or stopped
        cleanup(() => {
          document.removeEventListener('keydown', finalHandler, true)
        })
      },
      { immediate },
    )
  }
}

export { useSelectedCellKeydownListener, useSelectedCellKeydownListener as useActiveKeydownListener }
