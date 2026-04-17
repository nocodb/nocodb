import { NcErrorType } from 'nocodb-sdk'
import type { ColumnType, TableType } from 'nocodb-sdk'

type RecordTrashOperation =
  | 'recordTrashList'
  | 'recordTrashCount'
  | 'recordTrashRestore'
  | 'recordTrashPermanentDelete'
  | 'recordTrashEmpty'

export const useRecordTrash = createSharedComposable(() => {
  const { $api, $eventBus } = useNuxtApp()

  const { t } = useI18n()

  const tablesStore = useTablesStore()

  const { activeTableId: tableId, activeTable } = storeToRefs(tablesStore)

  const { activeProjectId } = storeToRefs(useBases())

  const { getMetaByKey } = useMetas()

  const { showWarningModal } = useNcConfirmModal()

  const isOpen = ref(false)

  const isLoading = ref(false)

  const deletedRecords = ref<Record<string, any>[]>([])

  const trashCount = ref(0)

  const currentPage = ref(1)

  const pageSize = 25

  const totalCount = ref(0)

  const selectedRowIds = ref<string[]>([])

  const retentionDays = ref(30)

  const meta = computed(() => {
    if (!activeProjectId.value || !tableId.value) return undefined
    return getMetaByKey(activeProjectId.value, tableId.value) ?? activeTable.value
  })

  const columns = computed(() => (meta.value?.columns ?? []) as ColumnType[])

  const pkColumn = computed(() => columns.value.find((c) => c.pk)?.title ?? 'Id')

  async function loadTrashCount() {
    if (!tableId.value || !(meta.value as TableType)?.fk_workspace_id) return
    try {
      const result = await $api.internal.getOperation(
        (meta.value as TableType).fk_workspace_id!,
        (meta.value as TableType)?.base_id,
        {
          operation: 'recordTrashCount' as RecordTrashOperation,
          tableId: tableId.value,
        } as any,
      )
      trashCount.value = (result as any)?.count ?? 0
      retentionDays.value = (result as any)?.retentionDays ?? 30
    } catch (_e) {
      trashCount.value = 0
    }
  }

  async function loadDeletedRecords() {
    if (!tableId.value || !(meta.value as TableType)?.fk_workspace_id) return
    isLoading.value = true
    try {
      const offset = (currentPage.value - 1) * pageSize
      const result = (await $api.internal.getOperation(
        (meta.value as TableType).fk_workspace_id!,
        (meta.value as TableType)?.base_id!,
        {
          operation: 'recordTrashList' as RecordTrashOperation,
          tableId: tableId.value,
          limit: pageSize,
          offset,
        } as any,
      )) as any

      deletedRecords.value = result?.list ?? []
      totalCount.value = result?.pageInfo?.totalRows ?? 0
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  function removeRowsLocally(rowIds: string[]) {
    const idSet = new Set(rowIds)
    deletedRecords.value = deletedRecords.value.filter((r) => !idSet.has(extractPkFromRow(r, columns.value) ?? ''))
    selectedRowIds.value = selectedRowIds.value.filter((id) => !idSet.has(id))
    trashCount.value = Math.max(0, trashCount.value - rowIds.length)
    totalCount.value = Math.max(0, totalCount.value - rowIds.length)
  }

  async function doRestore(tableMeta: TableType, rowIds: string[], force = false) {
    await $api.internal.postOperation(
      tableMeta.fk_workspace_id!,
      tableMeta.base_id!,
      { operation: 'recordTrashRestore' as RecordTrashOperation } as any,
      { tableId: tableMeta.id, rowIds, force },
    )
  }

  /**
   * Generic conflict-aware restore. Used by both the trash drawer and undo handlers.
   */
  async function restoreFromTrash(
    tableMeta: TableType | undefined,
    rowIds: string[],
    callbacks?: {
      onSuccess?: () => Promise<void> | void
      onError?: () => Promise<void> | void
    },
  ): Promise<void> {
    if (!tableMeta?.id || !tableMeta.fk_workspace_id || !rowIds.length) return

    try {
      await doRestore(tableMeta, rowIds)
      await callbacks?.onSuccess?.()
    } catch (e: any) {
      if (isUniqueConstraintViolationError(e)) {
        const errorData = e.response?.data
        const field = errorData?.fieldName
        const value = errorData?.value

        showWarningModal({
          title: t('trash.uniqueConflictTitle'),
          content: field && value ? t('trash.uniqueConflict', { field, value }) : t('trash.uniqueConflictGeneric'),
        })
        await callbacks?.onError?.()
        return
      }

      const { error } = await extractSdkResponseErrorMsgv2(e)
      if (error === NcErrorType.ERR_RECORD_RESTORE_CONFLICT) {
        showWarningModal({
          title: t('trash.ooConflictTitle'),
          content: t('trash.ooConflictForce'),
          okText: t('trash.restoreAnyway'),
          okCallback: async () => {
            try {
              await doRestore(tableMeta, rowIds, true)
              await callbacks?.onSuccess?.()
            } catch (e2: any) {
              message.error(await extractSdkResponseErrorMsg(e2))
              await callbacks?.onError?.()
            }
          },
        })
      } else {
        message.error(await extractSdkResponseErrorMsg(e))
        await callbacks?.onError?.()
      }
    }
  }

  async function restoreRecords(rowIds: string[]) {
    if (!tableId.value || !rowIds.length) return
    await restoreFromTrash(meta.value as TableType, rowIds, {
      onSuccess: async () => {
        message.toast(t('trash.recordsRestored', { count: rowIds.length }))
        removeRowsLocally(rowIds)
        await loadTrashCount()
      },
      onError: async () => {
        await loadDeletedRecords()
        await loadTrashCount()
      },
    })
  }

  async function permanentDeleteRecords(rowIds: string[]) {
    if (!tableId.value || !rowIds.length || !(meta.value as TableType)?.fk_workspace_id) return
    removeRowsLocally(rowIds)
    try {
      await $api.internal.postOperation(
        (meta.value as TableType).fk_workspace_id!,
        (meta.value as TableType)?.base_id!,
        { operation: 'recordTrashPermanentDelete' as RecordTrashOperation } as any,
        { tableId: tableId.value, rowIds },
      )
      message.success(t('trash.recordsDeleted', { count: rowIds.length }))
      await loadTrashCount()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      await loadDeletedRecords()
    }
  }

  async function emptyTrash() {
    if (!tableId.value || !(meta.value as TableType)?.fk_workspace_id) return
    try {
      await $api.internal.postOperation(
        (meta.value as TableType).fk_workspace_id!,
        (meta.value as TableType)?.base_id!,
        { operation: 'recordTrashEmpty' as RecordTrashOperation } as any,
        { tableId: tableId.value },
      )
      message.success(t('trash.trashEmptied'))
      deletedRecords.value = []
      selectedRowIds.value = []
      trashCount.value = 0
      totalCount.value = 0
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      await loadDeletedRecords()
      await loadTrashCount()
    }
  }

  function openTrash() {
    isOpen.value = true
  }

  watch(
    tableId,
    () => {
      currentPage.value = 1
      selectedRowIds.value = []
      deletedRecords.value = []
      loadTrashCount()

      if (isOpen.value) {
        loadDeletedRecords()
      }
    },
    { immediate: true },
  )

  // Refresh trash count when smartsheet data changes (e.g., another user deletes/restores records)
  const smartsheetEventHandler = (event: SmartsheetStoreEvents) => {
    if (event === SmartsheetStoreEvents.DATA_RELOAD) {
      loadTrashCount()

      if (isOpen.value) {
        loadDeletedRecords()
      }
    }
  }

  $eventBus.smartsheetStoreEventBus.on(smartsheetEventHandler)

  // Periodic refresh when the drawer is open (catches changes not signaled via eventBus)
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  watch(isOpen, (open) => {
    if (open) {
      refreshInterval = setInterval(() => {
        loadTrashCount()
        loadDeletedRecords()
      }, 30000)
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
    }
  })

  onScopeDispose(() => {
    $eventBus.smartsheetStoreEventBus.off(smartsheetEventHandler)

    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  })

  return {
    isOpen,
    isLoading,
    deletedRecords,
    trashCount,
    currentPage,
    pageSize,
    totalCount,
    selectedRowIds,
    pkColumn,
    retentionDays,
    loadDeletedRecords,
    restoreFromTrash,
    restoreRecords,
    permanentDeleteRecords,
    emptyTrash,
    openTrash,
  }
})
