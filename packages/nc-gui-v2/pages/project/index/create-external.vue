<script lang="ts" setup>
import { Form, Modal, message } from 'ant-design-vue'
import {
  clientTypes,
  computed,
  extractSdkResponseErrorMsg,
  fieldRequiredValidator,
  generateUniqueName,
  getDefaultConnectionConfig,
  getTestDatabaseName,
  navigateTo,
  nextTick,
  onMounted,
  projectTitleValidator,
  readFile,
  ref,
  sslUsage,
  useApi,
  useI18n,
  useNuxtApp,
  useSidebar,
  watch,
} from '#imports'
import { ClientType } from '~/lib'
import type { ProjectCreateForm } from '~/utils'

const useForm = Form.useForm

const testSuccess = ref(false)

const { api, isLoading } = useApi()

const { $e } = useNuxtApp()

useSidebar({ hasSidebar: false })

const { t } = useI18n()

const formState = $ref<ProjectCreateForm>({
  title: '',
  dataSource: { ...getDefaultConnectionConfig(ClientType.MYSQL) },
  inflection: {
    inflectionColumn: 'camelize',
    inflectionTable: 'camelize',
  },
  sslUse: 'No',
})

const validators = computed(() => {
  return {
    'title': [
      {
        required: true,
        message: 'Project name is required',
      },
      projectTitleValidator,
    ],
    'dataSource.client': [fieldRequiredValidator],
    ...(formState.dataSource.client === ClientType.SQLITE
      ? {
          'dataSource.connection.connection.filename': [fieldRequiredValidator],
        }
      : {
          'dataSource.connection.host': [fieldRequiredValidator],
          'dataSource.connection.port': [fieldRequiredValidator],
          'dataSource.connection.user': [fieldRequiredValidator],
          'dataSource.connection.password': [fieldRequiredValidator],
          'dataSource.connection.database': [fieldRequiredValidator],
          ...([ClientType.PG, ClientType.MSSQL].includes(formState.dataSource.client)
            ? {
                'dataSource.searchPath.0': [fieldRequiredValidator],
              }
            : {}),
        }),
  }
})

const { validate, validateInfos } = useForm(formState, validators)

const onClientChange = () => {
  formState.dataSource = { ...getDefaultConnectionConfig(formState.dataSource.client) }
}

const inflectionTypes = ['camelize', 'none']
const configEditDlg = ref(false)

// populate database name based on title
watch(
  () => formState.title,
  (v) => (formState.dataSource.connection.database = `${v?.trim()}_noco`),
)

// generate a random project title
formState.title = generateUniqueName()

const caFileInput = ref<HTMLInputElement>()
const keyFileInput = ref<HTMLInputElement>()
const certFileInput = ref<HTMLInputElement>()

const onFileSelect = (key: 'ca' | 'cert' | 'key', el: HTMLInputElement) => {
  readFile(el, (content) => {
    if ('ssl' in formState.dataSource.connection && formState.dataSource.connection.ssl)
      formState.dataSource.connection.ssl[key] = content ?? ''
  })
}

const sslFilesRequired = computed<boolean>(() => {
  return formState?.sslUse && formState.sslUse !== 'No'
})

function getConnectionConfig() {
  const connection = {
    ...formState.dataSource.connection,
  }

  if ('ssl' in connection && connection.ssl && (!sslFilesRequired || Object.values(connection.ssl).every((v) => !v))) {
    delete connection.ssl
  }
  return connection
}

const form = ref<any>()
const focusInvalidInput = () => {
  form?.value?.$el.querySelector('.ant-form-item-explain-error')?.parentNode?.parentNode?.querySelector('input')?.focus()
}

