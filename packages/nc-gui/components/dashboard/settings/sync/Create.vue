<script lang="ts" setup>
import type { Card as AntCard } from 'ant-design-vue'
import type { FormDefinition } from 'nocodb-sdk'
import { IntegrationsType } from 'nocodb-sdk'
import { JobStatus, generateUniqueTitle as generateTitle, iconMap } from '#imports'

const props = defineProps<{ open: boolean; isModal?: boolean }>()
const emit = defineEmits(['update:open'])
const vOpen = useVModel(props, 'open', emit)

const { loadDynamicIntegrations, saveIntegration, getIntegrationForm } = useIntegrationStore()

const baseStore = useBase()
const { loadProject } = useBases()
const { base } = storeToRefs(baseStore)

const { baseTables } = storeToRefs(useTablesStore())

const tables = computed(() => baseTables.value.get(base.id) || [])

const { loadProjectTables } = useTablesStore()
const { refreshCommandPalette } = useCommandPalette()

const _projectId = inject(ProjectIdInj, undefined)
const baseId = computed(() => _projectId?.value ?? base.value?.id)

const activeIntegrationItemForm = ref<FormDefinition>()

const { form, formState, isLoading, validateInfos, submit } = useProvideFormBuilderHelper({
  formSchema: activeIntegrationItemForm,
  onSubmit: async () => {
    isLoading.value = true

    try {
      await saveIntegration(formState.value)
    } catch (e) {
      console.error(e)
    } finally {
      isLoading.value = false
    }
  },
})

// const { $e } = useNuxtApp()

const { t } = useI18n()

// const { isUIAllowed } = useRoles()

const step = ref(1)

const progressQueue = ref<Record<string, any>[]>([])

const progress = ref<Record<string, any>[]>([])

const logRef = ref<typeof AntCard>()

const creatingSync = ref<boolean>(false)

const _pushProgress = async () => {
  if (progressQueue.value.length) {
    if (!creatingSync.value) {
      progress.value.push(...progressQueue.value.splice(0, progressQueue.value.length))
    } else {
      progress.value.push(progressQueue.value.shift()!)
    }
  }

  await nextTick(() => {
    const container: HTMLDivElement = logRef.value?.$el?.firstElementChild
    if (!container) return
    container.scrollTop = container.scrollHeight
  })
}

const pushProgress = async (message: string, status: JobStatus | 'progress') => {
  progressQueue.value.push({ msg: message, status })

  setTimeout(() => {
    _pushProgress()
  }, 100 * progressQueue.value.length)
}

const selectedSyncType = computed(() => {
  return formState.value.sub_type
})

const workspaceStore = useWorkspace()
const { loadWorkspaces } = workspaceStore
const { activeWorkspace } = storeToRefs(workspaceStore)

const goToDashboard = ref(false)

const goBack = ref(false)

/*
const { $poller } = useNuxtApp()

const createSource = async () => {
  try {
    await validate()
  } catch (e) {
    focusInvalidInput()
    return
  }

  try {
    if (!baseId.value) return

    creatingSync.value = true

    const connection = getConnectionConfig()

    const config = { ...formState.value.dataSource, connection }

    // if integration is selected and database/schema is empty, set it to `undefined` to use default from integration
    if (selectedIntegration.value) {
      if (config.connection?.database === '') {
        config.connection.database = undefined
      }
      if (config.searchPath?.[0] === '') {
        config.searchPath = undefined
      }
    }

    step.value = 2

    const jobData = await api.source.create(baseId.value, {
      fk_integration_id: formState.value.fk_integration_id,
      alias: formState.value.title,
      type: formState.value.dataSource.client,
      config,
      inflection_column: formState.value.inflection.inflectionColumn,
      inflection_table: formState.value.inflection.inflectionTable,
      is_schema_readonly: formState.value.is_schema_readonly,
      is_data_readonly: formState.value.is_data_readonly,
      is_private: formState.value.is_private,
    })

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
            $e('a:base:create:extdb')

            emit('sourceCreated')
            if (data.data?.result.needUpgrade) {
              activeWorkspace.value.status = WorkspaceStatus.CREATING
              loadWorkspacesWithInterval()
            } else {
              if (baseId.value) {
                await loadProject(baseId.value, true)
                await loadProjectTables(baseId.value, true)
              }
              pushProgress('Done!', 'progress')
              creatingSource.value = false
              onDashboard()
            }
          } else if (data.status === JobStatus.FAILED) {
            pushProgress('Failed to create source!', 'progress')
            if (data.data?.error?.message) pushProgress(data.data?.error.message, data.status)
            creatingSource.value = false
            goBack.value = true
          } else if (!data?.status && data.data?.message) {
            pushProgress(data.data.message, 'progress')
          }
        }
      },
    )
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    creatingSource.value = false
  } finally {
    refreshCommandPalette()
  }
}
*/

