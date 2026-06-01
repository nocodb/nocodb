<script lang="ts" setup>
import type { TableSyncType, TableType } from 'nocodb-sdk'

const props = defineProps<{
  baseId: string
  table: TableType
}>()

const emits = defineEmits<{
  (e: 'close'): void
}>()

const { $e } = useNuxtApp()

const tableSyncStore = useTableSyncStore()

const { baseSyncs } = storeToRefs(tableSyncStore)

const { loadSyncs, resync, openTableSyncEditModal } = tableSyncStore

const tableSync = computed<TableSyncType | undefined>(() => {
  const baseId = props.table.base_id
  if (!baseId || !props.table.id) return undefined

  const list = baseSyncs.value.get(baseId) ?? []
  return list.find((sync) => sync.mappings?.some((mapping) => mapping.dest_table_id === props.table.id))
})

// Only render for tables that are a NocoDB Table Sync destination.
const isTableSync = computed(() => !!tableSync.value)

async function handleSyncNow() {
  emits('close')
  if (!tableSync.value) return

  $e('c:table-sync:resync')
  await resync(props.baseId, tableSync.value.id)
}

function handleUpdateSyncConfiguration() {
  emits('close')
  if (!tableSync.value) return

  openTableSyncEditModal({ baseId: props.baseId, sync: tableSync.value })
}

onMounted(() => {
  // Ensure the base's syncs are loaded so the table → sync lookup resolves
  // (loadSyncs is cached, so this is a no-op once populated).
  if (props.table.synced && props.baseId) {
    loadSyncs(props.baseId)
  }
})
</script>

<template>
  <template v-if="isTableSync">
    <NcDivider />

    <NcMenuItem :data-testid="`sidebar-table-sync-now-${table.title}`" @click="handleSyncNow">
      <div v-e="['c:table-sync:resync']" class="flex gap-2 items-center">
        <GeneralIcon icon="ncZap" />
        {{ $t('labels.syncNow') }}
      </div>
    </NcMenuItem>

    <NcMenuItem :data-testid="`sidebar-table-sync-update-config-${table.title}`" @click="handleUpdateSyncConfiguration">
      <div v-e="['c:table-sync:edit:open']" class="flex gap-2 items-center">
        <GeneralIcon icon="ncSettings" />
        {{ $t('labels.updateSyncConfiguration') }}
      </div>
    </NcMenuItem>
  </template>
</template>
