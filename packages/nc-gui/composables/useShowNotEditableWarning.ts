const timeout = 3000 // in ms

export default function useShowNotEditableWarning() {
  const showEditNonEditableFieldWarning = refAutoReset(false, timeout)
  const showClearNonEditableFieldWarning = refAutoReset(false, timeout)

  const activateShowEditNonEditableFieldWarning = () => (showEditNonEditableFieldWarning.value = true)

  useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        showEditNonEditableFieldWarning.value = true
        break
      case 'Delete':
        showClearNonEditableFieldWarning.value = true
        break
    }
  })

  return { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning }
}
