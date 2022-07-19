<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { Form, Modal } from 'ant-design-vue'
import { navigateTo, useNuxtApp } from '#app'
import type { ProjectCreateForm } from '~/lib/types'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import {
  clientTypes,
  fieldRequiredValidator,
  getDefaultConnectionConfig,
  getTestDatabaseName,
  projectTitleValidator,
  sslUsage,
} from '~/utils/projectCreateUtils'
import MdiCheckIcon from '~icons/mdi/check-circle'

import { readFile } from '~/utils/fileUtils'

const onVal = (v) => {
  console.log(v)
}
const useForm = Form.useForm
const loading = ref(false)
const valid = ref(false)
const testSuccess = ref(true)

const { $api, $e } = useNuxtApp()
const toast = useToast()
const { t } = useI18n()

const formState = reactive<ProjectCreateForm>({
  title: '',
  dataSource: { ...getDefaultConnectionConfig('mysql2') },
  inflection: {
    inflection_column: 'camelize',
    inflection_table: 'camelize',
  },
})

const validators = reactive({
  'title': [
    {
      required: true,
      message: 'Please input project title',
    },
    projectTitleValidator,
  ],
  'dataSource.client': [fieldRequiredValidator],
  'dataSource.connection.port': [fieldRequiredValidator],
  'dataSource.connection.host': [fieldRequiredValidator],
  'dataSource.connection.user': [fieldRequiredValidator],
  'dataSource.connection.database': [fieldRequiredValidator],
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

const caFileInput = ref<HTMLInputElement>()
const keyFileInput = ref<HTMLInputElement>()
const certFileInput = ref<HTMLInputElement>()

const onFileSelect = (key: 'ca' | 'cert' | 'key', el: HTMLInputElement) => {
  readFile(el, (content) => {
    if ('ssl' in formState.dataSource.connection && formState.dataSource.connection.ssl)
      formState.dataSource.connection.ssl[key] = content ?? ''
  })
}

function getConnectionConfig() {
  const connection = {
    ...formState.dataSource.connection,
  }

  if ('ssl' in connection && connection.ssl && Object.values(connection.ssl).every((v) => !v)) {
    delete connection.ssl
  }
  return connection
}

const createProject = async () => {
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

    await navigateTo(`/nc/${result.id}`)
  } catch (e: any) {
    // todo: toast
    toast.error(await extractSdkResponseErrorMsg(e))
  }
  loading.value = false
}

const testConnection = async () => {
  $e('a:project:create:extdb:test-connection', [])
  try {
    // this.handleSSL(projectDatasource)

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
</script>

<template>
  <a-card class="max-w-[600px] mx-auto !mt-100px" :title="$t('activity.createProject')">
    <a-form :model="formState" name="validate_other" layout="horizontal" :label-col="{ span: 8 }" :wrapper-col="{ span: 18 }">
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
        v-bind="validateInfos['dataSource.connection.host']"
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
        <a-form-item v-if="['mssql', 'pg'].includes(formState.dataSource.client)" :label="$t('labels.schemaName')">
          <a-input v-model:value="formState.dataSource.connection.searchPath[0]" size="small" />
        </a-form-item>

        <a-collapse ghost expand-icon-position="right">
          <a-collapse-panel key="1" :header="$t('title.advancedParameters')">
            <!--            todo:  add in i18n -->
            <a-form-item label="SSL Mode" v-bind="validateInfos['dataSource.ssl']">
              <a-select v-model:value="formState.dataSource.sslUse" size="small" @change="onClientChange">
                <a-select-option v-for="opt in sslUsage" :key="opt" :value="opt">{{ opt }}</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item :label="$t('labels.dbCredentials')">
              <div class="flex gap-2">
                <a-tooltip placement="top">
                  <!-- Select .cert file -->
                  <template #title>
                    <span>{{ $t('tooltip.clientCert') }}</span>
                  </template>
                  <a-button size="small" @click="certFileInput.click()">
                    {{ $t('labels.clientCert') }}
                  </a-button>
                </a-tooltip>
                <a-tooltip placement="top">
                  <!-- Select .key file -->
                  <template #title>
                    <span>{{ $t('tooltip.clientKey') }}</span>
                  </template>
                  <a-button size="small" @click="keyFileInput.click()">
                    {{ $t('labels.clientKey') }}
                  </a-button>
                </a-tooltip>
                <a-tooltip placement="top">
                  <!-- Select CA file -->
                  <template #title>
                    <span>{{ $t('tooltip.clientCA') }}</span>
                  </template>
                  <a-button size="small" @click="caFileInput.click()">
                    {{ $t('labels.serverCA') }}
                  </a-button>
                </a-tooltip>
              </div>
            </a-form-item>

            <input ref="caFileInput" type="file" class="!hidden" @change="onFileSelect('ca', caFileInput)" />
            <input ref="certFileInput" type="file" class="!hidden" @change="onFileSelect('cert', certFileInput)" />
            <input ref="keyFileInput" type="file" class="!hidden" @change="onFileSelect('key', keyFileInput)" />

            <a-form-item :label="$t('labels.inflection.inflection_column')" v-bind="validateInfos['dataSource.client']">
              <a-select v-model:value="formState.inflection.inflection_table" size="small" @change="onClientChange">
                <a-select-option v-for="type in inflectionTypes" :key="type" :value="type">{{ type }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="$t('labels.inflection.inflection_column')" v-bind="validateInfos['dataSource.type']">
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

      <a-form-item class="flex justify-center">
        <div class="flex justify-center gap-2">
          <a-button type="primary" @click="createProject">Submit</a-button>
          <a-button type="primary" @click="testConnection">Test Connection</a-button>
        </div>
      </a-form-item>
    </a-form>

    <v-dialog v-model="configEditDlg">
      <Monaco v-if="configEditDlg" :model-value="formState" class="h-[320px] w-[600px]" @update:modelValue="onVal"></Monaco>
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
</style>
