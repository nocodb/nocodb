<script setup lang="ts">
import dayjs from 'dayjs'
import { SyncType } from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
}>()

const { $api } = useNuxtApp()

const { t } = useI18n()

const { isUIAllowed, loadRoles } = useRoles()

const { loadDynamicIntegrations, loadIntegrations, integrations } = useIntegrationStore()

const baseStore = useBase()

const basesStore = useBases()

const syncStore = useSyncStore()

const { showInfoModal } = useNcConfirmModal()

const { loadTables } = baseStore

const { bases, activeProjectId } = storeToRefs(basesStore)

const { activeBaseSyncs, isLoadingSync } = storeToRefs(syncStore)

const { loadSyncs, triggerSync: _triggerSync } = syncStore

const searchQuery = ref<string>('')

const isCreateSyncModalOpen = ref(false)

const isEditSyncModalOpen = ref(false)

const activeSyncId = ref('')

const showProgressModal = ref(false)

const syncJobId = ref<string | null>(null)

const columns = [
  {
    key: 'name',
    title: 'Name',
    name: 'Name',
    dataIndex: 'title',
    minWidth: 150,
    padding: '0px 24px',
  },
  {
    key: 'sources',
    title: 'Sources',
    name: 'Sources',
    dataIndex: 'sources',
    minWidth: 120,
    width: 120,
    padding: '0px 24px',
  },
  {
    key: 'type',
    title: 'Type',
    name: 'Type',
    dataIndex: 'sync_type',
    minWidth: 150,
    width: 150,
    padding: '0px 24px',
  },
  {
    key: 'last_sync',
    title: 'Last trigger',
    name: 'Last trigger',
    dataIndex: 'last_sync_at',
    minWidth: 150,
    width: 150,
    padding: '0px 24px',
  },
  {
    key: 'actions',
    title: 'Actions',
    name: 'Actions',
    width: 220,
    minWidth: 100,
    padding: '0px 24px',
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

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

const filteredSyncs = computed(() => {
  if (!searchQuery.value) return activeBaseSyncs.value
  return activeBaseSyncs.value.filter(
    (sync) =>
      sync.title?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      sync.sync_type?.toLowerCase().includes(searchQuery.value.toLowerCase()),
  )
})

const handleCreateSync = () => {
  isCreateSyncModalOpen.value = true
}

const handleEditSync = (syncId: string) => {
  activeSyncId.value = syncId
  isEditSyncModalOpen.value = true
}

const handleDeleteSync = async (syncId: string) => {
  if (!currentBase.value?.id) return

  showInfoModal({
    title: t('title.deleteSyncConfirmTitle'),
    content: t('title.deleteSyncConfirmSubtitle'),
    showCancelBtn: true,
    showIcon: false,
    okProps: {
      type: 'danger',
    },
    okText: t('general.delete'),
    okCallback: async () => {
      await syncStore.deleteSync(currentBase.value.id!, syncId)
      await loadTables()
    },
  })
}

const triggerSync = async (syncId: string) => {
  if (!currentBase.value?.id) return

  const job = await _triggerSync(currentBase.value.id!, syncId)

  if (job?.id) {
    syncJobId.value = job?.id
    showProgressModal.value = true
  }
}

const getIntegration = (id: string) => {
  return integrations.value.find((int) => int.id === id)
}

onMounted(async () => {
  await Promise.all([loadDynamicIntegrations(), loadIntegrations()])

  await waitForValueExists(
    () => currentBase.value?.id,
    (id) => !!id,
  )
  if (!currentBase.value?.id) return
  await loadSyncs(currentBase.value?.id)
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
        <NcButton type="text" size="small" class="!px-2 !w-22">
          <div class="flex gap-2 items-center">
            {{ $t('title.docs') }}
            <GeneralIcon icon="ncExternalLink" />
          </div>
        </NcButton>
      </div>

      <NcButton v-if="isUIAllowed('sourceCreate')" size="small" class="z-10 !px-2" type="primary" @click="handleCreateSync">
        <div class="flex flex-row items-center w-full gap-x-1">
          <GeneralIcon icon="plus" />
          <div class="flex">
            {{ $t('labels.newSync') }}
          </div>
        </div>
      </NcButton>
    </div>

    <div class="flex-1 overflow-auto">
      <NcTable
        :bordered="false"
        :columns="columns"
        :data="filteredSyncs"
        :is-data-loading="isLoadingSync"
        row-height="54px"
        header-row-height="54px"
        class="h-full w-full"
        @row-click="(record) => handleEditSync(record.id)"
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

          <template v-else-if="column.key === 'sources'">
            <div class="flex items-center gap-1">
              <NcTooltip v-for="(child, idx) in [record, ...(record.children || [])].slice(0, 3)" :key="idx">
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

          <template v-else-if="column.key === 'type'">
            <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
              {{ record.sync_type === SyncType.Full ? 'Full' : 'Incremental' }}
            </div>
          </template>
          <template v-else-if="column.key === 'last_sync'">
            <NcTooltip>
              <template #title>
                {{ dayjs(record.last_sync_at).isValid() ? dayjs(record.last_sync_at).format('DD MMM YYYY HH:mm Z') : 'Never' }}
              </template>
              <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
                {{ dayjs(record.last_sync_at).isValid() ? timeAgo(record.last_sync_at) : 'Never' }}
              </div>
            </NcTooltip>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="flex justify-end">
              <NcButton type="secondary" size="small" class="!border-r-0 !rounded-r-none" @click.stop="triggerSync(record.id)">
                {{ $t('labels.triggerSync') }}
              </NcButton>
              <NcDropdown placement="bottomRight" @click.stop>
                <NcButton type="secondary" size="small" class="!rounded-l-none">
                  <GeneralIcon icon="threeDotVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItemCopyId
                      v-if="record"
                      :id="record.id"
                      :tooltip="$t('labels.clickToCopySyncID')"
                      :label="
                        $t('labels.syncIdColon', {
                          syncId: record.id,
                        })
                      "
                    />
                    <NcDivider />
                    <NcMenuItem @click="handleEditSync(record.id)">
                      <GeneralIcon icon="edit" />
                      <span>{{ $t('general.edit') }}</span>
                    </NcMenuItem>
                    <NcDivider />
                    <NcMenuItem danger @click="handleDeleteSync(record.id)">
                      <GeneralIcon icon="delete" />
                      <span>{{ $t('general.delete') }}</span>
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </template>
        </template>
        <template #emptyText>
          <div class="px-2 py-6 text-nc-content-gray-muted flex flex-col items-center gap-6 text-center">
            <img
              src="~assets/img/placeholder/no-search-result-found.png"
              class="!w-[164px] flex-none"
              :alt="
                activeBaseSyncs.length === 0
                  ? 'Create your first sync to start automatically syncing data from external sources.'
                  : 'No search results found'
              "
            />
            <div class="max-w-md">
              {{
                activeBaseSyncs.length === 0
                  ? 'Create your first sync to start automatically syncing data from external sources.'
                  : 'No results matched your search'
              }}
            </div>
            <NcButton v-if="isUIAllowed('sourceCreate')" size="small" class="z-10 !px-2" type="primary" @click="handleCreateSync">
              <div class="flex flex-row items-center w-full gap-x-1">
                <GeneralIcon icon="plus" />
                <div class="flex">
                  {{ $t('labels.newSync') }}
                </div>
              </div>
            </NcButton>
          </div>
        </template>
      </NcTable>
    </div>

    <ProjectSyncCreate
      v-if="isCreateSyncModalOpen"
      v-model:value="isCreateSyncModalOpen"
      :base-id="currentBase?.id!"
      @sync-created="
        (jobId) => {
          syncJobId = jobId
          showProgressModal = true
        }
      "
    />

    <ProjectSyncEdit
      v-if="isEditSyncModalOpen && activeSyncId"
      v-model:value="isEditSyncModalOpen"
      :base-id="currentBase?.id!"
      :sync-id="activeSyncId"
    />

    <ProjectSyncProgressModal v-if="syncJobId" v-model="showProgressModal" :job-id="syncJobId" :base-id="currentBase?.id!" />
  </div>
</template>
