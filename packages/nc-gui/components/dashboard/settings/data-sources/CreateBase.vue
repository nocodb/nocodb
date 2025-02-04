<script lang="ts" setup>
import { Form, message } from 'ant-design-vue'
import { type IntegrationType, validateAndExtractSSLProp } from 'nocodb-sdk'
import {
  ClientType,
  type DatabricksConnection,
  JobStatus,
  type ProjectCreateForm,
  SSLUsage,
  type SnowflakeConnection,
  clientTypes as _clientTypes,
} from '#imports'

const props = defineProps<{ open: boolean; connectionType?: ClientType }>()

const emit = defineEmits(['update:open', 'sourceCreated'])

const vOpen = useVModel(props, 'open', emit)

const { loadIntegrations, integrations, eventBus, pageMode, IntegrationsPageMode } = useIntegrationStore()

const baseStore = useBase()
const { loadProject } = useBases()
const { base } = storeToRefs(baseStore)

const { loadProjectTables } = useTablesStore()

const { refreshCommandPalette } = useCommandPalette()

const _projectId = inject(ProjectIdInj, undefined)
const baseId = computed(() => _projectId?.value ?? base.value?.id)

const filteredIntegrations = computed(() => integrations.value.filter((i) => i.sub_type !== SyncDataType.NOCODB))

const useForm = Form.useForm

const testSuccess = ref(false)

const testingConnection = ref(false)

const form = ref<typeof Form>()

const { api } = useApi()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const creatingSource = ref(false)

const advancedOptionsExpansionPanel = ref<string[]>([])

const isLoading = ref<boolean>(false)

const defaultFormState = (client = ClientType.MYSQL) => {
  return {
    title: '',
    dataSource: { ...getDefaultConnectionConfig(client) },
    inflection: {
      inflectionColumn: 'none',
      inflectionTable: 'none',
    },
    sslUse: SSLUsage.No,
    extraParameters: [],
    is_schema_readonly: true,
    is_data_readonly: false,
  }
}

const formState = ref<ProjectCreateForm>(defaultFormState())

const easterEgg = ref(false)

const easterEggCount = ref(0)

const onEasterEgg = () => {
  easterEggCount.value += 1
  if (easterEggCount.value >= 2) {
    easterEgg.value = true
  }
}

const selectedIntegration = computed(() => {
  return formState.value.fk_integration_id && integrations.value.find((i) => i.id === formState.value.fk_integration_id)
})

const selectedIntegrationDb = computed(() => {
  return selectedIntegration.value?.config?.connection?.database
})
const selectedIntegrationSchema = computed(() => {
  return selectedIntegration.value?.config?.searchPath?.[0]
})

const getDataSourceValue = (field: 'database' | 'schema') => {
  if (field === 'database') {
    return selectedIntegrationDb.value
  }
  if (field === 'schema') {
    return selectedIntegrationSchema.value
  }
}

const validators = computed(() => {
  let clientValidations: Record<string, any[]> = {
    'dataSource.connection.database':
      selectedIntegration.value && getDataSourceValue('database') ? [] : [fieldRequiredValidator()],
  }

  switch (formState.value.dataSource.client) {
    case ClientType.SQLITE:
      clientValidations = {}
      break
    case ClientType.SNOWFLAKE:
      clientValidations = {
        'dataSource.connection.database': [fieldRequiredValidator()],
        'dataSource.connection.schema': [fieldRequiredValidator()],
      }
      break
    case ClientType.PG:
    case ClientType.MSSQL:
      clientValidations['dataSource.searchPath.0'] = selectedIntegration.value ? [] : [fieldRequiredValidator()]
      break
  }

  return {
    title: [
      {
        required: true,
        message: t('labels.sourceNameRequired'),
      },
      baseTitleValidator(),
    ],
    fk_integration_id: [
      {
        required: true,
        message: 'Connection is required',
      },
    ],
    extraParameters: [extraParameterValidator],
    ...clientValidations,
  }
})

const { validate, validateInfos, clearValidate } = useForm(formState.value, validators)

const onClientChange = () => {
  formState.value.dataSource = { ...getDefaultConnectionConfig(formState.value.dataSource.client) }
}

