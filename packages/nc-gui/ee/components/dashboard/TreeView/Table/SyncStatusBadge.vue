<script lang="ts" setup>
import dayjs from 'dayjs'
import { TableSyncStatus, type TableSyncType, type TableType } from 'nocodb-sdk'

const props = defineProps<{
  table: TableType
}>()

const { t } = useI18n()

const tableSyncStore = useTableSyncStore()

const { baseSyncs } = storeToRefs(tableSyncStore)

const tableSync = computed<TableSyncType | undefined>(() => {
  const baseId = props.table.base_id
  if (!baseId || !props.table.id) return undefined

  const list = baseSyncs.value.get(baseId) ?? []
  return list.find((sync) => sync.mappings?.some((mapping) => mapping.dest_table_id === props.table.id))
})

const status = computed(() => tableSync.value?.status ?? null)

const lastSyncedAgo = computed(() => {
  const last = tableSync.value?.last_synced_at
  if (!last || !dayjs(last).isValid()) return null
  return timeAgo(last)
})

const statusColorClass = computed(() => {
  switch (status.value) {
    case TableSyncStatus.Error:
      return 'text-nc-content-red-medium'
    case TableSyncStatus.Paused:
      return 'text-nc-content-orange-medium'
    case TableSyncStatus.Syncing:
      return 'text-nc-content-blue-medium'
    default:
      return ''
  }
})

const statusLine = computed(() => {
  switch (status.value) {
    case TableSyncStatus.Syncing:
      return `${t('labels.syncing')}…`
    case TableSyncStatus.Paused:
      return t('labels.syncPausedHint')
    case TableSyncStatus.Error:
      return lastSyncedAgo.value ? t('labels.lastSyncFailed', { time: lastSyncedAgo.value }) : t('labels.errored')
    case TableSyncStatus.Active:
      return lastSyncedAgo.value ? t('labels.lastSynced', { time: lastSyncedAgo.value }) : t('labels.syncNotYetRun')
    default:
      return null
  }
})
</script>

<template>
  <div class="flex flex-col gap-1.5 text-left">
    <div class="font-semibold">{{ $t('labels.syncedTable') }}</div>
    <div v-if="statusLine" class="text-xs" :class="statusColorClass">{{ statusLine }}</div>
    <div v-if="tableSync?.last_error" class="text-xs opacity-90 whitespace-pre-wrap break-words">
      {{ tableSync.last_error }}
    </div>
  </div>
</template>
