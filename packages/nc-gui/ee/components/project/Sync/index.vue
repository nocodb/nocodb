<script setup lang="ts">
import dayjs from 'dayjs'
import { TableSyncStatus, TableSyncTrigger } from 'nocodb-sdk'
import type { TableSyncType } from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
}>()

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { isUIAllowed, loadRoles } = useRoles()

const { loadDynamicIntegrations, loadIntegrations, integrations } = useIntegrationStore()

const baseStore = useBase()

const basesStore = useBases()

const syncStore = useSyncStore()

const tableSyncStore = useTableSyncStore()

const { showInfoModal } = useNcConfirmModal()

const { loadTables } = baseStore

const { bases, activeProjectId } = storeToRefs(basesStore)

const { openNewSyncCreateModal, openSyncProgressModal } = syncStore

const { activeBaseSyncs: integrationSyncs, isLoadingSync } = storeToRefs(syncStore)

const { loadSyncs, triggerSync: _triggerSync } = syncStore

const {
  loadSyncs: loadTableSyncs,
  resync: resyncTableSync,
  freezeSync: freezeTableSync,
  resumeSync: resumeTableSync,
  activeBaseSyncs: activeBaseTableSyncsFn,
  openTableSyncCreateModal,
} = tableSyncStore

const { isLoading: isLoadingTableSyncs } = storeToRefs(tableSyncStore)

const searchQuery = ref<string>('')

const isEditSyncModalOpen = ref(false)

const activeSyncId = ref('')

const isTableSyncEditOpen = ref(false)

const isTableSyncDeleteOpen = ref(false)

const activeTableSync = ref<TableSyncType | null>(null)

const isActing = ref<Record<string, boolean>>({})

const setActing = (id: string, v: boolean) => {
  isActing.value = { ...isActing.value, [id]: v }
}

interface UnifiedSyncRow {
  id: string
  title: string
  kind: 'integration' | 'table'
  raw: any
}

const currentBase = computedAsync(async () => {
  let base
  if (props.baseId) {
    base = bases.value.get(props.baseId)
    if (!base) {
      base = await $api.base.read(props.baseId!)
    }
  } else {
    base = bases.value.get(activeProjectId.value)
  }
  return base
})

const tableSyncs = computed<TableSyncType[]>(() => activeBaseTableSyncsFn(currentBase.value?.id))

const allSyncs = computed<UnifiedSyncRow[]>(() => {
  const rows: UnifiedSyncRow[] = []
  for (const s of integrationSyncs.value) {
    rows.push({ id: s.id, title: s.title ?? '', kind: 'integration', raw: s })
  }
  for (const s of tableSyncs.value) {
    rows.push({ id: s.id, title: s.title ?? '', kind: 'table', raw: s })
  }
  return rows
})

const filteredSyncs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return allSyncs.value
  return allSyncs.value.filter((row) => row.title.toLowerCase().includes(q))
})

const columns = [
  { key: 'name', title: 'Name', name: 'Name', dataIndex: 'title', minWidth: 200, basis: '35%', padding: '0px 24px' },
  { key: 'source', title: 'Source', name: 'Source', dataIndex: 'source', minWidth: 140, basis: '20%', padding: '0px 24px' },
  { key: 'status', title: 'Status', name: 'Status', dataIndex: 'status', minWidth: 120, basis: '15%', padding: '0px 24px' },
  {
    key: 'last_sync',
    title: 'Last trigger',
    name: 'Last trigger',
    dataIndex: 'last_sync_at',
    minWidth: 140,
    basis: '20%',
    padding: '0px 24px',
  },
  { key: 'actions', title: 'Actions', name: 'Actions', width: 220, minWidth: 100, padding: '0px 24px', justify: 'justify-end' },
] as NcTableColumnProps[]

const getIntegration = (id: string) => integrations.value.find((int) => int.id === id)

const isLoadingAll = computed(() => isLoadingSync.value || isLoadingTableSyncs.value)

const handleCreateIntegrationSync = () => {
  $e('c:sync:create:integration')
  openNewSyncCreateModal({ baseId: currentBase.value?.id })
}

const handleCreateTableSync = () => {
  $e('c:sync:create:table')
  openTableSyncCreateModal({ baseId: currentBase.value?.id })
}

