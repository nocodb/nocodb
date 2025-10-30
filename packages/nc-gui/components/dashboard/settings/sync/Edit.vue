<script lang="ts" setup>
import { JobStatus } from '#imports'

const props = defineProps<{ open: boolean; baseId: string; syncId: string; isModal?: boolean }>()
const emit = defineEmits(['update:open', 'syncUpdated'])
const vOpen = useVModel(props, 'open', emit)

const { integrations, loadDynamicIntegrations, loadIntegrations } = useIntegrationStore()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { $poller } = useNuxtApp()

const tabs = ref([
  {
    title: 'Sync',
    value: 'sync',
    icon: 'ncZap' as const,
  },
  {
    title: 'Sync Settings',
    value: 'sync-settings',
    icon: 'ncSettings' as const,
  },
  {
    title: 'Integrations',
    value: 'integrations',
    icon: 'ncSettings' as const,
  },
])

// Create a new integration configs store instance for this component
const { integrationConfigs, isLoading, loadConfig, syncConfigEditForm, editMode, editModeSync, triggerSync, readSync, editTab } =
  useProvideSyncStore(activeWorkspaceId, props.baseId!)

editMode.value = true

const updatingSync = ref(false)

const triggeredSync = ref(false)

const completeSync = ref(false)

const progressRef = ref()

async function initialize() {
  isLoading.value = true

  await loadDynamicIntegrations()
  await loadIntegrations()

  const sync = await readSync(props.syncId!)

  editModeSync.value = sync

  syncConfigEditForm.value = sync

  const existingIntegrationConfigs = [sync, ...sync.children]

  integrationConfigs.value = existingIntegrationConfigs.map((sync) => {
    const integration = integrations.value.find((i) => i.id === sync.fk_integration_id)

    if (!integration) {
      return null
    }

    return {
      ...integration,
      syncConfigId: sync.id,
      parentSyncConfigId: sync.fk_parent_sync_config_id,
    }
  }) as IntegrationConfig[]

  isLoading.value = false
}

const onTabChange = async (value?: string) => {
  if (value === 'integrations') {
    await loadConfig(0)
  }
}

const onTrigger = async () => {
  if (!editModeSync.value) return

  try {
    triggeredSync.value = true

    const jobData = await triggerSync(props.syncId!, true)

    if (!jobData) {
      triggeredSync.value = false
      return
    }

    $poller.subscribe(
      { id: jobData.id },
      async (data: {
        id: string
        status?: string
        data?: {
          error?: {
            message: string
          }
          message?: string
          result?: any
        }
      }) => {
        if (data.status !== 'close') {
          if (data.status === JobStatus.COMPLETED) {
            progressRef.value?.pushProgress(data.data?.message ?? 'Done!', data.status)
            triggeredSync.value = false
            completeSync.value = true
          } else if (data.status === JobStatus.FAILED) {
            progressRef.value?.pushProgress(data.data?.error?.message ?? 'Sync failed', data.status)
            triggeredSync.value = false
            completeSync.value = true
          } else {
            progressRef.value?.pushProgress(data.data?.message ?? '', data.status)
          }
        }
      },
    )
  } catch (e) {
    message.error(await extractSdkResponseErrorMsgv2(e as any))
    triggeredSync.value = false
  }
}

// select and focus title field on load
onMounted(async () => {
  await initialize()
})

const isModalClosable = computed(() => {
  return !updatingSync.value && !triggeredSync.value
})
</script>

