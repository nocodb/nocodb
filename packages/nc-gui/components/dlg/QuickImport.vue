<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import { Upload } from 'ant-design-vue'
import {
  CSVTemplateAdapter,
  ExcelTemplateAdapter,
  ExcelUrlTemplateAdapter,
  Form,
  JSONTemplateAdapter,
  JSONUrlTemplateAdapter,
  computed,
  extractSdkResponseErrorMsg,
  fieldRequiredValidator,
  importCsvUrlValidator,
  importExcelUrlValidator,
  importUrlValidator,
  message,
  reactive,
  ref,
  useI18n,
  useProject,
  useVModel,
} from '#imports'
import type { importFileList, streamImportFileList } from '~/lib'

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
  importOnly?: boolean
}

const { importType, importOnly = false, ...rest } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { tables } = useProject()

const activeKey = ref('uploadTab')

const jsonEditorRef = ref()

const templateEditorRef = ref()

const preImportLoading = ref(false)

const importLoading = ref(false)

const templateData = ref()

const importData = ref()

const importColumns = ref([])

const templateEditorModal = ref(false)

const isParsingData = ref(false)

const useForm = Form.useForm

const importState = reactive({
  fileList: [] as importFileList | streamImportFileList,
  url: '',
  jsonEditor: {},
  parserConfig: {
    maxRowsToParse: 500,
    normalizeNested: true,
    autoSelectFieldTypes: true,
    firstRowAsHeaders: true,
    importData: true,
  },
})

const isImportTypeJson = computed(() => importType === 'json')

const isImportTypeCsv = computed(() => importType === 'csv')

const IsImportTypeExcel = computed(() => importType === 'excel')

const validators = computed(() => ({
  url: [fieldRequiredValidator(), importUrlValidator, isImportTypeCsv.value ? importCsvUrlValidator : importExcelUrlValidator],
  maxRowsToParse: [fieldRequiredValidator()],
}))

const { validate, validateInfos } = useForm(importState, validators)

