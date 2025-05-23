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
const activeTableId = ref('')

const getSyncFrequency = (trigger: string, cron?: string) => {
  if (trigger === SyncTrigger.Manual) return 'Manual'
  if (trigger === SyncTrigger.Schedule && cron) {
    // Parse cron expression to human-readable format (simplified)
    if (cron.includes('hourly')) return 'Hourly'
    if (cron.includes('daily')) return 'Daily'
    if (cron.includes('weekly')) return 'Weekly'
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

const handleEditSync = (syncId: string, tableId: string) => {
  activeSyncId.value = syncId
  activeTableId.value = tableId
  isEditSyncModalOpen.value = true
}

const handleSyncNow = async (syncId: string) => {
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

const isSearchResultAvailable = () => {
  if (!searchQuery.value) return true
  return syncs.value.some(
    (sync) =>
      sync.title?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      sync.sync_type?.toLowerCase().includes(searchQuery.value.toLowerCase()),
  )
}

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
      loadSyncs()
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

      <NcButton v-if="isUIAllowed('sourceCreate')" size="large" class="z-10 !px-2" type="primary" @click="handleCreateSync">
        <div class="flex flex-row items-center w-full gap-x-1">
          <GeneralIcon icon="plus" />
          <div class="flex">Create Sync</div>
        </div>
      </NcButton>
    </div>

    <div class="flex-1 overflow-auto">
      <div class="ds-table overflow-y-auto nc-scrollbar-thin relative max-h-full mb-4">
        <div class="ds-table-head sticky top-0 bg-white z-10">
          <div class="ds-table-row !border-0">
            <div class="ds-table-col ds-table-name">Name</div>
            <div class="ds-table-col ds-table-type">Type</div>
            <div class="ds-table-col ds-table-frequency">Frequency</div>
            <div class="ds-table-col ds-table-last-sync">Last Run</div>
            <div class="ds-table-col ds-table-actions">Actions</div>
          </div>
        </div>
        <div class="ds-table-body relative">
          <div
            v-for="sync in syncs"
            :key="sync.id"
            class="ds-table-row border-gray-200"
            :class="{
              '!hidden':
                searchQuery &&
                !sync.title?.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !sync.sync_type?.toLowerCase().includes(searchQuery.toLowerCase()),
            }"
          >
            <div class="ds-table-col ds-table-name font-medium">
              <div class="flex items-center gap-1">
                <GeneralIcon icon="ncZap" class="!text-green-700 !h-5 !w-5" />
                {{ sync.title || 'Untitled Sync' }}
              </div>
            </div>
            <div class="ds-table-col ds-table-type">
              <NcBadge rounded="lg" class="flex items-center gap-2 px-2 py-1 !h-7 truncate !border-transparent">
                {{ sync.sync_type === SyncType.Full ? 'Full' : 'Incremental' }}
              </NcBadge>
            </div>
            <div class="ds-table-col ds-table-frequency">
              {{ sync.frequency }}
            </div>
            <div class="ds-table-col ds-table-last-sync">
              {{ formatDate(sync.last_sync_at) }}
            </div>
            <div class="ds-table-col ds-table-actions">
              <div class="flex justify-end gap-2">
                <NcTooltip>
                  <template #title>Sync Now</template>
                  <NcButton size="small" type="text" class="nc-action-btn !w-8 !px-1 !rounded-lg" @click="handleSyncNow(sync.id)">
                    <GeneralIcon icon="refresh" class="text-gray-600" />
                  </NcButton>
                </NcTooltip>

                <NcDropdown placement="bottomRight">
                  <NcButton size="small" type="text" class="nc-action-btn !w-8 !px-1 !rounded-lg">
                    <GeneralIcon icon="threeDotVertical" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu variant="small">
                      <NcMenuItem @click="handleEditSync(sync.id, sync.fk_model_id)">
                        <GeneralIcon icon="edit" />
                        <span>Edit</span>
                      </NcMenuItem>
                      <NcDivider />
                      <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="handleDeleteSync(sync.id)">
                        <GeneralIcon icon="delete" />
                        <span>Delete</span>
                      </NcMenuItem>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </div>
            </div>
          </div>

          <div
            v-if="!isLoading && syncs.length === 0"
            class="flex-none integration-table-empty flex items-center justify-center py-8 px-6"
          >
            <div class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6 text-center">
              <img src="~assets/img/placeholder/no-search-result-found.png" class="!w-[164px] flex-none" alt="No syncs found" />
              No syncs found
            </div>
          </div>

          <div
            v-if="!isLoading && syncs.length > 0 && !isSearchResultAvailable()"
            class="flex-none integration-table-empty flex items-center justify-center py-8 px-6"
          >
            <div class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6 text-center">
              <img
                src="~assets/img/placeholder/no-search-result-found.png"
                class="!w-[164px] flex-none"
                alt="No search results found"
              />
              No results matched your search
            </div>
          </div>
        </div>

        <div
          v-show="isLoading"
          class="flex items-center justify-center absolute left-0 top-0 w-full h-[calc(100%_-_45px)] z-10 pb-10 pointer-events-none"
        >
          <div class="flex flex-col justify-center items-center gap-2">
            <GeneralLoader size="xlarge" />
            <span class="text-center">Loading</span>
          </div>
        </div>
      </div>
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
      v-if="isEditSyncModalOpen && activeSyncId && activeTableId"
      v-model:open="isEditSyncModalOpen"
      :base-id="props.baseId"
      :table-id="activeTableId"
      @update:open="isEditSyncModalOpen = $event"
    />
  </div>
</template>

<style scoped>
.ds-table {
  @apply border-1 border-gray-200 rounded-lg h-full;
}
.ds-table-head {
  @apply flex items-center border-b-1 text-gray-500 bg-gray-50 text-sm font-weight-500;
}

.ds-table-body {
  @apply flex flex-col;
}

.ds-table-row {
  @apply grid grid-cols-12 border-b border-gray-100 w-full h-full;
}

.ds-table-col {
  @apply flex items-center justify-center py-3 mr-2;
}

.ds-table-name {
  @apply col-span-4 items-center capitalize;
}

.ds-table-type {
  @apply col-span-2 items-center;
}

.ds-table-frequency {
  @apply col-span-2 items-center;
}

.ds-table-last-sync {
  @apply col-span-2 items-center;
}

.ds-table-actions {
  @apply col-span-2 flex w-full;
}

.ds-table-col:last-child {
  @apply border-r-0;
}

.ds-table-body .ds-table-row:hover {
  @apply bg-gray-50/60;
}
</style>
