<script setup lang="ts">
import { SyncTrigger, SyncType } from 'nocodb-sdk'
import { JobStatus } from '#imports'

interface Props {
  state: string
  baseId: string
  reload?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:state', 'update:reload'])

const vReload = useVModel(props, 'reload', emits)

const { $api, $poller } = useNuxtApp()

const { projectPageTab } = storeToRefs(useConfigStore())

const workspaceStore = useWorkspace()
const { activeWorkspace } = storeToRefs(workspaceStore)

const baseStore = useBase()
const { loadTables } = baseStore

const { isUIAllowed } = useRoles()

const searchQuery = ref<string>('')
const syncs = ref<any[]>([])
const isLoading = ref(false)
const isCreateSyncModalOpen = ref(false)
const isEditSyncModalOpen = ref(false)
const activeSyncId = ref('')

const getSyncFrequency = (trigger: string, cron?: string) => {
  if (trigger === SyncTrigger.Manual) return 'Manual'
  if (trigger === SyncTrigger.Schedule && cron) {
    // Parse cron expression to human-readable format (simplified)
    if (cron.includes('hourly')) return 'Hourly'
    if (cron.includes('daily')) return 'Daily'
    if (cron.includes('* * * *')) return 'Hourly'
    if (cron.includes('* * *')) return 'Daily'
    return cron
  }
  return 'Unknown'
}

const loadSyncs = async () => {
  isLoading.value = true
  try {
    const response = await $api.internal.getOperation(activeWorkspace.value!.id!, props.baseId, {
      operation: 'listSync',
    })

    // Process and organize syncs data
    syncs.value = response.map((sync: any) => {
      return {
        ...sync,
        frequency: getSyncFrequency(sync.sync_trigger, sync.sync_trigger_cron),
      }
    })
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString()
}

const handleCreateSync = () => {
  isCreateSyncModalOpen.value = true
}

const handleEditSync = (syncId: string) => {
  activeSyncId.value = syncId
  isEditSyncModalOpen.value = true
}

const _handleSyncNow = async (syncId: string) => {
  try {
    const response = await $api.internal.postOperation(
      activeWorkspace.value!.id!,
      props.baseId,
      {
        operation: 'triggerSync',
      },
      {
        syncConfigId: syncId,
      },
    )

    if (response.job) {
      // Monitor job status
      $poller.subscribe({ id: response.job.id }, async (data) => {
        if (data.status !== 'close') {
          if (data.status === JobStatus.COMPLETED) {
            // Refresh syncs list after completion
            await loadSyncs()
          }
        }
      })
    }
  } catch (e) {
    console.error(e)
  }
}

const _handleMigrateSync = async (syncId: string) => {
  try {
    await $api.internal.postOperation(
      activeWorkspace.value!.id!,
      props.baseId,
      {
        operation: 'migrateSync',
      },
      {
        syncConfigId: syncId,
      },
    )
  } catch (e) {
    console.error(e)
  }
}

const handleDeleteSync = async (syncId: string) => {
  try {
    await $api.internal.postOperation(
      activeWorkspace.value!.id!,
      props.baseId,
      {
        operation: 'deleteSync',
      },
      {
        syncConfigId: syncId,
      },
    )
    await loadTables()
    await loadSyncs()
  } catch (e) {
    console.error(e)
  }
}

const filteredSyncs = computed(() => {
  if (!searchQuery.value) return syncs.value
  return syncs.value.filter(
    (sync) =>
      sync.title?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      sync.sync_type?.toLowerCase().includes(searchQuery.value.toLowerCase()),
  )
})

const columns = [
  {
    key: 'name',
    title: 'Name',
    name: 'Name',
    dataIndex: 'title',
    minWidth: 160,
    padding: '0px 24px',
  },
  {
    key: 'type',
    title: 'Type',
    name: 'Type',
    dataIndex: 'sync_type',
    width: 150,
    minWidth: 150,
    padding: '0px 24px',
  },
  {
    key: 'frequency',
    title: 'Frequency',
    name: 'Frequency',
    dataIndex: 'frequency',
    width: 150,
    minWidth: 150,
    padding: '0px 24px',
  },
  {
    key: 'last_sync',
    title: 'Last Run',
    name: 'Last Run',
    dataIndex: 'last_sync_at',
    width: 240,
    minWidth: 240,
    padding: '0px 24px',
  },
  {
    key: 'actions',
    title: 'Actions',
    name: 'Actions',
    width: 100,
    minWidth: 100,
    padding: '0px 24px',
  },
] as NcTableColumnProps[]

// Load syncs when component is mounted
onMounted(() => {
  until(() => !!activeWorkspace.value)
    .toBeTruthy()
    .then(() => {
      loadSyncs()
    })
})

// Watch for reload prop changes
watch(
  () => props.reload,
  (reload) => {
    if (reload) {
      vReload.value = false
    }
  },
)

watch(
  projectPageTab,
  () => {
    if (projectPageTab.value === 'syncs') {
      until(() => !!activeWorkspace.value)
        .toBeTruthy()
        .then(() => {
          loadSyncs()
        })
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col h-full p-6" data-testid="nc-settings-syncs-tab">
    <div class="mb-6 flex items-center justify-between gap-3">
      <a-input
        v-model:value="searchQuery"
        type="text"
        class="nc-search-syncs-input nc-input-border-on-value !max-w-90 nc-input-sm"
        placeholder="Search syncs"
        allow-clear
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500" />
        </template>
      </a-input>

      <NcButton v-if="isUIAllowed('sourceCreate')" size="small" class="z-10 !px-2" type="primary" @click="handleCreateSync">
        <div class="flex flex-row items-center w-full gap-x-1">
          <GeneralIcon icon="plus" />
          <div class="flex">Create Sync</div>
        </div>
      </NcButton>
    </div>

    <div class="flex-1 overflow-auto">
      <NcTable
        :columns="columns"
        :data="filteredSyncs"
        :is-data-loading="isLoading"
        row-height="54px"
        header-row-height="54px"
        class="h-full w-full"
        @row-click="(record) => handleEditSync(record.id)"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="ncZap" class="!text-green-700 !h-5 !w-5" />
              <span class="font-medium">{{ record.title || 'Untitled Sync' }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'type'">
            <NcBadge rounded="lg" class="flex items-center gap-2 px-2 py-1 !h-7 truncate !border-transparent">
              {{ record.sync_type === SyncType.Full ? 'Full' : 'Incremental' }}
            </NcBadge>
          </template>
          <template v-else-if="column.key === 'frequency'">
            {{ record.frequency }}
          </template>
          <template v-else-if="column.key === 'last_sync'">
            {{ formatDate(record.last_sync_at) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="flex justify-end gap-2">
              <NcDropdown placement="bottomRight" @click.stop>
                <NcButton size="small" type="text" class="nc-action-btn !w-8 !px-1 !rounded-lg">
                  <GeneralIcon icon="threeDotVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItem @click="handleEditSync(record.id)">
                      <GeneralIcon icon="edit" />
                      <span>Edit</span>
                    </NcMenuItem>
                    <NcDivider />
                    <NcMenuItem danger @click="handleDeleteSync(record.id)">
                      <GeneralIcon icon="delete" />
                      <span>Delete</span>
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </template>
        </template>
        <template #emptyText>
          <div class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6 text-center">
            <img
              src="~assets/img/placeholder/no-search-result-found.png"
              class="!w-[164px] flex-none"
              :alt="syncs.length === 0 ? 'No syncs found' : 'No search results found'"
            />
            {{ syncs.length === 0 ? 'No syncs found' : 'No results matched your search' }}
          </div>
        </template>
      </NcTable>
    </div>

    <!-- Create Sync Modal -->
    <DashboardSettingsSyncCreate
      v-if="isCreateSyncModalOpen"
      v-model:open="isCreateSyncModalOpen"
      :base-id="props.baseId"
      @sync-created="loadSyncs"
    />

    <!-- Edit Sync Modal -->
    <DashboardSettingsSyncEdit
      v-if="isEditSyncModalOpen && activeSyncId"
      v-model:open="isEditSyncModalOpen"
      :base-id="props.baseId"
      :sync-id="activeSyncId"
      @update:open="isEditSyncModalOpen = $event"
      @sync-updated="loadSyncs"
    />
  </div>
</template>

<style scoped>
/* Styles are now handled by NcTable component */
</style>
