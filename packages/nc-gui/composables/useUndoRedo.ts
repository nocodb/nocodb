export const useUndoRedo = createSharedComposable(() => {
  const isUndoRedoInFlight = ref(false)
  const inFlightDirection = ref<'undo' | 'redo' | null>(null)
  const isDisabledByEnv = computed(() => true)

  const undo = () => {}
  const redo = () => {}

  return {
    undo,
    redo,
    isUndoRedoInFlight,
    inFlightDirection,
    isDisabledByEnv,
  }
})
