export const useSandboxChangelog = createSharedComposable(() => {
  const { $api, $poller, $e } = useNuxtApp()

  const { t } = useI18n()

  const baseStore = useBase()
  const { base, isSandbox } = storeToRefs(baseStore)

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const { isPanelExpanded: isChatPanelExpanded } = useChatPanel()

  const DRAWER_WIDTH = 480

  const isDrawerOpen = ref(false)
  const isLoading = ref(false)
  const data = ref<{ changelog: any[]; users: Record<string, any> }>({ changelog: [], users: {} })
  const mergeStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const mergeError = ref('')

  watchEffect(() => {
    document.documentElement.style.setProperty(
      '--nc-sandbox-drawer-offset',
      isDrawerOpen.value && isSandbox.value ? `${DRAWER_WIDTH}px` : '0px',
    )
  })

  watch(isSandbox, (val) => {
    if (!val) isDrawerOpen.value = false
  })

  watch(isChatPanelExpanded, (expanded) => {
    if (expanded && isDrawerOpen.value) isDrawerOpen.value = false
  })

  const loadChangelog = async () => {
    if (!base.value?.id || !activeWorkspaceId.value || isLoading.value) return
    isLoading.value = true
    try {
      const response = (await $api.internal.getOperation(activeWorkspaceId.value, base.value.id, {
        operation: 'sandboxChangelog',
      })) as { changelog: any[]; users: Record<string, any> }
      data.value = {
        changelog: response?.changelog || [],
        users: response?.users || {},
      }
    } catch {
      data.value = { changelog: [], users: {} }
    } finally {
      isLoading.value = false
    }
  }

  const openDrawer = () => {
    if (isChatPanelExpanded.value) isChatPanelExpanded.value = false
    isDrawerOpen.value = true
    mergeStatus.value = 'idle'
    mergeError.value = ''
    loadChangelog()
  }

  const closeDrawer = () => {
    isDrawerOpen.value = false
  }

  const mergeFromChangelog = async () => {
    if (!base.value?.id || !activeWorkspaceId.value || mergeStatus.value === 'loading') return

    try {
      mergeStatus.value = 'loading'
      mergeError.value = ''

      const response = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        base.value.id,
        { operation: 'sandboxMerge' },
        {},
      )) as { job_id: string }

      if (response?.job_id) {
        $poller.subscribe(
          { id: response.job_id },
          async (jobData: { id: string; status?: string; data?: { error?: { message: string } } }) => {
            if (jobData.status === JobStatus.COMPLETED) {
              mergeStatus.value = 'success'
              data.value = { changelog: [], users: {} }
              $e('a:sandbox:merge')
            } else if (jobData.status === JobStatus.FAILED) {
              mergeStatus.value = 'error'
              mergeError.value = jobData.data?.error?.message || t('labels.failedToPublishChanges')
            }
          },
        )
      }
    } catch (e: any) {
      mergeStatus.value = 'error'
      mergeError.value = await extractSdkResponseErrorMsg(e)
    }
  }

  return {
    DRAWER_WIDTH,
    isDrawerOpen,
    isLoading,
    data,
    mergeStatus,
    mergeError,
    openDrawer,
    closeDrawer,
    mergeFromChangelog,
    loadChangelog,
  }
})