<template>
  <NcModal
    v-model:visible="vOpen"
    :mask-closable="isModalClosable"
    :keyboard="isModalClosable"
    centered
    size="large"
    wrap-class-name="nc-modal-create-source"
    @keydown.esc="vOpen = false"
  >
    <div class="flex-1 flex flex-col max-h-full create-source">
      <div class="px-4 py-3 w-full flex items-center gap-3 border-b-1 border-gray-200">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="ncZap" class="!text-green-700 !h-5 !w-5" />
          <div class="text-base font-weight-700">Edit Sync Configuration</div>
        </div>

        <div class="flex-1" />

        <div class="flex items-center gap-2">
          <NcButton
            v-if="editTab === 'sync' && editModeSync && !triggeredSync && !completeSync"
            size="small"
            type="primary"
            :loading="triggeredSync"
            :disabled="isLoading || updatingSync"
            @click="onTrigger"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="refresh" class="w-4 h-4" />
              <span>Trigger Sync</span>
            </div>
          </NcButton>
          <NcButton :disabled="updatingSync || triggeredSync" size="small" type="text" @click="vOpen = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>
      <div class="h-[calc(100%_-_58px)] flex justify-center p-5">
        <div class="flex flex-col gap-6 w-full max-w-5xl mx-auto overflow-y-auto">
          <div class="flex justify-center">
            <NcSelectTab v-model="editTab" :items="tabs" @update:model-value="onTabChange" />
          </div>
          <div class="flex w-full relative">
            <template v-if="editTab === 'sync'">
              <div class="flex flex-col gap-4 w-full">
                <!-- Sync Overview -->
                <div v-if="editModeSync" class="nc-sync-overview">
                  <div class="nc-overview-header">
                    <div class="flex items-center gap-2">
                      <div class="nc-sync-icon">
                        <GeneralIcon icon="ncZap" class="w-5 h-5 text-brand-600" />
                      </div>
                      <div>
                        <div class="text-base font-semibold text-gray-900">{{ editModeSync.title }}</div>
                        <div class="text-xs text-gray-500 mt-0.5">
                          {{ editModeSync.sync_type === 'full' ? 'Full Sync' : 'Incremental Sync' }} •
                          {{ editModeSync.sync_trigger === 'manual' ? 'Manual Trigger' : 'Scheduled' }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="nc-sync-stats">
                    <div class="nc-stat-item">
                      <div class="nc-stat-icon">
                        <GeneralIcon icon="clock" class="w-4 h-4 text-brand-600" />
                      </div>
                      <div class="nc-stat-content">
                        <div class="nc-stat-label">Last Sync</div>
                        <div class="nc-stat-value">{{ editModeSync.last_sync_at || 'Never' }}</div>
                      </div>
                    </div>
                    <div class="nc-stat-item">
                      <div class="nc-stat-icon">
                        <GeneralIcon icon="calendar" class="w-4 h-4 text-brand-600" />
                      </div>
                      <div class="nc-stat-content">
                        <div class="nc-stat-label">Next Sync</div>
                        <div class="nc-stat-value">{{ editModeSync.next_sync_at || 'Not scheduled' }}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="triggeredSync || completeSync" class="nc-progress-wrapper">
                  <div class="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
                    <div class="text-sm font-semibold text-gray-800">Sync Progress</div>
                    <NcButton size="small" type="text" @click="completeSync = false">
                      <GeneralIcon icon="close" class="w-4 h-4" />
                    </NcButton>
                  </div>
                  <GeneralProgressPanel ref="progressRef" class="w-full h-[400px]" />
                </div>
              </div>
            </template>
            <template v-if="editTab === 'sync-settings'">
              <div class="flex flex-col w-full">
                <DashboardSettingsSyncSettings :edit-mode="true" />
              </div>
            </template>
            <template v-if="editTab === 'integrations'">
              <div class="flex flex-col gap-4 w-full">
                <DashboardSettingsSyncIntegrationTabs />
                <DashboardSettingsSyncIntegrationConfig :edit-mode="true" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-sync-overview {
  @apply flex flex-col gap-4 p-5 rounded-lg border border-gray-200 bg-white;
}

.nc-overview-header {
  @apply pb-4 border-b border-gray-200;
}

.nc-sync-icon {
  @apply w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center;
}

.nc-sync-stats {
  @apply grid grid-cols-1 md:grid-cols-2 gap-3;
}

.nc-quick-actions {
  @apply flex flex-col;
}

.nc-stat-item {
  @apply flex items-start gap-3 p-3 rounded-lg bg-gray-50;
}

.nc-stat-icon {
  @apply w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0;
}

.nc-stat-content {
  @apply flex flex-col gap-0.5;
}

.nc-stat-label {
  @apply text-xs font-medium text-gray-500;
}

.nc-stat-value {
  @apply text-sm font-semibold text-gray-900;
}

.nc-progress-wrapper {
  @apply rounded-lg border border-gray-200 overflow-hidden;
}

:deep(.ant-form-item-explain-error) {
  @apply !text-xs;
}

:deep(.ant-form-item) {
  @apply mb-0;
}

:deep(.ant-divider) {
  @apply m-0;
}

:deep(.ant-form-item-with-help .ant-form-item-explain) {
  @apply !min-h-0;
}

:deep(.ant-select .ant-select-selector .ant-select-selection-item) {
  @apply font-weight-400;
}

.nc-form-section-body {
  @apply flex flex-col gap-3;
}

.nc-connection-json-editor {
  @apply min-h-[300px] max-h-[600px];
  resize: vertical;
  overflow-y: auto;
}

:deep(.ant-form-item-label > label.ant-form-item-required:after) {
  @apply content-['*'] inline-block text-inherit text-red-500 ml-1;
}

.nc-form-extra-connectin-parameters {
  :deep(.ant-input) {
    &:not(:hover):not(:focus):not(:disabled) {
      @apply !shadow-default !border-gray-200;
    }
    &:hover:not(:focus):not(:disabled) {
      @apply !border-gray-200 !shadow-hover;
    }
    &:focus {
      @apply !shadow-selected !ring-0;
      border-color: var(--ant-primary-color-hover) !important;
    }
  }
}
:deep(.ant-form-item) {
  &.ant-form-item-has-error {
    &:not(:has(.ant-input-password)) .ant-input {
      &:not(:hover):not(:focus):not(:disabled) {
        @apply shadow-default;
      }
      &:hover:not(:focus):not(:disabled) {
        @apply shadow-hover;
      }
      &:focus {
        @apply shadow-error ring-0;
      }
    }

    .ant-input-number,
    .ant-input-affix-wrapper.ant-input-password {
      &:not(:hover):not(:focus-within):not(:disabled) {
        @apply shadow-default;
      }
      &:hover:not(:focus-within):not(:disabled) {
        @apply shadow-hover;
      }
      &:focus-within {
        @apply shadow-error ring-0;
      }
    }
  }
  &:not(.ant-form-item-has-error) {
    &:not(:has(.ant-input-password)) .ant-input {
      &:not(:hover):not(:focus):not(:disabled) {
        @apply shadow-default border-gray-200;
      }
      &:hover:not(:focus):not(:disabled) {
        @apply border-gray-200 shadow-hover;
      }
      &:focus {
        @apply shadow-selected ring-0;
      }
    }
    .ant-input-number,
    .ant-input-affix-wrapper.ant-input-password {
      &:not(:hover):not(:focus-within):not(:disabled) {
        @apply shadow-default border-gray-200;
      }
      &:hover:not(:focus-within):not(:disabled) {
        @apply border-gray-200 shadow-hover;
      }
      &:focus-within {
        @apply shadow-selected ring-0;
      }
    }
  }
}

:deep(.ant-row:not(.ant-form-item)) {
  @apply !-mx-1.5;
  & > .ant-col {
    @apply !px-1.5;
  }
}
</style>

<style lang="scss">
.nc-modal-create-source {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }
}

.nc-dropdown-ext-db-type {
  @apply !z-1000;
}
</style>
