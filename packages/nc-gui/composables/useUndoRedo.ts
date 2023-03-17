import type { Ref } from 'vue'
import rfdc from 'rfdc'
import { createSharedComposable, ref, useRouter } from '#imports'
import type { UndoRedoAction } from '~/lib'

export const useUndoRedo = createSharedComposable(() => {
  const clone = rfdc()

  const router = useRouter()

  const route = $(router.currentRoute)

  const scope = computed<string[]>(() => {
    let tempScope = ['root']
    for (const param of Object.values(route.params)) {
      if (Array.isArray(param)) {
        tempScope = tempScope.concat(param)
      } else {
        tempScope.push(param)
      }
    }
    if (
      Object.keys(route.params).includes('viewTitle') &&
      Object.keys(route.params).includes('title') &&
      route.params.viewTitle.length
    ) {
      tempScope.splice(tempScope.indexOf(route.params.title as string), 1)
    }
    return tempScope
  })

  const undoQueue: Ref<UndoRedoAction[]> = ref([])

  const redoQueue: Ref<UndoRedoAction[]> = ref([])

  const addUndo = (action: UndoRedoAction) => {
    undoQueue.value.push(action)
  }

  const addRedo = (action: UndoRedoAction) => {
    redoQueue.value.push(action)
  }

  const undo = async () => {
    let actionIndex = -1
    for (let i = undoQueue.value.length - 1; i >= 0; i--) {
      if (Array.isArray(undoQueue.value[i].scope)) {
        if (scope.value.some((s) => undoQueue.value[i].scope?.includes(s))) {
          actionIndex = i
          break
        }
      } else {
        if (scope.value.includes((undoQueue.value[i].scope as string) || 'root')) {
          actionIndex = i
          break
        }
      }
    }

    if (actionIndex === -1) return

    const action = undoQueue.value.splice(actionIndex, 1)[0]
    if (action) {
      await action.undo.fn.apply(action, action.undo.args)
      addRedo(action)
    }
  }

  const redo = async () => {
    let actionIndex = -1
    for (let i = redoQueue.value.length - 1; i >= 0; i--) {
      if (Array.isArray(redoQueue.value[i].scope)) {
        if (scope.value.some((s) => redoQueue.value[i].scope?.includes(s))) {
          actionIndex = i
          break
        }
      } else {
        if (scope.value.includes((redoQueue.value[i].scope as string) || 'root')) {
          actionIndex = i
          break
        }
      }
    }

    if (actionIndex === -1) return

    const action = redoQueue.value.splice(actionIndex, 1)[0]
    if (action) {
      await action.redo.fn.apply(action, action.redo.args)
      addUndo(action)
    }
  }

  useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
    if (cmdOrCtrl && !e.altKey) {
      switch (e.keyCode) {
        case 90: {
          e.preventDefault()
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
