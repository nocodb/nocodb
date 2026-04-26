import { isDeletedCol, NcErrorType, PlanLimitTypes } from 'nocodb-sdk'
import type { BaseTrashType, TableType } from 'nocodb-sdk'

// Restore-conflict shapes mirror the backend (`record-trash.helpers.ts`) —
// kept here so the panel + group components can type their props without
// pulling backend modules into the frontend.
export type RestoreConflict =
  | {
      kind: 'link-v1'
      rowId: string
      columnId: string
      columnTitle: string
      fkColumnName: string
    }
  | {
      kind: 'link-v2'
      rowId: string
      columnId: string
      columnTitle: string
      anchorPk: unknown
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

export const useBaseTrash = createSharedComposable(() => {
  const { $api, $e } = useNuxtApp()

  const { t } = useI18n()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const basesStore = useBases()

  const { activeProjectId, bases } = storeToRefs(basesStore)

  const tablesStore = useTablesStore()

  const { activeTableId, activeTable } = storeToRefs(tablesStore)

  const { getMetaByKey } = useMetas()

  const { showWarningModal } = useNcConfirmModal()

  const { getLimit } = useEeConfig()

  const retentionDays = computed(() => {
    const limit = getLimit(PlanLimitTypes.LIMIT_TRASH_RETENTION)
    return typeof limit === 'number' && limit > 0 ? limit : 30
  })

  const isOpen = ref(false)

  const isLoading = ref(false)

  const trashItems = ref<BaseTrashType[]>([])

  const pageSize = ref(25)

  const nextCursor = ref<string | null>(null)

  const isLoadingMore = ref(false)

  const open = () => {
    isOpen.value = true
    loadTrash()
    $e('c:base-trash:open')
  }

  const close = () => {
    isOpen.value = false
    trashItems.value = []
    nextCursor.value = null
  }

  /**
   * Cursor-paginated load. `append=false` resets the list and pulls the first
   * page; `append=true` follows `nextCursor` to fetch and append the next.
   */
  const loadTrash = async (append = false) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    if (append && !nextCursor.value) return

    if (append) {
      isLoadingMore.value = true
    } else {
      isLoading.value = true
    }

    try {
      const res = await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'baseTrashList',
        limit: String(pageSize.value),
        ...(append && nextCursor.value ? { cursor: nextCursor.value } : {}),
      })

      const incoming = (res.list as BaseTrashType[]) || []
      trashItems.value = append ? [...trashItems.value, ...incoming] : incoming
      nextCursor.value = (res as any).nextCursor || null
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
      isLoadingMore.value = false
    }
  }

  const loadMore = () => loadTrash(true)

  // ── Per-entry conflict state ──────────────────────────────────
  //
  // When a record entry restore fails with ERR_RECORD_RESTORE_CONFLICT, the
  // backend returns a structured conflict list. We keep that list in
  // `conflictByEntryId` keyed by the BaseTrash entry id so the inline panel
  // can render groups + actions (Cancel / Partial / Force) right under the
  // row. Cleared on successful restore or explicit dismissal.
  const conflictByEntryId = reactive<Record<string, ConflictState>>({})

  function conflictFor(entryId: string): ConflictState | undefined {
    return conflictByEntryId[entryId]
  }

  function dismissConflict(entryId: string) {
    delete conflictByEntryId[entryId]
  }

  function extractConflictDetails(e: any): RestoreConflict[] | null {
    const conflicts = e?.response?.data?.details?.conflicts
    return Array.isArray(conflicts) ? (conflicts as RestoreConflict[]) : null
  }

  const callBaseTrashRestore = (
    trashId: string,
    opts: { force?: boolean; partial?: boolean } = {},
  ) =>
    $api.internal.postOperation(
      activeWorkspaceId.value!,
      activeProjectId.value!,
      { operation: 'baseTrashRestore' },
      { trashId, ...opts },
    )

  const restoreItem = async (trashId: string) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    dismissConflict(trashId)

    try {
      await callBaseTrashRestore(trashId)
      message.success(t('msg.success.restored'))
      $e('a:base-trash:restore')
      await loadTrash()
    } catch (e: any) {
      const { error } = await extractSdkResponseErrorMsgv2(e)
      // Record entries surface conflicts as inline panel state. Other types
      // fall through to a toast — they don't have the conflict pipeline.
      if (error === NcErrorType.ERR_RECORD_RESTORE_CONFLICT) {
        const conflicts = extractConflictDetails(e)
        if (conflicts) {
          conflictByEntryId[trashId] = { conflicts, isSubmitting: false }
          return
        }
      }
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  /**
   * Restore only the conflict-free rows under this entry. Conflicted rows
   * stay in trash for the user to fix upstream and retry. The entry itself
   * survives (handler returns `keepEntry: true`) until the residue is
   * cleared, so the unified list keeps showing it with the remaining rows.
   */
  async function partialRestoreItem(trashId: string) {
    if (!activeWorkspaceId.value || !activeProjectId.value) return
    const state = conflictByEntryId[trashId]
    if (!state) return

    state.isSubmitting = true
    state.error = undefined

    try {
      await callBaseTrashRestore(trashId, { partial: true })
      message.success(t('msg.success.partiallyRestored'))
      $e('a:base-trash:restore:partial')
      dismissConflict(trashId)
      await loadTrash()
    } catch (e: any) {
      if (conflictByEntryId[trashId]) {
        conflictByEntryId[trashId].isSubmitting = false
        conflictByEntryId[trashId].error = await extractSdkResponseErrorMsg(e)
      }
    }
  }

  /**
   * Force-restore: auto-resolve every conflict by nulling offending columns
   * / dropping junction rows. Destructive — backend applies the resolutions
   * inline, no rollback.
   */
  async function forceRestoreItem(trashId: string) {
    if (!activeWorkspaceId.value || !activeProjectId.value) return
    const state = conflictByEntryId[trashId]
    if (!state) return

    state.isSubmitting = true
    state.error = undefined

    try {
      await callBaseTrashRestore(trashId, { force: true })
      message.success(t('msg.success.restored'))
      $e('a:base-trash:restore:force')
      dismissConflict(trashId)
      await loadTrash()
    } catch (e: any) {
      if (conflictByEntryId[trashId]) {
        conflictByEntryId[trashId].isSubmitting = false
        conflictByEntryId[trashId].error = await extractSdkResponseErrorMsg(e)
      }
    }
  }

  const emptyTrash = async () => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      await $api.internal.postOperation(activeWorkspaceId.value, activeProjectId.value, { operation: 'baseTrashEmpty' }, {})

      message.success(t('msg.success.trashEmptied'))
      $e('a:base-trash:empty')
      trashItems.value = []
      nextCursor.value = null
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  // ── Per-row restore (used by data composables: undo, "restore selected") ──

  const tableMetaForRestore = computed(() => {
    if (!activeProjectId.value || !activeTableId.value) return undefined
    return getMetaByKey(activeProjectId.value, activeTableId.value) ?? activeTable.value
  })

  /**
   * Reason trash is unavailable for the active table, derived locally:
   *   'external' — source isn't NocoDB-managed (meta/local)
   *   'pending'  — meta source but no `_nc_deleted` column yet
   *   'disabled' — toggled off in trash settings for this table
   *   'license'  — workspace plan retention ≤ 0; mirrors backend isTrashEnabledForWorkspace
   *   null       — fully available
   */
  const trashUnavailableReason = computed<'external' | 'pending' | 'disabled' | 'license' | null>(() => {
    const table = tableMetaForRestore.value as TableType | undefined
    if (!table) return 'pending'
    const source = bases.value.get(table.base_id!)?.sources?.find((s) => s.id === table.source_id)
    if (source && !(source.is_meta || source.is_local)) return 'external'
    const limit = getLimit(PlanLimitTypes.LIMIT_TRASH_RETENTION)
    if (!(typeof limit === 'number' && limit > 0)) return 'license'
    if (!table.columns?.some((c) => isDeletedCol(c))) return 'pending'
    if (table.trash_disabled) return 'disabled'
    return null
  })

  /**
   * Direct row-level restore — bypasses the BaseTrash entry layer and
   * works on RLS-filtered primary keys. On link / validation / unique
   * conflict (HTTP 422 with NcErrorType.ERR_RECORD_RESTORE_CONFLICT),
   * surfaces a confirm modal that re-issues the call with `force: true`.
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

    const callRestore = (opts: { force?: boolean; partial?: boolean } = {}) =>
      $api.internal.postOperation(
        tableMeta.fk_workspace_id!,
        tableMeta.base_id as string,
        { operation: 'baseTrashRestoreRows' },
        { tableId: tableMeta.id, rowIds, ...opts },
      )

    try {
      await callRestore()
      await callbacks?.onSuccess?.()
    } catch (e: any) {
      const { error } = await extractSdkResponseErrorMsgv2(e)
      if (error === NcErrorType.ERR_RECORD_RESTORE_CONFLICT) {
        const conflicts = (e?.response?.data?.details?.conflicts ?? []) as any[]
        const summary = conflicts.length
          ? t('trash.conflict.panelTitle', { count: conflicts.length }, conflicts.length)
          : t('trash.linkConflictForce')
        showWarningModal({
          title: t('trash.linkConflictTitle'),
          content: summary,
          okText: t('trash.restoreAnyway'),
          showCancelBtn: true,
          okCallback: async () => {
            try {
              await callRestore({ force: true })
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

  return {
    isOpen,
    isLoading,
    isLoadingMore,
    trashItems,
    nextCursor,
    pageSize,
    retentionDays,
    open,
    close,
    loadTrash,
    loadMore,
    restoreItem,
    partialRestoreItem,
    forceRestoreItem,
    conflictFor,
    dismissConflict,
    emptyTrash,
    restoreFromTrash,
    trashUnavailableReason,
  }
})
