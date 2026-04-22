import { NcErrorType, PlanLimitTypes, isDeletedCol } from 'nocodb-sdk'
import type { TableType } from 'nocodb-sdk'

type RecordTrashOperation =
  | 'recordTrashEvents'
  | 'recordTrashCount'
  | 'recordTrashRestore'
  | 'recordTrashPermanentDelete'
  | 'recordTrashEmpty'

export type RestoreConflict =
  | {
      kind: 'link-v1' | 'link-v2'
      rowId: string
      columnId: string
      columnTitle: string
    }
  | {
      kind: 'validation'
      rowId: string
      columnId: string
      columnTitle: string
      columnName: string
      value: unknown
      message: string
    }
  | {
      kind: 'unique-active'
      rowId: string
      columnId: string
      columnTitle: string
      columnName: string
      value: unknown
      conflictingRowId: string
    }
  | {
      kind: 'unique-intra'
      rowId: string
      columnId: string
      columnTitle: string
      columnName: string
      value: unknown
      winnerRowId: string
    }

export interface ConflictState {
  conflicts: RestoreConflict[]
  isSubmitting: boolean
  error?: string
}

export interface RestoreResult {
  restored: number
  skipped: Array<{ rowId: string; conflicts: RestoreConflict[] }>
  cleared: Array<{ rowId: string; columns: string[] }>
  message?: string
}

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

  const { getLimit } = useEeConfig()

  const PAGE_SIZE = 25

  // UI state
  const isOpen = ref(false)
  const isLoading = ref(false)
  const isLoadingMore = ref(false)

  // Data
  const trashEvents = ref<TrashEvent[]>([])
  const trashCount = ref(0)
  const nextCursor = ref<string | null>(null)
  const hasMoreEvents = computed(() => nextCursor.value !== null)

  const meta = computed(() => {
    if (!activeProjectId.value || !tableId.value) return undefined
    return getMetaByKey(activeProjectId.value, tableId.value) ?? activeTable.value
  })

  const baseUsers = computed(() => {
    const baseId = (meta.value as TableType | undefined)?.base_id
    return baseId ? basesUser.value.get(baseId) ?? [] : []
  })

  // Default retention comes from the workspace plan limit; per-table override on `meta.trash_retention_days`.
  const retentionDays = computed(() => {
    const table = meta.value as TableType | undefined
    if (typeof table?.trash_retention_days === 'number') return table.trash_retention_days
    const limit = getLimit(PlanLimitTypes.LIMIT_TRASH_RETENTION)
    return typeof limit === 'number' && limit > 0 ? limit : 30
  })

  // Reason trash is unavailable for the active table, derived locally:
  //   'external' — source isn't a NocoDB-managed (meta/local) source
  //   'pending'  — meta source but no __nc_deleted column yet
  //   'disabled' — user toggled trash off in settings
  //   'license'  — workspace plan doesn't include trash (retention ≤ 0); mirrors backend Model.isTrashEnabledForWorkspace
  //   null       — trash is fully available
  const trashUnavailableReason = computed<'external' | 'pending' | 'disabled' | 'license' | null>(() => {
    const table = meta.value as TableType | undefined
    if (!table) return 'pending'
    const source = bases.value.get(table.base_id!)?.sources?.find((s) => s.id === table.source_id)
    if (source && !(source.is_meta || source.is_local)) return 'external'
    // 'license' has to win over 'pending' / 'disabled' — without a plan, the column/user settings are moot
    const limit = getLimit(PlanLimitTypes.LIMIT_TRASH_RETENTION)
    if (!(typeof limit === 'number' && limit > 0)) return 'license'
    if (!table.columns?.some((c) => isDeletedCol(c))) return 'pending'
    if (table.trash_disabled) return 'disabled'
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
        (meta.value as TableType)?.base_id as string,
        {
          operation: 'recordTrashEvents' as RecordTrashOperation,
          tableId: tableId.value,
          limit: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        } as any,
      )) as any

      const list = ((result?.list ?? []) as RawTrashEvent[]).map(enrichEvent)
      trashEvents.value = opts.append ? [...trashEvents.value, ...list] : list
      nextCursor.value = result?.pageInfo?.nextCursor ?? null
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

  async function doRestoreEvent(
    tableMeta: TableType,
    eventId: string,
    opts: { force?: boolean; partial?: boolean } = {},
  ): Promise<RestoreResult> {
    return (await $api.internal.postOperation(
      tableMeta.fk_workspace_id!,
      tableMeta.base_id!,
      { operation: 'recordTrashRestore' as RecordTrashOperation } as any,
      { tableId: tableMeta.id, eventId, ...opts },
    )) as RestoreResult
  }

  const conflictByEventId = reactive<Record<string, ConflictState>>({})

  function conflictFor(eventId: string): ConflictState | undefined {
    return conflictByEventId[eventId]
  }

  function dismissConflict(eventId: string) {
    delete conflictByEventId[eventId]
  }

  function extractConflictDetails(e: any): RestoreConflict[] | null {
    const conflicts = e?.response?.data?.details?.conflicts
    return Array.isArray(conflicts) ? (conflicts as RestoreConflict[]) : null
  }

  async function restoreEvent(eventId: string) {
    if (!tableId.value || !eventId) return
    const tableMeta = meta.value as TableType | undefined
    if (!tableMeta?.id || !tableMeta?.fk_workspace_id) return

    dismissConflict(eventId)

    try {
      const result = await doRestoreEvent(tableMeta, eventId)
      message.toast(t('trash.recordsRestored', { count: result.restored }))
      removeEventLocally(eventId)
      await loadTrashCount()
    } catch (e: any) {
      const { error } = await extractSdkResponseErrorMsgv2(e)
      if (error === NcErrorType.ERR_RECORD_RESTORE_CONFLICT) {
        const conflicts = extractConflictDetails(e)
        if (conflicts) {
          conflictByEventId[eventId] = { conflicts, isSubmitting: false }
          return
        }
      }
      message.error(await extractSdkResponseErrorMsg(e))
      await loadTrashEvents()
    }
  }

  /**
   * Restore only the non-conflicted rows. Conflicted rows stay in trash for
   * the user to fix upstream and retry.
   */
  async function partialRestoreEvent(eventId: string) {
    if (!tableId.value || !eventId) return
    const tableMeta = meta.value as TableType | undefined
    if (!tableMeta?.id || !tableMeta?.fk_workspace_id) return

    const state = conflictByEventId[eventId]
    if (!state) return
    state.isSubmitting = true
    state.error = undefined

    try {
      const result = await doRestoreEvent(tableMeta, eventId, { partial: true })
      const skipped = result.skipped?.length ?? 0
      message.toast(
        skipped
          ? t('trash.recordsRestoredPartial', { restored: result.restored, skipped })
          : t('trash.recordsRestored', { count: result.restored }),
      )
      dismissConflict(eventId)
      if (!skipped) {
        removeEventLocally(eventId)
      } else {
        await loadTrashEvents()
      }
      await loadTrashCount()
    } catch (e: any) {
      if (conflictByEventId[eventId]) {
        conflictByEventId[eventId].isSubmitting = false
        conflictByEventId[eventId].error = await extractSdkResponseErrorMsg(e)
      }
    }
  }

  /**
   * Force-restore: auto-resolve every conflict by nulling the offending
   * column(s) / deleting conflicting junction rows. Destructive.
   */
  async function forceRestoreEvent(eventId: string) {
    if (!tableId.value || !eventId) return
    const tableMeta = meta.value as TableType | undefined
    if (!tableMeta?.id || !tableMeta?.fk_workspace_id) return

    const state = conflictByEventId[eventId]
    if (!state) return
    state.isSubmitting = true
    state.error = undefined

    try {
      const result = await doRestoreEvent(tableMeta, eventId, { force: true })
      const clearedCount = result.cleared?.reduce((n, r) => n + r.columns.length, 0) ?? 0
      message.toast(
        clearedCount
          ? t('trash.recordsRestoredForce', { restored: result.restored, cleared: clearedCount })
          : t('trash.recordsRestored', { count: result.restored }),
      )
      dismissConflict(eventId)
      removeEventLocally(eventId)
      await loadTrashCount()
    } catch (e: any) {
      if (conflictByEventId[eventId]) {
        conflictByEventId[eventId].isSubmitting = false
        conflictByEventId[eventId].error = await extractSdkResponseErrorMsg(e)
      }
    }
  }

  async function permanentDeleteEvent(eventId: string) {
    if (!tableId.value || !eventId || !(meta.value as TableType)?.fk_workspace_id) return
    try {
      await $api.internal.postOperation(
        (meta.value as TableType).fk_workspace_id!,
        (meta.value as TableType)?.base_id as string,
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

  async function doRestore(
    tableMeta: TableType,
    rowIds: string[],
    opts: { force?: boolean; partial?: boolean } = {},
  ): Promise<RestoreResult> {
    return (await $api.internal.postOperation(
      tableMeta.fk_workspace_id!,
      tableMeta.base_id!,
      { operation: 'recordTrashRestore' as RecordTrashOperation } as any,
      { tableId: tableMeta.id, rowIds, ...opts },
    )) as RestoreResult
  }

  /**
   * Row-based restore entry point (undo, bulk actions). When no event row
   * is available to host an inline panel, falls back to a confirm modal
   * that summarises the structured conflicts.
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
        const conflicts = extractConflictDetails(e)
        const summary = conflicts?.length
          ? t('trash.conflict.panelTitle', { count: conflicts.length }, conflicts.length)
          : t('trash.linkConflictForce')

        showWarningModal({
          title: t('trash.linkConflictTitle'),
          content: summary,
          okText: t('trash.restoreAnyway'),
          showCancelBtn: true,
          okCallback: async () => {
            try {
              await doRestore(tableMeta, rowIds, { force: true })
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
        (meta.value as TableType)?.base_id as string,
        { operation: 'recordTrashEmpty' as RecordTrashOperation } as any,
        { tableId: tableId.value },
      )
      message.toast(t('trash.trashEmptied'))
      trashEvents.value = []
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

  // Drop all inline conflict panels whenever the trash modal closes or the
  // active table changes — stale panels shouldn't linger across sessions.
  function clearConflicts() {
    for (const k of Object.keys(conflictByEventId)) delete conflictByEventId[k]
  }

  watch(isOpen, (val) => {
    if (!val) clearConflicts()
  })

  watch(
    tableId,
    () => {
      nextCursor.value = null
      trashEvents.value = []
      clearConflicts()
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

  onScopeDispose(() => {
    $eventBus.smartsheetStoreEventBus.off(smartsheetEventHandler)
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
    partialRestoreEvent,
    forceRestoreEvent,
    conflictByEventId,
    conflictFor,
    dismissConflict,
    permanentDeleteEvent,
    restoreFromTrash,
    emptyTrash,
    openTrash,
  }
})
