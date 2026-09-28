export const useUndoRedo = createSharedComposable(() => {
  const isUndoRedoInFlight = ref(false)
  const inFlightDirection = ref<'undo' | 'redo' | null>(null)
  const isDisabledByEnv = computed(() => true)

  const canDispatchUndoRedo = computed(() => false)

  const undo = () => {}
  const redo = () => {}
  // Signature mirrors the EE impl; CE has no undo, so the options are inert.
  const toastWithUndo = (content: string, _opts?: { undoable?: boolean; event?: string; plainDuration?: number }) =>
    message.toast(content)

  return {
    undo,
    redo,
    toastWithUndo,
    canDispatchUndoRedo,
    isUndoRedoInFlight,
    inFlightDirection,
    isDisabledByEnv,
  }
})