const createProject = async () => {
  try {
    await validate()
  } catch (e) {
    focusInvalidInput()
    return
  }

  try {
    const connection = getConnectionConfig()

    const config = { ...formState.dataSource, connection }

    const result = await api.project.create({
      title: formState.title,
      bases: [
        {
          type: formState.dataSource.client,
          config,
          inflection_column: formState.inflection.inflectionColumn,
          inflection_table: formState.inflection.inflectionTable,
        },
      ],
      external: true,
    })

    $e('a:project:create:extdb')

    await navigateTo(`/nc/${result.id}`)
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

  $e('a:project:create:extdb:test-connection', [])

  try {
    if (formState.dataSource.client === ClientType.SQLITE) {
      testSuccess.value = true
    } else {
      const connection = getConnectionConfig()

      connection.database = getTestDatabaseName(formState.dataSource)!

      const testConnectionConfig = {
        ...formState.dataSource,
        connection,
      }

      const result = await api.utils.testConnection(testConnectionConfig)

      if (result.code === 0) {
        testSuccess.value = true

        Modal.confirm({
          title: t('msg.info.dbConnected'),
          icon: null,
          type: 'success',

          okText: t('activity.OkSaveProject'),
          okType: 'primary',
          cancelText: 'Cancel',
          onOk: createProject,
        })
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

// reset test status on config change
watch(
  () => formState.dataSource,
  () => (testSuccess.value = false),
  { deep: true },
)

// select and focus title field on load
onMounted(() => {
  nextTick(() => {
    // todo: replace setTimeout and follow better approach
    setTimeout(() => {
      const input = form.value?.$el?.querySelector('input[type=text]')
      input.setSelectionRange(0, formState.title.length)
      input.focus()
    }, 500)
  })
})
</script>

<template>
  <div
    class="overflow-auto md:bg-primary bg-opacity-5 pb-4 create-external h-full min-h-[600px] flex flex-col justify-center items-end"
  >
    <div
      class="bg-white mt-275px relative flex flex-col justify-center gap-2 w-full max-w-[500px] !mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
    >
      <general-noco-icon class="color-transition hover:(ring ring-accent)" :class="[isLoading ? 'animated-bg-gradient' : '']" />

      <h1 class="prose-2xl font-bold self-center my-4">{{ $t('activity.createProject') }}</h1>

      <a-form
        ref="form"
        :model="formState"
        name="external-project-create-form"
        layout="horizontal"
        no-style
        :label-col="{ span: 10 }"
      >
        <a-form-item :label="$t('placeholder.projName')" v-bind="validateInfos.title">
          <a-input v-model:value="formState.title" size="small" class="nc-extdb-proj-name" />
        </a-form-item>

        <a-form-item :label="$t('labels.dbType')" v-bind="validateInfos['dataSource.client']">
          <a-select v-model:value="formState.dataSource.client" size="small" class="nc-extdb-db-type" @change="onClientChange">
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
          <a-input v-model:value="formState.dataSource.connection.connection.filename" size="small" />
        </a-form-item>

        <template v-else>
          <!-- Host Address -->
          <a-form-item :label="$t('labels.hostAddress')" v-bind="validateInfos['dataSource.connection.host']">
            <a-input v-model:value="formState.dataSource.connection.host" size="small" class="nc-extdb-host-address" />
          </a-form-item>

          <!-- Port Number -->
          <a-form-item :label="$t('labels.port')" v-bind="validateInfos['dataSource.connection.port']">
            <a-input-number
              v-model:value="formState.dataSource.connection.port"
              class="!w-full nc-extdb-host-port"
              size="small"
            />
          </a-form-item>

          <!-- Username -->
          <a-form-item :label="$t('labels.username')" v-bind="validateInfos['dataSource.connection.user']">
            <a-input v-model:value="formState.dataSource.connection.user" size="small" class="nc-extdb-host-user" />
          </a-form-item>

          <!-- Password -->
          <a-form-item :label="$t('labels.password')">
            <a-input-password
              v-model:value="formState.dataSource.connection.password"
              size="small"
              class="nc-extdb-host-password"
            />
          </a-form-item>

          <!-- Database -->
          <a-form-item :label="$t('labels.database')" v-bind="validateInfos['dataSource.connection.database']">
            <!-- Database : create if not exists -->
            <a-input
              v-model:value="formState.dataSource.connection.database"
              :placeholder="$t('labels.dbCreateIfNotExists')"
              size="small"
              class="nc-extdb-host-database"
            />
          </a-form-item>

          <!-- Schema name -->
          <a-form-item
            v-if="[ClientType.MSSQL, ClientType.PG].includes(formState.dataSource.client) && formState.dataSource.searchPath"
            :label="$t('labels.schemaName')"
            v-bind="validateInfos['dataSource.searchPath.0']"
          >
            <a-input v-model:value="formState.dataSource.searchPath[0]" size="small" />
          </a-form-item>

          <a-collapse ghost expand-icon-position="right" class="!mt-6">
            <a-collapse-panel key="1" :header="$t('title.advancedParameters')">
              <!--            todo:  add in i18n -->
              <a-form-item label="SSL mode">
                <a-select v-model:value="formState.sslUse" size="small" @change="onClientChange">
                  <a-select-option v-for="opt in sslUsage" :key="opt" :value="opt">{{ opt }}</a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="SSL keys">
                <div class="flex gap-2">
                  <a-tooltip placement="top">
                    <!-- Select .cert file -->
                    <template #title>
                      <span>{{ $t('tooltip.clientCert') }}</span>
                    </template>

                    <a-button :disabled="!sslFilesRequired" size="small" class="shadow" @click="certFileInput.click()">
                      {{ $t('labels.clientCert') }}
                    </a-button>
                  </a-tooltip>

                  <a-tooltip placement="top">
                    <!-- Select .key file -->
                    <template #title>
                      <span>{{ $t('tooltip.clientKey') }}</span>
                    </template>
                    <a-button :disabled="!sslFilesRequired" size="small" class="shadow" @click="keyFileInput.click()">
                      {{ $t('labels.clientKey') }}
                    </a-button>
                  </a-tooltip>

                  <a-tooltip placement="top">
                    <!-- Select CA file -->
                    <template #title>
                      <span>{{ $t('tooltip.clientCA') }}</span>
                    </template>

                    <a-button :disabled="!sslFilesRequired" size="small" class="shadow" @click="caFileInput.click()">
                      {{ $t('labels.serverCA') }}
                    </a-button>
                  </a-tooltip>
                </div>
              </a-form-item>

              <input ref="caFileInput" type="file" class="!hidden" @change="onFileSelect('ca', caFileInput)" />

              <input ref="certFileInput" type="file" class="!hidden" @change="onFileSelect('cert', certFileInput)" />

              <input ref="keyFileInput" type="file" class="!hidden" @change="onFileSelect('key', keyFileInput)" />

              <a-form-item :label="$t('labels.inflection.tableName')">
                <a-select v-model:value="formState.inflection.inflectionTable" size="small" @change="onClientChange">
                  <a-select-option v-for="type in inflectionTypes" :key="type" :value="type">{{ type }}</a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item :label="$t('labels.inflection.columnName')">
                <a-select v-model:value="formState.inflection.inflectionColumn" size="small" @change="onClientChange">
                  <a-select-option v-for="type in inflectionTypes" :key="type" :value="type">{{ type }}</a-select-option>
                </a-select>
              </a-form-item>

              <div class="flex justify-end">
                <a-button class="!shadow-md" @click="configEditDlg = true">
                  <!-- Edit connection JSON -->
                  {{ $t('activity.editConnJson') }}
                </a-button>
              </div>
            </a-collapse-panel>
          </a-collapse>
        </template>

        <a-form-item class="flex justify-center !mt-5">
          <div class="flex justify-center gap-2">
            <a-button type="primary" ghost class="nc-extdb-btn-test-connection" @click="testConnection">
              {{ $t('activity.testDbConn') }}
            </a-button>

            <a-button type="primary" :disabled="!testSuccess" class="nc-extdb-btn-submit !shadow" @click="createProject">
              Submit
            </a-button>
          </div>
        </a-form-item>
      </a-form>

      <!-- todo: needs replacement
      <v-dialog v-model="configEditDlg">
        <a-card>
          <MonacoEditor v-if="configEditDlg" v-model="formState" class="h-[400px] w-[600px]" />
        </a-card>
      </v-dialog>
       -->
    </div>
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

:deep(.ant-card-head-title) {
  @apply !text-3xl;
}

.create-external {
  :deep(.ant-input-affix-wrapper),
  :deep(.ant-input),
  :deep(.ant-select) {
    @apply !appearance-none my-1 border-1 border-solid border-primary/50 rounded;
  }
}
</style>
