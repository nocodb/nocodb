<script lang="ts" setup>
import { Form, message } from 'ant-design-vue'
import type { SelectHandler } from 'ant-design-vue/es/vc-select/Select'
import type { DefaultConnection, ProjectCreateForm, SQLiteConnection } from '#imports'
import {
  CertTypes,
  ClientType,
  ProjectIdInj,
  SSLUsage,
  clientTypes as _clientTypes,
  computed,
  extractSdkResponseErrorMsg,
  fieldRequiredValidator,
  generateUniqueName,
  getDefaultConnectionConfig,
  getTestDatabaseName,
  iconMap,
  nextTick,
  onMounted,
  projectTitleValidator,
  readFile,
  ref,
  storeToRefs,
  useApi,
  useI18n,
  useNuxtApp,
  watch,
} from '#imports'

const { connectionType } = defineProps<{ connectionType: ClientType }>()

const emit = defineEmits(['baseCreated', 'close'])

const projectStore = useProject()
const { loadProject } = useProjects()
const { project } = storeToRefs(projectStore)

const { loadProjectTables } = useTablesStore()

const _projectId = inject(ProjectIdInj, undefined)
const projectId = computed(() => _projectId?.value ?? project.value?.id)

const useForm = Form.useForm

const testSuccess = ref(false)

const form = ref<typeof Form>()

const { api } = useApi()

const { $e } = useNuxtApp()

const { t } = useI18n()

const formState = ref<ProjectCreateForm>({
  title: '',
  dataSource: { ...getDefaultConnectionConfig(ClientType.MYSQL) },
  inflection: {
    inflectionColumn: 'camelize',
    inflectionTable: 'camelize',
  },
  sslUse: SSLUsage.No,
  extraParameters: [],
})

const customFormState = ref<ProjectCreateForm>({
  title: '',
  dataSource: { ...getDefaultConnectionConfig(ClientType.MYSQL) },
  inflection: {
    inflectionColumn: 'camelize',
    inflectionTable: 'camelize',
  },
  sslUse: SSLUsage.No,
  extraParameters: [],
})

