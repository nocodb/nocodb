<script lang="ts" setup>
import type { SyncConfig, TableSyncType, TableType } from 'nocodb-sdk'
import { TableSyncMappingRole } from 'nocodb-sdk'

const props = defineProps<{
  baseId: string
  table: TableType
}>()

const emits = defineEmits<{
  (e: 'close'): void
}>()

const { $e, $api } = useNuxtApp()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { loadProjectTables } = useTablesStore()

const { showWarningModal } = useNcConfirmModal()

const tableSyncStore = useTableSyncStore()

const { baseSyncs } = storeToRefs(tableSyncStore)

const { loadSyncs, resync, openTableSyncEditModal, deleteSync: deleteTableSync, detachTable } = tableSyncStore

const syncStore = useSyncStore()

const { baseSyncs: appBaseSyncs } = storeToRefs(syncStore)

const tableSync = computed<TableSyncType | undefined>(() => {
  const baseId = props.table.base_id
  if (!baseId || !props.table.id) return undefined

  const list = baseSyncs.value.get(baseId) ?? []
  return list.find((sync) => sync.mappings?.some((mapping) => mapping.dest_table_id === props.table.id))
})

// App/custom sync destination tables are resolved via the sync config's table
// mappings (`fk_model_id`), attached by `listSync`.
const appSync = computed<SyncConfig | undefined>(() => {
  const baseId = props.table.base_id
  if (!baseId || !props.table.id) return undefined

  const list = appBaseSyncs.value.get(baseId) ?? []
  return list.find((sync) => sync.mappings?.some((mapping) => mapping.fk_model_id === props.table.id))
})

const isTableSync = computed(() => !!tableSync.value)

const isAppSync = computed(() => !!appSync.value)

// Converting the sync's MAIN table removes the sync itself (keep tables);
// shadow/junction tables detach individually and the sync keeps running.
const isTableSyncMainTable = computed(() => {
  const mapping = tableSync.value?.mappings?.find((m) => m.dest_table_id === props.table.id)
  return mapping?.role === TableSyncMappingRole.Main
})

async function handleSyncNow() {
  emits('close')

  if (tableSync.value) {
    $e('c:table-sync:resync')
    await resync(props.baseId, tableSync.value.id)
    return
  }

  if (!appSync.value) return

  $e('c:sync:trigger-click')
  const job = await syncStore.triggerSync(props.baseId, appSync.value.id)
  if (job?.id) {
    syncStore.openSyncProgressModal({ baseId: props.baseId, jobId: job.id })
  }
}

function handleConvertToRegularTable() {
  emits('close')

  if (!appSync.value && !tableSync.value) return

  $e('c:sync:detach-table:open')

  showWarningModal({
    title: t('labels.convertToRegularTable'),
    content:
      isTableSync.value && isTableSyncMainTable.value
        ? t('msg.warning.tableSyncConvertMainTable')
        : t('msg.warning.syncDetachTable'),
    okText: t('labels.convertToRegularTable'),
    showCancelBtn: true,
    okCallback: async () => {
      if (!activeWorkspaceId.value) return

      try {
        if (tableSync.value) {
          if (isTableSyncMainTable.value) {
            // Converting the synced (main) table drops the sync itself — the
            // sync (with its mappings) goes to trash and every dest table
            // becomes a regular editable table; undo restores + re-attaches.
            await deleteTableSync(props.baseId, tableSync.value.id, { dropTables: false })
          } else {
            // Shadow/junction: drop just this table's mapping from the sync
            // config; the rest of the sync keeps running.
            await detachTable(props.baseId, props.table.id!)
          }
        } else if (appSync.value) {
          await $api.internal.postOperation(
            activeWorkspaceId.value,
            props.baseId,
            { operation: 'detachSyncTable' },
            { modelId: props.table.id },
          )
        }

        $e('a:sync:detach-table')

        await Promise.all([loadProjectTables(props.baseId, true), syncStore.loadSyncs(props.baseId, true)])
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

function handleUpdateSyncConfiguration() {
  emits('close')

  if (tableSync.value) {
    openTableSyncEditModal({ baseId: props.baseId, sync: tableSync.value })
    return
  }

  if (!appSync.value) return

  syncStore.openSyncEditModal({ baseId: props.baseId, syncId: appSync.value.id })
}

onMounted(() => {
  // Ensure the base's syncs are loaded so the table → sync lookup resolves
  // (both loaders are cached, so this is a no-op once populated).
  if (props.table.synced && props.baseId) {
    loadSyncs(props.baseId)

    // App-sync configs are listed via `listSync`, which is creator+ on the
    // backend — gate like the other "Manage Syncs" surfaces so editors don't
    // trigger a failing request (the store toasts on error). Force a refresh
    // when a cached entry lacks `mappings` (populated by an older response),
    // since the table → sync lookup depends on them.
    if (isUIAllowed('sourceCreate')) {
      const cached = appBaseSyncs.value.get(props.baseId)
      const isCacheMissingMappings = !!cached?.some((sync) => !sync.mappings)

      syncStore.loadSyncs(props.baseId, isCacheMissingMappings)
    }
  }
})
</script>

<template>
  <template v-if="isTableSync || isAppSync">
    <NcDivider />

    <NcMenuItem :data-testid="`sidebar-table-sync-now-${table.title}`" @click="handleSyncNow">
      <div v-e="[isTableSync ? 'c:table-sync:resync' : 'c:sync:trigger-click']" class="flex gap-2 items-center">
        <GeneralIcon icon="ncZap" />
        {{ $t('labels.syncNow') }}
      </div>
    </NcMenuItem>

    <NcMenuItem :data-testid="`sidebar-table-sync-update-config-${table.title}`" @click="handleUpdateSyncConfiguration">
      <div v-e="[isTableSync ? 'c:table-sync:edit:open' : 'c:sync:open-edit-modal']" class="flex gap-2 items-center">
        <GeneralIcon icon="ncSettings" />
        {{ $t('labels.updateSyncConfiguration') }}
      </div>
    </NcMenuItem>

    <NcDivider />
    <NcMenuItem :data-testid="`sidebar-table-sync-detach-${table.title}`" danger @click="handleConvertToRegularTable">
      <div v-e="['c:sync:detach-table:open']" class="flex gap-2 items-center">
        <GeneralIcon icon="ncZapOff" />
        {{ $t('labels.convertToRegularTable') }}
      </div>
    </NcMenuItem>
  </template>
</template>
