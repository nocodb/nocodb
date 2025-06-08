<script lang="ts" setup>
import type { SyncCategory } from 'nocodb-sdk'
import { JobStatus } from '#imports'

const props = defineProps<{ open: boolean; baseId: string; isModal?: boolean }>()
const emit = defineEmits(['update:open', 'syncCreated'])
const vOpen = useVModel(props, 'open', emit)

const { loadDynamicIntegrations } = useIntegrationStore()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const baseStore = useBase()
const { loadTables } = baseStore

const { refreshCommandPalette } = useCommandPalette()

const { $poller } = useNuxtApp()

enum Step {
  Category = 0,
  SyncSettings = 1,
  Integration = 2,
  DestinationSchema = 3,
  Create = 4,
}

const step = ref(Step.Category)
const goToDashboard = ref(false)
const goBack = ref(false)
const progressRef = ref()
const creatingSync = ref(false)

// Create a new integration configs store instance for this component
const {
  createSync,
  formState,
  syncConfigForm,
  isLoading,
  deepReference,
  switchToIntegrationConfig,
  resetStore,
  saveCurrentFormState,
  validateSyncConfig,
} = useProvideSyncStore(activeWorkspaceId, props.baseId!)

const handleSubmit = async () => {
  isLoading.value = true
  creatingSync.value = true

  try {
    const syncData = await createSync()

    if (!syncData) {
      return
    }

    $poller.subscribe(
      { id: syncData.job.id },
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
            progressRef.value?.pushProgress('Done!', data.status)

            await loadTables()

            refreshCommandPalette()
            goToDashboard.value = true
          } else if (data.status === JobStatus.FAILED) {
            progressRef.value?.pushProgress(data.data?.error?.message ?? 'Sync failed', data.status)

            await loadTables()

            refreshCommandPalette()

            goBack.value = true
          } else {
            progressRef.value?.pushProgress(data.data?.message ?? 'Syncing...', 'progress')
          }

          emit('syncCreated')
        }
      },
    )
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    creatingSync.value = false
  } finally {
    isLoading.value = false
  }
}

const nextStep = async () => {
  switch (step.value) {
    case Step.Category:
      step.value = Step.SyncSettings
      break
    case Step.Integration:
      if (await saveCurrentFormState()) {
        if (syncConfigForm.value.sync_category === 'custom') {
          step.value = Step.DestinationSchema
        } else {
          step.value = Step.Create
        }
      }
      break
    case Step.SyncSettings:
      try {
        await validateSyncConfig()
        step.value = Step.Integration
      } catch {}
      break
    case Step.DestinationSchema:
      if (formState.value.config.custom_schema) {
        // make sure every table has a primary key
        for (const table of Object.values(formState.value.config.custom_schema) as {
          systemFields: {
            primaryKey: string[]
          }
        }[]) {
          if (!table.systemFields.primaryKey || table.systemFields.primaryKey.length === 0) {
            message.error('Every table must have at least one unique identifier column')
            return
          }
        }

        if (await saveCurrentFormState()) {
          step.value = Step.Create
        }
      }
      break
    case Step.Create:
      handleSubmit()
      break
  }
}

const previousStep = () => {
  switch (step.value) {
    case Step.Category:
      step.value = Step.Category
      break
    case Step.SyncSettings:
      step.value = Step.Category
      break
    case Step.Integration:
      step.value = Step.SyncSettings
      break
    case Step.DestinationSchema:
      step.value = Step.Integration
      break
    case Step.Create:
      if (syncConfigForm.value.sync_category === 'custom') {
        step.value = Step.DestinationSchema
      } else {
        step.value = Step.Integration
      }
      break
  }
}

const onCategoryChange = (value: string) => {
  syncConfigForm.value.sync_category = value as SyncCategory
  step.value = Step.SyncSettings
}

const continueEnabled = computed(() => {
  switch (step.value) {
    case Step.Category:
      return !!syncConfigForm.value.sync_category
    case Step.Integration:
      return formState.value.sub_type
    default:
      return true
  }
})

