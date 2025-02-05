<script lang="ts" setup>
import { Form, message } from 'ant-design-vue'
import type { SelectHandler } from 'ant-design-vue/es/vc-select/Select'
import { diff } from 'deep-object-diff'
import { IntegrationsType, validateAndExtractSSLProp } from 'nocodb-sdk'
import {
  type CertTypes,
  ClientType,
  type DatabricksConnection,
  type DefaultConnection,
  type ProjectCreateForm,
  type SQLiteConnection,
  SSLUsage,
  type SnowflakeConnection,
  clientTypes as _clientTypes,
} from '#imports'

const props = defineProps<{
  open: boolean
  connectionType?: ClientType
  loadDatasourceInfo?: boolean
  baseId?: string
}>()

const emit = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emit)

const connectionType = computed(() => props.connectionType ?? ClientType.MYSQL)

const {
  isFromIntegrationPage,
  pageMode,
  IntegrationsPageMode,
  activeIntegration,
  saveIntegration,
  updateIntegration,
  integrationsIconMap,
} = useIntegrationStore()

const isEditMode = computed(() => pageMode.value === IntegrationsPageMode.EDIT)

const useForm = Form.useForm

const testSuccess = ref(false)

const testingConnection = ref(false)

const form = ref<typeof Form>()

const { api } = useApi()

const { $e } = useNuxtApp()

const { t } = useI18n()

const creatingSource = ref(false)

const _getDefaultConnectionConfig = (client = ClientType.MYSQL) => {
  const config = getDefaultConnectionConfig(client)
  if ('database' in config.connection) {
    config.connection.database = ''
  }

  if (client === ClientType.SQLITE && config.connection?.connection?.filename) {
    config.connection.connection.filename = ''
  }
  return config
}

const defaultFormState = (client = ClientType.MYSQL) => {
  return {
    title: '',
    dataSource: { ..._getDefaultConnectionConfig(client) },
    sslUse: SSLUsage.No,
    extraParameters: [],
    is_private: false,
  }
}

const formState = ref<ProjectCreateForm>(defaultFormState())

const activeIntegrationformState = ref<ProjectCreateForm>(defaultFormState())

const isEnabledSaveChangesBtn = ref(false)

const easterEgg = ref(false)

const easterEggCount = ref(0)

const useSslExpansionPanel = ref<string[]>([])

const advancedOptionsExpansionPanel = ref<string[]>([])

const isLoading = ref<boolean>(false)

const maskedPassword = ref<boolean>(false)

const maskedPasswordHelp = computed(() => {
  return maskedPassword.value ? 'Re-enter your password to test or update connection' : undefined
})

const isDisabledSubmitBtn = computed(() => {
  if (isEditMode.value) {
    return !testSuccess.value && !isEnabledSaveChangesBtn.value
  }
  return !testSuccess.value
})

const onEasterEgg = () => {
  easterEggCount.value += 1
  if (easterEggCount.value >= 2) {
    easterEgg.value = true
  }
}