const clientTypes = computed(() => {
  return _clientTypes.filter((type) => {
    // return appInfo.value?.ee || type.value !== ClientType.SNOWFLAKE
    return type.value !== ClientType.SNOWFLAKE
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
    case ClientType.PG:
    case ClientType.MSSQL:
      clientValidations['dataSource.searchPath.0'] = [fieldRequiredValidator()]
      break
  }

  return {
    'title': [
      {
        required: true,
        message: 'Base name is required',
      },
      projectTitleValidator,
    ],
    'extraParameters': [extraParameterValidator],
    'dataSource.client': [fieldRequiredValidator()],
    ...clientValidations,
  }
})

const { validate, validateInfos } = useForm(formState.value, validators)

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

const inflectionTypes = ['camelize', 'none']
const importURL = ref('')
const configEditDlg = ref(false)
const importURLDlg = ref(false)

const caFileInput = ref<HTMLInputElement>()
const keyFileInput = ref<HTMLInputElement>()
const certFileInput = ref<HTMLInputElement>()

const onFileSelect = (key: CertTypes, el?: HTMLInputElement) => {
  if (!el) return

  readFile(el, (content) => {
    if ('ssl' in formState.value.dataSource.connection && typeof formState.value.dataSource.connection.ssl === 'object')
      formState.value.dataSource.connection.ssl[key] = content ?? ''
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
const isConnSuccess = ref(false)

const createBase = async () => {
  try {
    await validate()
    isConnSuccess.value = false
  } catch (e) {
    focusInvalidInput()
    isConnSuccess.value = false
    return
  }

  try {
    if (!projectId.value) return

    const connection = getConnectionConfig()

    const config = { ...formState.value.dataSource, connection }

    await api.base.create(projectId.value, {
      alias: formState.value.title,
      type: formState.value.dataSource.client,
      config,
      inflection_column: formState.value.inflection.inflectionColumn,
      inflection_table: formState.value.inflection.inflectionTable,
    })

    $e('a:base:create:extdb')

    await loadProject(projectId.value, true)
    await loadProjectTables(projectId.value, true)
    emit('baseCreated')
    emit('close')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const testConnection = async () => {
  try {
    await validate()
  } catch (e) {
    focusInvalidInput()
    return
  }

  $e('a:base:create:extdb:test-connection', [])

  try {
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
        isConnSuccess.value = true
      } else {
        testSuccess.value = false

        message.error(`${t('msg.error.dbConnectionFailed')} ${result.message}`)
      }
    }
  } catch (e: any) {
    testSuccess.value = false

    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const handleImportURL = async () => {
  if (!importURL.value || importURL.value === '') return

  const connectionConfig = await api.utils.urlToConfig({ url: importURL.value })

  if (connectionConfig) {
    formState.value.dataSource.client = connectionConfig.client
    formState.value.dataSource.connection = { ...connectionConfig.connection }
  } else {
    message.error(t('msg.error.invalidURL'))
  }
  importURLDlg.value = false
  updateSSLUse()
}

const handleEditJSON = () => {
  customFormState.value = { ...formState.value }
  configEditDlg.value = true
}

const handleOk = () => {
  formState.value = { ...customFormState.value }
  configEditDlg.value = false
  updateSSLUse()
}

// reset test status on config change
watch(
  () => formState.value.dataSource,
  () => (testSuccess.value = false),
  { deep: true },
)

// populate database name based on title
watch(
  () => formState.value.title,
  (v) => populateName(v),
)

// select and focus title field on load
onMounted(async () => {
  formState.value.title = await generateUniqueName()
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
  () => connectionType,
  (v) => {
    formState.value.dataSource.client = v
    onClientChange()
  },
  { immediate: true },
)
</script>

<template>
  <GeneralModal v-model:visible="isConnSuccess" class="!w-[25rem]">
    <div class="flex flex-col h-full p-8">
      <div class="text-lg font-semibold self-start mb-4">{{ t('msg.info.dbConnected') }}</div>
      <div class="flex gap-x-2 mt-5 ml-7 pt-2.5 justify-end">
        <NcButton key="back" type="secondary" @click="isConnSuccess = false">{{ $t('general.cancel') }}</NcButton>
        <NcButton key="submit" type="primary" @click="createBase">Ok & Add Base</NcButton>
      </div>
    </div>
  </GeneralModal>
  <div class="create-base bg-white relative flex flex-col justify-center gap-2 w-full">
    <h1 class="prose-2xl font-bold self-start mb-4 flex items-center gap-2">
      New Base
      <DashboardSettingsDataSourcesInfo />
      <span class="flex-grow"></span>
    </h1>

    <a-form
      ref="form"
      :model="formState"
      name="external-project-create-form"
      layout="horizontal"
      no-style
      :label-col="{ span: 8 }"
    >
      <div
        class="nc-scrollbar-md"
        :style="{
          maxHeight: '60vh',
        }"
      >
        <a-form-item label="Base Name" v-bind="validateInfos.title">
          <a-input v-model:value="formState.title" class="nc-extdb-proj-name" />
        </a-form-item>

        <a-form-item :label="$t('labels.dbType')" v-bind="validateInfos['dataSource.client']">
          <a-select
            v-model:value="formState.dataSource.client"
            class="nc-extdb-db-type"
            dropdown-class-name="nc-dropdown-ext-db-type"
            @change="onClientChange"
          >
            <a-select-option v-for="client in clientTypes" :key="client.value" :value="client.value"
              >{{ client.text }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <!-- SQLite File -->
        <a-form-item
          v-if="formState.dataSource.client === ClientType.SQLITE"
          :label="$t('labels.sqliteFile')"
          v-bind="validateInfos['dataSource.connection.connection.filename']"
        >
          <a-input v-model:value="(formState.dataSource.connection as SQLiteConnection).connection.filename" />
        </a-form-item>

        <template v-else>
          <!-- Host Address -->
          <a-form-item :label="$t('labels.hostAddress')" v-bind="validateInfos['dataSource.connection.host']">
            <a-input v-model:value="(formState.dataSource.connection as DefaultConnection).host" class="nc-extdb-host-address" />
          </a-form-item>

          <!-- Port Number -->
          <a-form-item :label="$t('labels.port')" v-bind="validateInfos['dataSource.connection.port']">
            <a-input-number
              v-model:value="(formState.dataSource.connection as DefaultConnection).port"
              class="!w-full nc-extdb-host-port"
            />
          </a-form-item>

          <!-- Username -->
          <a-form-item :label="$t('labels.username')" v-bind="validateInfos['dataSource.connection.user']">
            <a-input v-model:value="(formState.dataSource.connection as DefaultConnection).user" class="nc-extdb-host-user" />
          </a-form-item>

          <!-- Password -->
          <a-form-item :label="$t('labels.password')">
            <a-input-password
              v-model:value="(formState.dataSource.connection as DefaultConnection).password"
              class="nc-extdb-host-password"
            />
          </a-form-item>

          <!-- Database -->
          <a-form-item :label="$t('labels.database')" v-bind="validateInfos['dataSource.connection.database']">
            <!-- Database : create if not exists -->
            <a-input
              v-model:value="formState.dataSource.connection.database"
              :placeholder="$t('labels.dbCreateIfNotExists')"
              class="nc-extdb-host-database"
            />
          </a-form-item>

          <!-- Schema name -->
          <a-form-item
            v-if="[ClientType.MSSQL, ClientType.PG].includes(formState.dataSource.client) && formState.dataSource.searchPath"
            :label="$t('labels.schemaName')"
            v-bind="validateInfos['dataSource.searchPath.0']"
          >
            <a-input v-model:value="formState.dataSource.searchPath[0]" />
          </a-form-item>
          <div class="flex items-right justify-end gap-2">
            <!--                Use Connection URL -->
            <NcButton size="small" class="nc-extdb-btn-import-url !rounded-md" @click.stop="importURLDlg = true">
              {{ $t('activity.useConnectionUrl') }}
            </NcButton>
          </div>

          <a-collapse ghost expand-icon-position="right" class="!mt-6">
            <a-collapse-panel key="1">
              <template #header>
                <span>{{ $t('title.advancedParameters') }}</span>
              </template>
              <a-form-item label="SSL mode">
                <a-select v-model:value="formState.sslUse" dropdown-class-name="nc-dropdown-ssl-mode" @select="onSSLModeChange">
                  <a-select-option v-for="opt in Object.values(SSLUsage)" :key="opt" :value="opt">{{ opt }} </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="SSL keys">
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

              <input ref="caFileInput" type="file" class="!hidden" @change="onFileSelect(CertTypes.ca, caFileInput)" />

              <input ref="certFileInput" type="file" class="!hidden" @change="onFileSelect(CertTypes.cert, certFileInput)" />

              <input ref="keyFileInput" type="file" class="!hidden" @change="onFileSelect(CertTypes.key, keyFileInput)" />

              <a-divider />

              <!--            Extra connection parameters -->
              <a-form-item class="mb-2" :label="$t('labels.extraConnectionParameters')" v-bind="validateInfos.extraParameters">
                <a-card>
                  <div v-for="(item, index) of formState.extraParameters" :key="index">
                    <div class="flex py-1 items-center gap-1">
                      <a-input v-model:value="item.key" />

                      <span>:</span>

                      <a-input v-model:value="item.value" />

                      <component
                        :is="iconMap.close"
                        :style="{ 'font-size': '1.5em', 'color': 'red' }"
                        @click="removeParam(index)"
                      />
                    </div>
                  </div>
                  <NcButton size="small" type="dashed" class="w-full caption mt-2" @click="addNewParam">
                    <div class="flex items-center justify-center">
                      <component :is="iconMap.plus" />
                    </div>
                  </NcButton>
                </a-card>
              </a-form-item>

              <a-divider />

              <a-form-item :label="$t('labels.inflection.tableName')">
                <a-select
                  v-model:value="formState.inflection.inflectionTable"
                  dropdown-class-name="nc-dropdown-inflection-table-name"
                >
                  <a-select-option v-for="type in inflectionTypes" :key="type" :value="type">{{ type }} </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item :label="$t('labels.inflection.columnName')">
                <a-select
                  v-model:value="formState.inflection.inflectionColumn"
                  dropdown-class-name="nc-dropdown-inflection-column-name"
                >
                  <a-select-option v-for="type in inflectionTypes" :key="type" :value="type">{{ type }} </a-select-option>
                </a-select>
              </a-form-item>

              <div class="flex justify-end">
                <NcButton type="primary" size="small" class="!rounded-md" @click="handleEditJSON()">
                  <!-- Edit connection JSON -->
                  {{ $t('activity.editConnJson') }}
                </NcButton>
              </div>
            </a-collapse-panel>
          </a-collapse>
        </template>
      </div>

      <a-form-item class="flex justify-end !mt-5">
        <div class="flex justify-end gap-2">
          <NcButton type="primary" size="small" class="nc-extdb-btn-test-connection !rounded-md" @click="testConnection">
            {{ $t('activity.testDbConn') }}
          </NcButton>

          <NcButton
            size="small"
            type="primary"
            :disabled="!testSuccess"
            class="nc-extdb-btn-submit !rounded-md"
            @click="createBase"
          >
            {{ $t('general.submit') }}
          </NcButton>
        </div>
      </a-form-item>
    </a-form>

    <a-modal
      v-model:visible="configEditDlg"
      :title="$t('activity.editConnJson')"
      width="600px"
      wrap-class-name="nc-modal-edit-connection-json"
      @ok="handleOk"
    >
      <MonacoEditor v-if="configEditDlg" v-model="customFormState" class="h-[400px] w-full" />
    </a-modal>

    <!--    Use Connection URL -->
    <a-modal
      v-model:visible="importURLDlg"
      :title="$t('activity.useConnectionUrl')"
      width="500px"
      :ok-text="$t('general.ok')"
      :cancel-text="$t('general.cancel')"
      wrap-class-name="nc-modal-connection-url"
      @ok="handleImportURL"
    >
      <a-input v-model:value="importURL" />
    </a-modal>

    <!-- connection succesfull modal -->
    <GeneralModal v-model:visible="isConnSuccess" class="!w-[25rem]">
      <div class="flex flex-col h-full p-8">
        <div class="text-lg font-semibold self-start mb-4">{{ t('msg.info.dbConnected') }}</div>
        <div class="flex gap-x-2 mt-5 ml-7 pt-2.5 justify-end">
          <NcButton key="back" type="secondary" @click="isConnSuccess = false">{{ $t('general.cancel') }}</NcButton>
          <NcButton key="submit" type="primary" @click="createBase">Ok & Add Base</NcButton>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-collapse-header) {
  @apply !pr-10 !-mt-4 text-right justify-end;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0;
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

.create-base {
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
}
</style>
