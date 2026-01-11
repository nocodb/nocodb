import type { Ref } from 'vue'

const timeout = 3000 // in ms

export default function useShowNotEditableWarning(options: { onEnter?: (e: Event) => void; disable?: Ref<boolean> } = {}) {
  const showEditNonEditableFieldWarning = refAutoReset(false, timeout)
  const showClearNonEditableFieldWarning = refAutoReset(false, timeout)

  const activeCell = inject(ActiveCellInj, ref(false))

  const activateShowEditNonEditableFieldWarning = () => (showEditNonEditableFieldWarning.value = true)

  useSelectedCellKeydownListener(
    computed(() => activeCell.value && !options.disable?.value),
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          options.onEnter?.(e)
          showEditNonEditableFieldWarning.value = true
          break
        case 'Delete':
          showClearNonEditableFieldWarning.value = true
          break
      }
    },
  )
  return { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning }
}
