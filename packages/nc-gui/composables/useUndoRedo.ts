export const useUndoRedo = createSharedComposable(() => {
  const isUndoRedoInFlight = ref(false)
  const inFlightDirection = ref<'undo' | 'redo' | null>(null)
  const isDisabledByEnv = computed(() => true)

  const canDispatchUndoRedo = computed(() => false)

  const undo = () => {}
  const redo = () => {}
  const toastWithUndo = (content: string) => message.toast(content)

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