const inflectionTypes = ['camelize', 'none']

function getConnectionConfig() {
  const extraParameters = Object.fromEntries(
    new Map(formState.value.extraParameters.filter((object) => object.key?.trim()).map((object) => [object.key, object.value])),
  )

  const connection = {
    ...formState.value.dataSource.connection,
    ...extraParameters,
  }

  connection.ssl = validateAndExtractSSLProp(connection, formState.value.sslUse, formState.value.dataSource.client)

  return connection
}

const focusInvalidInput = () => {
  form.value?.$el.querySelector('.ant-form-item-explain-error')?.parentNode?.parentNode?.querySelector('input')?.focus()
}

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

    creatingSource.value = true

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

    const jobData = await api.source.create(baseId.value, {
      fk_integration_id: formState.value.fk_integration_id,
      alias: formState.value.title,
      type: formState.value.dataSource.client,
      config,
      inflection_column: formState.value.inflection.inflectionColumn,
      inflection_table: formState.value.inflection.inflectionTable,
      is_schema_readonly: formState.value.is_schema_readonly,
      is_data_readonly: formState.value.is_data_readonly,
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

            if (baseId.value) {
              await loadProject(baseId.value, true)
              await loadProjectTables(baseId.value, true)
            }

            emit('sourceCreated')
            vOpen.value = false
            creatingSource.value = false
          } else if (data.status === JobStatus.FAILED) {
            message.error(data?.data?.error?.message || 'Failed to create base')
            creatingSource.value = false
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

const testConnectionError = ref()

const testConnection = async () => {
  try {
    await validate()
  } catch (e) {
    focusInvalidInput()
    return
  }

  $e('a:source:create:extdb:test-connection', [])

  try {
    testingConnection.value = true

    if (formState.value.dataSource.client === ClientType.SQLITE) {
      testSuccess.value = true
    } else {
      const connection = getConnectionConfig()

      connection.database = getTestDatabaseName(formState.value.dataSource)!

      let searchPath = formState.value.dataSource.searchPath

      // if integration is selected and database/schema is empty, set it to `undefined` to use default from integration
      if (selectedIntegration.value) {
        if (searchPath?.[0] === '') {
          searchPath = undefined
        }
      }

      const testConnectionConfig = {
        ...formState.value.dataSource,
        connection,
        searchPath,
        fk_integration_id: formState.value.fk_integration_id,
      }

      const result = await api.utils.testConnection(testConnectionConfig)

      if (result.code === 0) {
        testSuccess.value = true
      } else {
        testSuccess.value = false

        message.error(`${t('msg.error.dbConnectionFailed')} ${result.message}`)
      }
    }
  } catch (e: any) {
    testSuccess.value = false
    testConnectionError.value = await extractSdkResponseErrorMsg(e)
  }

  testingConnection.value = false
}

// reset test status on config change
watch(
  () => formState.value.dataSource,
  () => {
    testSuccess.value = false
    testConnectionError.value = null
  },
  { deep: true },
)

// select and focus title field on load
onMounted(async () => {
  isLoading.value = true

  if (!integrations.value.length) {
    await loadIntegrations(true, base.value?.id)
  }

  formState.value.title = await generateUniqueName()

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

const allowMetaWrite = computed({
  get: () => !formState.value.is_schema_readonly,
  set: (v) => {
    formState.value.is_schema_readonly = !v
    // if schema write is allowed, data write should be allowed too
    if (v) {
      formState.value.is_data_readonly = false
    }
    $e('c:source:schema-write-toggle', { allowed: !v, edit: true })
  },
})

const allowDataWrite = computed({
  get: () => !formState.value.is_data_readonly,
  set: (v) => {
    formState.value.is_data_readonly = !v
    $e('c:source:data-write-toggle', { allowed: !v })
  },
})
const changeIntegration = (triggerTestConnection = false) => {
  if (formState.value.fk_integration_id && selectedIntegration.value) {
    formState.value.dataSource = {
      client: selectedIntegration.value.sub_type,
      connection: {
        database: selectedIntegrationDb.value,
      },
      searchPath: selectedIntegration.value.config?.searchPath,
    }
  } else {
    onClientChange()
  }
  clearValidate()
  if (triggerTestConnection) {
    setTimeout(() => {
      testConnection()
    }, 300)
  }
}

const handleAddNewConnection = () => {
  pageMode.value = IntegrationsPageMode.LIST
}

eventBus.on((event, payload) => {
  if (event === IntegrationStoreEvents.INTEGRATION_ADD && payload?.id) {
    formState.value.fk_integration_id = payload.id
    until(() => selectedIntegration.value?.id === payload.id)
      .toBeTruthy()
      .then(() => {
        changeIntegration(true)
      })
  }
})

const handleUpdateAdvancedOptionsExpansionPanel = (open: boolean) => {
  if (open) {
    advancedOptionsExpansionPanel.value = ['1']
    handleAutoScroll(true, 'nc-source-advanced-options')
  } else {
    advancedOptionsExpansionPanel.value = []
  }
}

let timer: any
function handleAutoScroll(scroll: boolean, className: string) {
  if (scroll) {
    if (timer) {
      clearTimeout(timer)
    }

    nextTick(() => {
      const el = document.querySelector(`.create-source .${className}`)
      if (!el) return

      // wait for transition complete
      timer = setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 400)
    })
  }
}

const filterIntegrationCategory = (c: IntegrationCategoryItemType) => [IntegrationCategoryType.DATABASE].includes(c.value)
const filterIntegration = (i: IntegrationItemType) => i.sub_type !== SyncDataType.NOCODB && i.isAvailable

const isIntgrationDisabled = (integration: IntegrationType = {}) => {
  switch (integration.sub_type) {
    case ClientType.SQLITE:
      return {
        isDisabled: integration?.source_count && integration.source_count > 0,
        msg: 'Sqlite support only 1 database per connection',
      }

    default:
      return {
        isDisabled: false,
        msg: '',
      }
  }
}
</script>

<template>
  <NcModal
    v-model:visible="vOpen"
    :closable="false"
    :mask-closable="!creatingSource"
    :keyboard="!creatingSource"
    centered
    size="large"
    wrap-class-name="nc-modal-create-source"
    @keydown.esc="vOpen = false"
  >
    <div class="flex-1 flex flex-col max-h-full">
      <div class="px-4 py-3 w-full flex items-center gap-3 border-b-1 border-gray-200">
        <div class="h-6 self-start flex items-center">
          <GeneralIcon icon="server1" class="!text-green-700 !h-4 !w-4" />
        </div>
        <div class="flex-1 text-base font-weight-700">Add Data Source</div>

        <div class="flex items-center gap-3">
          <div class="w-[15px] h-[15px] cursor-pointer" @dblclick="onEasterEgg"></div>
          <NcTooltip :disabled="!testConnectionError">
            <template #title>
              {{ testConnectionError }}
            </template>

            <NcButton
              type="secondary"
              size="small"
              class="nc-extdb-btn-test-connection"
              :class="{ 'pointer-events-none': testSuccess }"
              :disabled="!selectedIntegration || isLoading"
              :loading="testingConnection"
              icon-position="right"
              @click="testConnection()"
            >
              <template #icon>
                <GeneralIcon v-if="testSuccess" icon="circleCheckSolid" class="!text-green-700 w-4 h-4" />
                <GeneralIcon v-else-if="testConnectionError" icon="alertTriangleSolid" class="!text-red-700 w-4 h-4" />
              </template>

              <span>
                {{ testSuccess ? 'Test successful' : 'Test connection' }}
              </span>
            </NcButton>
          </NcTooltip>

          <NcButton
            size="small"
            type="primary"
            :disabled="!testSuccess || !selectedIntegration || isLoading"
            :loading="creatingSource"
            class="nc-extdb-btn-submit"
            @click="createSource"
          >
            Add Source
          </NcButton>
          <NcButton :disabled="creatingSource" size="small" type="text" @click="vOpen = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>
      <div class="h-[calc(100%_-_58px)] flex">
        <div class="nc-add-source-left-panel nc-scrollbar-thin relative">
          <div class="create-source bg-white relative flex flex-col gap-2 w-full max-w-[768px]">
            <a-form
              ref="form"
              :model="formState"
              hide-required-mark
              name="external-base-create-form"
              layout="vertical"
              no-style
              class="flex flex-col gap-5.5"
            >
              <div class="nc-form-section">
                <div class="nc-form-section-body">
                  <a-row :gutter="24">
                    <a-col :span="12">
                      <a-form-item label="Data Source Name" v-bind="validateInfos.title">
                        <a-input v-model:value="formState.title" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <a-row :gutter="24">
                    <a-col :span="12">
                      <a-form-item label="Select connection" v-bind="validateInfos.fk_integration_id">
                        <NcSelect
                          v-model:value="formState.fk_integration_id"
                          class="nc-extdb-db-type nc-select-shadow"
                          dropdown-class-name="nc-dropdown-ext-db-type"
                          placeholder="Select connection"
                          allow-clear
                          show-search
                          dropdown-match-select-width
                          @change="changeIntegration()"
                        >
                          <a-select-option
                            v-for="integration in filteredIntegrations"
                            :key="integration.id"
                            :value="integration.id"
                            :disabled="isIntgrationDisabled(integration).isDisabled"
                          >
                            <div class="w-full flex gap-2 items-center" :data-testid="integration.title">
                              <GeneralIntegrationIcon
                                v-if="integration?.sub_type"
                                :type="integration.sub_type"
                                :style="{
                                  filter: isIntgrationDisabled(integration).isDisabled
                                    ? 'grayscale(100%) brightness(115%)'
                                    : undefined,
                                }"
                              />
                              <NcTooltip
                                class="flex-1 truncate"
                                :show-on-truncate-only="!isIntgrationDisabled(integration).isDisabled"
                              >
                                <template #title>
                                  {{
                                    isIntgrationDisabled(integration).isDisabled
                                      ? isIntgrationDisabled(integration).msg
                                      : integration.title
                                  }}
                                </template>
                                {{ integration.title }}
                              </NcTooltip>
                              <component
                                :is="iconMap.check"
                                v-if="formState.fk_integration_id === integration.id"
                                id="nc-selected-item-icon"
                                class="text-primary w-4 h-4"
                              />
                            </div>
                          </a-select-option>

                          <template v-if="isUIAllowed('workspaceIntegrations')" #dropdownRender="{ menuNode: menu }">
                            <component :is="menu" />
                            <a-divider style="margin: 4px 0" />
                            <div
                              class="px-1.5 flex items-center text-brand-500 text-sm cursor-pointer"
                              @mousedown.prevent
                              @click="handleAddNewConnection"
                            >
                              <div class="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100">
                                <GeneralIcon icon="plus" class="flex-none" />
                                {{ $t('general.new') }} {{ $t('general.connection').toLowerCase() }}
                              </div>
                            </div>
                          </template>
                        </NcSelect>
                      </a-form-item>
                    </a-col>
                  </a-row>
                </div>
              </div>

              <template v-if="selectedIntegration">
                <div class="nc-form-section">
                  <div class="nc-form-section-body">
                    <!-- SQLite File -->
                    <template v-if="formState.dataSource.client === ClientType.SQLITE"> </template>
                    <template v-else-if="formState.dataSource.client === ClientType.SNOWFLAKE">
                      <a-row :gutter="24">
                        <a-col :span="12">
                          <!-- Database -->
                          <a-form-item :label="$t('labels.database')" v-bind="validateInfos['dataSource.connection.database']">
                            <a-input
                              v-model:value="(formState.dataSource.connection as SnowflakeConnection).database"
                              class="nc-extdb-host-database"
                            />
                          </a-form-item>
                        </a-col>
                        <a-col :span="12">
                          <!-- Schema -->
                          <a-form-item label="Schema" v-bind="validateInfos['dataSource.connection.schema']">
                            <a-input
                              v-model:value="(formState.dataSource.connection as SnowflakeConnection).schema"
                              class="nc-extdb-host-database"
                            />
                          </a-form-item>
                        </a-col>
                      </a-row>
                    </template>

                    <template v-else-if="formState.dataSource.client === ClientType.DATABRICKS">
                      <a-row :gutter="24">
                        <a-col :span="12">
                          <a-form-item label="Database" v-bind="validateInfos['dataSource.connection.database']">
                            <a-input
                              v-model:value="(formState.dataSource.connection as DatabricksConnection).database"
                              class="nc-extdb-host-database"
                            />
                          </a-form-item>
                        </a-col>
                        <a-col :span="12">
                          <a-form-item label="Schema" v-bind="validateInfos['dataSource.connection.schema']">
                            <a-input
                              v-model:value="(formState.dataSource.connection as DatabricksConnection).schema"
                              class="nc-extdb-host-schema"
                            />
                          </a-form-item>
                        </a-col>
                      </a-row>
                    </template>
                    <template v-else>
                      <a-row :gutter="24">
                        <a-col :span="12">
                          <!-- Database -->
                          <a-form-item :label="$t('labels.database')" v-bind="validateInfos['dataSource.connection.database']">
                            <!-- Database : create if not exists -->
                            <a-input
                              v-model:value="formState.dataSource.connection.database"
                              :placeholder="$t('labels.dbCreateIfNotExists')"
                              class="nc-extdb-host-database"
                            />
                          </a-form-item>
                        </a-col>
                        <a-col :span="12">
                          <!-- Schema name -->
                          <a-form-item
                            v-if="
                              ([ClientType.MSSQL, ClientType.PG].includes(formState.dataSource.client) ||
                                [ClientType.MSSQL, ClientType.PG].includes(selectedIntegration?.sub_type)) &&
                              formState.dataSource.searchPath
                            "
                            :label="$t('labels.schemaName')"
                            v-bind="validateInfos['dataSource.searchPath.0']"
                          >
                            <a-input
                              v-model:value="formState.dataSource.searchPath[0]"
                              :placeholder="selectedIntegrationSchema && `${selectedIntegrationSchema} (default)`"
                            />
                          </a-form-item>
                        </a-col>
                      </a-row>
                    </template>
                  </div>
                </div>

                <div class="nc-form-section">
                  <div class="nc-form-section-title">Permissions</div>
                  <div class="nc-form-section-body">
                    <DashboardSettingsDataSourcesSourceRestrictions
                      v-model:allowMetaWrite="allowMetaWrite"
                      v-model:allowDataWrite="allowDataWrite"
                    />
                  </div>
                </div>

                <template
                  v-if="![ClientType.SQLITE, ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(formState.dataSource.client)"
                >
                  <a-collapse v-model:active-key="advancedOptionsExpansionPanel" ghost class="nc-source-advanced-options !mt-4">
                    <template #expandIcon="{ isActive }">
                      <NcButton
                        type="text"
                        size="small"
                        class="!-ml-1.5"
                        @click="handleUpdateAdvancedOptionsExpansionPanel(!advancedOptionsExpansionPanel.length)"
                      >
                        <div class="nc-form-section-title">Advanced options</div>

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

                      <div class="flex flex-col gap-4">
                        <div class="flex flex-col gap-4">
                          <a-row :gutter="24">
                            <a-col :span="12">
                              <a-form-item :label="$t('labels.inflection.tableName')">
                                <NcSelect
                                  v-model:value="formState.inflection.inflectionTable"
                                  class="nc-select-shadow"
                                  dropdown-class-name="nc-dropdown-inflection-table-name"
                                >
                                  <a-select-option v-for="tp in inflectionTypes" :key="tp" :value="tp">{{ tp }}</a-select-option>
                                </NcSelect>
                              </a-form-item>
                            </a-col>
                            <a-col :span="12">
                              <a-form-item :label="$t('labels.inflection.columnName')">
                                <NcSelect
                                  v-model:value="formState.inflection.inflectionColumn"
                                  class="nc-select-shadow"
                                  dropdown-class-name="nc-dropdown-inflection-column-name"
                                >
                                  <a-select-option v-for="tp in inflectionTypes" :key="tp" :value="tp">{{ tp }}</a-select-option>
                                </NcSelect>
                              </a-form-item>
                            </a-col>
                          </a-row>
                        </div>
                      </div>
                    </a-collapse-panel>
                  </a-collapse>
                </template>
              </template>
              <div>
                <!-- For spacing -->
              </div>
            </a-form>

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
    @apply text-base font-bold text-gray-800;
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