const clientTypes = computed(() => {
  return _clientTypes.filter((type) => {
    return (
      ([ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(type.value) && easterEgg.value) ||
      ![ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(type.value)
    )
  })
})

const validators = computed(() => {
  let clientValidations: Record<string, any[]> = {
    'dataSource.connection.host': [fieldRequiredValidator()],
    'dataSource.connection.port': [fieldRequiredValidator()],
    'dataSource.connection.user': [fieldRequiredValidator()],
    'dataSource.connection.password': [fieldRequiredValidator()],
  }

  switch (formState.value.dataSource.client) {
    case ClientType.SQLITE:
      clientValidations = {
        'dataSource.connection.connection.filename': [fieldRequiredValidator()],
      }
      break
    case ClientType.SNOWFLAKE:
      clientValidations = {
        'dataSource.connection.account': [fieldRequiredValidator()],
        'dataSource.connection.username': [fieldRequiredValidator()],
        'dataSource.connection.password': [fieldRequiredValidator()],
        'dataSource.connection.warehouse': [fieldRequiredValidator()],
        'dataSource.connection.database': [fieldRequiredValidator()],
        'dataSource.connection.schema': [fieldRequiredValidator()],
      }
      break
    case ClientType.DATABRICKS:
      clientValidations = {
        'dataSource.connection.token': [fieldRequiredValidator()],
        'dataSource.connection.host': [fieldRequiredValidator()],
        'dataSource.connection.path': [fieldRequiredValidator()],
      }
      break
    case ClientType.PG:
    case ClientType.MSSQL:
      clientValidations['dataSource.searchPath.0'] = [fieldRequiredValidator()]
      break
  }

  return {
    'title': [
      {
        required: true,
        message: 'Connection name is required',
      },
      baseTitleValidator('connection'),
    ],
    'extraParameters': [extraParameterValidator],
    'dataSource.client': [fieldRequiredValidator()],
    ...clientValidations,
  }
})

const { validate, validateInfos } = useForm(formState, validators)

const onClientChange = () => {
  formState.value.dataSource = { ..._getDefaultConnectionConfig(formState.value.dataSource.client) }
}

const onSSLModeChange = ((mode: SSLUsage) => {
  if (formState.value.dataSource.client !== ClientType.SQLITE) {
    const connection = formState.value.dataSource.connection as DefaultConnection
    switch (mode) {
      case SSLUsage.No:
        connection.ssl = undefined
        break
      case SSLUsage.Allowed:
        connection.ssl = 'true'
        break
      default:
        connection.ssl = {
          ca: '',
          cert: '',
          key: '',
        }
        break
    }
  }
}) as SelectHandler

const updateSSLUse = (updateActiveIntegrationFormState = false) => {
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

    if (updateActiveIntegrationFormState) {
      activeIntegrationformState.value.sslUse = toRaw(formState.value.sslUse)
      useSslExpansionPanel.value = formState.value.sslUse !== SSLUsage.No ? ['1'] : []
    }
  }
}

const addNewParam = () => {
  formState.value.extraParameters.push({ key: '', value: '' })
}

const removeParam = (index: number) => {
  formState.value.extraParameters.splice(index, 1)
}

const importURL = ref('')
const importURLDlg = ref(false)

const caFileInput = ref<HTMLInputElement>()
const keyFileInput = ref<HTMLInputElement>()
const certFileInput = ref<HTMLInputElement>()

const onFileSelect = (key: CertTypes, el?: HTMLInputElement) => {
  if (!el) return

  readFile(el, (content) => {
    if ('ssl' in formState.value.dataSource.connection && typeof formState.value.dataSource.connection.ssl === 'object')
      formState.value.dataSource.connection.ssl[key] = content ?? ''
    el.value = null
  })
}

const sslFilesRequired = computed(
  () => !!formState.value.sslUse && formState.value.sslUse !== SSLUsage.No && formState.value.sslUse !== SSLUsage.Allowed,
)

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

const createOrUpdateIntegration = async () => {
  // if it is edit mode and activeIntegration id is not present then return
  if (isEditMode.value && !activeIntegration.value?.id) return

  try {
    await validate()
  } catch (e) {
    focusInvalidInput()
    return
  }

  try {
    creatingSource.value = true

    const connection = getConnectionConfig()

    const config = { ...formState.value.dataSource, connection }

    if (!isEditMode.value) {
      await saveIntegration(
        {
          title: formState.value.title,
          type: IntegrationsType.Database,
          sub_type: formState.value.dataSource.client,
          config,
          is_private: formState.value.is_private,
        },
        'create',
        props.loadDatasourceInfo,
        props.baseId,
      )
    } else {
      await updateIntegration({
        id: activeIntegration.value.id,
        title: formState.value.title,
        type: IntegrationsType.Database,
        sub_type: formState.value.dataSource.client,
        config,
        is_private: formState.value.is_private,
      })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    creatingSource.value = false
  }
}

// apply fix to config
function applyConfigFix(fix: any) {
  if (!fix) return

  formState.value.dataSource = {
    ...formState.value.dataSource,
    ...fix,
    connection: {
      ...formState.value.dataSource.connection,
      ...fix.connection,
    },
  }
}

const testConnectionError = ref()

const testConnection = async (retry = 0, initialConfig = null) => {
  try {
    await validate()
  } catch (e) {
    if (e.errorFields?.length) {
      focusInvalidInput()
      return
    }
  }

  $e('a:source:create:extdb:test-connection', [])

  try {
    testingConnection.value = true

    if (formState.value.dataSource.client === ClientType.SQLITE) {
      testSuccess.value = true
      isEnabledSaveChangesBtn.value = true
    } else {
      const connection = getConnectionConfig()

      connection.database = getTestDatabaseName(formState.value.dataSource)!

      const testConnectionConfig = {
        ...formState.value.dataSource,
        connection,
      }

      const result = await api.utils.testConnection(testConnectionConfig)

      if (result.code === 0) {
        testSuccess.value = true
        isEnabledSaveChangesBtn.value = true
      } else {
        testSuccess.value = false

        message.error(`${t('msg.error.dbConnectionFailed')} ${result.message}`)
      }
    }
  } catch (e: any) {
    // take a copy of the current config
    const config = initialConfig || JSON.parse(JSON.stringify(formState.value.dataSource))
    await handleConnectionError(e, retry, config)
  } finally {
    testingConnection.value = false
  }
}

const MAX_CONNECTION_RETRIES = 3

async function handleConnectionError(e: any, retry: number, initialConfig: any): Promise<void> {
  if (retry >= MAX_CONNECTION_RETRIES) {
    testSuccess.value = false
    testConnectionError.value = await extractSdkResponseErrorMsg(e)
    // reset the connection config to initial state
    formState.value.dataSource = initialConfig
    return
  }

  const fix = generateConfigFix(e)

  if (fix) {
    applyConfigFix(fix)
    // Retry the connection after applying the fix
    return testConnection(retry + 1, initialConfig)
  }

  // If no fix is available, or fix did not resolve the issue
  testSuccess.value = false
  testConnectionError.value = await extractSdkResponseErrorMsg(e)
}

const handleImportURL = async () => {
  if (!importURL.value || importURL.value === '') return

  const connectionConfig = await api.utils.urlToConfig({ url: importURL.value })

  if (connectionConfig) {
    formState.value.dataSource.client = connectionConfig.client
    formState.value.dataSource.connection = {
      ...connectionConfig.connection,
    }

    // set filename only for sqlite connection
    if (connectionConfig.client === ClientType.SQLITE) {
      formState.value.dataSource.connection.connection = {
        filename: connectionConfig?.connection?.filename || '',
      }
    }
  } else {
    message.error(t('msg.error.invalidURL'))
  }
  importURLDlg.value = false
  updateSSLUse()
}

const customJsonFormState = computed({
  get: () => ({ ...formState.value }),
  set: (value) => {
    if (value && typeof value === 'object') {
      formState.value = { ...defaultFormState(), ...value }
    } else {
      formState.value = defaultFormState(formState.value?.dataSource?.client ? formState.value?.dataSource?.client : undefined)
    }
    updateSSLUse()
  },
})

function checkDifference() {
  const difference = diff(activeIntegrationformState.value, formState.value)

  if (typeof difference === 'object' && Object.keys(difference).length === 1 && difference?.title !== undefined) {
    return false
  }

  return true
}

const handleUpdateUseSslExpannsionPanel = (open: boolean) => {
  if (open) {
    useSslExpansionPanel.value = ['1']
  } else {
    useSslExpansionPanel.value = []
    // reset only on collapse use ssl panel
    formState.value.sslUse = SSLUsage.No
    onSSLModeChange(formState.value.sslUse, {})
  }
}

const handleUpdateAdvancedOptionsExpansionPanel = (open: boolean) => {
  if (open) {
    advancedOptionsExpansionPanel.value = ['1']
    handleAutoScroll(true, 'nc-connection-advanced-options')
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
      const el = document.querySelector(`.nc-edit-or-add-connection .${className}`)

      if (!el) return

      // wait for transition complete
      timer = setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 400)
    })
  }
}

