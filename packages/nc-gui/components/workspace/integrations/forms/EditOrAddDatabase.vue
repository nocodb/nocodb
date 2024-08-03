<script lang="ts" setup>
import { Form, message } from 'ant-design-vue'
import type { SelectHandler } from 'ant-design-vue/es/vc-select/Select'
import type { Card as AntCard } from 'ant-design-vue'
import { IntegrationsType } from 'nocodb-sdk'
import {
  type CertTypes,
  ClientType,
  type DatabricksConnection,
  type DefaultConnection,
  JobStatus,
  type ProjectCreateForm,
  type SQLiteConnection,
  SSLUsage,
  type SnowflakeConnection,
  clientTypes as _clientTypes,
} from '#imports'

const props = defineProps<{ open: boolean; connectionType?: ClientType }>()

const emit = defineEmits(['update:open', 'sourceCreated'])

const vOpen = useVModel(props, 'open', emit)

const connectionType = computed(() => props.connectionType ?? ClientType.MYSQL)

const { pageMode, IntegrationsPageMode, activeIntegration, saveIntegration, updateIntegration } = useIntegrationStore()

const isEditMode = computed(() => pageMode.value === IntegrationsPageMode.EDIT)

const useForm = Form.useForm

const testSuccess = ref(false)

const testingConnection = ref(false)

const form = ref<typeof Form>()

const { api } = useApi()

const { $e } = useNuxtApp()

const { t } = useI18n()

const creatingSource = ref(false)

const step = ref(1)

const progressQueue = ref<Record<string, any>[]>([])

const progress = ref<Record<string, any>[]>([])

const logRef = ref<typeof AntCard>()

const _pushProgress = async () => {
  if (progressQueue.value.length) {
    if (!creatingSource.value) {
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

const defaultFormState = () => {
  return {
    title: '',
    dataSource: { ...getDefaultConnectionConfig(ClientType.MYSQL) },
    sslUse: SSLUsage.No,
    extraParameters: [],
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
    'dataSource.connection.database': [fieldRequiredValidator()],
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
        message: 'Integration name is required',
      },
      baseTitleValidator('integration'),
    ],
    'extraParameters': [extraParameterValidator],
    'dataSource.client': [fieldRequiredValidator()],
    ...clientValidations,
  }
})

const { validate, validateInfos } = useForm(formState, validators)

const populateName = (v: string) => {
  formState.value.dataSource.connection.database = `${v.trim()}_noco`
}

const onClientChange = () => {
  formState.value.dataSource = { ...getDefaultConnectionConfig(formState.value.dataSource.client) }
  populateName(formState.value.title)
}

