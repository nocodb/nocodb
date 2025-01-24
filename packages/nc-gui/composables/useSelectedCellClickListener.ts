import { isClient } from '@vueuse/core'
import type { ComputedRef, Ref } from 'vue'

export function useSelectedCellClickListener(
  selected: Ref<boolean | undefined> | ComputedRef<boolean | undefined>,
  handler: (e: MouseEvent) => void,
  { immediate = false, isGridCell = true }: { immediate?: boolean; isGridCell?: boolean } = {},
) {
  const finalHandler = (e: MouseEvent) => {
    if (isGridCell) {
      // if clicked element is out of tabular UI, don't trigger the handler
      if (!(e.target as HTMLElement).closest('table, .nc-group-table, .nc-grid-wrapper')) {
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
          document.addEventListener('click', finalHandler, true)
          // if `selected` is falsy then remove the event handler
        } else {
          document.removeEventListener('click', finalHandler, true)
        }

        // cleanup is called whenever the watcher is re-evaluated or stopped
        cleanup(() => {
          document.removeEventListener('click', finalHandler, true)
        })
      },
      { immediate },
    )
  }
}