const activeIntegrationIcon = computed(() => {
  const activeIntegrationType = isEditMode.value
    ? activeIntegration.value?.sub_type || activeIntegration.value?.config?.client
    : activeIntegration.value?.type

  return integrationsIconMap[activeIntegrationType]
})

const onFocusPassword = () => {
  if (maskedPassword.value) {
    formState.value.dataSource.connection.password = ''
    maskedPassword.value = false
  }
}

// reset test status on config change
watch(
  formState,
  () => {
    if (checkDifference()) {
      testSuccess.value = false
      testConnectionError.value = null

      isEnabledSaveChangesBtn.value = false
    } else {
      isEnabledSaveChangesBtn.value = true
    }
  },
  { deep: true },
)

// select and focus title field on load
onMounted(async () => {
  isLoading.value = true

  if (pageMode.value === IntegrationsPageMode.ADD) {
    formState.value.title = await generateUniqueName()
  } else {
    if (!activeIntegration.value) return

    const definedParameters = ['host', 'port', 'user', 'password', 'database']

    const tempParameters = Object.entries(activeIntegration.value.config.connection)
      .filter(([key]) => !definedParameters.includes(key))
      .map(([key, value]) => ({ key: key as string, value: value as string }))

    formState.value = {
      title: activeIntegration.value.title || '',
      dataSource: activeIntegration.value.config,
      extraParameters: tempParameters,
      sslUse: SSLUsage.No,
      is_private: activeIntegration.value?.is_private,
    }

    if (formState.value.dataSource?.connection?.password === null) {
      maskedPassword.value = true
      formState.value.dataSource.connection.password = '*'.repeat(8)
    }

    activeIntegrationformState.value = JSON.parse(JSON.stringify(formState.value))
    updateSSLUse(true)
  }

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

watch(
  connectionType,
  (v) => {
    formState.value.dataSource.client = v
    onClientChange()
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="activeIntegration" class="h-full">
    <div class="p-4 w-full flex items-center justify-between gap-3 border-b-1 border-gray-200">
      <div class="flex-1 flex items-center gap-3">
        <NcButton
          v-if="!isEditMode && !isFromIntegrationPage"
          type="text"
          size="small"
          @click="pageMode = IntegrationsPageMode.LIST"
        >
          <GeneralIcon icon="arrowLeft" />
        </NcButton>
        <div
          v-if="activeIntegrationIcon"
          class="h-8 w-8 flex items-center justify-center children:flex-none bg-gray-200 rounded-lg"
        >
          <component :is="activeIntegrationIcon" class="!stroke-transparent w-4 h-4" />
        </div>

        <div class="flex-1 text-base font-weight-700">{{ activeIntegration?.title }}</div>
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
            :disabled="isLoading || maskedPassword"
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
          :disabled="isDisabledSubmitBtn || isLoading"
          :loading="creatingSource"
          class="nc-extdb-btn-submit"
          @click="createOrUpdateIntegration"
        >
          {{ pageMode === IntegrationsPageMode.ADD ? 'Create connection' : 'Update connection' }}
        </NcButton>
        <NcButton size="small" type="text" @click="vOpen = false">
          <GeneralIcon icon="close" class="text-gray-600" />
        </NcButton>
      </div>
    </div>

    <div class="h-[calc(100%_-_66px)] flex">
      <div class="nc-edit-or-add-integration-left-panel nc-scrollbar-thin relative">
        <div class="w-full gap-8 max-w-[768px]">
          <div class="nc-edit-or-add-connection bg-white relative flex flex-col justify-center gap-2 w-full">
            <a-form
              ref="form"
              :model="formState"
              hide-required-mark
              name="external-base-create-form"
              layout="vertical"
              class="flex flex-col gap-8"
            >
              <div class="nc-form-section">
                <div class="nc-form-section-title">General</div>
                <div class="nc-form-section-body">
                  <a-row :gutter="24">
                    <a-col :span="12">
                      <a-form-item label="Connection name" v-bind="validateInfos.title">
                        <a-input v-model:value="formState.title" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </div>
              </div>

              <div class="nc-form-section">
                <div class="flex items-center justify-between">
                  <div class="nc-form-section-title">Connection details</div>

                  <!-- Use Connection URL -->
                  <NcDropdown
                    v-if="![ClientType.SQLITE, ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(formState.dataSource.client)"
                    v-model:visible="importURLDlg"
                    placement="bottomRight"
                  >
                    <NcButton
                      type="text"
                      size="small"
                      class="nc-extdb-btn-import-url !rounded-md !px-2 flex-none -my-1.5"
                      @click.stop="importURLDlg = true"
                    >
                      <div class="flex items-center gap-2">
                        <GeneralIcon icon="ncLink" class="flex-none" />
                        {{ $t('activity.useConnectionUrl') }}
                      </div>
                    </NcButton>
                    <template #overlay>
                      <div class="p-4 w-[448px] flex flex-col gap-3">
                        <div class="text-sm text-gray-700">
                          Auto populate connection configuration using database connection URL
                        </div>

                        <a-textarea
                          :ref="
                            (el) => {
                              el?.$el?.focus()
                            }
                          "
                          v-model:value="importURL"
                          class="!rounded-lg !min-h-[120px] !max-h-[250px] nc-scrollbar-thin"
                        ></a-textarea>

                        <div class="flex items-center gap-2 justify-end">
                          <NcButton
                            size="small"
                            type="secondary"
                            @click="
                              () => {
                                importURLDlg = false
                                importURL = ''
                              }
                            "
                          >
                            {{ $t('general.cancel') }}</NcButton
                          >
                          <NcButton size="small" @click="handleImportURL"> Import</NcButton>
                        </div>
                      </div>
                    </template>
                  </NcDropdown>
                </div>
                <div class="nc-form-section-body">
                  <a-row v-if="easterEgg" :gutter="24">
                    <a-col :span="12">
                      <a-form-item :label="$t('labels.dbType')" v-bind="validateInfos['dataSource.client']">
                        <NcSelect
                          v-model:value="formState.dataSource.client"
                          class="nc-select-shadow nc-extdb-db-type"
                          dropdown-class-name="nc-dropdown-ext-db-type"
                          @change="onClientChange"
                        >
                          <a-select-option v-for="client in clientTypes" :key="client.value" :value="client.value"
                            >{{ client.text }}
                          </a-select-option>
                        </NcSelect>
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <!-- SQLite File -->
                  <template v-if="formState.dataSource.client === ClientType.SQLITE">
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <a-form-item
                          :label="$t('labels.sqliteFile')"
                          v-bind="validateInfos['dataSource.connection.connection.filename']"
                        >
                          <a-input
                            v-model:value="(formState.dataSource.connection as SQLiteConnection).connection.filename"
                            placeholder="Enter absolute file path"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </template>
                  <template v-else-if="formState.dataSource.client === ClientType.SNOWFLAKE">
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <!-- Account -->
                        <a-form-item :label="$t('labels.account')" v-bind="validateInfos['dataSource.connection.account']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as SnowflakeConnection).account"
                            class="nc-extdb-host-address"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <!-- Username -->
                        <a-form-item :label="$t('labels.username')" v-bind="validateInfos['dataSource.connection.username']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as SnowflakeConnection).username"
                            class="nc-extdb-host-user"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <!-- Password -->
                        <a-form-item
                          :label="$t('labels.password')"
                          class="nc-form-item-connection-password"
                          v-bind="validateInfos['dataSource.connection.password']"
                        >
                          <template #help>
                            <div class="text-xs text-warning mt-1">{{ maskedPasswordHelp }}</div>
                          </template>
                          <a-input-password
                            v-model:value="(formState.dataSource.connection as SnowflakeConnection).password"
                            class="nc-extdb-host-password"
                            @focus="onFocusPassword"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <!-- Warehouse -->
                        <a-form-item label="Warehouse" v-bind="validateInfos['dataSource.connection.warehouse']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as SnowflakeConnection).warehouse"
                            class="nc-extdb-host-database"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <!-- Database -->
                        <a-form-item :label="$t('labels.database')" v-bind="validateInfos['dataSource.connection.database']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as SnowflakeConnection).database"
                            class="nc-extdb-host-database"
                            :placeholder="`${$t('labels.database')} ${$t('general.name').toLowerCase()}`"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
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
                        <a-form-item label="Token" v-bind="validateInfos['dataSource.connection.token']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as DatabricksConnection).token"
                            class="nc-extdb-host-token"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <a-form-item label="Host" v-bind="validateInfos['dataSource.connection.host']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as DatabricksConnection).host"
                            class="nc-extdb-host-address"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <a-form-item label="Path" v-bind="validateInfos['dataSource.connection.path']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as DatabricksConnection).path"
                            class="nc-extdb-host-path"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <a-form-item label="Database" v-bind="validateInfos['dataSource.connection.database']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as DatabricksConnection).database"
                            :placeholder="`${$t('labels.database')} ${$t('general.name').toLowerCase()}`"
                            class="nc-extdb-host-database"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
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
                        <!-- Host Address -->
                        <a-form-item :label="$t('labels.hostAddress')" v-bind="validateInfos['dataSource.connection.host']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as DefaultConnection).host"
                            class="nc-extdb-host-address"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <!-- Port Number -->
                        <a-form-item
                          :label="$t('labels.port')"
                          class="nc-form-item-connection-port"
                          v-bind="validateInfos['dataSource.connection.port']"
                        >
                          <a-input-number
                            v-model:value="(formState.dataSource.connection as DefaultConnection).port"
                            class="!w-full nc-extdb-host-port !rounded-md"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <!-- Username -->
                        <a-form-item :label="$t('labels.username')" v-bind="validateInfos['dataSource.connection.user']">
                          <a-input
                            v-model:value="(formState.dataSource.connection as DefaultConnection).user"
                            class="nc-extdb-host-user"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <!-- Password -->
                        <a-form-item :label="$t('labels.password')">
                          <template #help>
                            <div class="text-xs text-warning mt-1">{{ maskedPasswordHelp }}</div>
                          </template>
                          <a-input-password
                            v-model:value="(formState.dataSource.connection as DefaultConnection).password"
                            class="nc-extdb-host-password"
                            @focus="onFocusPassword"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <!-- Database -->
                        <a-form-item :label="$t('labels.database')" v-bind="validateInfos['dataSource.connection.database']">
                          <!-- Database : create if not exists -->
                          <a-input
                            v-model:value="formState.dataSource.connection.database"
                            :placeholder="`${$t('labels.database')} ${$t('general.name').toLowerCase()}`"
                            class="nc-extdb-host-database"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <!-- Schema name -->
                        <a-form-item
                          v-if="
                            [ClientType.MSSQL, ClientType.PG].includes(formState.dataSource.client) &&
                            formState.dataSource.searchPath
                          "
                          :label="$t('labels.schemaName')"
                          v-bind="validateInfos['dataSource.searchPath.0']"
                        >
                          <a-input v-model:value="formState.dataSource.searchPath[0]" />
                        </a-form-item>
                      </a-col>
                    </a-row>

                    <a-row
                      v-if="
                        ![ClientType.SQLITE, ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(formState.dataSource.client)
                      "
                      :gutter="24"
                    >
                      <a-col :span="24">
                        <!-- Extra connection parameters -->
                        <a-form-item
                          class="nc-form-extra-connectin-parameters mb-2"
                          label="Connection parameters"
                          v-bind="validateInfos.extraParameters"
                        >
                          <div class="flex flex-col gap-3">
                            <div v-for="(item, index) of formState.extraParameters" :key="index">
                              <a-row :gutter="24">
                                <a-col :span="12"><a-input v-model:value="item.key" placeholder="Key" /> </a-col>
                                <a-col :span="12">
                                  <div class="flex gap-2">
                                    <a-input v-model:value="item.value" placeholder="Value" />

                                    <NcButton type="text" size="small" @click="removeParam(index)">
                                      <GeneralIcon icon="delete" class="flex-none text-gray-500" />
                                    </NcButton>
                                  </div>
                                </a-col>
                              </a-row>
                            </div>

                            <div>
                              <NcButton size="small" type="secondary" class="" @click="addNewParam">
                                <div class="flex items-center">
                                  <GeneralIcon icon="plus" />
                                  Add
                                </div>
                              </NcButton>
                            </div>
                          </div>
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </template>
                </div>
              </div>

              <template
                v-if="![ClientType.SQLITE, ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(formState.dataSource.client)"
              >
                <NcDivider />

                <a-collapse v-model:active-key="useSslExpansionPanel" ghost class="!mt-4">
                  <template #expandIcon="{ isActive }">
                    <a-switch :checked="isActive" size="small" @change="handleUpdateUseSslExpannsionPanel($event)" />
                  </template>
                  <a-collapse-panel key="1" collapsible="disabled">
                    <template #header>
                      <div class="flex">
                        <div
                          class="nc-form-section-title cursor-pointer"
                          @click="handleUpdateUseSslExpannsionPanel(!useSslExpansionPanel.length)"
                        >
                          Use SSL
                        </div>
                      </div>
                    </template>

                    <div class="border-1 border-gray-200 rounded-lg p-3">
                      <a-row :gutter="24">
                        <a-col :span="12">
                          <a-form-item label="SSL mode">
                            <NcSelect
                              v-model:value="formState.sslUse"
                              class="nc-select-shadow"
                              dropdown-class-name="nc-dropdown-ssl-mode"
                              @select="onSSLModeChange"
                            >
                              <a-select-option v-for="opt in Object.values(SSLUsage)" :key="opt" :value="opt">
                                <div class="w-full flex gap-2 items-center">
                                  <div class="flex-1">
                                    {{ opt }}
                                  </div>

                                  <component
                                    :is="iconMap.check"
                                    v-if="formState.sslUse === opt"
                                    id="nc-selected-item-icon"
                                    class="text-primary w-4 h-4"
                                  />
                                </div>
                              </a-select-option>
                            </NcSelect>
                          </a-form-item>
                        </a-col>
                      </a-row>

                      <a-row :gutter="24">
                        <a-col :span="24">
                          <a-form-item
                            v-if="formState.sslUse && ![SSLUsage.No, SSLUsage.Allowed].includes(formState.sslUse)"
                            label="SSL keys"
                            class="!mt-3"
                          >
                            <div class="flex gap-2 w-full">
                              <NcTooltip placement="top">
                                <!-- Select .cert file -->
                                <template #title>
                                  <span>{{ $t('tooltip.clientCert') }}</span>
                                </template>

                                <NcButton
                                  size="small"
                                  type="secondary"
                                  :disabled="!sslFilesRequired"
                                  class="shadow !w-[90px]"
                                  @click="certFileInput?.click()"
                                >
                                  {{ $t('labels.clientCert') }}
                                </NcButton>
                              </NcTooltip>

                              <NcTooltip placement="top">
                                <!-- Select .key file -->
                                <template #title>
                                  <span>{{ $t('tooltip.clientKey') }}</span>
                                </template>
                                <NcButton
                                  size="small"
                                  type="secondary"
                                  :disabled="!sslFilesRequired"
                                  class="shadow !w-[90px]"
                                  @click="keyFileInput?.click()"
                                >
                                  {{ $t('labels.clientKey') }}
                                </NcButton>
                              </NcTooltip>

                              <NcTooltip placement="top">
                                <!-- Select CA file -->
                                <template #title>
                                  <span>{{ $t('tooltip.clientCA') }}</span>
                                </template>

                                <NcButton
                                  size="small"
                                  type="secondary"
                                  :disabled="!sslFilesRequired"
                                  class="shadow !w-[90px]"
                                  @click="caFileInput?.click()"
                                >
                                  {{ $t('labels.serverCA') }}
                                </NcButton>
                              </NcTooltip>
                            </div>
                          </a-form-item>
                        </a-col>
                      </a-row>

                      <input
                        ref="caFileInput"
                        type="file"
                        class="!hidden"
                        accept=".ca"
                        @change="onFileSelect(CertTypes.ca, caFileInput)"
                      />

                      <input
                        ref="certFileInput"
                        type="file"
                        class="!hidden"
                        accept=".cert"
                        @change="onFileSelect(CertTypes.cert, certFileInput)"
                      />

                      <input
                        ref="keyFileInput"
                        type="file"
                        class="!hidden"
                        accept=".key"
                        @change="onFileSelect(CertTypes.key, keyFileInput)"
                      />
                    </div>
                  </a-collapse-panel>
                </a-collapse>
              </template>

              <!-- Todo: Enable later when we plan to introduce private connection -->
              <!-- <div class="nc-form-section">
                <a-form-item class="!my-0">
                  <div class="flex items-center gap-3">
                    <a-switch v-if="isEeUI" v-model:checked="formState.is_private" size="small" />
                    <NcTooltip v-else>
                      <template #title>
                        <div class="text-center">
                          {{ $t('msg.info.thisFeatureIsOnlyAvailableInEnterpriseEdition') }}
                        </div>
                      </template>

                      <a-switch :checked="formState.is_private" disabled size="small" />
                    </NcTooltip>

                    <NcTooltip placement="right" class="cursor-pointer">
                      <template #title>
                        {{ $t('tooltip.privateConnection') }}
                      </template>

                      <div
                        class="nc-form-section-title"
                        @click="isEeUI ? (formState.is_private = !formState.is_private) : undefined"
                      >
                        Private connection
                      </div>
                    </NcTooltip>
                  </div>
                </a-form-item>
              </div> -->

              <template
                v-if="![ClientType.SQLITE, ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(formState.dataSource.client)"
              >
                <a-collapse v-model:active-key="advancedOptionsExpansionPanel" ghost class="nc-connection-advanced-options !mt-4">
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

                    <div class="flex flex-col gap-2">
                      <div>Edit Connection JSON</div>
                      <div class="border-1 border-gray-200 !rounded-lg shadow-sm overflow-hidden">
                        <MonacoEditor v-model="customJsonFormState" class="nc-connection-json-editor h-[400px] w-full" />
                      </div>
                    </div>
                  </a-collapse-panel>
                </a-collapse>
              </template>
            </a-form>

            <div class="mt-10"></div>
          </div>
        </div>
        <general-overlay :model-value="isLoading" inline transition class="!bg-opacity-15">
          <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
            <a-spin size="large" />
          </div>
        </general-overlay>
      </div>
      <div class="nc-edit-or-add-integration-right-panel">
        <template v-if="isEeUI">
          <DashboardSettingsDataSourcesInfo varient="new" />
          <NcDivider />
        </template>
        <WorkspaceIntegrationsSupportedDocs />
        <NcDivider />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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

.nc-edit-or-add-connection {
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

<style lang="scss"></style>
