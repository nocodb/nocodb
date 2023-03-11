import type { Ref } from 'vue'
import clone from 'just-clone'
import { createSharedComposable, ref } from '#imports'
import type { UndoRedoAction } from '~/lib'

export const useUndoRedo = createSharedComposable(() => {
  const undoQueue: Ref<UndoRedoAction[]> = ref([])

  const redoQueue: Ref<UndoRedoAction[]> = ref([])

  const addUndo = (action: UndoRedoAction) => {
    undoQueue.value.push(action)
  }

  const addRedo = (action: UndoRedoAction) => {
    redoQueue.value.push(action)
  }

  const undo = () => {
    const action = undoQueue.value.pop()
    if (action) {
      action.undo.fn.apply(action, action.undo.args)
      addRedo(action)
    }
  }

  const redo = () => {
    const action = redoQueue.value.pop()
    if (action) {
      action.redo.fn.apply(action, action.redo.args)
      addUndo(action)
    }
  }

  useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
    if (cmdOrCtrl && !e.altKey) {
      switch (e.keyCode) {
        case 90: {
          // CMD + z and CMD + shift + z
          if (!e.shiftKey) {
            if (undoQueue.value.length) {
              undo()
            }
          } else {
            if (redoQueue.value.length) {
              redo()
            }
          }
          break
        }
      }
    }
  })

  return {
    addUndo,
    undo,
    clone,
  }
})
