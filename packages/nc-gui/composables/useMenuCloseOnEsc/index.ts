import { isClient } from '@vueuse/core'
import type { Ref } from 'vue'

export function useMenuCloseOnEsc(open: Ref<boolean>) {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      open.value = false
    }
  }
  if (isClient) {
    watch(open, (nextVal, _, cleanup) => {
      // bind listener when `open` is truthy
      if (nextVal) {
        document.addEventListener('keydown', handler, true)
        // if `open` is falsy then remove the event handler
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
