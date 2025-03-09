<script lang="ts" setup>
import type { FormDefinition } from 'nocodb-sdk'
import { IntegrationsType, SyncTrigger, SyncType } from 'nocodb-sdk'
import { JobStatus } from '#imports'

const props = defineProps<{ open: boolean; tableId: string; baseId: string; isModal?: boolean }>()
const emit = defineEmits(['update:open'])
const vOpen = useVModel(props, 'open', emit)

const { integrations, loadDynamicIntegrations, getIntegrationForm, loadIntegrations } = useIntegrationStore()

const { refreshCommandPalette } = useCommandPalette()

const { t } = useI18n()

const { baseTables } = storeToRefs(useTablesStore())

const tables = computed(() => baseTables.value.get(props.baseId) ?? [])

const table = computed(() => tables.value.find((t) => t.id === props.tableId))

const workspaceStore = useWorkspace()
const { activeWorkspace } = storeToRefs(workspaceStore)

const activeIntegrationItemForm = ref<FormDefinition>()

const tableSyncs = ref<Record<string, any>[]>([])

const activeSync = ref<Record<string, any> | null>(null)

const syncOptions = ref<
  {
    label: string
    value: string
  }[]
>([])

const { $api, $poller } = useNuxtApp()

const createMoreModal = ref(false)

const { formState, isLoading, validateInfos, clearValidate, submit, isChanged } = useProvideFormBuilderHelper({
  formSchema: activeIntegrationItemForm,
  onSubmit: async () => {
    isLoading.value = true

    try {
      await $api.internal.postOperation(
        activeWorkspace.value!.id!,
        props.baseId!,
        {
          operation: 'updateSync',
        },
        { syncConfigId: activeSync.value!.id, ...formState.value },
      )

      await initialize()

      refreshCommandPalette()
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  },
})

const updatingSync = ref(false)

const triggeredSync = ref(false)

const completeSync = ref(false)

const progressRef = ref()

const selectedSyncType = computed(() => {
  return formState.value.sub_type
})

const changeActiveSync = async (id: string) => {
  activeSync.value = tableSyncs.value.find((sync) => sync.id === id)!

  const integration = await $api.integration.read(activeSync.value.fk_integration_id, {
    includeConfig: true,
  })

  const integrationForm = await getIntegrationForm(IntegrationsType.Sync, integration.sub_type!)

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

  nextTick(() => {
    formState.value = {
      id: integration.id,
      table_name: table.value?.title,
      title: integration.title,
      type: integration.type,
      sub_type: integration.sub_type,
      config: {
        ...integration.config,
        sync: {
          ...activeSync.value,
        },
      },
    }

    nextTick(() => {
      clearValidate()
      isChanged.value = false
    })

    isLoading.value = false
  })
}

async function initialize() {
  tableSyncs.value = []
  syncOptions.value = []

  isLoading.value = true

  await loadDynamicIntegrations()
  await loadIntegrations()

  const syncs = (await $api.internal.getOperation(activeWorkspace.value!.id!, props.baseId!, {
    operation: 'listSync',
    fk_model_id: props.tableId,
  })) as {
    id: string
    fk_integration_id: string
    fk_model_id: string
    sync_type: string
    sync_trigger: string
    sync_trigger_cron?: string
    sync_trigger_secret?: string
    last_sync_at: string | null
    next_sync_at: string | null
    sync_job_id: string
  }[]

  if (syncs.length === 0) {
    vOpen.value = false
    return
  }

  for (const sync of syncs) {
    tableSyncs.value.push(sync)

    const integration = integrations.value.find((i) => i.id === sync.fk_integration_id)

    if (!integration) continue

    syncOptions.value.push({
      label: `${integration.title}`,
      value: sync.id,
    })
  }

  await changeActiveSync(syncs[0]!.id)
}

const onTrigger = async () => {
  if (!activeSync.value) return

  try {
    triggeredSync.value = true

    const jobData = await $api.internal.postOperation(
      activeWorkspace.value!.id!,
      props.baseId!,
      {
        operation: 'triggerSync',
      },
      {
        syncConfigId: activeSync.value.id,
      },
    )

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
            progressRef.value.pushProgress(data.data?.error?.message ?? 'Sync failed', data.status)
            triggeredSync.value = false
            completeSync.value = true
          } else {
            progressRef.value.pushProgress(data.data?.message, data.status)
          }
        }
      },
    )
  } catch (e) {
    message.error(await extractSdkResponseErrorMsgv2(e as any))
    triggeredSync.value = false
  }
}

