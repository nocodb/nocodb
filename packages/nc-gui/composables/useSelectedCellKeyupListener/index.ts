import type { Ref } from 'vue'
import { onUnmounted, useEventListener } from '#imports'

export function useSelectedCellKeyupListener(selected: Ref<boolean>, handler: (e: KeyboardEvent) => void) {
  const cleanup: Ref<ReturnType<typeof useEventListener> | null> = ref(null)

  watch(selected, (value) => {
    if (value) {
      cleanup.value = useEventListener('keydown', handler, true)
    } else {
      cleanup.value?.()
    }
  })

  onUnmounted(() => cleanup.value?.())

  return {
    cleanup,
  }
}
