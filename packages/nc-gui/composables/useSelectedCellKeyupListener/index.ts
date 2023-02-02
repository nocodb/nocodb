import { isClient } from '@vueuse/core'
import type { Ref } from 'vue'

function useSelectedCellKeyupListener(
  selected: Ref<boolean>,
  handler: (e: KeyboardEvent) => void,
  { immediate = false }: { immediate?: boolean } = {},
) {
  if (isClient) {
    watch(
      selected,
      (nextVal: boolean, _: boolean, cleanup) => {
        // bind listener when `selected` is truthy
        if (nextVal) {
          document.addEventListener('keydown', handler, true)
          // if `selected` is falsy then remove the event handler
        } else {
          document.removeEventListener('keydown', handler, true)
        }

        // cleanup is called whenever the watcher is re-evaluated or stopped
        cleanup(() => {
          document.removeEventListener('keydown', handler, true)
        })
      },
      { immediate },
    )
  }
}

export { useSelectedCellKeyupListener, useSelectedCellKeyupListener as useActiveKeyupListener }
