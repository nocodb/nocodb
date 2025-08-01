<script lang="ts" setup>
import { IntegrationsType, type SourceType, validateAndExtractSSLProp } from 'nocodb-sdk'
import { Form } from 'ant-design-vue'
import {
  ClientType,
  type DatabricksConnection,
  type DefaultConnection,
  type ProjectCreateForm,
  SSLUsage,
  type SnowflakeConnection,
  clientTypes as _clientTypes,
} from '#imports'

const props = defineProps<{
  sourceId: string
}>()

const emit = defineEmits(['sourceUpdated', 'close'])

const baseStore = useBase()
const basesStore = useBases()
const { base } = storeToRefs(baseStore)

const { integrations, loadIntegrations } = useIntegrationStore()

const _projectId = inject(ProjectIdInj, undefined)
const baseId = computed(() => _projectId?.value ?? base.value?.id)

const { refreshCommandPalette } = useCommandPalette()

const filteredIntegrations = computed(() => integrations.value.filter((i) => i.sub_type !== SyncDataType.NOCODB))

const useForm = Form.useForm

const testSuccess = ref(false)

const testingConnection = ref(false)

const form = ref<typeof Form>()

const { api } = useApi()

const { $e } = useNuxtApp()

const { t } = useI18n()

const editingSource = ref(false)

const easterEgg = ref(false)

const easterEggCount = ref(0)

const advancedOptionsExpansionPanel = ref<string[]>([])

const isLoading = ref<boolean>(false)

const onEasterEgg = () => {
  easterEggCount.value += 1
  if (easterEggCount.value >= 2) {
    easterEgg.value = true
  }
}

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
  return {
    'title': [baseTitleValidator()],
    'extraParameters': [extraParameterValidator],
    'dataSource.client': [fieldRequiredValidator()],
    ...(formState.value.dataSource.client === ClientType.SQLITE
      ? {}
      : formState.value.dataSource.client === ClientType.SNOWFLAKE
      ? {
          'dataSource.connection.database': [fieldRequiredValidator()],
          'dataSource.connection.schema': [fieldRequiredValidator()],
        }
      : {
          'dataSource.connection.database':
            selectedIntegration.value && getDataSourceValue('database') ? [] : [fieldRequiredValidator()],
          ...([ClientType.PG].includes(formState.value.dataSource.client) && formState.value.dataSource.searchPath
            ? {
                'dataSource.searchPath.0':
                  selectedIntegration.value && getDataSourceValue('schema') ? [] : [fieldRequiredValidator()],
              }
            : {}),
        }),
  }
})

const { validate, validateInfos } = useForm(formState, validators)

const updateSSLUse = () => {
  if (formState.value.dataSource.client !== ClientType.SQLITE) {
    const connection = formState.value.dataSource.connection as DefaultConnection
    if (connection.ssl) {
      if (typeof connection.ssl === 'string') {
        formState.value.sslUse = SSLUsage.Allowed
      } else {
        formState.value.sslUse = SSLUsage.Preferred
      }
    } else {
      formState.value.sslUse = SSLUsage.No
    }
  }
}

const inflectionTypes = ['camelize', 'none']

