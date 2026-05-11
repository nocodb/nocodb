import { isClient } from '@vueuse/core'
import type { ComputedRef, Ref } from 'vue'

function useSelectedCellKeydownListener(
  selected: Ref<boolean | undefined> | ComputedRef<boolean | undefined>,
  handler: (e: KeyboardEvent) => void,
  { immediate = false, isGridCell = true }: { immediate?: boolean; isGridCell?: boolean } = {},
) {
  // Detect whether THIS cell is being rendered inside the expanded-record
  // side panel (EFP). The panel hardcodes `active=true` on every cell it
  // renders so every cell registers a document keydown listener — without a
  // gate, every panel cell fires on every keystroke, including ones the user
  // directed at the grid behind the panel.
  const isInsideExpandedFormPanel = inject(IsExpandedFormOpenInj, ref(false))

  const finalHandler = (e: KeyboardEvent) => {
    if (cmdKActive()) return

    // If this cell is in the EFP and the user's current interaction intent is
    // NOT on the panel (e.g. their last click was on a grid cell), bail. The
    // grid's own keyboard handlers will take it from here. Without this,
    // pressing Enter on a grid cell while EFP is open opens the panel's
    // corresponding-field picker/dropdown.
    if (isInsideExpandedFormPanel.value && !isExpandedFormPanelOpen()) {
      return
    }

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
