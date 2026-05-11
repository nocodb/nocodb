export const useUndoRedo = createSharedComposable(() => {
  const isUndoRedoInFlight = ref(false)

  const undo = () => {}
  const redo = () => {}

  return {
    undo,
    redo,
    isUndoRedoInFlight,
  }
})