const onSSLModeChange = ((mode: SSLUsage) => {
  if (formState.value.dataSource.client !== ClientType.SQLITE) {
    const connection = formState.value.dataSource.connection as DefaultConnection
    switch (mode) {
      case SSLUsage.No:
        delete connection.ssl
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
  const extraParameters = Object.fromEntries(new Map(formState.value.extraParameters.map((object) => [object.key, object.value])))

  const connection = {
    ...formState.value.dataSource.connection,
    ...extraParameters,
  }

  if ('ssl' in connection && connection.ssl) {
    if (
      formState.value.sslUse === SSLUsage.No ||
      (typeof connection.ssl === 'object' && Object.values(connection.ssl).every((v) => v === null || v === undefined))
    ) {
      delete connection.ssl
    }
  }
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
      await saveIntegration({
        title: formState.value.title,
        type: IntegrationsType.Database,
        sub_type: formState.value.dataSource.client,
        config,
        is_private: formState.value.is_private,
      })
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
    creatingSource.value = false
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

      const testConnectionConfig = {
        ...formState.value.dataSource,
        connection,
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

const handleImportURL = async () => {
  if (!importURL.value || importURL.value === '') return

  const connectionConfig = await api.utils.urlToConfig({ url: importURL.value })

  if (connectionConfig) {
    formState.value.dataSource.client = connectionConfig.client
    formState.value.dataSource.connection = {
      ...connectionConfig.connection,
      connection: {
        filename: connectionConfig?.connection?.filename || '',
      },
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
      formState.value = defaultFormState()
    }
    updateSSLUse()
  },
})

// reset test status on config change
watch(
  () => formState.value.dataSource,
  () => {
    testSuccess.value = false
    testConnectionError.value = null
  },
  { deep: true },
)

// populate database name based on title
watch(
  () => formState.value.title,
  (v) => populateName(v),
)

// select and focus title field on load
onMounted(async () => {
  if (pageMode.value === IntegrationsPageMode.ADD) {
    formState.value.title = await generateUniqueName()
  } else {
    const definedParameters = ['host', 'port', 'user', 'password', 'database']

    const tempParameters = Object.entries(activeIntegration.value.config.connection)
      .filter(([key]) => !definedParameters.includes(key))
      .map(([key, value]) => ({ key: key as string, value: value as string }))

    formState.value = {
      title: activeIntegration.value.title || '',
      dataSource: activeIntegration.value.config,
      extraParameters: tempParameters,
      sslUse: SSLUsage.No,
      is_private: activeIntegration.value.is_private,
    }
    updateSSLUse()
  }

  nextTick(() => {
    // todo: replace setTimeout and follow better approach
    setTimeout(() => {
      const input = form.value?.$el?.querySelector('input[type=text]')
      input?.setSelectionRange(0, formState.value.title.length)
      input?.focus()
    }, 500)
  })
})

watch(
  connectionType,
  (v) => {
    formState.value.dataSource.client = v
    onClientChange()
  },
  { immediate: true },
)

const refreshState = async (keepForm = false) => {
  if (!keepForm) {
    formState.value = {
      title: await generateUniqueName(),
      dataSource: { ...getDefaultConnectionConfig(ClientType.MYSQL) },
      sslUse: SSLUsage.No,
      extraParameters: [],
    }
  }
  testSuccess.value = false
  testConnectionError.value = null
  goBack.value = false
  creatingSource.value = false
  goToDashboard.value = false
  testingConnection.value = false
  progressQueue.value = []
  progress.value = []
  step.value = 1
}

const onDashboard = () => {
  refreshState()
  vOpen.value = false
}

const useCaseFormState = ref({})

const onUseCaseFormSubmit = async () => {
  $e('a:extdb:usecase', useCaseFormState.value)
  return onDashboard()
}

const allowAccess = computed({
  get: () => !formState.value.is_private,
  set: (v) => {
    formState.value.is_private = !v
  },
})
</script>

<template>
  <div class="h-full">
    <div class="p-4 w-full flex items-center justify-between gap-3 border-b-1 border-gray-200">
      <div class="flex-1 flex items-center gap-3">
        <NcButton v-if="!isEditMode" type="text" size="small" @click="pageMode = IntegrationsPageMode.LIST">
          <GeneralIcon icon="arrowLeft" />
        </NcButton>
        <WorkspaceIntegrationsIcon
          :integration-type="
            isEditMode ? activeIntegration?.sub_type || activeIntegration?.config?.client : activeIntegration.type
          "
          size="xs"
        />
        <div class="flex-1 text-sm font-weight-700">Configure {{ activeIntegration.title }}</div>
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
            class="nc-extdb-btn-test-connection !rounded-md"
            :class="{ 'pointer-events-none': testSuccess }"
            :loading="testingConnection"
            icon-position="right"
            @click="testConnection"
          >
            <template #icon>
              <GeneralIcon v-if="testSuccess" icon="circleCheck2" class="!text-green-500 w-4 h-4" />
              <GeneralIcon v-else-if="testConnectionError" icon="info" class="!text-red-500 w-4 h-4" />
            </template>

            <span>
              {{ testSuccess ? 'Test successful' : 'Test connection' }}
            </span>
          </NcButton>
        </NcTooltip>

        <NcButton
          size="small"
          type="primary"
          :disabled="!testSuccess"
          :loading="creatingSource"
          class="nc-extdb-btn-submit !rounded-md"
          @click="createOrUpdateIntegration"
        >
          {{ pageMode === IntegrationsPageMode.ADD ? 'Add integration' : 'Edit integration' }}
        </NcButton>
      </div>
    </div>

    <div class="h-[calc(80vh_-_66px)] flex">
      <div class="nc-edit-or-add-integration-left-panel nc-scrollbar-thin">
        <div class="w-full gap-8 max-w-[768px]">
          <div class="create-source bg-white relative flex flex-col justify-center gap-2 w-full">
            <template v-if="step === 1">
              <a-form
                ref="form"
                :model="formState"
                hide-required-mark
                name="external-base-create-form"
                layout="vertical"
                class="flex flex-col gap-5.5"
              >
                <div class="nc-form-section">
                  <div class="nc-form-section-title">General</div>
                  <div class="nc-form-section-body">
                    <a-row :gutter="24">
                      <a-col :span="12">
                        <a-form-item label="Integration name" v-bind="validateInfos.title">
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
                      v-if="
                        ![ClientType.SQLITE, ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(formState.dataSource.client)
                      "
                      v-model:visible="importURLDlg"
                      placement="bottomRight"
                    >
                      <NcButton
                        type="text"
                        size="xsmall"
                        class="nc-extdb-btn-import-url !rounded-md !h-6 !px-2 flex-none"
                        @click.stop="importURLDlg = true"
                      >
                        <div class="flex items-center gap-2">
                          <GeneralIcon icon="magic" class="flex-none text-yellow-500" />
                          {{ $t('activity.useConnectionUrl') }}
                        </div>
                      </NcButton>
                      <template #overlay>
                        <div class="p-4 w-[448px] flex flex-col gap-3">
                          <div class="text-sm text-gray-700">
                            Auto populate connection configuration using database connection URL
                          </div>
                          <a-textarea
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
                    <a-row :gutter="24" v-if="easterEgg">
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
                            <a-input v-model:value="(formState.dataSource.connection as SQLiteConnection).connection.filename" />
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
                          <a-form-item :label="$t('labels.password')" class="nc-form-item-connection-password" v-bind="validateInfos['dataSource.connection.password']">
                            <a-input-password
                              v-model:value="(formState.dataSource.connection as SnowflakeConnection).password"
                              class="nc-extdb-host-password"
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
                          <a-form-item :label="$t('labels.port')" class="nc-form-item-connection-port" v-bind="validateInfos['dataSource.connection.port']">
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
                            <a-input-password
                              v-model:value="(formState.dataSource.connection as DefaultConnection).password"
                              class="nc-extdb-host-password"
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
                              :placeholder="$t('labels.dbCreateIfNotExists')"
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
                        :gutter="24"
                        v-if="
                          ![ClientType.SQLITE, ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(formState.dataSource.client)
                        "
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
                                        <GeneralIcon icon="delete" class="flex-none" />
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

                  <a-collapse ghost class="!mt-4">
                    <template #expandIcon="{ isActive }">
                      <a-switch :checked="isActive" size="small" class="!mt-1" />
                    </template>
                    <a-collapse-panel key="1">
                      <template #header>
                        <div class="flex">
                          <div class="nc-form-section-title">Use SSL</div>
                        </div>
                      </template>

                      <a-row :gutter="24">
                        <a-col :span="12">
                          <a-form-item label="SSL mode">
                            <NcSelect
                              v-model:value="formState.sslUse"
                              class="nc-select-shadow"
                              dropdown-class-name="nc-dropdown-ssl-mode"
                              @select="onSSLModeChange"
                            >
                              <a-select-option v-for="opt in Object.values(SSLUsage)" :key="opt" :value="opt"
                                >{{ opt }}
                              </a-select-option>
                            </NcSelect>
                          </a-form-item>
                        </a-col>
                      </a-row>

                      <a-form-item
                        v-if="formState.sslUse && ![SSLUsage.No, SSLUsage.Allowed].includes(formState.sslUse)"
                        label="SSL keys"
                      >
                        <div class="flex gap-2">
                          <a-tooltip placement="top">
                            <!-- Select .cert file -->
                            <template #title>
                              <span>{{ $t('tooltip.clientCert') }}</span>
                            </template>

                            <NcButton size="small" :disabled="!sslFilesRequired" class="shadow" @click="certFileInput?.click()">
                              {{ $t('labels.clientCert') }}
                            </NcButton>
                          </a-tooltip>

                          <a-tooltip placement="top">
                            <!-- Select .key file -->
                            <template #title>
                              <span>{{ $t('tooltip.clientKey') }}</span>
                            </template>
                            <NcButton size="small" :disabled="!sslFilesRequired" class="shadow" @click="keyFileInput?.click()">
                              {{ $t('labels.clientKey') }}
                            </NcButton>
                          </a-tooltip>

                          <a-tooltip placement="top">
                            <!-- Select CA file -->
                            <template #title>
                              <span>{{ $t('tooltip.clientCA') }}</span>
                            </template>

                            <NcButton size="small" :disabled="!sslFilesRequired" class="shadow" @click="caFileInput?.click()">
                              {{ $t('labels.serverCA') }}
                            </NcButton>
                          </a-tooltip>
                        </div>
                      </a-form-item>

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
                    </a-collapse-panel>
                  </a-collapse>
                </template>

                <div class="nc-form-section">
                  <a-form-item class="!my-0">
                    <div class="flex items-center gap-3">
                      <a-switch v-if="isEeUI" v-model:checked="allowAccess" size="small" />
                      <NcTooltip v-else>
                        <template #title>
                          <div class="text-center">
                            {{ $t('msg.info.thisFeatureIsOnlyAvailableInEnterpriseEdition') }}
                          </div>
                        </template>

                        <a-switch :checked="allowAccess" disabled size="small" />
                      </NcTooltip>

                      <NcTooltip placement="right" class="cursor-pointer">
                        <template #title>
                          {{ $t('tooltip.allowIntegrationAccess') }}
                        </template>

                        <div @click="isEeUI ? (allowAccess = !allowAccess) : undefined" class="nc-form-section-title">
                          Share Integration
                        </div>
                      </NcTooltip>
                    </div>
                  </a-form-item>
                </div>

                <template
                  v-if="![ClientType.SQLITE, ClientType.SNOWFLAKE, ClientType.DATABRICKS].includes(formState.dataSource.client)"
                >
                  <a-collapse ghost expand-icon-position="right" class="!mt-4">
                    <template #expandIcon="{ isActive }">
                      <NcButton type="text" size="xsmall">
                        <GeneralIcon
                          icon="chevronDown"
                          class="flex-none cursor-pointer transform transition-transform duration-500"
                          :class="{ '!rotate-180': isActive }"
                        />
                      </NcButton>
                    </template>
                    <a-collapse-panel key="1">
                      <template #header>
                        <div class="flex">
                          <div class="nc-form-section-title">Advanced options</div>
                        </div>
                      </template>

                      <div class="flex flex-col gap-6">
                        <div>Connection JSON</div>
                        <div class="border-1 border-gray-200 !rounded-lg shadow-sm overflow-hidden">
                          <MonacoEditor v-model="customJsonFormState" class="nc-connection-json-editor h-[400px] w-full" />
                        </div>
                      </div>
                    </a-collapse-panel>
                  </a-collapse>
                </template>
              </a-form>

              <div class="mt-10"></div>
            </template>
            <template v-else>
              <!--         Inferring schema from your data source -->
              <div class="mb-4 prose-xl font-bold">Inferring schema from your data source</div>

              <a-card
                ref="logRef"
                :body-style="{ backgroundColor: '#000000', height: goToDashboard ? '200px' : '400px', overflow: 'auto' }"
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

              <div v-if="goToDashboard">
                <a-form :model="useCaseFormState" name="useCase" autocomplete="off" @finish="onUseCaseFormSubmit">
                  <div class="text-center text-lg mb-2 mt-4 font-weight-bold">Your usecase? And role of NocoDB?</div>
                  <a-form-item
                    name="useCase"
                    :rules="[
                      { required: true, message: 'Please input the use case and role of NocoDB' },
                      { min: 50, message: 'Please input minimum 50 characters' },
                    ]"
                  >
                    <a-textarea
                      v-model:value="useCaseFormState.useCase"
                      :rows="4"
                      placeholder="Eg : We are a car driving school company and will use NocoDB as admin for DB management"
                      :minlength="50"
                    />
                  </a-form-item>
                  <div class="flex justify-center">
                    <nc-button html-type="submit" class="mt-2" size="middle"> 🚀 Submit & Go to Dashboard 🚀 </nc-button>
                  </div>
                </a-form>
              </div>
              <div v-else-if="goBack" class="flex justify-center items-center">
                <a-button class="mt-4" size="large" @click="onBack">Go Back</a-button>
              </div>
            </template>
          </div>
        </div>
      </div>
      <div class="nc-edit-or-add-integration-right-panel">
        <DashboardSettingsDataSourcesInfo varient="new" />
        <NcDivider v-if="isEeUI" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-collapse-header) {
  @apply !-mt-4 !p-0 flex items-center;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-6;
}

:deep(.ant-form-item-explain-error) {
  @apply !text-xs;
}

:deep(.ant-form-item) {
  @apply mb-2;
}

:deep(.ant-form-item-with-help .ant-form-item-explain) {
  @apply !min-h-0;
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
    @apply flex flex-col gap-4;
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
      .ant-input-affix-wrapper.ant-input-password  {
        &:not(:hover):not(:focus-within):not(:disabled) {
          @apply shadow-default;
        }
        &:hover:not(:focus-within):not(:disabled) {
          @apply  shadow-hover;
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
      .ant-input-affix-wrapper.ant-input-password  {
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

  :deep(.ant-row){
    @apply !-mx-1.5;
    .ant-col{
      @apply !px-1.5;
    }
  }
  }
}
</style>

<style lang="scss"></style>
