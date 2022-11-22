import { isClient } from '@vueuse/core'
import type { Ref } from 'vue'

export function useSelectedCellKeyupListener(selected: Ref<boolean>, handler: (e: KeyboardEvent) => void) {
  if (isClient) {
    watch(selected, (nextVal, _, cleanup) => {
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
    })
  }
}
