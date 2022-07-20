<script lang="ts" setup>
import { onMounted } from '@vue/runtime-core'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { Form, Modal } from 'ant-design-vue'
import { ref } from '#imports'
import { navigateTo, useNuxtApp } from '#app'
import type { ProjectCreateForm } from '~/lib/types'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import {
  clientTypes,
  fieldRequiredValidator,
  generateUniqueName,
  getDefaultConnectionConfig,
  getTestDatabaseName,
  projectTitleValidator,
  sslUsage,
} from '~/utils/projectCreateUtils'
import { readFile } from '~/utils/fileUtils'

const useForm = Form.useForm
const loading = ref(false)
const testSuccess = ref(false)

const { $api, $e, $state } = useNuxtApp()
const toast = useToast()
const { t } = useI18n()

const formState = $ref<ProjectCreateForm>({
  title: '',
  dataSource: { ...getDefaultConnectionConfig('mysql2') },
  inflection: {
    inflection_column: 'camelize',
    inflection_table: 'camelize',
  },
  sslUse: 'No',
})

const validators = computed(() => {
  return {
    'title': [
      {
        required: true,
        message: 'Please input project title',
      },
      projectTitleValidator,
    ],
    'dataSource.client': [fieldRequiredValidator],
    ...(formState.dataSource.client === 'sqlite3'
      ? {
          'dataSource.connection.connection.filename': [fieldRequiredValidator],
        }
      : {
          'dataSource.connection.host': [fieldRequiredValidator],
          'dataSource.connection.port': [fieldRequiredValidator],
          'dataSource.connection.user': [fieldRequiredValidator],
          'dataSource.connection.password': [fieldRequiredValidator],
          'dataSource.connection.database': [fieldRequiredValidator],
          ...(['pg', 'mssql'].includes(formState.dataSource.client)
            ? {
                'dataSource.connection.searchPath.0': [fieldRequiredValidator],
              }
            : {}),
        }),
  }
})

const { resetFields, validate, validateInfos } = useForm(formState, validators)

const onClientChange = () => {
  formState.dataSource = { ...getDefaultConnectionConfig(formState.dataSource.client) }
}

const inflectionTypes = ['camelize', 'none']
const configEditDlg = ref(false)

// populate database name based on title
watch(
  () => formState.title,
  (v) => (formState.dataSource.connection.database = `${v}_noco`),
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
  form?.value?.$el.querySelector('.ant-form-item-explain-error')?.parentNode?.querySelector('input')?.focus()
}

const createProject = async () => {
  try {
    await validate()
  } catch (e) {
    focusInvalidInput()
    return
  }
  loading.value = true
  try {
    const connection = getConnectionConfig()
    const config = { ...formState.dataSource, connection }
    const result = await $api.project.create({
      title: formState.title,
      bases: [
        {
          type: formState.dataSource.client,
          config,
          inflection_column: formState.inflection.inflection_column,
          inflection_table: formState.inflection.inflection_table,
        },
      ],
      external: true,
    })
    $e('a:project:create:extdb')
    await navigateTo(`/nc/${result.id}`)
  } catch (e: any) {
    // todo: toast
    toast.error(await extractSdkResponseErrorMsg(e))
  }
  loading.value = false
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
    if (formState.dataSource.client === 'sqlite3') {
      testSuccess.value = true
    } else {
      const connection: any = getConnectionConfig()
      connection.database = getTestDatabaseName(formState.dataSource)
      const testConnectionConfig = {
        ...formState.dataSource,
        connection,
      }

      const result = await $api.utils.testConnection(testConnectionConfig)

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
        toast.error(`${t('msg.error.dbConnectionFailed')} ${result.message}`)
      }
    }
  } catch (e: any) {
    testSuccess.value = false
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}