const handleEditIntegrationSync = (syncId: string) => {
  $e('c:sync:open-edit-modal')
  activeSyncId.value = syncId
  isEditSyncModalOpen.value = true
}

const handleDeleteIntegrationSync = (syncId: string) => {
  if (!currentBase.value?.id) return
  showInfoModal({
    title: t('title.deleteSyncConfirmTitle'),
    content: t('title.deleteSyncConfirmSubtitle'),
    showCancelBtn: true,
    showIcon: false,
    showOkLoading: true,
    okProps: { type: 'danger' },
    okText: t('general.delete'),
    okCallback: async () => {
      try {
        await syncStore.deleteSync(currentBase.value!.id!, syncId)
        loadTables()
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

const triggerIntegrationSync = async (syncId: string) => {
  if (!currentBase.value?.id) return
  $e('c:sync:trigger-click')
  const job = await _triggerSync(currentBase.value.id!, syncId)
  if (job?.id) {
    openSyncProgressModal({ baseId: currentBase.value.id!, jobId: job.id })
  }
}

const openTableSyncEdit = (sync: TableSyncType) => {
  $e('c:table-sync:edit:open')
  activeTableSync.value = sync
  isTableSyncEditOpen.value = true
}

const openTableSyncDelete = (sync: TableSyncType) => {
  $e('c:table-sync:delete:open')
  activeTableSync.value = sync
  isTableSyncDeleteOpen.value = true
}

const doTableSyncResync = async (sync: TableSyncType) => {
  $e('c:table-sync:resync', { fromStatus: sync.status })
  setActing(sync.id, true)
  try {
    const updated = await resyncTableSync(currentBase.value!.id!, sync.id)
    if (updated?.sync_job_id && currentBase.value?.id) {
      openSyncProgressModal({ baseId: currentBase.value.id, jobId: updated.sync_job_id })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setActing(sync.id, false)
  }
}

const doTableSyncFreeze = async (sync: TableSyncType) => {
  $e('c:table-sync:freeze')
  setActing(sync.id, true)
  try {
    await freezeTableSync(currentBase.value!.id!, sync.id)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setActing(sync.id, false)
  }
}

const doTableSyncResume = async (sync: TableSyncType) => {
  $e('c:table-sync:resume', { fromStatus: sync.status })
  setActing(sync.id, true)
  try {
    await resumeTableSync(currentBase.value!.id!, sync.id)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setActing(sync.id, false)
  }
}

const onRowClick = (row: UnifiedSyncRow) => {
  if (row.kind === 'integration') {
    handleEditIntegrationSync(row.id)
  } else {
    openTableSyncEdit(row.raw as TableSyncType)
  }
}

const tableSyncTriggerLabel = (trigger: TableSyncTrigger) => {
  if (trigger === TableSyncTrigger.Realtime) return t('labels.automatically')
  if (trigger === TableSyncTrigger.Manual) return t('labels.manually')
  return trigger
}

const tableSyncStatusVariant = (status: TableSyncStatus): { text: string; color: string } => {
  switch (status) {
    case TableSyncStatus.Active:
      return { text: t('general.active'), color: 'text-nc-content-green-dark' }
    case TableSyncStatus.Syncing:
      return { text: t('labels.syncing'), color: 'text-nc-content-brand' }
    case TableSyncStatus.Paused:
      return { text: t('labels.paused'), color: 'text-nc-content-gray-subtle' }
    case TableSyncStatus.Error:
      return { text: t('labels.errored'), color: 'text-nc-content-red-dark' }
    default:
      return { text: String(status), color: 'text-nc-content-gray' }
  }
}

const lastTriggerOf = (row: UnifiedSyncRow): string | null => {
  if (row.kind === 'integration') return row.raw?.last_sync_at ?? null
  return row.raw?.last_synced_at ?? null
}

onMounted(async () => {
  await Promise.all([loadDynamicIntegrations(), loadIntegrations(null, props.baseId || activeProjectId.value)])

  await waitForValueExists(
    () => currentBase.value?.id,
    (id) => !!id,
  )
  if (!currentBase.value?.id) return
  await Promise.all([loadSyncs(currentBase.value.id), loadTableSyncs(currentBase.value.id)])
})

onMounted(async () => {
  if (props.baseId) {
    await loadRoles(props.baseId)
  }
})
</script>

<template>
  <div class="flex flex-col h-full p-6" data-testid="nc-settings-syncs-tab">
    <div class="mb-6 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <a-input
          v-model:value="searchQuery"
          type="text"
          class="nc-search-syncs-input nc-input-border-on-value !max-w-90 nc-input-sm"
          placeholder="Search sync"
          allow-clear
        >
          <template #prefix>
            <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
          </template>
        </a-input>
        <NuxtLink href="https://nocodb.com/docs/product-docs/noco-sync" target="_blank" rel="noopener noreferrer">
          <NcButton v-e="['c:sync:docs']" type="text" size="small" class="!px-2 !w-22 !text-nc-content-gray-subtle2">
            <div class="flex gap-2 items-center">
              {{ $t('title.docs') }}
              <GeneralIcon icon="ncExternalLink" />
            </div>
          </NcButton>
        </NuxtLink>
      </div>

      <NcDropdown v-if="isUIAllowed('sourceCreate')" :trigger="['click']" placement="bottomRight">
        <NcButton size="small" class="z-10 !px-2" type="primary" data-testid="nc-sync-new-dropdown">
          <div class="flex flex-row items-center w-full gap-x-1">
            <GeneralIcon icon="plus" />
            <span>{{ $t('labels.newSync') }}</span>
            <GeneralIcon icon="ncChevronDown" class="!w-3.5 !h-3.5" />
          </div>
        </NcButton>
        <template #overlay>
          <NcMenu variant="small" class="!w-[320px] nc-sync-new-menu">
            <NcMenuItem data-testid="nc-sync-new-table" @click="handleCreateTableSync">
              <div class="flex items-start gap-2 w-full py-1">
                <GeneralIcon icon="ncZap" class="!w-5 !h-5 flex-none mt-0.5 text-nc-content-gray-emphasis" />
                <div class="flex flex-col gap-1 flex-1 min-w-0">
                  <span class="text-bodyDefaultSmBold text-nc-content-gray">
                    {{ $t('labels.tableSync') }}
                  </span>
                  <span class="text-bodyDefaultSm text-nc-content-gray-subtle2 whitespace-normal break-words">
                    {{ $t('labels.tableSyncDesc') }}
                  </span>
                </div>
              </div>
            </NcMenuItem>
            <NcMenuItem data-testid="nc-sync-new-integration" @click="handleCreateIntegrationSync">
              <div class="flex items-start gap-2 w-full py-1">
                <GeneralIcon icon="integration" class="!w-5 !h-5 flex-none mt-0.5 text-nc-content-gray-emphasis" />
                <div class="flex flex-col gap-1 flex-1 min-w-0">
                  <span class="text-bodyDefaultSmBold text-nc-content-gray">
                    {{ $t('labels.integrationSync') }}
                  </span>
                  <span class="text-bodyDefaultSm text-nc-content-gray-subtle2 whitespace-normal break-words">
                    {{ $t('labels.integrationSyncDesc') }}
                  </span>
                </div>
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>

    <div class="flex-1 overflow-auto">
      <NcTable
        :bordered="false"
        :columns="columns"
        :data="filteredSyncs"
        :is-data-loading="isLoadingAll"
        row-height="54px"
        header-row-height="54px"
        class="h-full w-full"
        @row-click="(row) => onRowClick(row)"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <NcTooltip
              :title="record.title || 'Untitled Sync'"
              show-on-truncate-only
              class="text-captionBold text-nc-content-gray truncate w-full"
            >
              {{ record.title || 'Untitled Sync' }}
            </NcTooltip>
          </template>

          <template v-else-if="column.key === 'source'">
            <template v-if="record.kind === 'integration'">
              <div class="flex items-center gap-1">
                <NcTooltip v-for="(child, idx) in [record.raw, ...(record.raw.children || [])].slice(0, 3)" :key="idx">
                  <template #title>
                    {{ getIntegration(child.fk_integration_id)?.title || 'Unknown Sync' }}
                  </template>
                  <GeneralIntegrationIcon
                    v-if="getIntegration(child.fk_integration_id)?.sub_type"
                    size="lg"
                    :type="getIntegration(child.fk_integration_id)?.sub_type"
                  />
                  <GeneralIcon v-else icon="ncZap" class="w-5 h-5" />
                </NcTooltip>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center gap-2">
                <GeneralIcon icon="ncZap" class="text-nc-content-brand w-5 h-5" />
                <span class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
                  {{ tableSyncTriggerLabel(record.raw.sync_trigger) }}
                </span>
              </div>
            </template>
          </template>

          <template v-else-if="column.key === 'status'">
            <template v-if="record.kind === 'table'">
              <NcTooltip
                v-if="record.raw.status === TableSyncStatus.Error && record.raw.last_error"
                :title="record.raw.last_error"
                placement="top"
              >
                <span
                  class="text-caption inline-flex items-center gap-1"
                  :class="tableSyncStatusVariant(record.raw.status).color"
                >
                  {{ tableSyncStatusVariant(record.raw.status).text }}
                  <GeneralIcon icon="info" class="!w-3.5 !h-3.5 opacity-70" />
                </span>
              </NcTooltip>
              <span v-else class="text-caption" :class="tableSyncStatusVariant(record.raw.status).color">
                {{ tableSyncStatusVariant(record.raw.status).text }}
              </span>
            </template>
            <span v-else class="text-nc-content-gray-subtle2 text-bodyDefaultSm">—</span>
          </template>

          <template v-else-if="column.key === 'last_sync'">
            <NcTooltip>
              <template #title>
                {{
                  dayjs(lastTriggerOf(record)).isValid() ? dayjs(lastTriggerOf(record)).format('DD MMM YYYY HH:mm Z') : 'Never'
                }}
              </template>
              <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
                {{ dayjs(lastTriggerOf(record)).isValid() ? timeAgo(lastTriggerOf(record)) : 'Never' }}
              </div>
            </NcTooltip>
          </template>

          <template v-else-if="column.key === 'actions'">
            <div class="flex justify-end" @click.stop>
              <template v-if="record.kind === 'integration'">
                <NcButton
                  type="secondary"
                  size="small"
                  class="!border-r-0 !rounded-r-none"
                  @click.stop="triggerIntegrationSync(record.id)"
                >
                  {{ $t('labels.triggerSync') }}
                </NcButton>
                <NcDropdown placement="bottomRight">
                  <NcButton type="secondary" size="small" class="!rounded-l-none">
                    <GeneralIcon icon="threeDotVertical" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu variant="small">
                      <NcMenuItemCopyId
                        v-if="record"
                        :id="record.id"
                        :tooltip="$t('labels.clickToCopySyncID')"
                        :label="$t('labels.syncIdColon', { syncId: record.id })"
                      />
                      <NcDivider />
                      <NcMenuItem @click="handleEditIntegrationSync(record.id)">
                        <GeneralIcon icon="edit" />
                        <span>{{ $t('general.edit') }}</span>
                      </NcMenuItem>
                      <NcDivider />
                      <NcMenuItem danger @click="handleDeleteIntegrationSync(record.id)">
                        <GeneralIcon icon="delete" />
                        <span>{{ $t('general.delete') }}</span>
                      </NcMenuItem>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </template>

              <template v-else>
                <NcDropdown placement="bottomRight">
                  <NcButton type="secondary" size="small">
                    <GeneralIcon icon="threeDotVertical" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu variant="small">
                      <NcMenuItem
                        v-if="record.raw.status === TableSyncStatus.Paused || record.raw.status === TableSyncStatus.Error"
                        :disabled="isActing[record.id] || record.raw.status === TableSyncStatus.Syncing"
                        @click="doTableSyncResume(record.raw)"
                      >
                        <GeneralIcon icon="play" class="opacity-80" />
                        <span class="flex-1">
                          {{ record.raw.status === TableSyncStatus.Error ? $t('labels.retrySync') : $t('labels.resumeSync') }}
                        </span>
                      </NcMenuItem>
                      <NcMenuItem
                        :disabled="isActing[record.id] || record.raw.status === TableSyncStatus.Syncing"
                        @click="doTableSyncResync(record.raw)"
                      >
                        <GeneralIcon icon="refresh" class="opacity-80" />
                        <span class="flex-1">{{ $t('labels.syncNow') }}</span>
                      </NcMenuItem>
                      <NcMenuItem
                        v-if="record.raw.status !== TableSyncStatus.Paused"
                        :disabled="isActing[record.id] || record.raw.status === TableSyncStatus.Syncing"
                        @click="doTableSyncFreeze(record.raw)"
                      >
                        <GeneralIcon icon="pause" class="opacity-80" />
                        <span class="flex-1">{{ $t('labels.freezeSync') }}</span>
                      </NcMenuItem>
                      <NcMenuItem @click="openTableSyncEdit(record.raw)">
                        <GeneralIcon icon="edit" />
                        <span>{{ $t('general.edit') }}</span>
                      </NcMenuItem>
                      <NcDivider />
                      <NcMenuItem danger @click="openTableSyncDelete(record.raw)">
                        <GeneralIcon icon="delete" />
                        <span>{{ $t('general.delete') }}</span>
                      </NcMenuItem>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </template>
            </div>
          </template>
        </template>

        <template #emptyText>
          <div class="px-2 py-6 text-nc-content-gray-muted flex flex-col items-center gap-6 text-center">
            <img
              src="~assets/img/placeholder/no-search-result-found.png"
              class="!w-[164px] flex-none"
              :alt="allSyncs.length === 0 ? $t('labels.noSyncsYet') : 'No search results found'"
            />
            <div class="max-w-md">
              {{ allSyncs.length === 0 ? $t('labels.noSyncsYet') : 'No results matched your search' }}
            </div>
            <NcDropdown v-if="isUIAllowed('sourceCreate') && allSyncs.length === 0" :trigger="['click']">
              <NcButton size="small" type="primary" data-testid="nc-sync-empty-new">
                <div class="flex items-center gap-x-1">
                  <GeneralIcon icon="plus" />
                  <span>{{ $t('labels.newSync') }}</span>
                  <GeneralIcon icon="ncChevronDown" class="!w-3.5 !h-3.5" />
                </div>
              </NcButton>
              <template #overlay>
                <NcMenu variant="small" class="!w-[320px] nc-sync-new-menu">
                  <NcMenuItem @click="handleCreateTableSync">
                    <div class="flex items-start gap-2 w-full py-1">
                      <GeneralIcon icon="ncZap" class="!w-5 !h-5 flex-none mt-0.5 text-nc-content-gray-emphasis" />
                      <div class="flex flex-col gap-1 flex-1 min-w-0">
                        <span class="text-bodyDefaultSmBold text-nc-content-gray">
                          {{ $t('labels.tableSync') }}
                        </span>
                        <span class="text-bodyDefaultSm text-nc-content-gray-subtle2 whitespace-normal break-words">
                          {{ $t('labels.tableSyncDesc') }}
                        </span>
                      </div>
                    </div>
                  </NcMenuItem>
                  <NcMenuItem @click="handleCreateIntegrationSync">
                    <div class="flex items-start gap-2 w-full py-1">
                      <GeneralIcon icon="integration" class="!w-5 !h-5 flex-none mt-0.5 text-nc-content-gray-emphasis" />
                      <div class="flex flex-col gap-1 flex-1 min-w-0">
                        <span class="text-bodyDefaultSmBold text-nc-content-gray">
                          {{ $t('labels.integrationSync') }}
                        </span>
                        <span class="text-bodyDefaultSm text-nc-content-gray-subtle2 whitespace-normal break-words">
                          {{ $t('labels.integrationSyncDesc') }}
                        </span>
                      </div>
                    </div>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </template>
      </NcTable>
    </div>

    <ProjectSyncEdit
      v-if="isEditSyncModalOpen && activeSyncId"
      v-model:value="isEditSyncModalOpen"
      :base-id="currentBase?.id!"
      :sync-id="activeSyncId"
    />

    <ProjectSyncTableForm
      v-if="isTableSyncEditOpen && activeTableSync"
      v-model:value="isTableSyncEditOpen"
      :base-id="currentBase?.id!"
      :sync="activeTableSync"
    />

    <ProjectSyncTableDelete
      v-if="isTableSyncDeleteOpen && activeTableSync"
      v-model:value="isTableSyncDeleteOpen"
      :base-id="currentBase?.id!"
      :sync="activeTableSync"
    />
  </div>
</template>

<style lang="scss">
.nc-sync-new-menu {
  .ant-dropdown-menu-item.nc-menu-item {
    @apply !overflow-visible;
  }

  .nc-menu-item > .ant-dropdown-menu-title-content,
  .nc-menu-item-inner {
    @apply !items-start whitespace-normal;
  }
}
</style>
