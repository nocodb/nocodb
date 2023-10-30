import type { Ref } from 'vue'
import rfdc from 'rfdc'
import type { BaseType, TableType, ViewType } from 'nocodb-sdk'
import { createSharedComposable, ref, useRouter } from '#imports'
import type { UndoRedoAction } from '#imports'

export const useUndoRedo = createSharedComposable(() => {
  const clone = rfdc()

  const router = useRouter()

  const route = router.currentRoute

  // keys: baseType | baseId | type | title | viewTitle
  const scope = computed<{ key: string; param: string }[]>(() => {
    const tempScope: { key: string; param: string }[] = [{ key: 'root', param: 'root' }]
    for (const [key, param] of Object.entries(route.value.params)) {
      if (Array.isArray(param)) {
        tempScope.push({ key, param: param.join(',') })
      } else {
        tempScope.push({ key, param })
      }
    }

    return tempScope
  })

  const isSameScope = (sc: { key: string; param: string | string[] }[]) => {
    // TODO - improve this logic
    // for now we disable undo/redo for webhook, field, api, relation
    const slugs = scope.value.find((s) => s.key === 'slugs')
    if (slugs) {
      const params = Array.isArray(slugs.param) ? slugs.param : slugs.param.split(',')
      if (params.some((el) => ['webhook', 'field', 'api', 'relation'].includes(el))) {
        return false
      }
    }

    return sc.every((s) => {
      return scope.value.some(
        // viewTitle is optional for default view
        (s2) => {
          if (Array.isArray(s.param)) {
            return (
              (s.key === 'viewTitle' && s2.key === 'viewTitle' && s2.param === '') ||
              (s.key === s2.key && s.param.includes(s2.param))
            )
          } else {
            return (
              (s.key === 'viewTitle' && s2.key === 'viewTitle' && s2.param === '') || (s.key === s2.key && s.param === s2.param)
            )
          }
        },
      )
    })
  }

  const undoQueue: Ref<UndoRedoAction[]> = ref([])

  const redoQueue: Ref<UndoRedoAction[]> = ref([])

  const addUndo = (action: UndoRedoAction, fromRedo = false) => {
    // remove all redo actions that are in the same scope
    if (!fromRedo) redoQueue.value = redoQueue.value.filter((a) => !isSameScope(a.scope || []))
    undoQueue.value.push(action)
  }

  const addRedo = (action: UndoRedoAction) => {
    redoQueue.value.push(action)
  }

  const undo = async () => {
    let actionIndex = -1
    for (let i = undoQueue.value.length - 1; i >= 0; i--) {
      const elScope = undoQueue.value[i].scope || [{ key: 'root', param: 'root' }]
      if (isSameScope(elScope)) {
        actionIndex = i
        break
      }
    }

    if (actionIndex === -1) return

    const action = undoQueue.value.splice(actionIndex, 1)[0]
    if (action) {
      try {
        await action.undo.fn.apply(action, action.undo.args)
        addRedo(action)
      } catch (e) {
        message.warn('Error while undoing action, it is skipped.')
      }
    }
  }

  const redo = async () => {
    let actionIndex = -1
    for (let i = redoQueue.value.length - 1; i >= 0; i--) {
      const elScope = redoQueue.value[i].scope || [{ key: 'root', param: 'root' }]
      if (isSameScope(elScope)) {
        actionIndex = i
        break
      }
    }

    if (actionIndex === -1) return

    const action = redoQueue.value.splice(actionIndex, 1)[0]
    if (action) {
      try {
        await action.redo.fn.apply(action, action.redo.args)
        addUndo(action, true)
      } catch (e) {
        message.warn('Error while redoing action, it is skipped.')
      }
    }
  }

  const defineRootScope = () => {
    return [{ key: 'root', param: 'root' }]
  }

  const defineProjectScope = (param: { base?: BaseType; model?: TableType; view?: ViewType; base_id?: string }) => {
    if (param.base) {
      return [{ key: 'baseId', param: param.base.id! }]
    } else if (param.model) {
      return [{ key: 'baseId', param: param.model.base_id! }]
    } else if (param.view) {
      return [{ key: 'baseId', param: param.view.base_id! }]
    } else {
      return [{ key: 'baseId', param: param.base_id! }]
    }
  }

  const defineModelScope = (param: { model?: TableType; view?: ViewType; base_id?: string; model_id?: string }) => {
    if (param.model) {
      return [
        { key: 'baseId', param: param.model.base_id! },
        { key: 'viewId', param: param.model.id! },
      ]
    } else if (param.view) {
      return [
        { key: 'baseId', param: param.view.base_id! },
        { key: 'viewId', param: param.view.fk_model_id! },
      ]
    } else {
      return [
        { key: 'baseId', param: param.base_id! },
        { key: 'viewId', param: param.model_id! },
      ]
    }
  }

  const defineViewScope = (param: { view?: ViewType; base_id?: string; model_id?: string; title?: string; id?: string }) => {
    if (param.view) {
      return [
        { key: 'baseId', param: param.view.base_id! },
        { key: 'viewId', param: param.view.fk_model_id! },
        { key: 'viewTitle', param: [param.view.title, param.view.id!] },
      ]
    } else {
      return [
        { key: 'baseId', param: param.base_id! },
        { key: 'viewId', param: param.model_id! },
        { key: 'viewTitle', param: [param.title!, param.id!] },
      ]
    }
  }

  useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

    if (e && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return

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
    defineRootScope,
    defineProjectScope,
    defineModelScope,
    defineViewScope,
  }
})
