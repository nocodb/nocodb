import { acceptHMRUpdate } from 'pinia'
import type { ColumnType, TableSyncCreateReqType, TableSyncType, TableSyncUpdateReqType, ViewType } from 'nocodb-sdk'
import { ProjectSyncTableForm } from '#components'

export interface TableSyncSourceSchema {
  source_table_missing: boolean
  columns: ColumnType[]
  views: ViewType[]
  visible_source_column_ids: string[]
}

export const useTableSyncStore = defineStore('tableSync', () => {
  const { $api, $e } = useNuxtApp()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { showUpgradeToUseTableSync } = useEeConfig()

  const { isUIAllowed } = useRoles()

  const baseSyncs = ref<Map<string, TableSyncType[]>>(new Map())

  const isLoading = ref(false)

  const activeBaseSyncs = (baseId?: string | null) => {
    if (!baseId) return []
    return baseSyncs.value.get(baseId) ?? []
  }

  const upsertSync = (baseId: string, sync: TableSyncType) => {
    const list = baseSyncs.value.get(baseId) ?? []
    const idx = list.findIndex((s) => s.id === sync.id)
    const next = [...list]
    if (idx === -1) next.push(sync)
    else next[idx] = sync
    baseSyncs.value.set(baseId, next)
  }

  const removeSync = (baseId: string, syncId: string) => {
    const list = baseSyncs.value.get(baseId) ?? []
    baseSyncs.value.set(
      baseId,
      list.filter((s) => s.id !== syncId),
    )
  }

  const loadSyncs = async (baseId: string): Promise<TableSyncType[]> => {
    if (!activeWorkspaceId.value || !baseId) return []
    // Listing syncs is creator+ on the backend; skip for editors and below
    // so the sidebar/tree auto-loads don't fire a forbidden `tableSyncList`.
    if (!isUIAllowed('tableSyncList')) return []
    isLoading.value = true
    try {
      const res = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'tableSyncList',
      })) as TableSyncType[] | { list?: TableSyncType[] } | null | undefined
      const list: TableSyncType[] = Array.isArray(res) ? res : res?.list ?? []
      baseSyncs.value.set(baseId, list)
      return list
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return []
    } finally {
      isLoading.value = false
    }
  }

  const createSync = async (baseId: string, payload: TableSyncCreateReqType): Promise<TableSyncType | null> => {
    if (!activeWorkspaceId.value) return null
    const created = (await $api.internal.postOperation(
      activeWorkspaceId.value,
      baseId,
      { operation: 'tableSyncCreate' },
      payload,
    )) as TableSyncType
    upsertSync(baseId, created)
    return created
  }

  const deleteSync = async (baseId: string, syncId: string, options: { dropTables?: boolean } = {}): Promise<void> => {
    if (!activeWorkspaceId.value) return
    await $api.internal.postOperation(
      activeWorkspaceId.value,
      baseId,
      { operation: 'tableSyncDelete', tableSyncId: syncId },
      { dropTables: !!options.dropTables },
    )
    removeSync(baseId, syncId)
  }

  const resync = async (baseId: string, syncId: string): Promise<TableSyncType | null> => {
    if (!activeWorkspaceId.value) return null
    const updated = (await $api.internal.postOperation(
      activeWorkspaceId.value,
      baseId,
      { operation: 'tableSyncResync', tableSyncId: syncId },
      {},
    )) as TableSyncType
    upsertSync(baseId, updated)
    return updated
  }

  const updateSync = async (baseId: string, syncId: string, patch: TableSyncUpdateReqType): Promise<TableSyncType | null> => {
    if (!activeWorkspaceId.value) return null
    const updated = (await $api.internal.postOperation(
      activeWorkspaceId.value,
      baseId,
      { operation: 'tableSyncUpdate', tableSyncId: syncId },
      patch,
    )) as TableSyncType
    upsertSync(baseId, updated)
    return updated
  }

  const freezeSync = async (baseId: string, syncId: string): Promise<TableSyncType | null> => {
    if (!activeWorkspaceId.value) return null
    const updated = (await $api.internal.postOperation(
      activeWorkspaceId.value,
      baseId,
      { operation: 'tableSyncFreeze', tableSyncId: syncId },
      {},
    )) as TableSyncType
    upsertSync(baseId, updated)
    return updated
  }

  const resumeSync = async (baseId: string, syncId: string): Promise<TableSyncType | null> => {
    if (!activeWorkspaceId.value) return null
    const updated = (await $api.internal.postOperation(
      activeWorkspaceId.value,
      baseId,
      { operation: 'tableSyncResume', tableSyncId: syncId },
      {},
    )) as TableSyncType
    upsertSync(baseId, updated)
    return updated
  }

  /**
   * Resolve a public share-view URL (`/dashboard/#/nc/view/<uuid>`) or raw
   * uuid into the underlying base/table/view ids. Backend validates the
   * password (bcrypt-compared against the View's stored hash) when set, and
   * refuses views whose `allow_sync` is not enabled.
   */
  const resolveLink = async (
    baseId: string,
    payload: { url?: string; uuid?: string; password?: string },
  ): Promise<
    | ({
        workspace_id: string
        base_id: string
        table_id: string
        view_id: string
        has_password: boolean
      } & TableSyncSourceSchema)
    | null
  > => {
    if (!activeWorkspaceId.value) return null
    return (await $api.internal.postOperation(
      activeWorkspaceId.value,
      baseId,
      { operation: 'tableSyncResolveLink' },
      payload,
    )) as {
      workspace_id: string
      base_id: string
      table_id: string
      view_id: string
      has_password: boolean
    } & TableSyncSourceSchema
  }

  /**
   * Source schema (columns + views + the bound view's visible-column ids) for
   * an existing sync, read through the sync's own authorization on the backend
   * rather than the caller's base ACL. The edit form uses this instead of
   * `tableGet`/`viewColumnList` so it doesn't 403 when the importing user has
   * no access to the source base (the share view, not base membership, is the
   * authorization for sync-from-shared-view).
   */
  const fetchSourceSchema = async (baseId: string, syncId: string): Promise<TableSyncSourceSchema | null> => {
    if (!activeWorkspaceId.value) return null
    return (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
      operation: 'tableSyncSourceSchema',
      tableSyncId: syncId,
    })) as TableSyncSourceSchema
  }

  async function openTableSyncCreateModal({ baseId }: { baseId?: string }) {
    if (!baseId || showUpgradeToUseTableSync({ triggerSource: 'table-sync' })) return

    $e('c:sync:open-internal-create-modal')

    const isDlgOpen = ref(true)

    const { close } = useDialog(ProjectSyncTableForm, {
      'value': isDlgOpen,
      'baseId': baseId,
      'onUpdate:value': () => closeDialog(),
      'onSyncCreated': (jobId: string) => {
        closeDialog(jobId)
      },
    })

    function closeDialog(jobId?: string) {
      isDlgOpen.value = false
      close(1000)

      if (baseId && jobId) {
        useSyncStore().openSyncProgressModal({ baseId, jobId })
      }
    }
  }

  function openTableSyncEditModal({ baseId, sync }: { baseId?: string; sync?: TableSyncType }) {
    if (!baseId || !sync) return

    $e('c:table-sync:edit:open')

    const isDlgOpen = ref(true)

    const { close } = useDialog(ProjectSyncTableForm, {
      'value': isDlgOpen,
      'baseId': baseId,
      'sync': sync,
      'onUpdate:value': () => closeDialog(),
      'onSaved': () => closeDialog(),
    })

    function closeDialog() {
      isDlgOpen.value = false
      close(1000)
    }
  }

  return {
    baseSyncs,
    isLoading,
    activeBaseSyncs,
    loadSyncs,
    createSync,
    updateSync,
    deleteSync,
    resync,
    freezeSync,
    resumeSync,
    resolveLink,
    fetchSourceSchema,
    openTableSyncCreateModal,
    openTableSyncEditModal,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTableSyncStore, import.meta.hot))
}
