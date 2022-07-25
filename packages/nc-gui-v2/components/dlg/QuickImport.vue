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
import { fieldRequiredValidator, importUrlValidator } from '~/utils/validation'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { JSONTemplateAdapter, JSONUrlTemplateAdapter, ExcelTemplateAdapter, ExcelUrlTemplateAdapter } from '~/utils/parsers'
import { useProject } from '#imports'
const { t } = useI18n()

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
}

const { modelValue, importType } = defineProps<Props>()
const { tables } = useProject()
const toast = useToast()
const emit = defineEmits(['update:modelValue'])
const activeKey = ref('upload')
const jsonEditorRef = ref()
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
    'url': [fieldRequiredValidator, importUrlValidator],
    'maxRowsToParse': [fieldRequiredValidator]
  }
})

const { resetFields, validate, validateInfos } = useForm(importState, validators)

const handleDrop = (e: DragEvent) => {
  console.log(e)
}

const rejectDrop = (fileList: any[]) => {
  fileList.map((file) => {
    toast.error(`Failed to upload file ${file.name}`)
  })
}

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

const handleChange = (info: UploadChangeParam) => {
  const status = info.file.status
  if (status !== 'uploading') {
    console.log(info.file, info.fileList)
  }
  if (status === 'done') {
    toast.success(`Uploaded file ${info.file.name} successfully`)
  } else if (status === 'error') {
    toast.error(`Failed to upload file ${info.file.name}`)
  }
}

const formatJson = () => {
  jsonEditorRef.value.format()
}

const handleImport = async () => {
  if (activeKey.value === 'upload') {
    importState.fileList.map(async (file: any) => {
      await parseAndExtractData('file', file.orginFileObj, file.name)
    })
  } else if (activeKey.value === 'url') {
    try {
      await validate()
      await parseAndExtractData('url', importState.url, '')
    } catch (e: any) {
      toast.error(await extractSdkResponseErrorMsg(e))
    }
  } else if (activeKey.value === 'json') {
    await parseAndExtractData('jsonEditor', JSON.stringify(importState.jsonEditor), '')
  }
}

const populateUniqueTableName = () => {
  let c = 1
  while (tables.value.some((t: TableType) => t.title === `Sheet${c}`)) {
    c++
  }
  return `Sheet${c}`
}

const getAdapter: any = (name: string, val: any) => {
  if (importType === 'excel' || importType === 'csv') {
    return {
      file: new ExcelTemplateAdapter(name, val, importState.parserConfig),
      url: new ExcelUrlTemplateAdapter(val, importState.parserConfig),
    }
  } else if (importType === 'json') {
    return {
      file: new JSONTemplateAdapter(name, val, importState.parserConfig),
      url: new JSONUrlTemplateAdapter(val, importState.parserConfig),
      jsonEditor: new JSONTemplateAdapter(name, val, importState.parserConfig),
    }
  }
  return {}
}

const parseAndExtractData = async (type: string, val: any, name: string) => {
  try {
    let templateGenerator
    templateData.value = null
    importData.value = null
    templateGenerator = getAdapter(name, val)[type]

    await templateGenerator.init()
    templateGenerator.parse()
    templateData.value = templateGenerator.getTemplate()
    templateData.value.tables[0].table_name = populateUniqueTableName()
    importData.value = templateGenerator.getData()
    templateEditorModal.value = true
    dialogShow.value = false
  } catch (e: any) {
    console.log(e)
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <a-modal v-model:visible="dialogShow" width="max(90vw, 600px)" @keydown.esc="dialogShow = false">
    <a-typography-title class="ml-4 mb-4 select-none" type="secondary" :level="5">{{ importMeta.header }}</a-typography-title>
    <template #footer>
      <a-button key="back" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>
      <a-button v-if="activeKey === 'json'" key="format" :loading="loading" @click="formatJson">Format JSON</a-button>
      <a-button key="submit" type="primary" :loading="loading" @click="handleImport">Import</a-button>
    </template>
    <a-tabs v-model:activeKey="activeKey" hide-add type="editable-card" :tab-position="top">
      <a-tab-pane key="upload" :closable="false">
        <template #tab>
          <span class="flex items-center gap-2">
            <MdiFileUploadOutlineIcon />
            Upload
          </span>
        </template>
        <div class="pr-10 pb-10 pt-5">
          <a-form-item :label="t('msg.info.footMsg')" v-bind="validateInfos.maxRowsToParse">
            <a-input-number id="x" v-model:value="importState.parserConfig.maxRowsToParse" :min="1" :max="50000" size="large" />
          </a-form-item>
          <a-upload-dragger
            v-model:fileList="importState.fileList"
            name="file"
            :multiple="true"
            :accept="importMeta.acceptTypes"
            @change="handleChange"
            @drop="handleDrop"
            @reject="rejectDrop"
            list-type="picture"
          >
            <MdiFileIcon size="large" />
            <p class="ant-upload-text">Click or drag file to this area to upload</p>
            <p class="ant-upload-hint">
              {{ importMeta.uploadHint }}
            </p>
          </a-upload-dragger>
        </div>
      </a-tab-pane>
      <a-tab-pane v-if="importType === 'json'" key="json" :closable="false">
        <template #tab>
          <span class="flex items-center gap-2">
            <MdiCodeJSONIcon />
            Json Editor
          </span>
        </template>
        <div class="pr-10 pb-10 pt-5">
          <MonacoEditor v-model="importState.jsonEditor" class="h-[400px]" ref="jsonEditorRef" />
        </div>
      </a-tab-pane>
      <a-tab-pane v-else key="url" :closable="false">
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
  </a-modal>
  <TemplateEditor v-if="templateEditorModal" :project-template="templateData" :import-data="importData" :quick-import-type="importType"/>
</template>

<style scoped lang="scss">
:deep(.ant-upload-list) {
  overflow: auto;
  height: 300px;
}
</style>
