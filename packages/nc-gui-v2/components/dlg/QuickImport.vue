<script setup lang="ts">
import { useToast } from 'vue-toastification'
import { Form } from 'ant-design-vue'
import type { TableType } from 'nocodb-sdk'
import type { UploadChangeParam } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import MdiFileIcon from '~icons/mdi/file-plus-outline'
import MdiFileUploadOutlineIcon from '~icons/mdi/file-upload-outline'
import MdiLinkVariantIcon from '~icons/mdi/link-variant'
import MdiCodeJSONIcon from '~icons/mdi/code-json'
import { fieldRequiredValidator, importCsvUrlValidator, importExcelUrlValidator, importUrlValidator } from '~/utils/validation'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import {
  CSVTemplateAdapter,
  ExcelTemplateAdapter,
  ExcelUrlTemplateAdapter,
  JSONTemplateAdapter,
  JSONUrlTemplateAdapter,
} from '~/utils/parsers'
import { useProject } from '#imports'

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
  importOnly: boolean
}

const { importType, importOnly, ...rest } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { tables } = useProject()

const toast = useToast()

const activeKey = ref('uploadTab')

const jsonEditorRef = ref()

const templateEditorRef = ref()

const loading = ref(false)

const templateData = ref()

const importData = ref()

const importColumns = ref([])

const templateEditorModal = ref(false)

const useForm = Form.useForm

const importState = reactive({
  fileList: [] as Record<string, any>,
  url: '',
  jsonEditor: {},
  parserConfig: {
    maxRowsToParse: 500,
    normalizeNested: true,
    importData: true,
  },
})

const isImportTypeJson = computed(() => importType === 'json')

const isImportTypeCsv = computed(() => importType === 'csv')

const IsImportTypeExcel = computed(() => importType === 'excel')

const validators = computed(() => {
  return {
    url: [fieldRequiredValidator, importUrlValidator, isImportTypeCsv.value ? importCsvUrlValidator : importExcelUrlValidator],
    maxRowsToParse: [fieldRequiredValidator],
  }
})

const { resetFields, validate, validateInfos } = useForm(importState, validators)

const importMeta = computed(() => {
  if (IsImportTypeExcel.value) {
    return {
      header: 'QUICK IMPORT - EXCEL',
      uploadHint: t('msg.info.excelSupport'),
      urlInputLabel: t('msg.info.excelURL'),
      loadUrlDirective: ['c:quick-import:excel:load-url'],
      acceptTypes: '.xls, .xlsx, .xlsm, .ods, .ots',
    }
  } else if (isImportTypeCsv.value) {
    return {
      header: 'QUICK IMPORT - CSV',
      uploadHint: '',
      urlInputLabel: t('msg.info.csvURL'),
      loadUrlDirective: ['c:quick-import:csv:load-url'],
      acceptTypes: '.csv',
    }
  } else if (isImportTypeJson.value) {
    return {
      header: 'QUICK IMPORT - JSON',
      uploadHint: '',
      acceptTypes: '.json',
    }
  }
  return {}
})

const dialogShow = useVModel(rest, 'modelValue', emit)

const disablePreImportButton = computed(() => {
  if (activeKey.value === 'uploadTab') {
    return !(importState.fileList.length > 0)
  } else if (activeKey.value === 'urlTab') {
    if (!validateInfos.url.validateStatus) return true
    return validateInfos.url.validateStatus === 'error'
  } else if (activeKey.value === 'jsonEditorTab') {
    return !jsonEditorRef.value?.isValid
  }
})

const disableImportButton = computed(() => {
  return !templateEditorRef.value?.isValid
})

const disableFormatJsonButton = computed(() => !jsonEditorRef.value?.isValid)

const modalWidth = computed(() => {
  if (importType === 'excel' && templateEditorModal.value) {
    return 'max(90vw, 600px)'
  }
  return 'max(60vw, 600px)'
})

async function handlePreImport() {
  loading.value = true
  if (activeKey.value === 'uploadTab') {
    await parseAndExtractData(importState.fileList[0].data, importState.fileList[0].name)
  } else if (activeKey.value === 'urlTab') {
    try {
      await validate()
      await parseAndExtractData(importState.url, '')
    } catch (e: any) {
      toast.error(await extractSdkResponseErrorMsg(e))
    }
  } else if (activeKey.value === 'jsonEditorTab') {
    await parseAndExtractData(JSON.stringify(importState.jsonEditor), '')
  }
  loading.value = false
}

async function handleImport() {
  try {
    loading.value = true
    await templateEditorRef.value.importTemplate()
  } catch (e: any) {
    return toast.error(await extractSdkResponseErrorMsg(e))
  } finally {
    loading.value = false
  }
  dialogShow.value = false
}