function getConnectionConfig() {
  const extraParameters = Object.fromEntries(new Map(formState.value.extraParameters.map((object) => [object.key, object.value])))

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

const editBase = async () => {
  try {
    await validate()
  } catch (e) {
    focusInvalidInput()
    return
  }

  try {
    if (!base.value?.id) return

    const connection = getConnectionConfig()

    const config = { ...formState.value.dataSource, connection }

    // todo: refactor and remove this duplicate path in config
    if (config.client === ClientType.SQLITE && config.connection?.connection?.filename) {
      config.connection.filename = config.connection.connection.filename
    }

    // if integration is selected and database/schema is empty, set it to `undefined` to use default from integration
    if (selectedIntegration.value) {
      if (config.connection?.database === '') {
        config.connection.database = undefined
      }
      if (config.searchPath?.[0] === '') {
        config.searchPath = undefined
      }
    }

    await api.source.update(base.value?.id, props.sourceId, {
      alias: formState.value.title,
      type: formState.value.dataSource.client,
      config,
      inflection_column: formState.value.inflection.inflectionColumn,
      inflection_table: formState.value.inflection.inflectionTable,
      is_schema_readonly: formState.value.is_schema_readonly,
      is_data_readonly: formState.value.is_data_readonly,
    })

    $e('a:source:edit:extdb')

    await basesStore.loadProject(baseId.value!, true)
    emit('sourceUpdated')
    emit('close')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
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

  $e('a:source:edit:extdb:test-connection', [])

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
        if (connection?.database === '') {
          connection.database = undefined
        }
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

// load source config
onMounted(async () => {
  isLoading.value = true

  if (!integrations.value.length) {
    await loadIntegrations(IntegrationsType.Database, base.value?.id)
  }

  if (base.value?.id) {
    const definedParameters = ['host', 'port', 'user', 'password', 'database']

    const activeBase = (await api.source.read(base.value?.id, props.sourceId)) as SourceType

    const tempParameters = Object.entries(activeBase.config.connection || {})
      .filter(([key]) => !definedParameters.includes(key))
      .map(([key, value]) => ({ key: key as string, value: value as string }))

    formState.value = {
      title: activeBase.alias || '',
      dataSource: { connection: {}, ...(activeBase.config || {}), searchPath: activeBase.config?.searchPath || [] },
      inflection: {
        inflectionColumn: activeBase.inflection_column,
        inflectionTable: activeBase.inflection_table,
      },
      extraParameters: tempParameters,
      sslUse: SSLUsage.No,
      is_schema_readonly: activeBase.is_schema_readonly,
      is_data_readonly: activeBase.is_data_readonly,
      fk_integration_id: activeBase.fk_integration_id,
    }
    updateSSLUse()
  }

  isLoading.value = false
})

// if searchPath is null/undefined reset it to empty array when necessary
watch(
  () => formState.value.dataSource.searchPath,
  (val) => {
    if ([ClientType.PG].includes(formState.value.dataSource.client) && !val) {
      formState.value.dataSource.searchPath = []
    }
  },
  {
    immediate: true,
  },
)

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
    $e('c:source:data-write-toggle', { allowed: !v, edit: true })
  },
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
      const el = document.querySelector(`.edit-source .${className}`)
      if (!el) return

      // wait for transition complete
      timer = setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 400)
    })
  }
}
</script>

<template>
  <div class="edit-source bg-white relative h-full flex flex-col w-full">
    <div class="h-full max-h-[calc(100%_-_65px)] flex">
      <div class="nc-edit-source-left-panel nc-scrollbar-thin relative">
        <div class="h-full max-w-[768px] mx-auto">
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
                      <a-input v-model:value="formState.title" class="nc-extdb-proj-name" />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-row :gutter="24">
                  <a-col :span="12">
                    <a-form-item label="Select connection">
                      <NcSelect
                        :value="formState.fk_integration_id"
                        disabled
                        class="nc-extdb-db-type nc-select-shadow"
                        dropdown-class-name="nc-dropdown-ext-db-type"
                        placeholder="Select connection"
                        allow-clear
                        show-search
                        dropdown-match-select-width
                      >
                        <a-select-option
                          v-for="integration in filteredIntegrations"
                          :key="integration.id"
                          :value="integration.id"
                        >
                          <div class="w-full flex gap-2 items-center" :data-testid="integration.title">
                            <GeneralIntegrationIcon
                              v-if="integration?.sub_type"
                              :type="integration.sub_type"
                              :style="{
                                filter: 'grayscale(100%) brightness(115%)',
                              }"
                            />
                            <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                              <template #title>
                                {{ integration.title }}
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
                      </NcSelect>
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>
            </div>

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
                          ([ClientType.PG].includes(formState.dataSource.client) ||
                            [ClientType.PG].includes(selectedIntegration?.sub_type)) &&
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
                  v-model:allow-meta-write="allowMetaWrite"
                  v-model:allow-data-write="allowDataWrite"
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
            <div>
              <!-- For spacing -->
            </div>
          </a-form>
        </div>
        <general-overlay :model-value="isLoading" inline transition class="!bg-opacity-15">
          <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
            <a-spin size="large" />
          </div>
        </general-overlay>
      </div>
      <div class="nc-edit-source-right-panel">
        <DashboardSettingsDataSourcesSupportedDocs />
        <NcDivider />
      </div>
    </div>
    <div class="p-4 w-full flex items-center justify-between gap-3 border-t-1 border-gray-200">
      <div class="flex-1 flex items-center gap-3">
        <div class="flex-1 flex items-center gap-3 text-[#C86827]">
          <GeneralIcon icon="alertTriangle" class="flex-none" />
          <div>{{ $t('msg.warning.dbValid') }}</div>
        </div>
      </div>
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
            :loading="testingConnection"
            :disabled="isLoading"
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
          :disabled="!testSuccess || isLoading"
          :loading="editingSource"
          class="nc-extdb-btn-submit"
          @click="editBase"
        >
          {{ $t('general.submit') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-edit-source-left-panel {
  @apply p-6 flex-1 flex justify-center;
}
.nc-edit-source-right-panel {
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

.edit-source {
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