const generateUniqueTitle = () => {
  return generateTitle(t('objects.table'), tables.value, 'title')
}

// select and focus title field on load
onMounted(async () => {
  isLoading.value = true

  await loadDynamicIntegrations()

  formState.value.title = generateUniqueTitle()

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
  activeIntegrationItemForm.value = await getIntegrationForm(IntegrationsType.Sync, formState.value.sub_type)
}

const refreshState = async (keepForm = false) => {
  if (!keepForm) {
    formState.value = {}
  }
  goBack.value = false
  creatingSync.value = false
  goToDashboard.value = false
  progressQueue.value = []
  progress.value = []
  step.value = 1
}

const onBack = () => {
  refreshState(true)
}

function onDashboard() {
  refreshState()
  vOpen.value = false
}

const isModalClosable = computed(() => {
  return !creatingSync.value
})

const filterIntegrationCategory = (c: IntegrationCategoryItemType) => [IntegrationCategoryType.SYNC].includes(c.value)
const filterIntegration = (i: IntegrationItemType) => !!(i.sub_type !== SyncDataType.NOCODB && i.isAvailable)
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
    <div class="flex-1 flex flex-col max-h-full">
      <div class="px-4 py-3 w-full flex items-center gap-3 border-b-1 border-gray-200">
        <div class="flex items-center">
          <GeneralIcon icon="sync" class="!text-green-700 !h-5 !w-5" />
        </div>
        <div class="flex-1 text-base font-weight-700">Add Sync Table</div>

        <div class="flex items-center gap-3">
          <NcButton
            v-if="step === 1"
            size="small"
            type="primary"
            :disabled="!selectedSyncType || isLoading"
            :loading="creatingSync"
            class="nc-extdb-btn-submit"
            @click="submit"
          >
            Create Sync Table
          </NcButton>
          <NcButton :disabled="creatingSync" size="small" type="text" @click="vOpen = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>
      <div class="h-[calc(100%_-_58px)] flex">
        <div class="nc-add-source-left-panel nc-scrollbar-thin relative">
          <div class="create-source bg-white relative flex flex-col gap-2 w-full max-w-[768px]">
            <template v-if="step === 1">
              <a-form name="external-base-create-form" layout="vertical" no-style class="flex flex-col gap-5.5">
                <div class="nc-form-section">
                  <div class="nc-form-section-body">
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <a-form-item label="Table Name" v-bind="validateInfos.title">
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
              <!--         Inferring schema from your data source -->
              <div class="mb-4 prose-xl font-bold">Inferring schema from your data source</div>

              <a-card
                ref="logRef"
                :body-style="{
                  backgroundColor: '#000000',
                  height: goToDashboard ? '200px' : '400px',
                  overflow: 'auto',
                  borderRadius: '8px',
                }"
              >
                <div v-for="({ msg, status }, i) in progress" :key="i">
                  <div v-if="status === JobStatus.FAILED" class="flex items-center">
                    <component :is="iconMap.closeCircle" class="text-red-500" />

                    <span class="text-red-500 ml-2">{{ msg }}</span>
                  </div>

                  <div v-else class="flex items-center">
                    <MdiCurrencyUsd class="text-green-500" />

                    <span class="text-green-500 ml-2">{{ msg }}</span>
                  </div>
                </div>

                <div
                  v-if="!goToDashboard && progress[progress.length - 1]?.status !== JobStatus.FAILED"
                  class="flex items-center"
                >
                  <!--            Importing -->
                  <component :is="iconMap.loading" class="text-green-500 animate-spin" />
                  <span class="text-green-500 ml-2">Setting up...</span>
                </div>
              </a-card>

              <div v-if="goToDashboard" class="flex justify-center items-center">
                <NcButton class="mt-6 mb-8" size="medium" @click="onDashboard"> 🚀 Submit & Go to Dashboard 🚀</NcButton>
              </div>
              <div v-else-if="goBack" class="flex justify-center items-center">
                <NcButton class="mt-6 mb-8" type="ghost" size="medium" @click="onBack">Go Back</NcButton>
              </div>
            </template>
          </div>
          <general-overlay :model-value="isLoading" inline transition class="!bg-opacity-15">
            <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
              <a-spin size="large" />
            </div>
          </general-overlay>
        </div>
        <div class="nc-add-source-right-panel">
          <DashboardSettingsDataSourcesSupportedDocs />
          <NcDivider />
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
