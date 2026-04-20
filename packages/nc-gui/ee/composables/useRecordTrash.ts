import { NcErrorType, isDeletedCol } from 'nocodb-sdk'
import type { TableType } from 'nocodb-sdk'

type RecordTrashOperation =
  | 'recordTrashEvents'
  | 'recordTrashCount'
  | 'recordTrashRestore'
  | 'recordTrashPermanentDelete'
  | 'recordTrashEmpty'

interface RawTrashEvent {
  id: string
  op_type: string
  created_at: string
  fk_user_id: string | null
  row_count: number
  preview_rows: Array<{ row_id: string; pv: any }>
}

export interface TrashEvent extends RawTrashEvent {
  display_name: string | null
  display_name_short: string | null
  email: string | null
  user_meta: any
}

export const useRecordTrash = createSharedComposable(() => {
  const { $api, $eventBus } = useNuxtApp()

  const { t } = useI18n()

  const tablesStore = useTablesStore()

  const { activeTableId: tableId, activeTable } = storeToRefs(tablesStore)

  const basesStore = useBases()

  const { activeProjectId, basesUser, bases } = storeToRefs(basesStore)

  const { getMetaByKey } = useMetas()

  const { showWarningModal } = useNcConfirmModal()

  const isOpen = ref(false)

  const isLoading = ref(false)

  const isLoadingMore = ref(false)

  const trashEvents = ref<TrashEvent[]>([])

  const hasMoreEvents = ref(false)

  const trashCount = ref(0)

  const nextCursor = ref<string | null>(null)

  const pageSize = 25

  const retentionDays = ref(30)

  const trashDisabled = ref(false)

  const meta = computed(() => {
    if (!activeProjectId.value || !tableId.value) return undefined
    return getMetaByKey(activeProjectId.value, tableId.value) ?? activeTable.value
  })

  const baseUsers = computed(() => {
    const baseId = (meta.value as TableType | undefined)?.base_id
    return baseId ? basesUser.value.get(baseId) ?? [] : []
  })

  // Reason trash is unavailable for the active table, derived locally:
  //   'external' — source isn't a NocoDB-managed (meta/local) source
  //   'pending'  — meta source but no __nc_deleted column yet
  //   'disabled' — user toggled trash off in settings
  //   null       — trash is fully available
  const trashUnavailableReason = computed<
    'external' | 'pending' | 'disabled' | null
  >(() => {
    const table = meta.value as TableType | undefined
    if (!table) return 'pending'
    const source = bases.value
      .get(table.base_id!)
      ?.sources?.find((s) => s.id === table.source_id)
    if (source && !(source.is_meta || source.is_local)) return 'external'
    if (!table.columns?.some((c) => isDeletedCol(c))) return 'pending'
    if (trashDisabled.value) return 'disabled'
    return null
  })

  function enrichEvent(raw: RawTrashEvent): TrashEvent {
    const user = raw.fk_user_id ? baseUsers.value.find((u) => u.id === raw.fk_user_id) : undefined
    return {
      ...raw,
      display_name: user?.display_name ?? null,
      display_name_short: user?.display_name ?? extractNameFromEmail(user?.email) ?? null,
      email: user?.email ?? null,
      user_meta: user?.meta,
    }
  }

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
      trashDisabled.value = !!(result as any)?.trashDisabled
    } catch (_e) {
      trashCount.value = 0
    }
  }

  /**
   * Event-based API — each item is one delete operation (grouped by deleter +
   * LastModifiedTime), not one record.
   */
  async function loadTrashEvents(opts: { append?: boolean } = {}) {
    if (!tableId.value || !(meta.value as TableType)?.fk_workspace_id) return
    if (opts.append) isLoadingMore.value = true
    else isLoading.value = true

    try {
      const cursor = opts.append ? nextCursor.value : null
      const result = (await $api.internal.getOperation(
        (meta.value as TableType).fk_workspace_id!,
        (meta.value as TableType)?.base_id!,
        {
          operation: 'recordTrashEvents' as RecordTrashOperation,
          tableId: tableId.value,
          limit: pageSize,
          ...(cursor ? { cursor } : {}),
        } as any,
      )) as any

      const list = ((result?.list ?? []) as RawTrashEvent[]).map(enrichEvent)
      trashEvents.value = opts.append ? [...trashEvents.value, ...list] : list
      hasMoreEvents.value = !!result?.pageInfo?.hasMore
      nextCursor.value = result?.pageInfo?.nextCursor ?? null
      if (typeof result?.retentionDays === 'number') {
        retentionDays.value = result.retentionDays
      }
      if (typeof result?.trashDisabled === 'boolean') {
        trashDisabled.value = result.trashDisabled
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      if (opts.append) isLoadingMore.value = false
      else isLoading.value = false
    }
  }

  async function loadMoreEvents() {
    if (isLoading.value || isLoadingMore.value || !hasMoreEvents.value) return
    if (!nextCursor.value) return
    await loadTrashEvents({ append: true })
  }

  function removeEventLocally(eventId: string) {
    const event = trashEvents.value.find((e) => e.id === eventId)
    const count = event?.row_count ?? 0
    trashEvents.value = trashEvents.value.filter((e) => e.id !== eventId)
    trashCount.value = Math.max(0, trashCount.value - count)
    return count
  }

  async function doRestoreEvent(tableMeta: TableType, eventId: string, force = false) {
    await $api.internal.postOperation(
      tableMeta.fk_workspace_id!,
      tableMeta.base_id!,
      { operation: 'recordTrashRestore' as RecordTrashOperation } as any,
      { tableId: tableMeta.id, eventId, force },
    )
  }

  async function restoreEvent(eventId: string) {
    if (!tableId.value || !eventId) return
    const tableMeta = meta.value as TableType | undefined
    if (!tableMeta?.id || !tableMeta?.fk_workspace_id) return

    const event = trashEvents.value.find((e) => e.id === eventId)
    const expectedCount = event?.row_count ?? 0

    try {
      await doRestoreEvent(tableMeta, eventId)
      message.toast(t('trash.recordsRestored', { count: expectedCount }))
      removeEventLocally(eventId)
      await loadTrashCount()
    } catch (e: any) {
      if (isUniqueConstraintViolationError(e)) {
        const errorData = e.response?.data
        const field = errorData?.fieldName
        const value = errorData?.value

        showWarningModal({
          title: t('trash.uniqueConflictTitle'),
          content: field && value ? t('trash.uniqueConflict', { field, value }) : t('trash.uniqueConflictGeneric'),
        })
        return
      }

      const { error } = await extractSdkResponseErrorMsgv2(e)
      if (error === NcErrorType.ERR_RECORD_RESTORE_CONFLICT) {
        showWarningModal({
          title: t('trash.linkConflictTitle'),
          content: t('trash.linkConflictForce'),
          okText: t('trash.restoreAnyway'),
          showCancelBtn: true,
          okCallback: async () => {
            try {
              await doRestoreEvent(tableMeta, eventId, true)
              message.toast(t('trash.recordsRestored', { count: expectedCount }))
              removeEventLocally(eventId)
              await loadTrashCount()
            } catch (e2: any) {
              message.error(await extractSdkResponseErrorMsg(e2))
              await loadTrashEvents()
            }
          },
        })
        return
      }

      message.error(await extractSdkResponseErrorMsg(e))
      await loadTrashEvents()
    }
  }

  async function permanentDeleteEvent(eventId: string) {
    if (!tableId.value || !eventId || !(meta.value as TableType)?.fk_workspace_id) return
    try {
      await $api.internal.postOperation(
        (meta.value as TableType).fk_workspace_id!,
        (meta.value as TableType)?.base_id!,
        { operation: 'recordTrashPermanentDelete' as RecordTrashOperation } as any,
        { tableId: tableId.value, eventId },
      )
      const count = removeEventLocally(eventId)
      message.success(t('trash.recordsDeleted', { count }))
      await loadTrashCount()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      await loadTrashEvents()
    }
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
          title: t('trash.linkConflictTitle'),
          content: t('trash.linkConflictForce'),
          okText: t('trash.restoreAnyway'),
          showCancelBtn: true,
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

  async function emptyTrash() {
    if (!tableId.value || !(meta.value as TableType)?.fk_workspace_id) return
    try {
      await $api.internal.postOperation(
        (meta.value as TableType).fk_workspace_id!,
        (meta.value as TableType)?.base_id!,
        { operation: 'recordTrashEmpty' as RecordTrashOperation } as any,
        { tableId: tableId.value },
      )
      message.toast(t('trash.trashEmptied'))
      trashEvents.value = []
      hasMoreEvents.value = false
      nextCursor.value = null
      trashCount.value = 0
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      await loadTrashEvents()
      await loadTrashCount()
    }
  }

  function openTrash() {
    if (trashUnavailableReason.value) return
    isOpen.value = true
  }

  watch(
    tableId,
    () => {
      nextCursor.value = null
      trashEvents.value = []
      hasMoreEvents.value = false
      loadTrashCount()

      if (isOpen.value) {
        loadTrashEvents()
      }
    },
    { immediate: true },
  )

  // Refresh trash count when smartsheet data changes (e.g., another user deletes/restores records)
  const smartsheetEventHandler = (event: SmartsheetStoreEvents) => {
    if (event === SmartsheetStoreEvents.DATA_RELOAD) {
      loadTrashCount()

      if (isOpen.value) {
        loadTrashEvents()
      }
    }
  }

  $eventBus.smartsheetStoreEventBus.on(smartsheetEventHandler)

  // Periodic refresh when the drawer is open (catches changes not signaled via eventBus)
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  watch(isOpen, (open) => {
    if (open) {
      // Only poll the count — a plain number doesn't re-render list rows.
      // The events list refreshes on modal open and on DATA_RELOAD from the
      // smartsheet event bus, which is enough to keep the user's own actions
      // in sync without flickering the chips.
      refreshInterval = setInterval(() => {
        loadTrashCount()
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
    isLoadingMore,
    trashEvents,
    trashCount,
    hasMoreEvents,
    retentionDays,
    trashUnavailableReason,
    loadTrashEvents,
    loadMoreEvents,
    restoreEvent,
    permanentDeleteEvent,
    restoreFromTrash,
    emptyTrash,
    openTrash,
  }
})
