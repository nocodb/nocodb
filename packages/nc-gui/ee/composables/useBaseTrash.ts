import { PlanLimitTypes } from 'nocodb-sdk'
import type { BaseTrashType } from 'nocodb-sdk'

export const useBaseTrash = createSharedComposable(() => {
  const { $api, $e } = useNuxtApp()

  const { t } = useI18n()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const basesStore = useBases()

  const { activeProjectId } = storeToRefs(basesStore)

  const { getLimit } = useEeConfig()

  const retentionDays = computed(() => {
    const limit = getLimit(PlanLimitTypes.LIMIT_TRASH_RETENTION)
    return typeof limit === 'number' && limit > 0 ? limit : 30
  })

  const isOpen = ref(false)

  const isLoading = ref(false)

  const trashItems = ref<BaseTrashType[]>([])

  const totalRows = ref(0)

  const currentPage = ref(1)

  const pageSize = ref(25)

  const open = () => {
    isOpen.value = true
    loadTrash()
    $e('c:base-trash:open')
  }

  const close = () => {
    isOpen.value = false
    trashItems.value = []
    currentPage.value = 1
  }

  const loadTrash = async (page = 1) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    isLoading.value = true

    try {
      const res = await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'baseTrashList',
        limit: String(pageSize.value),
        offset: String((page - 1) * pageSize.value),
      })

      trashItems.value = res.list || []
      totalRows.value = res.pageInfo?.totalRows || 0
      currentPage.value = page
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  const restoreItem = async (trashId: string) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        { operation: 'baseTrashRestore' },
        { trashId },
      )

      message.success(t('msg.success.restored'))
      $e('a:base-trash:restore')
      // Reload to recompute is_restorable flags for remaining items
      await loadTrash(currentPage.value)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const emptyTrash = async () => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      await $api.internal.postOperation(activeWorkspaceId.value, activeProjectId.value, { operation: 'baseTrashEmpty' }, {})

      message.success(t('msg.success.trashEmptied'))
      $e('a:base-trash:empty')
      trashItems.value = []
      totalRows.value = 0
      currentPage.value = 1
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    isOpen,
    isLoading,
    trashItems,
    totalRows,
    currentPage,
    pageSize,
    retentionDays,
    open,
    close,
    loadTrash,
    restoreItem,
    emptyTrash,
  }
})
