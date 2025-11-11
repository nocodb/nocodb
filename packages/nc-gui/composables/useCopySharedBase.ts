import { ProjectTypes } from 'nocodb-sdk'

export const useCopySharedBase = createSharedComposable(() => {
  const workspaceStore = useWorkspace()

  const { populateWorkspace } = workspaceStore

  const sharedBaseId = ref<string | null>(null)

  const isDuplicateDlgOpen = ref(false)

  const selectedWorkspace = ref<string>()

  const isUseThisTemplate = ref(false)

  const templateName = ref<string>('')

  const isLoading = ref(false)

  const options = ref({
    includeData: true,
    includeViews: true,
  })

  const optionsToExclude = computed(() => {
    const { includeData, includeViews } = options.value

    return {
      excludeData: !includeData,
      excludeViews: !includeViews,
    }
  })

  const { api } = useApi()

  const { $e, $poller } = useNuxtApp()

  const { ncNavigateTo } = useGlobal()

  const { t } = useI18n()

  const duplicateSharedBase = async ({
    workspaceId,
    onComplete = (_status: 'success' | 'error') => undefined,
    failedToastMessage = isUseThisTemplate.value
      ? t('msg.error.failedToCopyTemplate')
      : t('msg.error.failedToDuplicateSharedBase'),
  }: {
    workspaceId: string
    onComplete?: (status: 'success' | 'error') => void
    failedToastMessage?: string
  }) => {
    if (!workspaceId && isEeUI) return

    isLoading.value = true

    try {
      const jobData = await api.base.duplicateShared(workspaceId ?? 'nc', sharedBaseId.value, {
        options: optionsToExclude.value,
        base: isEeUI
          ? {
              fk_workspace_id: workspaceId,
              type: ProjectTypes.DATABASE,
            }
          : {},
      })

      sharedBaseId.value = null

      $poller.subscribe(
        { id: jobData.id },
        async (data: {
          id: string
          status?: string
          data?: {
            error?: {
              message: string
            }
            message?: string
            result?: any
          }
        }) => {
          if (data.status !== 'close') {
            if (data.status === JobStatus.COMPLETED) {
              console.log('job completed', jobData)
              ncNavigateTo({
                ...(isEeUI ? { workspaceId: jobData.fk_workspace_id } : {}),
                baseId: jobData.base_id,
                query: {
                  openTable: 'true',
                },
              })
              isLoading.value = false
              onComplete?.('success')
            } else if (data.status === JobStatus.FAILED) {
              message.error(failedToastMessage)
              await populateWorkspace()
              isLoading.value = false
              onComplete?.('error')
            }
          }
        },
      )

      $e('a:base:duplicate-shared-base', {
        isFromTemplates: isUseThisTemplate.value,
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      isLoading.value = false
      onComplete?.('error')
    }
  }

  return {
    sharedBaseId,
    isUseThisTemplate,
    isLoading,
    options,
    optionsToExclude,
    duplicateSharedBase,
    isDuplicateDlgOpen,
    selectedWorkspace,
    templateName,
  }
})
