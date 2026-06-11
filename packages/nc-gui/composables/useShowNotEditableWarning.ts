const timeout = 3000 // in ms

export default function useShowNotEditableWarning(options: { onEnter?: (e: Event) => void } = {}) {
  const showEditNonEditableFieldWarning = refAutoReset(false, timeout)
  const showClearNonEditableFieldWarning = refAutoReset(false, timeout)

  const activateShowEditNonEditableFieldWarning = () => (showEditNonEditableFieldWarning.value = true)

  useSelectedCellKeydownListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        options.onEnter?.(e)
        showEditNonEditableFieldWarning.value = true
        break
      case 'Delete':
        showClearNonEditableFieldWarning.value = true
        break
    }
  })

  return { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning }
}