async function parseAndExtractData(val: any, name: string) {
  try {
    templateData.value = null
    importData.value = null
    importColumns.value = []
    const templateGenerator: any = getAdapter(name, val)
    if (!templateGenerator) {
      toast.error('Template Generator cannot be found!')
      return
    }
    await templateGenerator.init()
    templateGenerator.parse()
    templateData.value = templateGenerator.getTemplate()
    templateData.value.tables[0].table_name = populateUniqueTableName()
    importData.value = templateGenerator.getData()
    if (importOnly) importColumns.value = templateGenerator.getColumns()
    templateEditorModal.value = true
  } catch (e: any) {
    console.log(e)
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}

function rejectDrop(fileList: any[]) {
  fileList.map((file) => {
    return toast.error(`Failed to upload file ${file.name}`)
  })
}

function handleChange(info: UploadChangeParam) {
  const status = info.file.status
  if (status !== 'uploading') {
    const reader: any = new FileReader()
    reader.onload = (e: any) => {
      const target: any = importState.fileList.find((f: any) => f?.uid === info.file.uid)
      if (target) {
        target.data = e.target.result
      }
    }
    reader.readAsArrayBuffer(info.file.originFileObj)
  }
  if (status === 'done') {
    toast.success(`Uploaded file ${info.file.name} successfully`)
  } else if (status === 'error') {
    toast.error(`Failed to upload file ${info.file.name}`)
  }
}

function formatJson() {
  jsonEditorRef.value?.format()
}

function populateUniqueTableName() {
  let c = 1
  while (tables.value.some((t: TableType) => t.title === `Sheet${c}`)) {
    c++
  }
  return `Sheet${c}`
}

function getAdapter(name: string, val: any) {
  if (IsImportTypeExcel.value || isImportTypeCsv.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        return new ExcelTemplateAdapter(name, val, importState.parserConfig)
      case 'urlTab':
        return new ExcelUrlTemplateAdapter(val, importState.parserConfig)
    }
  } else if (isImportTypeJson.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        return new JSONTemplateAdapter(name, val, importState.parserConfig)
      case 'urlTab':
        return new JSONUrlTemplateAdapter(val, importState.parserConfig)
      case 'jsonEditorTab':
        return new JSONTemplateAdapter(name, val, importState.parserConfig)
    }
  }
  return null
}
</script>

<template>
  <a-modal v-model:visible="dialogShow" :width="modalWidth" :mask-closable="false" @keydown.esc="dialogShow = false">
    <a-typography-title class="ml-5 mt-5 mb-5" type="secondary" :level="5">{{ importMeta.header }}</a-typography-title>
    <template #footer>
      <a-button v-if="templateEditorModal" key="back" @click="templateEditorModal = false">Back</a-button>
      <a-button v-else key="cancel" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>
      <a-button
        v-if="activeKey === 'jsonEditorTab' && !templateEditorModal"
        key="format"
        :disabled="disableFormatJsonButton"
        @click="formatJson"
        >Format JSON</a-button
      >
      <a-button
        v-if="!templateEditorModal"
        key="pre-import"
        type="primary"
        class="nc-btn-import"
        :loading="loading"
        :disabled="disablePreImportButton"
        @click="handlePreImport"
        >{{ $t('activity.import') }}
      </a-button>
      <a-button v-else key="import" type="primary" :loading="loading" :disabled="disableImportButton" @click="handleImport">{{
        $t('activity.import')
      }}</a-button>
    </template>
    <div class="ml-5 mr-5">
      <TemplateEditor
        v-if="templateEditorModal"
        ref="templateEditorRef"
        :project-template="templateData"
        :import-data="importData"
        :import-columns="importColumns"
        :import-only="importOnly"
        :quick-import-type="importType"
        :max-rows-to-parse="importState.parserConfig.maxRowsToParse"
        @import="handleImport"
      />
      <a-tabs v-else v-model:activeKey="activeKey" hide-add type="editable-card" :tab-position="top">
        <a-tab-pane key="uploadTab" :closable="false">
          <template #tab>
            <span class="flex items-center gap-2">
              <MdiFileUploadOutlineIcon />
              Upload
            </span>
          </template>
          <div class="pr-10 pb-0 pt-5">
            <a-upload-dragger
              v-model:fileList="importState.fileList"
              name="file"
              class="nc-input-import"
              :accept="importMeta.acceptTypes"
              :max-count="1"
              list-type="picture"
              @change="handleChange"
              @reject="rejectDrop"
            >
              <MdiFileIcon size="large" />
              <p class="ant-upload-text">Click or drag file to this area to upload</p>
              <p class="ant-upload-hint">
                {{ importMeta.uploadHint }}
              </p>
            </a-upload-dragger>
          </div>
        </a-tab-pane>
        <a-tab-pane v-if="isImportTypeJson" key="jsonEditorTab" :closable="false">
          <template #tab>
            <span class="flex items-center gap-2">
              <MdiCodeJSONIcon />
              JSON Editor
            </span>
          </template>
          <div class="pb-3 pt-3">
            <MonacoEditor ref="jsonEditorRef" v-model="importState.jsonEditor" class="min-h-60 max-h-80" />
          </div>
        </a-tab-pane>
        <a-tab-pane v-else key="urlTab" :closable="false">
          <template #tab>
            <span class="flex items-center gap-2">
              <MdiLinkVariantIcon />
              URL
            </span>
          </template>
          <div class="pr-10 pt-5">
            <a-form :model="importState" name="quick-import-url-form" layout="horizontal" class="mb-0">
              <a-form-item :label="importMeta.urlInputLabel" v-bind="validateInfos.url">
                <a-input v-model:value="importState.url" size="large" />
              </a-form-item>
            </a-form>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
    <div v-if="!templateEditorModal" class="ml-5 mr-5">
      <a-divider />
      <div class="mb-4">
        <span class="prose-xl font-bold">Advanced Settings</span>
        <a-form-item class="mt-4 mb-2" :label="t('msg.info.footMsg')" v-bind="validateInfos.maxRowsToParse">
          <a-input-number v-model:value="importState.parserConfig.maxRowsToParse" :min="1" :max="50000" />
        </a-form-item>
        <div v-if="isImportTypeJson" class="mt-3">
          <a-checkbox v-model:checked="importState.parserConfig.normalizeNested">
            <span class="caption">Flatten nested</span>
          </a-checkbox>
        </div>
        <div v-if="isImportTypeJson" class="mt-4">
          <a-checkbox v-model:checked="importState.parserConfig.importData">Import data</a-checkbox>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped lang="scss">
:deep(.ant-upload-list) {
  @apply max-h-80 overflow-auto;
}
</style>
