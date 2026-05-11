/**
 * EE undo/redo. Server-backed via the command-registry — every traced forward
 * op writes an entry to `nc_operation_logs` with a pre-computed inverse.
 *
 * Visibility is hierarchical. From inside view V on table T the frontend ships
 * `[VIEW(V), TABLE(T), BASE]`; the server pops the most recent entry whose
 * scope is in that set. So Cmd-Z reaches view edits AND the table/base ops
 * that bubble up to it. Cross-table ops stay invisible (Table A's stack is
 * not in B's chain).
 */
type ServerStatus = 'ok' | 'empty' | 'no_handler' | 'no_scope' | 'errored'

type UndoRedoScopeType = 'base' | 'table' | 'view' | 'dashboard' | 'workflow' | 'script'

interface UndoRedoScope {
  type: UndoRedoScopeType
  id: string
}

export const useUndoRedo = createSharedComposable(() => {
  const router = useRouter()

  const route = router.currentRoute

  const { $api } = useNuxtApp()

  const { t } = useI18n()

  const workspaceStore = useWorkspace()

  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const isUndoRedoInFlight = ref(false)

  let queue: Promise<void> = Promise.resolve()
  let pending = 0
  let clearFlagTimer: ReturnType<typeof setTimeout> | null = null

  const enqueue = (work: () => Promise<void>): Promise<void> => {
    pending += 1
    isUndoRedoInFlight.value = true
    if (clearFlagTimer) {
      clearTimeout(clearFlagTimer)
      clearFlagTimer = null
    }
    const next = queue.then(work)
    // Catch errors here so a rejected work fn doesn't poison the chain
    // for subsequent enqueues. Rejection still propagates to the
    // returned promise so callers can observe failure.
    queue = next
      .catch(() => undefined)
      .finally(() => {
        pending -= 1
        if (pending === 0) {
          clearFlagTimer = setTimeout(() => {
            if (pending === 0) isUndoRedoInFlight.value = false
            clearFlagTimer = null
          }, 1000)
        }
      })
    return next
  }

  const activeBaseId = (): string | null => {
    const baseId = (route.value.params as Record<string, any>).baseId as string | undefined
    return baseId || null
  }

  const readParam = (key: string): string | undefined => {
    const v = route.value.params[key]
    return typeof v === 'string' && v.length ? v : undefined
  }

  /**
   * Build the leaf-first visibility chain from the active route. The
   * server treats `(scope_type, scope_id) IN (chain)` as the visible set
   * and pops the most recent op across all of them.
   */
  const resolveScopes = (): UndoRedoScope[] | null => {
    const baseId = readParam('baseId')
    if (!baseId) return null

    const base: UndoRedoScope = { type: 'base', id: baseId }

    const workflowId = readParam('workflowId')
    if (workflowId) return [{ type: 'workflow', id: workflowId }, base]

    const scriptId = readParam('scriptId')
    if (scriptId) return [{ type: 'script', id: scriptId }, base]

    const dashboardId = readParam('dashboardId')
    if (dashboardId) return [{ type: 'dashboard', id: dashboardId }, base]

    // `viewId` in the route is the *table id* per NocoDB's convention.
    const tableId = readParam('viewId')
    if (tableId) {
      const table: UndoRedoScope = { type: 'table', id: tableId }
      const activeView = useViewsStore().activeView
      if (activeView?.id) {
        return [{ type: 'view', id: activeView.id }, table, base]
      }
      return [table, base]
    }
    return [base]
  }

  const callServer = async (operation: 'undo' | 'redo'): Promise<ServerStatus> => {
    const baseId = activeBaseId()
    if (!baseId || !activeWorkspaceId.value) return 'no_scope'
    const scopes = resolveScopes()
    if (!scopes) return 'no_scope'
    try {
      const res: any = await $api.internal.postOperation(activeWorkspaceId.value, baseId, { operation }, { scopes })
      const status = res?.status as ServerStatus
      return status ?? 'errored'
    } catch (e: any) {
      message.toast(
        `${operation === 'undo' ? t('labels.undo') : t('labels.redo')} failed: ${await extractSdkResponseErrorMsg(e)}`,
      )
      return 'errored'
    }
  }

  const undo = (): Promise<void> =>
    enqueue(async () => {
      const status = await callServer('undo')
      if (status === 'ok') {
        message.toast(t('labels.actionUndone'))
      } else if (status === 'empty') {
        message.toast(t('labels.noMoreActionsToUndo'))
      }
    })

  const redo = (): Promise<void> =>
    enqueue(async () => {
      const status = await callServer('redo')
      if (status === 'ok') {
        message.toast(t('labels.actionRedone'))
      } else if (status === 'empty') {
        message.toast(t('labels.noMoreActionsToRedo'))
      }
    })

  useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

    if ((e && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) || isExpandedFormOpenExist()) {
      return
    }

    if (cmdOrCtrl && !e.altKey && e.keyCode === 90) {
      e.preventDefault()
      if (!e.shiftKey) {
        undo()
      } else {
        redo()
      }
    }
  })

  return {
    undo,
    redo,
    isUndoRedoInFlight,
  }
})