// hide sidebar
$state.sidebarOpen.value = false

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
  <a-card
    class="max-w-[600px] mx-auto !mt-5 !mb-5"
    :title="$t('activity.createProject')"
    :head-style="{ textAlign: 'center', fontWeight: '700' }"
  >
    <a-form
      ref="form"
      :model="formState"
      name="validate_other"
      layout="horizontal"
      :label-col="{ span: 8 }"
      :wrapper-col="{ span: 18 }"
    >
      <a-form-item :label="$t('placeholder.projName')" v-bind="validateInfos.title">
        <a-input v-model:value="formState.title" size="small" />
      </a-form-item>

      <a-form-item :label="$t('labels.dbType')" v-bind="validateInfos['dataSource.client']">
        <a-select v-model:value="formState.dataSource.client" size="small" @change="onClientChange">
          <a-select-option v-for="client in clientTypes" :key="client.value" :value="client.value"
            >{{ client.text }}
          </a-select-option>
        </a-select>
      </a-form-item>

      <!-- SQLite File -->
      <a-form-item
        v-if="formState.dataSource.client === 'sqlite3'"
        :label="$t('labels.sqliteFile')"
        v-bind="validateInfos['dataSource.connection.connection.filename']"
      >
        <a-input v-model:value="formState.dataSource.connection.connection.filename" size="small" />
      </a-form-item>

      <template v-else>
        <!-- Host Address -->
        <a-form-item :label="$t('labels.hostAddress')" v-bind="validateInfos['dataSource.connection.host']">
          <a-input v-model:value="formState.dataSource.connection.host" size="small" />
        </a-form-item>

        <!-- Port Number -->
        <a-form-item :label="$t('labels.port')" v-bind="validateInfos['dataSource.connection.port']">
          <a-input-number v-model:value="formState.dataSource.connection.port" class="!w-full" size="small" />
        </a-form-item>

        <!-- Username -->
        <a-form-item :label="$t('labels.username')" v-bind="validateInfos['dataSource.connection.user']">
          <a-input v-model:value="formState.dataSource.connection.user" size="small" />
        </a-form-item>

        <!-- Password -->
        <a-form-item :label="$t('labels.password')">
          <a-input-password v-model:value="formState.dataSource.connection.password" size="small" />
        </a-form-item>

        <!-- Database -->
        <a-form-item :label="$t('labels.database')" v-bind="validateInfos['dataSource.connection.database']">
          <!-- Database : create if not exists -->
          <a-input
            v-model:value="formState.dataSource.connection.database"
            :placeholder="$t('labels.dbCreateIfNotExists')"
            size="small"
          />
        </a-form-item>
        <!-- Schema name -->
        <a-form-item
          v-if="['mssql', 'pg'].includes(formState.dataSource.client)"
          :label="$t('labels.schemaName')"
          v-bind="validateInfos['dataSource.connection.searchPath.0']"
        >
          <a-input v-model:value="formState.dataSource.connection.searchPath[0]" size="small" />
        </a-form-item>

        <a-collapse ghost expand-icon-position="right">
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
                  <a-button :disabled="!sslFilesRequired" size="small" @click="certFileInput.click()">
                    {{ $t('labels.clientCert') }}
                  </a-button>
                </a-tooltip>
                <a-tooltip placement="top">
                  <!-- Select .key file -->
                  <template #title>
                    <span>{{ $t('tooltip.clientKey') }}</span>
                  </template>
                  <a-button :disabled="!sslFilesRequired" size="small" @click="keyFileInput.click()">
                    {{ $t('labels.clientKey') }}
                  </a-button>
                </a-tooltip>
                <a-tooltip placement="top">
                  <!-- Select CA file -->
                  <template #title>
                    <span>{{ $t('tooltip.clientCA') }}</span>
                  </template>
                  <a-button :disabled="!sslFilesRequired" size="small" @click="caFileInput.click()">
                    {{ $t('labels.serverCA') }}
                  </a-button>
                </a-tooltip>
              </div>
            </a-form-item>

            <input ref="caFileInput" type="file" class="!hidden" @change="onFileSelect('ca', caFileInput)" />
            <input ref="certFileInput" type="file" class="!hidden" @change="onFileSelect('cert', certFileInput)" />
            <input ref="keyFileInput" type="file" class="!hidden" @change="onFileSelect('key', keyFileInput)" />

            <a-form-item :label="$t('labels.inflection.tableName')" v-bind="validateInfos['dataSource.client']">
              <a-select v-model:value="formState.inflection.inflection_table" size="small" @change="onClientChange">
                <a-select-option v-for="type in inflectionTypes" :key="type" :value="type">{{ type }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="$t('labels.inflection.columnName')" v-bind="validateInfos['dataSource.type']">
              <a-select v-model:value="formState.inflection.inflection_column" size="small" @change="onClientChange">
                <a-select-option v-for="type in inflectionTypes" :key="type" :value="type">{{ type }}</a-select-option>
              </a-select>
            </a-form-item>
            <div class="flex justify-end">
              <a-button size="small" @click="configEditDlg = true">
                <!-- Edit connection JSON -->
                {{ $t('activity.editConnJson') }}
              </a-button>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </template>

      <a-form-item class="flex justify-center mt-5">
        <div class="flex justify-center gap-2">
          <a-button type="primary" :disabled="!testSuccess" @click="createProject">Submit</a-button>
          <a-button type="primary" @click="testConnection">Test Connection</a-button>
        </div>
      </a-form-item>
    </a-form>

    <v-dialog v-model="configEditDlg">
      <a-card>
        <Monaco v-if="configEditDlg" v-model="formState" class="h-[400px] w-[600px]"></Monaco>
      </a-card>
    </v-dialog>
  </a-card>
</template>

<style scoped>
:deep(.ant-collapse-header) {
  @apply !pr-10 !-mt-4 text-right;
}

:deep(.ant-collapse-content-box) {
  @apply !pr-0;
}

:deep(.ant-form-item-explain-error) {
  @apply !text-xs;
}
</style>
