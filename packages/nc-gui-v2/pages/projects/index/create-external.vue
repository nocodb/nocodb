<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { Form } from 'ant-design-vue'
import form from '../../../../nc-gui/components/project/spreadsheet/mixins/form'
import { navigateTo, useNuxtApp } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import {
  clientTypes,
  fieldRequiredValidator,
  getDefaultConnectionConfig,
  getTestDatabaseName,
  projectTitleValidator,
  sslUsage,
} from '~/utils/projectCreateUtils'
import MaterialSymbolsRocketLaunchOutline from '~icons/material-symbols/rocket-launch-outline'

const useForm = Form.useForm
const name = ref('')
const loading = ref(false)
const valid = ref(false)
const testSuccess = ref(true)
const projectDatasource = ref()
const inflection = reactive({
  tableName: 'camelize',
  columnName: 'camelize',
})

const { $api, $e } = useNuxtApp()
const toast = useToast()
const { t } = useI18n()

const createProject = async () => {
  loading.value = true
  try {
    const result = await $api.project.create({
      title: name.value,
      bases: [
        {
          type: projectDatasource.value.client,
          config: projectDatasource.value,
          inflection_column: inflection.columnName,
          inflection_table: inflection.tableName,
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

    if (projectDatasource.value.client === 'sqlite3') {
      testSuccess.value = true
    } else {
      const testConnectionConfig = {
        ...projectDatasource,
        connection: {
          ...projectDatasource.value.connection,
          database: getTestDatabaseName(projectDatasource.value),
        },
        inflection: {
          tableName: 'camelize',
          columnName: 'camelize',
        },
      }

      const result = await $api.utils.testConnection(testConnectionConfig)

      if (result.code === 0) {
        testSuccess.value = true
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

const formState = reactive<Record<string, any>>({ dataSource: { ...getDefaultConnectionConfig('mysql2') } })

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
</script>

<template>
  <a-card class="max-w-[600px] mx-auto !mt-100px" :title="$t('activity.createProject')">
    <a-form :model="formState" name="validate_other" layout="horizontal" :label-col="{ span: 8 }" :wrapper-col="{ span: 18 }">
      <!--      <a-row :gutter="24"> -->
      <!--        <a-col span="24"> -->
      <!-- Enter Project Name -->
      <a-form-item :label="$t('placeholder.projName')" v-bind="validateInfos.title">
        <a-input v-model:value="formState.title" size="small" />
      </a-form-item>
      <!--        </a-col> -->
      <!--        <a-col :span="24" class="text-center text-md font-medium mb-3 mt-1"> -->
      <!--          {{ $t('title.dbCredentials') }} -->
      <!--        </a-col> -->
      <!--        <a-col :span="8"> -->
      <a-form-item :label="$t('labels.dbType')" v-bind="validateInfos['dataSource.client']">
        <a-select v-model:value="formState.dataSource.client" size="small" @change="onClientChange">
          <a-select-option v-for="client in clientTypes" :key="client.value" :value="client.value"
            >{{ client.text }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <!--        </a-col> -->
      <!--        <a-col :span="8"> -->
      <a-form-item :label="$t('labels.hostAddress')" v-bind="validateInfos['dataSource.connection.host']">
        <a-input v-model:value="formState.dataSource.connection.host" size="small" />
      </a-form-item>
      <!--        </a-col> -->
      <!--        <a-col :span="8"> -->
      <a-form-item :label="$t('labels.port')" v-bind="validateInfos['dataSource.connection.port']">
        <a-input-number v-model:value="formState.dataSource.connection.port" class="!w-full" size="small" />
      </a-form-item>
      <!--        </a-col> -->
      <!--        <a-col :span="8"> -->
      <a-form-item :label="$t('labels.username')" v-bind="validateInfos['dataSource.connection.user']">
        <a-input v-model:value="formState.dataSource.connection.user" size="small" />
      </a-form-item>
      <!--        </a-col> -->
      <!--        <a-col :span="8"> -->
      <a-form-item :label="$t('labels.password')">
        <a-input-password v-model:value="formState.dataSource.connection.password" size="small" />
      </a-form-item>
      <!--        </a-col> -->
      <!--        <a-col :span="8"> -->
      <a-form-item :label="$t('labels.database')" v-bind="validateInfos['dataSource.connection.database']">
        <a-input
          v-model:value="formState.dataSource.connection.database"
          :placeholder="$t('labels.dbCreateIfNotExists')"
          size="small"
        />
      </a-form-item>
      <!--        </a-col> -->
      <!--      </a-row> -->

      <a-collapse ghost expand-icon-position="right">
        <a-collapse-panel key="1" header="Advance options">
          <a-form-item :label="$t('lables.ssl')" v-bind="validateInfos['dataSource.ssl']">
            <a-select v-model:value="formState.dataSource.ssl" size="small" @change="onClientChange">
              <a-select-option v-for="opt in Object.keys(sslUsage)" :key="opt" :value="opt">{{ opt }}</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item :label="$t('labels.dbCredentials')">
            <!--            <a-input v-model:value="formState.dataSource.connection.database" size="small" /> -->

            <div class="flex gap-2">
              <a-tooltip placement="top">
                <template #title>
                  <span>{{ $t('tooltip.clientCert') }}</span>
                </template>
                <a-button size="small">
                  {{ $t('labels.clientCert') }}
                </a-button>
              </a-tooltip>
              <a-tooltip placement="top">
                <template #title>
                  <span>{{ $t('tooltip.clientKey') }}</span>
                </template>
                <a-button size="small">
                  {{ $t('labels.clientKey') }}
                </a-button>
              </a-tooltip>
              <a-tooltip placement="top">
                <template #title>
                  <span>{{ $t('tooltip.clientCA') }}</span>
                </template>
                <a-button size="small">
                  {{ $t('labels.serverCA') }}
                </a-button>
              </a-tooltip>
            </div>
          </a-form-item>

          <!-- <v-row> -->
          <!--  <v-col> -->
          <a-form-item :label="$t('labels.inflection.tableName')" v-bind="validateInfos['dataSource.client']">
            <a-select v-model:value="formState.dataSource.client" size="small" @change="onClientChange">
              <a-select-option v-for="client in clientTypes" :key="client.value" :value="client.value"
                >{{ client.text }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <!--  </v-col> -->
          <!--  <v-col> -->
          <a-form-item :label="$t('labels.inflection.columnName')" v-bind="validateInfos['dataSource.client']">
            <a-select v-model:value="formState.dataSource.client" size="small" @change="onClientChange">
              <a-select-option v-for="client in clientTypes" :key="client.value" :value="client.value"
                >{{ client.text }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <!--  </v-col> -->
          <!-- </v-row> -->
          <div class="flex justify-end">
            <a-button size="small" @click="configEditDlg = true">
              <!-- Edit connection JSON -->
              {{ $t('activity.editConnJson') }}
            </a-button>
          </div>
        </a-collapse-panel>
      </a-collapse>

      <a-form-item class="flex justify-center">
        <div class="flex justify-center gap-2">
          <a-button type="primary" html-type="submit">Submit</a-button>
          <a-button type="primary" html-type="submit">Test Connection</a-button>
        </div>
      </a-form-item>
    </a-form>

    <v-dialog v-model="configEditDlg">
      <MonacoJson v-if="configEditDlg" class="h-[320px] w-[600px]"></MonacoJson>
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
