<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { Form } from 'ant-design-vue'
import { navigateTo, useNuxtApp } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import {
  clientTypes,
  fieldRequiredValidator,
  getDefaultConnectionConfig,
  getTestDatabaseName,
  projectTitleValidator,
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
</script>

<template>
  <a-card class="max-w-[800px] mx-auto !mt-100px" :title="$t('activity.createProject')">
    <a-form :model="formState" name="validate_other" layout="vertical">
      <a-row :gutter="24">
        <a-col span="24">
          <!-- Enter Project Name -->
          <a-form-item :label="$t('placeholder.projName')" v-bind="validateInfos.title">
            <a-input v-model:value="formState.title" size="large" />
          </a-form-item>
        </a-col>
        <a-col :span="24" class="text-center text-md font-medium mb-3 mt-1">
          {{ $t('title.dbCredentials') }}
        </a-col>
        <a-col :span="8">
          <a-form-item :label="$t('labels.dbType')" v-bind="validateInfos['dataSource.client']">
            <a-select v-model:value="formState.dataSource.client" @change="onClientChange">
              <a-select-option v-for="client in clientTypes" :key="client.value" :value="client.value"
                >{{ client.text }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="$t('labels.hostAddress')" v-bind="validateInfos['dataSource.connection.host']">
            <a-input v-model:value="formState.dataSource.connection.host" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="$t('labels.port')" v-bind="validateInfos['dataSource.connection.port']">
            <a-input-number v-model:value="formState.dataSource.connection.port" class="!w-full" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="$t('labels.username')" v-bind="validateInfos['dataSource.connection.user']">
            <a-input v-model:value="formState.dataSource.connection.user" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="$t('labels.password')">
            <a-input-password v-model:value="formState.dataSource.connection.password" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="$t('labels.dbCreateIfNotExists')" v-bind="validateInfos['dataSource.connection.database']">
            <a-input v-model:value="formState.dataSource.connection.database" />
          </a-form-item>
        </a-col>
      </a-row>
      <!--
    <a-form-item label="InputNumber">
      <a-form-item name="input-number" no-style>
        <a-input-number v-model:value="formState['input-number']" />
      </a-form-item>
      <span class="ant-form-text">machines</span>
    </a-form-item>

    <a-form-item name="switch" label="Switch">
      <a-switch v-model:checked="formState.switch" />
    </a-form-item>

    <a-form-item name="slider" label="Slider">
      <a-slider
        v-model:value="formState.slider"
        :marks="{
          0: 'A',
          20: 'B',
          40: 'C',
          60: 'D',
          80: 'E',
          100: 'F',
        }"
      />
    </a-form-item>

    <a-form-item name="radio-group" label="Radio.Group">
      <a-radio-group v-model:value="formState['radio-group']">
        <a-radio value="a">item 1</a-radio>
        <a-radio value="b">item 2</a-radio>
        <a-radio value="c">item 3</a-radio>
      </a-radio-group>
    </a-form-item>

    <a-form-item
      name="radio-button"
      label="Radio.Button"
      :rules="[{ required: true, message: 'Please pick an item!' }]"
    >
      <a-radio-group v-model:value="formState['radio-button']">
        <a-radio-button value="a">item 1</a-radio-button>
        <a-radio-button value="b">item 2</a-radio-button>
        <a-radio-button value="c">item 3</a-radio-button>
      </a-radio-group>
    </a-form-item>

    <a-form-item name="checkbox-group" label="Checkbox.Group">
      <a-checkbox-group v-model:value="formState['checkbox-group']">
        <a-row>
          <a-col :span="8">
            <a-checkbox value="A" style="line-height: 32px">A</a-checkbox>
          </a-col>
          <a-col :span="8">
            <a-checkbox value="B" style="line-height: 32px" disabled>B</a-checkbox>
          </a-col>
          <a-col :span="8">
            <a-checkbox value="C" style="line-height: 32px">C</a-checkbox>
          </a-col>
          <a-col :span="8">
            <a-checkbox value="D" style="line-height: 32px">D</a-checkbox>
          </a-col>
          <a-col :span="8">
            <a-checkbox value="E" style="line-height: 32px">E</a-checkbox>
          </a-col>
          <a-col :span="8">
            <a-checkbox value="F" style="line-height: 32px">F</a-checkbox>
          </a-col>
        </a-row>
      </a-checkbox-group>
    </a-form-item>

    <a-form-item name="rate" label="Rate">
      <a-rate v-model:value="formState.rate" allow-half />
    </a-form-item>

    <a-form-item name="upload" label="Upload" extra="longgggggggggggggggggggggggggggggggggg">
      <a-upload
        v-model:fileList="formState.upload"
        name="logo"
        action="/upload.do"
        list-type="picture"
      >
        <a-button>
          <template #icon><UploadOutlined /></template>
          Click to upload
        </a-button>
      </a-upload>
    </a-form-item>

    <a-form-item label="Dragger">
      <a-form-item name="dragger" no-style>
        <a-upload-dragger v-model:fileList="formState.dragger" name="files" action="/upload.do">
          <p class="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p class="ant-upload-text">Click or drag file to this area to upload</p>
          <p class="ant-upload-hint">Support for a single or bulk upload.</p>
        </a-upload-dragger>
      </a-form-item>
    </a-form-item> -->

      <a-form-item class="text-center">
        <a-button type="primary" html-type="submit">Submit</a-button>
      </a-form-item>
    </a-form>
  </a-card>

  <!--  <v-form ref="formValidator" v-model="valid" class="h-full" @submit.prevent="createProject">
      <v-container fluid class="flex justify-center items-center h-5/6">
        <v-card max-width="600">
          &lt;!&ndash; Create Project &ndash;&gt;
          <v-container class="pb-10 px-12">
            <h1 class="my-4 prose-lg text-center">
              {{ $t('activity.createProject') }}
            </h1>

            <v-row>
              <v-col offset="2" cols="8">
                <v-text-field
                  v-model="name"
                  :rules="titleValidationRule"
                  class="nc-metadb-project-name"
                  :label="$t('labels.projName')"
                />
              </v-col>

              <v-col cols="6">
                <v-select
                  v-model="projectDatasource.client"
                  density="compact"
                  :items="clientTypes"
                  item-title="text"
                  item-value="value"
                  class="nc-metadb-project-name"
                  label="Database client"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="projectDatasource.connection.host" density="compact" :label="$t('labels.hostAddress')" />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="projectDatasource.connection.port"
                  density="compact"
                  :label="$t('labels.port')"
                  type="number"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="projectDatasource.connection.user" density="compact" :label="$t('labels.username')" />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="projectDatasource.connection.password"
                  density="compact"
                  type="password"
                  :label="$t('labels.password')"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="projectDatasource.connection.database" density="compact" label="Database name" />
              </v-col>
            </v-row>

            <div class="d-flex justify-center" style="gap: 4px">
              <v-btn :disabled="!testSuccess" large :loading="loading" color="primary" @click="createProject">
                <MaterialSymbolsRocketLaunchOutline class="mr-1" />
                <span> {{ $t('general.create') }} </span>
              </v-btn>

              &lt;!&ndash;              <v-btn small class="px-2"> &ndash;&gt;
              &lt;!&ndash;     todo:implement test connection &ndash;&gt;
              &lt;!&ndash;         <v-btn size="sm" class="text-sm text-capitalize">
                    &lt;!&ndash; Test Database Connection &ndash;&gt;
                    {{ $t('activity.testDbConn') }}
                  </v-btn> &ndash;&gt;
            </div>
          </v-container>
        </v-card>
      </v-container>
    </v-form> -->
</template>

<style scoped></style>