// select and focus title field on load
onMounted(async () => {
  isLoading.value = true
  await loadDynamicIntegrations()

  nextTick(() => {
    switchToIntegrationConfig(0)
  })

  isLoading.value = false
})

// Watch for modal visibility changes
watch(
  () => vOpen.value,
  (newVal) => {
    if (newVal) {
      step.value = Step.Category
      resetStore()
    }
  },
)

const refreshState = () => {
  goBack.value = false
  creatingSync.value = false
  goToDashboard.value = false
}

function onDashboard() {
  refreshState()
  vOpen.value = false
}

const onClose = () => {
  refreshState()
  vOpen.value = false
}

const isModalClosable = computed(() => {
  return !creatingSync.value
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
    @keydown.esc="onClose"
  >
    <div class="flex-1 flex flex-col max-h-full create-source">
      <div class="px-4 py-3 w-full flex items-center gap-3 border-b-1 border-gray-200">
        <div class="flex items-center">
          <GeneralIcon icon="ncZap" class="!text-green-700 !h-5 !w-5" />
        </div>
        <div class="flex-1 text-base font-weight-700">Create Sync</div>

        <div class="flex items-center gap-3">
          <NcButton :disabled="creatingSync" size="small" type="text" @click="onClose">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>
      <div class="h-[calc(100%_-_58px)] flex justify-center p-5">
        <div class="flex flex-col gap-10 w-full items-center overflow-y-auto">
          <div class="w-5xl">
            <DashboardSettingsSyncSteps :current="step" />
          </div>
          <div class="flex rounded-lg p-6 border-1 border-nc-border-gray-medium">
            <a-form name="external-base-create-form" layout="vertical" no-style hide-required-mark class="flex flex-col w-full">
              <div class="nc-form-section">
                <div class="flex flex-col gap-5">
                  <div v-if="step === Step.Category" class="w-3xl">
                    <a-row :gutter="24">
                      <a-col :span="24">
                        <a-form-item label="Sync Category">
                          <DashboardSettingsSyncCategorySelect
                            :model-value="deepReference('sync_category')"
                            @change="onCategoryChange($event)"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </div>
                  <div v-if="step === Step.Integration" class="w-3xl">
                    <div>
                      <!-- Integration tabs and configuration -->
                      <DashboardSettingsSyncIntegrationTabs />
                      <DashboardSettingsSyncIntegrationConfig />
                    </div>
                  </div>
                  <div v-if="step === Step.SyncSettings" class="w-3xl">
                    <DashboardSettingsSyncSettings />
                  </div>
                  <div v-if="syncConfigForm.sync_category === 'custom' && step === Step.DestinationSchema">
                    <DashboardSettingsSyncDestinationSchema />
                  </div>
                  <div v-if="step === Step.Create" class="w-3xl">
                    <div v-if="creatingSync">
                      <div class="mb-4 prose-xl font-bold">Creating sync schema and syncing initial data</div>

                      <GeneralProgressPanel ref="progressRef" class="w-full" />

                      <div v-if="goToDashboard" class="flex justify-center items-center">
                        <NcButton class="mt-6 mb-8" size="medium" @click="onDashboard"> 🚀 Go To Dashboard 🚀</NcButton>
                      </div>
                      <div v-else-if="goBack" class="flex justify-center items-center">
                        <NcButton class="mt-6 mb-8" type="ghost" size="medium" @click="onDashboard">Go Dashboard</NcButton>
                      </div>
                    </div>
                    <div v-else>
                      <DashboardSettingsSyncReview />
                    </div>
                  </div>
                </div>
              </div>
            </a-form>
          </div>
          <div v-if="!creatingSync" class="w-3xl flex justify-between">
            <NcButton type="ghost" :disabled="step === Step.Category" @click="previousStep"> Back </NcButton>
            <NcButton type="primary" :loading="creatingSync" :disabled="!continueEnabled" @click="nextStep">
              {{ step === Step.Create ? 'Create' : 'Continue' }}
            </NcButton>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
:deep(.ant-steps-item-finish .ant-steps-icon) {
  top: -3px;
}

.nc-form-section > div > div {
  @apply flex flex-col gap-2;
}

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