const importMeta = computed(() => {
  if (IsImportTypeExcel.value) {
    return {
      header: `${t('title.quickImport')} - EXCEL`,
      uploadHint: t('msg.info.excelSupport'),
      urlInputLabel: t('msg.info.excelURL'),
      loadUrlDirective: ['c:quick-import:excel:load-url'],
      acceptTypes: '.xls, .xlsx, .xlsm, .ods, .ots',
    }
  } else if (isImportTypeCsv.value) {
    return {
      header: `${t('title.quickImport')} - CSV`,
      uploadHint: '',
      urlInputLabel: t('msg.info.csvURL'),
      loadUrlDirective: ['c:quick-import:csv:load-url'],
      acceptTypes: '.csv',
    }
  } else if (isImportTypeJson.value) {
    return {
      header: `${t('title.quickImport')} - JSON`,
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

const disableImportButton = computed(() => !templateEditorRef.value?.isValid)

const disableFormatJsonButton = computed(() => !jsonEditorRef.value?.isValid)

const modalWidth = computed(() => {
  if (importType === 'excel' && templateEditorModal.value) {
    return 'max(90vw, 600px)'
  }

  return 'max(60vw, 600px)'
})

let templateGenerator: CSVTemplateAdapter | JSONTemplateAdapter | ExcelTemplateAdapter | null

async function handlePreImport() {
  preImportLoading.value = true
  isParsingData.value = true

  if (activeKey.value === 'uploadTab') {
    if (isImportTypeCsv.value) {
      await parseAndExtractStreamData(importState.fileList as streamImportFileList)
    } else {
      await parseAndExtractData((importState.fileList as importFileList)[0].data)
    }
  } else if (activeKey.value === 'urlTab') {
    try {
      await validate()
      await parseAndExtractData(importState.url)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  } else if (activeKey.value === 'jsonEditorTab') {
    await parseAndExtractData(JSON.stringify(importState.jsonEditor))
  }
}

async function handleImport() {
  try {
    if (!templateGenerator) {
      message.error(t('msg.error.templateGeneratorNotFound'))
      return
    }

    importLoading.value = true
    importData.value = templateGenerator.getData()
    await templateEditorRef.value.importTemplate()
  } catch (e: any) {
    return message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    importLoading.value = false
  }
  dialogShow.value = false
}

async function parseAndExtractStreamData(val: UploadFile[]) {
  try {
    templateData.value = null
    importData.value = null
    importColumns.value = []

    templateGenerator = getAdapter(val)

    if (!templateGenerator) {
      message.error(t('msg.error.templateGeneratorNotFound'))
      return
    }

    await templateGenerator.init()

    templateGenerator.parse(() => {
      templateData.value = templateGenerator!.getTemplate()
      // TODO(import): remove
      // templateData.value.tables[0].table_name = populateUniqueTableName()
      // if (importOnly) importColumns.value = templateGenerator.getColumns()
      templateEditorModal.value = true
      isParsingData.value = false
      preImportLoading.value = false
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

async function parseAndExtractData(val: string | ArrayBuffer) {
  try {
    templateData.value = null
    importData.value = null
    importColumns.value = []

    templateGenerator = getAdapter(val)

    if (!templateGenerator) {
      message.error(t('msg.error.templateGeneratorNotFound'))
      return
    }

    await templateGenerator.init()

    templateGenerator.parse(() => {
      templateData.value = templateGenerator!.getTemplate()
      if (importOnly) importColumns.value = templateGenerator!.getColumns()
      templateEditorModal.value = true
      isParsingData.value = false
      preImportLoading.value = false
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

function rejectDrop(fileList: UploadFile[]) {
  fileList.map((file) => {
    return message.error(`${t('msg.error.fileUploadFailed')} ${file.name}`)
  })
}

function handleChange(info: UploadChangeParam) {
  const status = info.file.status
  if (status && status !== 'uploading' && status !== 'removed') {
    if (isImportTypeCsv.value) {
      if (!importState.fileList.find((f) => f.uid === info.file.uid)) {
        ;(importState.fileList as streamImportFileList).push({
          ...info.file,
          status: 'done',
        })
      }
    } else {
      const reader = new FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const target = (importState.fileList as importFileList).find((f) => f.uid === info.file.uid)
        if (e.target && e.target.result) {
          /** if the file was pushed into the list by `<a-upload-dragger>` we just add the data to the file */
          if (target) {
            target.data = e.target.result
          } else if (!target) {
            /** if the file was added programmatically and not with d&d, we create file infos and push it into the list */
            importState.fileList.push({
              ...info.file,
              status: 'done',
              data: e.target.result,
            })
          }
        }
      }
      reader.readAsArrayBuffer(info.file.originFileObj!)
    }
  }

  if (status === 'done') {
    message.success(`Uploaded file ${info.file.name} successfully`)
  } else if (status === 'error') {
    message.error(`${t('msg.error.fileUploadFailed')} ${info.file.name}`)
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

function getAdapter(val: any) {
  if (isImportTypeCsv.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        return new CSVTemplateAdapter(val, importState.parserConfig)
      case 'urlTab':
        // TODO(import): implement one for CSV
        return new ExcelUrlTemplateAdapter(val, importState.parserConfig)
    }
  } else if (IsImportTypeExcel.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        return new ExcelTemplateAdapter(val, importState.parserConfig)
      case 'urlTab':
        return new ExcelUrlTemplateAdapter(val, importState.parserConfig)
    }
  } else if (isImportTypeJson.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        return new JSONTemplateAdapter(val, importState.parserConfig)
      case 'urlTab':
        return new JSONUrlTemplateAdapter(val, importState.parserConfig)
      case 'jsonEditorTab':
        return new JSONTemplateAdapter(val, importState.parserConfig)
    }
  }

  return null
}

defineExpose({
  handleChange,
})

/** a workaround to override default antd upload api call */
const customReqCbk = (customReqArgs: { file: any; onSuccess: () => void }) => {
  importState.fileList.forEach((f) => {
    if (f.uid === customReqArgs.file.uid) {
      f.status = 'done'
      handleChange({ file: f, fileList: importState.fileList })
    }
  })
  customReqArgs.onSuccess()
}

/** check if the file size exceeds the limit */
const beforeUpload = (file: UploadFile) => {
  const exceedLimit = file.size! / 1024 / 1024 > 5
  if (exceedLimit) {
    message.error(`File ${file.name} is too big. The accepted file size is less than 5MB.`)
  }
  return !exceedLimit || Upload.LIST_IGNORE
}
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :width="modalWidth"
    wrap-class-name="nc-modal-quick-import"
    @keydown.esc="dialogShow = false"
  >
    <a-spin :spinning="isParsingData" tip="Parsing Data ..." size="large">
      <div class="px-5">
        <div class="prose-xl font-weight-bold my-5">{{ importMeta.header }}</div>

        <div class="mt-5">
          <LazyTemplateEditor
            v-if="templateEditorModal"
            ref="templateEditorRef"
            :project-template="templateData"
            :import-data="importData"
            :import-columns="importColumns"
            :import-only="importOnly"
            :quick-import-type="importType"
            :max-rows-to-parse="importState.parserConfig.maxRowsToParse"
            class="nc-quick-import-template-editor"
            @import="handleImport"
          />

          <a-tabs v-else v-model:activeKey="activeKey" hide-add type="editable-card" tab-position="top">
            <a-tab-pane key="uploadTab" :closable="false">
              <template #tab>
                <!--              Upload -->
                <div class="flex items-center gap-2">
                  <MdiFileUploadOutline />
                  {{ $t('general.upload') }}
                </div>
              </template>

              <div class="py-6">
                <a-upload-dragger
                  v-model:fileList="importState.fileList"
                  name="file"
                  class="nc-input-import !scrollbar-thin-dull"
                  :accept="importMeta.acceptTypes"
                  :max-count="1"
                  list-type="picture"
                  :custom-request="customReqCbk"
                  :before-upload="beforeUpload"
                  @change="handleChange"
                  @reject="rejectDrop"
                >
                  <MdiFilePlusOutline size="large" />

                  <!--                Click or drag file to this area to upload -->
                  <p class="ant-upload-text">{{ $t('msg.info.import.clickOrDrag') }}</p>

                  <p class="ant-upload-hint">
                    {{ importMeta.uploadHint }}
                  </p>
                </a-upload-dragger>
              </div>
            </a-tab-pane>

            <a-tab-pane v-if="isImportTypeJson" key="jsonEditorTab" :closable="false">
              <template #tab>
                <span class="flex items-center gap-2">
                  <MdiCodeJson />
                  JSON Editor
                </span>
              </template>

              <div class="pb-3 pt-3">
                <LazyMonacoEditor ref="jsonEditorRef" v-model="importState.jsonEditor" class="min-h-60 max-h-80" />
              </div>
            </a-tab-pane>

            <a-tab-pane v-else key="urlTab" :closable="false">
              <template #tab>
                <span class="flex items-center gap-2">
                  <MdiLinkVariant />
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

        <div v-if="!templateEditorModal">
          <a-divider />

          <div class="mb-4">
            <!-- Advanced Settings -->
            <span class="prose-lg">{{ $t('title.advancedSettings') }}</span>

            <a-form-item class="!my-2" :label="t('msg.info.footMsg')" v-bind="validateInfos.maxRowsToParse">
              <a-input-number v-model:value="importState.parserConfig.maxRowsToParse" :min="1" :max="50000" />
            </a-form-item>

            <a-form-item class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.autoSelectFieldTypes">
                <span class="caption">Auto-Select Field Types</span>
              </a-checkbox>
            </a-form-item>

            <a-form-item v-if="isImportTypeCsv" class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.firstRowAsHeaders">
                <span class="caption">Use First Row as Headers</span>
              </a-checkbox>
            </a-form-item>

            <!-- Flatten nested -->
            <a-form-item v-if="isImportTypeJson" class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.normalizeNested">
                <span class="caption">{{ $t('labels.flattenNested') }}</span>
              </a-checkbox>
            </a-form-item>

            <!-- Import Data -->
            <a-form-item class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.importData">{{ $t('labels.importData') }}</a-checkbox>
            </a-form-item>
          </div>
        </div>
      </div>
    </a-spin>
    <template #footer>
      <a-button v-if="templateEditorModal" key="back" @click="templateEditorModal = false">Back</a-button>

      <a-button v-else key="cancel" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button
        v-if="activeKey === 'jsonEditorTab' && !templateEditorModal"
        key="format"
        :disabled="disableFormatJsonButton"
        @click="formatJson"
      >
        Format JSON
      </a-button>

      <a-button
        v-if="!templateEditorModal"
        key="pre-import"
        type="primary"
        class="nc-btn-import"
        :loading="preImportLoading"
        :disabled="disablePreImportButton"
        @click="handlePreImport"
      >
        {{ $t('activity.import') }}
      </a-button>

      <a-button v-else key="import" type="primary" :loading="importLoading" :disabled="disableImportButton" @click="handleImport">
        {{ $t('activity.import') }}
      </a-button>
    </template>
  </a-modal>
</template>
