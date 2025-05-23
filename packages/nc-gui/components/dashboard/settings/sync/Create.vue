<script lang="ts" setup>
import type { FormDefinition } from 'nocodb-sdk'
import { IntegrationsType, SyncTrigger, SyncType } from 'nocodb-sdk'
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
  Create = 3,
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

    try {
      const res = await $api.internal.postOperation(
        base.value.fk_workspace_id!,
        baseId.value!,
        {
          operation: 'createSync',
        },
        formState.value,
      )

  try {
    const syncData = await createSync()

    if (!syncData) {
      return
    }

const selectedSyncType = computed(() => {
  return formState.value.sub_type
})

// select and focus title field on load
onMounted(async () => {
  isLoading.value = true
  await loadDynamicIntegrations()

  formState.value.title = 'Sync Source'
  formState.value.type = IntegrationsType.Sync

  nextTick(() => {
    // todo: replace setTimeout and follow better approach
    setTimeout(() => {
      const input = form.value?.$el?.querySelector('input[type=text]')
      input?.setSelectionRange(0, formState.value.title.length)
      input?.focus()
    }, 500)
  })

  isLoading.value = false
})

const changeIntegration = async () => {
  const integrationForm = (await getIntegrationForm(IntegrationsType.Sync, formState.value.sub_type)).filter(
    (el: any) => el.model !== 'title',
  )

  activeIntegrationItemForm.value = [
    ...integrationForm,
    {
      type: FormBuilderInputType.Select,
      label: 'Sync Type',
      width: 48,
      model: 'config.sync.sync_type',
      category: 'Sync Options',
      placeholder: 'Select sync type',
      defaultValue: SyncType.Full,
      options: [
        {
          label: 'Full',
          value: SyncType.Full,
        },
        {
          label: 'Incremental',
          value: SyncType.Incremental,
        },
      ],
      validators: [
        {
          type: 'required',
          message: 'Sync type is required',
        },
      ],
    },
    {
      type: FormBuilderInputType.Space,
      width: 4,
      category: 'Sync Options',
    },
    {
      type: FormBuilderInputType.Select,
      label: 'Sync Trigger',
      width: 48,
      model: 'config.sync.sync_trigger',
      category: 'Sync Options',
      placeholder: 'Select trigger type',
      defaultValue: SyncTrigger.Manual,
      options: [
        {
          label: 'Manual',
          value: SyncTrigger.Manual,
        },
      ],
      validators: [
        {
          type: 'required',
          message: 'Sync trigger is required',
        },
      ],
    },
  ]
}

const refreshState = async (keepForm = false) => {
  if (!keepForm) {
    formState.value = {
      type: IntegrationsType.Sync,
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
          <NcButton
            v-if="!creatingSync"
            size="small"
            type="primary"
            :disabled="!selectedSyncType || isLoading"
            class="nc-extdb-btn-submit"
            @click="submit"
          >
            Create Sync
          </NcButton>
          <NcButton :disabled="creatingSync" size="small" type="text" @click="vOpen = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>
      <div class="h-[calc(100%_-_58px)] flex">
        <div class="nc-add-source-left-panel nc-scrollbar-thin relative">
          <div class="create-source bg-white relative flex flex-col gap-2 w-full max-w-[768px]">
            <template v-if="!creatingSync">
              <a-form name="external-base-create-form" layout="vertical" no-style class="flex flex-col gap-5.5">
                <div class="nc-form-section">
                  <div class="nc-form-section-body">
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <a-form-item label="Sync Title" v-bind="validateInfos.title">
                          <a-input v-model:value="formState.title" />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <a-form-item label="Integration" v-bind="validateInfos.type">
                          <DashboardSettingsSyncSelect v-model:value="formState.sub_type" @change="changeIntegration" />
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </div>
                </div>
              </a-form>
              <NcFormBuilder :key="formState.sub_type" class="py-2" />

              <WorkspaceIntegrationsTab
                is-modal
                :filter-category="filterIntegrationCategory"
                :filter-integration="filterIntegration"
              />
              <WorkspaceIntegrationsEditOrAdd load-datasource-info :base-id="baseId" />
            </template>
            <template v-else>
              <div class="mb-4 prose-xl font-bold">Creating sync schema and syncing initial data</div>

              <GeneralProgressPanel ref="progressRef" class="w-full" />

              <div v-if="goToDashboard" class="flex justify-center items-center">
                <NcButton class="mt-6 mb-8" size="medium" @click="onDashboard"> 🚀 Go To Dashboard 🚀</NcButton>
              </div>
              <div v-else-if="goBack" class="flex justify-center items-center">
                <NcButton class="mt-6 mb-8" type="ghost" size="medium" @click="onDashboard">Go Dashboard</NcButton>
              </div>
            </template>
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