const onDeleteSync = async () => {
  if (!activeSync.value) return

  Modal.confirm({
    title: `Do you want to delete ${formState.value.title}?`,
    content: 'This action cannot be undone!!!',
    wrapClassName: 'nc-modal-delete',
    okText: t('general.yes'),
    okType: 'danger',
    cancelText: t('general.no'),
    width: 450,
    async onOk() {
      try {
        await $api.internal.postOperation(
          activeWorkspace.value!.id!,
          props.baseId!,
          {
            operation: 'deleteSync',
          },
          {
            syncConfigId: activeSync.value!.id,
          },
        )

        message.success('Sync deleted successfully')

        await initialize()
      } catch (e) {
        message.error(await extractSdkResponseErrorMsgv2(e as any))
      }
    },
  })
}

// select and focus title field on load
onMounted(() => {
  initialize()
})

const isModalClosable = computed(() => {
  return !updatingSync.value
})

const filterIntegrationCategory = (c: IntegrationCategoryItemType) => [IntegrationCategoryType.SYNC].includes(c.value)
const filterIntegration = (i: IntegrationItemType) => !!(i.sub_type !== SyncDataType.NOCODB && i.isAvailable)

const integrationOptionsExpansionPanel = ref<string[]>([])

const handleUpdateIntegrationOptionsExpansionPanel = (open: boolean) => {
  if (open) {
    integrationOptionsExpansionPanel.value = ['1']
  } else {
    integrationOptionsExpansionPanel.value = []
  }
}
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
        <div class="flex-1 text-base font-weight-700">Edit Sync Configuration</div>

        <div class="flex items-center gap-3">
          <NcButton
            size="small"
            type="primary"
            :disabled="!isChanged || !selectedSyncType || isLoading || triggeredSync"
            :loading="updatingSync"
            class="nc-extdb-btn-submit"
            @click="submit"
          >
            Update Sync Table
          </NcButton>
          <NcButton :disabled="updatingSync" size="small" type="text" @click="vOpen = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>
      <div class="h-[calc(100%_-_58px)] flex">
        <div class="nc-add-source-left-panel nc-scrollbar-thin relative">
          <div class="create-source bg-white relative flex flex-col gap-2 w-full max-w-[768px]">
            <a-form name="external-base-create-form" layout="vertical" no-style class="flex flex-col gap-5.5">
              <div class="nc-form-section">
                <div class="nc-form-section-body">
                  <a-row :gutter="24">
                    <a-col :span="12">
                      <a-form-item label="Table Name" v-bind="validateInfos.table_name">
                        <a-input v-model:value="formState.table_name" disabled />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row :gutter="24">
                    <a-col :span="12">
                      <a-form-item label="Integration" v-bind="validateInfos.type">
                        <div class="flex">
                          <NcSelect :value="formState?.config?.sync?.id" :options="syncOptions" @change="changeActiveSync" />
                          <NcButton class="!px-6 mx-2" size="small" type="ghost" @click="createMoreModal = true">
                            <div class="flex items-center gap-2">
                              <GeneralIcon icon="plus" class="!h-4 !w-4" />
                              <div>Add</div>
                            </div>
                          </NcButton>
                          <NcButton class="!px-6 mx-2" size="small" type="danger" @click="onDeleteSync">
                            <div class="flex items-center gap-2">
                              <GeneralIcon icon="delete" class="!h-4 !w-4" />
                              <div>Delete</div>
                            </div>
                          </NcButton>
                        </div>
                      </a-form-item>
                    </a-col>
                  </a-row>
                </div>
              </div>
            </a-form>
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

            <a-collapse v-model:active-key="integrationOptionsExpansionPanel" ghost class="nc-source-advanced-options !mt-6">
              <template #expandIcon="{ isActive }">
                <NcButton
                  type="text"
                  size="small"
                  class="!-ml-1.5"
                  @click="handleUpdateIntegrationOptionsExpansionPanel(!integrationOptionsExpansionPanel.length)"
                >
                  <div class="nc-form-section-title">Integration options</div>

                  <GeneralIcon
                    icon="chevronDown"
                    class="ml-2 flex-none cursor-pointer transform transition-transform duration-500"
                    :class="{ '!rotate-180': isActive }"
                  />
                </NcButton>
              </template>
              <a-collapse-panel key="1" collapsible="disabled">
                <template #header>
                  <span></span>
                </template>

                <NcFormBuilder :key="formState.sub_type" class="py-2" />
              </a-collapse-panel>
            </a-collapse>

            <WorkspaceIntegrationsTab
              is-modal
              :filter-category="filterIntegrationCategory"
              :filter-integration="filterIntegration"
            />
            <WorkspaceIntegrationsEditOrAdd load-datasource-info :base-id="baseId" />
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
    <DashboardSettingsSyncCreateMore
      v-if="createMoreModal"
      v-model:open="createMoreModal"
      :table-id="tableId"
      :base-id="baseId"
      @create-sync="initialize"
    />
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
