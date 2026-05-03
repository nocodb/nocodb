/**
 * EE undo/redo. Server-backed via the command-registry — every traced forward
 * op writes an entry to `nc_operation_logs` with a pre-computed inverse, and
 * Cmd-Z pops the latest entry for the current (user, base, tab).
 *
 * Mounted once at app boot via `useUndoRedo()` in `app.vue`.
 */
type ServerStatus = 'ok' | 'empty' | 'no_handler' | 'no_scope' | 'errored'

export const useUndoRedo = createSharedComposable(() => {
  const router = useRouter()

  const route = router.currentRoute

  const { $api } = useNuxtApp()

  const { t } = useI18n()

  const workspaceStore = useWorkspace()

  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const activeBaseId = (): string | null => {
    const baseId = (route.value.params as Record<string, any>).baseId as string | undefined
    return baseId || null
  }

  const callServer = async (operation: 'undo' | 'redo'): Promise<ServerStatus> => {
    const baseId = activeBaseId()
    if (!baseId || !activeWorkspaceId.value) return 'no_scope'
    try {
      const res: any = await $api.internal.postOperation(activeWorkspaceId.value, baseId, { operation }, {})
      const status = res?.status as ServerStatus
      return status ?? 'errored'
    } catch (e: any) {
      message.toast(
        `${operation === 'undo' ? t('labels.undo') : t('labels.redo')} failed: ${await extractSdkResponseErrorMsg(e)}`,
      )
      return 'errored'
    }
  }

  const undo = async () => {
    const status = await callServer('undo')
    if (status === 'ok') {
      message.toast(t('labels.actionUndone'))
    } else if (status === 'empty') {
      message.toast(t('labels.noMoreActionsToUndo'))
    }
    // 'no_scope' / 'no_handler' / 'errored' — silent or already toasted by catch.
  }

  const redo = async () => {
    const status = await callServer('redo')
    if (status === 'ok') {
      message.toast(t('labels.actionRedone'))
    } else if (status === 'empty') {
      message.toast(t('labels.noMoreActionsToRedo'))
    }
  }

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
  }
})
