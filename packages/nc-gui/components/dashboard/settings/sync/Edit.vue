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
const {
  integrationConfigs,
  isLoading,
  loadConfig,
  syncConfigEditForm,
  editMode,
  editModeSync,
  syncConfigEditFormChanged,
  triggerSync,
  readSync,
  editTab,
} = useProvideSyncStore(activeWorkspaceId, props.baseId!)

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
onMounted(() => {
  initialize()
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
        <div class="flex items-center">
          <GeneralIcon icon="ncZap" class="!text-green-700 !h-5 !w-5" />
        </div>
        <div class="flex-1 text-base font-weight-700">Edit Sync Configuration</div>

        <div class="flex items-center gap-3">
          <NcButton :disabled="updatingSync || triggeredSync" size="small" type="text" @click="vOpen = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>
      <div class="h-[calc(100%_-_58px)] flex justify-center p-5">
        <div class="flex flex-col gap-10 w-full items-center overflow-y-auto">
          <div>
            <NcSelectTab v-model="editTab" :items="tabs" @update:model-value="onTabChange" />
          </div>
          <div class="w-3xl flex rounded-lg p-6 w-full border-1 border-nc-border-gray-medium relative">
            <div
              v-if="editTab === 'integrations' && syncConfigEditForm.sync_category === 'custom'"
              class="absolute inset-0 bg-gray-500/10 z-10 rounded-lg cursor-not-allowed"
            ></div>
            <template v-if="editTab === 'sync'">
              <div class="create-source bg-white relative flex flex-col gap-2 w-full max-w-[768px]">
                <div v-if="editModeSync" class="sync-info bg-gray-100 p-4 rounded-lg w-full">
                  <div class="flex justify-between items-center">
                    <div class="text-lg font-semibold">Sync Information</div>
                    <div class="flex flex-col gap-2">
                      <div class="text-sm text-gray-500">
                        Last Sync: {{ editModeSync.last_sync_at ? editModeSync.last_sync_at : 'Never' }}
                      </div>
                      <div v-if="editModeSync.next_sync_at" class="text-sm text-gray-500">
                        Next Sync: {{ editModeSync.next_sync_at }}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="w-full flex flex-col mt-3">
                  <div class="flex items-center gap-3">
                    <NcButton
                      v-if="!triggeredSync && !completeSync"
                      size="small"
                      type="primary"
                      class="nc-extdb-btn-submit"
                      :loading="triggeredSync"
                      :disabled="isLoading || updatingSync"
                      @click="onTrigger"
                    >
                      Trigger Sync
                    </NcButton>
                    <NcButton
                      v-if="completeSync"
                      size="small"
                      type="primary"
                      class="nc-extdb-btn-submit"
                      @click="completeSync = false"
                    >
                      Minimize
                    </NcButton>
                  </div>
                </div>

                <div class="flex">
                  <GeneralProgressPanel v-if="triggeredSync || completeSync" ref="progressRef" class="w-full h-[400px]" />
                </div>
              </div>
            </template>
            <template v-if="editTab === 'sync-settings'">
              <a-form name="external-base-create-form" layout="vertical" no-style hide-required-mark class="flex flex-col w-full">
                <div class="nc-form-section">
                  <div class="flex flex-col gap-5">
                    <DashboardSettingsSyncSettings :edit-mode="true" />
                  </div>
                </div>
              </a-form>
            </template>
            <template v-if="editTab === 'integrations'">
              <div class="create-source bg-white relative flex flex-col gap-2 w-full max-w-[768px]">
                <div class="nc-form-section w-full">
                  <!-- Integration tabs and configuration -->
                  <DashboardSettingsSyncIntegrationTabs />
                  <DashboardSettingsSyncIntegrationConfig :edit-mode="true" />
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-add-source-left-panel {
  @apply p-6 flex-1 flex justify-center;
}
.nc-add-source-right-panel {
  @apply p-4 w-[320px] border-l-1 border-gray-200 flex flex-col gap-4 bg-gray-50 rounded-br-2xl;
}
:deep(.ant-collapse-header) {
  @apply !-mt-4 !p-0 flex items-center !cursor-default children:first:flex;
}
:deep(.ant-collapse-icon-position-right > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow) {
  @apply !right-0;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-3;
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

.create-source {
  :deep(.ant-input-affix-wrapper),
  :deep(.ant-input),
  :deep(.ant-select) {
    @apply !appearance-none border-solid rounded-md;
  }

  :deep(.ant-input-password) {
    input {
      @apply !border-none my-0;
    }
  }

  .nc-form-section {
    @apply flex flex-col gap-3;
  }
  .nc-form-section-title {
    @apply text-sm font-bold text-gray-800;
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
