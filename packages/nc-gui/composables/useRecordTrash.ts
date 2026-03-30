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
    if (!tableId.value) return
    try {
      const result = await $api.internal.getOperation(
        (meta.value as TableType)?.fk_workspace_id ?? 'nc__',
        (meta.value as TableType)?.base_id!,
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
    if (!tableId.value) return
    isLoading.value = true
    try {
      const offset = (currentPage.value - 1) * pageSize
      const result = (await $api.internal.getOperation(
        (meta.value as TableType)?.fk_workspace_id ?? 'nc__',
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
    deletedRecords.value = deletedRecords.value.filter((r) => !idSet.has(String(r[pkColumn.value])))
    selectedRowIds.value = selectedRowIds.value.filter((id) => !idSet.has(id))
    trashCount.value = Math.max(0, trashCount.value - rowIds.length)
    totalCount.value = Math.max(0, totalCount.value - rowIds.length)
  }

  async function _doRestoreRecords(rowIds: string[], force = false) {
    await $api.internal.postOperation(
      (meta.value as TableType)?.fk_workspace_id ?? 'nc__',
      (meta.value as TableType)?.base_id!,
      { operation: 'recordTrashRestore' as RecordTrashOperation } as any,
      { tableId: tableId.value, rowIds, force },
    )
    message.success(t('trash.recordsRestored', { count: rowIds.length }))
    await loadTrashCount()
  }

  async function restoreRecords(rowIds: string[]) {
    if (!tableId.value || !rowIds.length) return
    try {
      await _doRestoreRecords(rowIds)
      removeRowsLocally(rowIds)
    } catch (e: any) {
      const { error } = await extractSdkResponseErrorMsgv2(e)
      if (error === NcErrorType.ERR_RECORD_RESTORE_CONFLICT) {
        showWarningModal({
          title: t('trash.ooConflictTitle'),
          content: t('trash.ooConflictForce'),
          okText: t('trash.restoreAnyway'),
          okCallback: async () => {
            try {
              await _doRestoreRecords(rowIds, true)
              removeRowsLocally(rowIds)
            } catch (e2: any) {
              message.error(await extractSdkResponseErrorMsg(e2))
              await loadDeletedRecords()
              await loadTrashCount()
            }
          },
        })
      } else {
        message.error(await extractSdkResponseErrorMsg(e))
        await loadDeletedRecords()
        await loadTrashCount()
      }
    }
  }

  async function permanentDeleteRecords(rowIds: string[]) {
    if (!tableId.value || !rowIds.length) return
    removeRowsLocally(rowIds)
    try {
      await $api.internal.postOperation(
        (meta.value as TableType)?.fk_workspace_id ?? 'nc__',
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
    if (!tableId.value) return
    try {
      await $api.internal.postOperation(
        (meta.value as TableType)?.fk_workspace_id ?? 'nc__',
        (meta.value as TableType)?.base_id,
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
    restoreRecords,
    permanentDeleteRecords,
    emptyTrash,
    openTrash,
  }
})
