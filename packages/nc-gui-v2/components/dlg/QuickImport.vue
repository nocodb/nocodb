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
import { ExcelTemplateAdapter, ExcelUrlTemplateAdapter, JSONTemplateAdapter, JSONUrlTemplateAdapter } from '~/utils/parsers'
import { useProject } from '#imports'
const { modelValue, importType } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
}

const { tables } = useProject()
const toast = useToast()
const activeKey = ref('uploadTab')
const jsonEditorRef = ref()
const templateEditorRef = ref()
const loading = ref(false)
const templateData = ref()
const importData = ref()
const templateEditorModal = ref(false)
const useForm = Form.useForm

const importState = reactive({
  fileList: [],
  url: '',
  jsonEditor: {},
  parserConfig: {
    maxRowsToParse: 500,
    normalizeNested: true,
    importData: true,
  },
})

const validators = computed(() => {
  return {
    url: [fieldRequiredValidator, importUrlValidator, importType === 'csv' ? importCsvUrlValidator : importExcelUrlValidator],
    maxRowsToParse: [fieldRequiredValidator],
  }
})

const importMeta = computed(() => {
  if (importType === 'excel') {
    return {
      header: 'QUICK IMPORT - EXCEL',
      uploadHint: t('msg.info.excelSupport'),
      urlInputLabel: t('msg.info.excelURL'),
      loadUrlDirective: ['c:quick-import:excel:load-url'],
      acceptTypes: '.xls, .xlsx, .xlsm, .ods, .ots',
    }
  } else if (importType === 'csv') {
    return {
      header: 'QUICK IMPORT - CSV',
      uploadHint: '',
      urlInputLabel: t('msg.info.csvURL'),
      loadUrlDirective: ['c:quick-import:csv:load-url'],
      acceptTypes: '.csv',
    }
  } else if (importType === 'json') {
    return {
      header: 'QUICK IMPORT - JSON',
      uploadHint: '',
      acceptTypes: '.json',
    }
  }
  return {}
})

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

const { resetFields, validate, validateInfos } = useForm(importState, validators)

async function handlePreImport() {
  loading.value = true
  if (activeKey.value === 'uploadTab') {
    // FIXME:
    importState.fileList.map(async (file: any) => {
      await parseAndExtractData(file.data, file.name)
    })
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
  loading.value = true
  await templateEditorRef.value.importTemplate()
  loading.value = false
  dialogShow.value = false
}

async function parseAndExtractData(val: any, name: string) {
  try {
    templateData.value = null
    importData.value = null
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
    templateEditorModal.value = true
  } catch (e: any) {
    console.log(e)
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}

function handleDrop(e: DragEvent) {
  console.log(e)
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
  loading.value = true
  jsonEditorRef.value.format()
  loading.value = false
}

function populateUniqueTableName() {
  let c = 1
  while (tables.value.some((t: TableType) => t.title === `Sheet${c}`)) {
    c++
  }
  return `Sheet${c}`
}

function getAdapter(name: string, val: any) {
  if (importType === 'excel' || importType === 'csv') {
    if (activeKey.value === 'uploadTab') {
      return new ExcelTemplateAdapter(name, val, importState.parserConfig)
    } else if (activeKey.value === 'urlTab') {
      return new ExcelUrlTemplateAdapter(val, importState.parserConfig)
    }
  } else if (importType === 'json') {
    if (activeKey.value === 'uploadTab') {
      return new JSONTemplateAdapter(name, val, importState.parserConfig)
    } else if (activeKey.value === 'urlTab') {
      return new JSONUrlTemplateAdapter(val, importState.parserConfig)
    } else if (activeKey.value === 'jsonEditorTab') {
      return new JSONTemplateAdapter(name, val, importState.parserConfig)
    }
  }
  return {}
}
</script>

<template>
  <a-modal v-model:visible="dialogShow" width="max(90vw, 600px)" @keydown.esc="dialogShow = false">
    <a-typography-title class="ml-4 mb-4 select-none" type="secondary" :level="5">{{ importMeta.header }}</a-typography-title>
    <template #footer>
      <a-button v-if="templateEditorModal" key="back" @click="templateEditorModal = false">Back</a-button>
      <a-button v-else key="cancel" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>
      <a-button v-if="activeKey === 'jsonEditorTab'" key="format" :loading="loading" @click="formatJson">Format JSON</a-button>
      <a-button v-if="!templateEditorModal" key="pre-import" type="primary" :loading="loading" @click="handlePreImport">{{
        $t('activity.import')
      }}</a-button>
      <a-button v-else key="import" type="primary" :loading="loading" @click="handleImport">{{ $t('activity.import') }}</a-button>
    </template>
    <TemplateEditor
      v-if="templateEditorModal"
      ref="templateEditorRef"
      :project-template="templateData"
      :import-data="importData"
      :quick-import-type="importType"
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
            :accept="importMeta.acceptTypes"
            :max-count="1"
            list-type="picture"
            @change="handleChange"
            @drop="handleDrop"
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
      <a-tab-pane v-if="importType === 'json'" key="jsonEditorTab" :closable="false">
        <template #tab>
          <span class="flex items-center gap-2">
            <MdiCodeJSONIcon />
            Json Editor
          </span>
        </template>
        <div class="pr-10 pb-10 pt-5">
          <MonacoEditor ref="jsonEditorRef" v-model="importState.jsonEditor" class="min-h-60 max-h-80" />
        </div>
      </a-tab-pane>
      <a-tab-pane v-else key="urlTab" :closable="false">
        <template #tab>
          <span class="flex items-center gap-2">
            <MdiLinkVariantIcon />
            Url
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
    <div v-if="!templateEditorModal">
      <a-divider />
      <div class="mb-4">
        <span class="prose-xl font-bold">Advanced Settings</span>
        <a-form-item class="mt-4 mb-2" :label="t('msg.info.footMsg')" v-bind="validateInfos.maxRowsToParse">
          <a-input-number v-model:value="importState.parserConfig.maxRowsToParse" :min="1" :max="50000" />
        </a-form-item>
        <div v-if="importType === 'json'" class="mt-3">
          <a-checkbox v-model:checked="importState.parserConfig.normalizeNested">
            <span class="caption">Flatten nested</span>
          </a-checkbox>
        </div>
        <div v-if="importType === 'json'" class="mt-4">
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
