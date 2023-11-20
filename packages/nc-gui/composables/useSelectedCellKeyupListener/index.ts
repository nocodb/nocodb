import { isClient } from '@vueuse/core'
import type { ComputedRef, Ref } from 'vue'
import { cmdKActive } from '#imports'

function useSelectedCellKeyupListener(
  selected: Ref<boolean | undefined> | ComputedRef<boolean | undefined>,
  handler: (e: KeyboardEvent) => void,
  { immediate = false }: { immediate?: boolean } = {},
) {
  const finalHandler = (e: KeyboardEvent) => {
    if (cmdKActive()) return
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

export { useSelectedCellKeyupListener, useSelectedCellKeyupListener as useActiveKeyupListener }
