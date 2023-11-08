<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import { Upload } from 'ant-design-vue'
import { toRaw, unref } from '@vue/runtime-core'
import type { ImportWorkerPayload, importFileList, streamImportFileList } from '#imports'
import {
  BASE_FALLBACK_URL,
  CSVTemplateAdapter,
  ExcelTemplateAdapter,
  ExcelUrlTemplateAdapter,
  Form,
  ImportSource,
  ImportType,
  ImportWorkerOperations,
  ImportWorkerResponse,
  JSONTemplateAdapter,
  JSONUrlTemplateAdapter,
  computed,
  extractSdkResponseErrorMsg,
  fieldRequiredValidator,
  iconMap,
  importCsvUrlValidator,
  importExcelUrlValidator,
  importUrlValidator,
  initWorker,
  message,
  reactive,
  ref,
  storeToRefs,
  useBase,
  useGlobal,
  useI18n,
  useNuxtApp,
  useVModel,
} from '#imports'

// import worker script according to the doc of Vite
import importWorkerUrl from '~/workers/importWorker?worker&url'

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
  sourceId: string
  importDataOnly?: boolean
}

const { importType, importDataOnly = false, sourceId, ...rest } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { $api } = useNuxtApp()

const { appInfo } = useGlobal()

const config = useRuntimeConfig()

const isWorkerSupport = typeof Worker !== 'undefined'

let importWorker: Worker | null

const { t } = useI18n()

const progressMsg = ref('Parsing Data ...')

const { tables } = storeToRefs(useBase())

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

const defaultImportState = {
  fileList: [] as importFileList | streamImportFileList,
  url: '',
  jsonEditor: {},
  parserConfig: {
    maxRowsToParse: 500,
    normalizeNested: true,
    autoSelectFieldTypes: true,
    firstRowAsHeaders: true,
    shouldImportData: true,
  },
}
const importState = reactive(defaultImportState)

const { token } = useGlobal()

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
      header: `${t('title.quickImportExcel')}`,
      uploadHint: t('msg.info.excelSupport'),
      urlInputLabel: t('msg.info.excelURL'),
      loadUrlDirective: ['c:quick-import:excel:load-url'],
      acceptTypes: '.xls, .xlsx, .xlsm, .ods, .ots',
    }
  } else if (isImportTypeCsv.value) {
    return {
      header: `${t('title.quickImportCSV')}`,
      uploadHint: '',
      urlInputLabel: t('msg.info.csvURL'),
      loadUrlDirective: ['c:quick-import:csv:load-url'],
      acceptTypes: '.csv',
    }
  } else if (isImportTypeJson.value) {
    return {
      header: `${t('title.quickImportJSON')}`,
      uploadHint: '',
      acceptTypes: '.json',
    }
  }
  return {}
})

const dialogShow = useVModel(rest, 'modelValue', emit)

// watch dialogShow to init or terminate worker
if (isWorkerSupport) {
  watch(
    dialogShow,
    async (val) => {
      if (val) {
        importWorker = await initWorker(importWorkerUrl)
      } else {
        importWorker?.terminate()
      }
    },
    { immediate: true },
  )
}

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
    if (isImportTypeCsv.value || (isWorkerSupport && importWorker)) {
      await parseAndExtractData(importState.fileList as streamImportFileList)
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
    if (!templateGenerator && !importWorker) {
      message.error(t('msg.error.templateGeneratorNotFound'))
      return
    }
    importLoading.value = true
    await templateEditorRef.value.importTemplate()
  } catch (e: any) {
    return message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    importLoading.value = false
    templateEditorModal.value = false
    Object.assign(importState, defaultImportState)
  }
  dialogShow.value = false
}

function rejectDrop(fileList: UploadFile[]) {
  fileList.map((file) => {
    return message.error(`${t('msg.error.fileUploadFailed')} ${file.name}`)
  })
}

function handleChange(info: UploadChangeParam) {
  const status = info.file.status
  if (status && status !== 'uploading' && status !== 'removed') {
    if (isImportTypeCsv.value || (isWorkerSupport && importWorker)) {
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

function populateUniqueTableName(tn: string) {
  let c = 1
  while (
    tables.value.some((t: TableType) => {
      const s = t.table_name.split('___')
      let target = t.table_name
      if (s.length > 1) target = s[1]
      return target === `${tn}`
    })
  ) {
    tn = `${tn}_${c++}`
  }
  return tn
}

function getAdapter(val: any) {
  if (isImportTypeCsv.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        return new CSVTemplateAdapter(val, {
          ...importState.parserConfig,
          importFromURL: false,
        })
      case 'urlTab':
        return new CSVTemplateAdapter(val, {
          ...importState.parserConfig,
          importFromURL: true,
        })
    }
  } else if (IsImportTypeExcel.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        return new ExcelTemplateAdapter(val, importState.parserConfig)
      case 'urlTab':
        return new ExcelUrlTemplateAdapter(val, importState.parserConfig, $api)
    }
  } else if (isImportTypeJson.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        return new JSONTemplateAdapter(val, importState.parserConfig)
      case 'urlTab':
        return new JSONUrlTemplateAdapter(val, importState.parserConfig, $api)
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

// UploadFile[] for csv import (streaming)
// ArrayBuffer for excel import
function extractImportWorkerPayload(value: UploadFile[] | ArrayBuffer | string) {
  let payload: ImportWorkerPayload
  if (isImportTypeCsv.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        payload = {
          config: {
            ...importState.parserConfig,
            importFromURL: false,
          },
          value,
          importType: ImportType.CSV,
          importSource: ImportSource.FILE,
        }
        break
      case 'urlTab':
        payload = {
          config: {
            ...importState.parserConfig,
            importFromURL: true,
          },
          value,
          importType: ImportType.CSV,
          importSource: ImportSource.FILE,
        }
        break
    }
  } else if (IsImportTypeExcel.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        payload = {
          config: toRaw(importState.parserConfig),
          value,
          importType: ImportType.EXCEL,
          importSource: ImportSource.FILE,
        }
        break
      case 'urlTab':
        payload = {
          config: toRaw(importState.parserConfig),
          value,
          importType: ImportType.EXCEL,
          importSource: ImportSource.URL,
        }
        break
    }
  } else if (isImportTypeJson.value) {
    switch (activeKey.value) {
      case 'uploadTab':
        payload = {
          config: toRaw(importState.parserConfig),
          value,
          importType: ImportType.JSON,
          importSource: ImportSource.FILE,
        }
        break
      case 'urlTab':
        payload = {
          config: toRaw(importState.parserConfig),
          value,
          importType: ImportType.JSON,
          importSource: ImportSource.URL,
        }
        break
      case 'jsonEditorTab':
        payload = {
          config: toRaw(importState.parserConfig),
          value,
          importType: ImportType.JSON,
          importSource: ImportSource.STRING,
        }
        break
    }
  }
  return payload
}

// string for json import
async function parseAndExtractData(val: UploadFile[] | ArrayBuffer | string) {
  templateData.value = null
  importData.value = null
  importColumns.value = []
  try {
    // if the browser supports web worker, use it to parse the file and process the data
    if (isWorkerSupport && importWorker) {
      importWorker.postMessage([
        ImportWorkerOperations.INIT_SDK,
        {
          baseURL: config.public.ncBackendUrl || appInfo.value.ncSiteUrl || BASE_FALLBACK_URL,
          token: token.value,
        },
      ])

      let value = toRaw(val)

      // if array, iterate and unwrap proxy
      if (Array.isArray(value)) value = value.map((v) => toRaw(v))

      const payload = extractImportWorkerPayload(value)

      importWorker.postMessage([
        ImportWorkerOperations.SET_TABLES,
        unref(tables).map((t) => ({
          table_name: t.table_name,
          title: t.title,
        })),
      ])
      importWorker.postMessage([
        ImportWorkerOperations.SET_CONFIG,
        {
          importDataOnly,
          importColumns: !!importColumns.value,
          importData: !!importData.value,
        },
      ])

      const response: {
        templateData: any
        importColumns: any
        importData: any
      } = await new Promise((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          const [type, payload] = e.data
          switch (type) {
            case ImportWorkerResponse.PROCESSED_DATA:
              resolve(payload)
              importWorker?.removeEventListener('message', handler, false)
              break
            case ImportWorkerResponse.PROGRESS:
              progressMsg.value = payload
              break
            case ImportWorkerResponse.ERROR:
              reject(payload)
              importWorker?.removeEventListener('message', handler, false)
              break
          }
        }
        importWorker?.addEventListener('message', handler, false)

        importWorker?.postMessage([ImportWorkerOperations.PROCESS, payload])
      })
      templateData.value = response.templateData
      importColumns.value = response.importColumns
      importData.value = response.importData
    }
    // otherwise, use the main thread to parse the file and process the data
    else {
      templateGenerator = getAdapter(val)

      if (!templateGenerator) {
        message.error(t('msg.error.templateGeneratorNotFound'))
        return
      }

      await templateGenerator.init()

      await templateGenerator.parse()

      templateData.value = templateGenerator!.getTemplate()
      if (importDataOnly) importColumns.value = templateGenerator!.getColumns()
      else {
        // ensure the target table name not exist in current table list
        templateData.value.tables = templateData.value.tables.map((table: Record<string, any>) => ({
          ...table,
          table_name: populateUniqueTableName(table.table_name),
        }))
      }
      importData.value = templateGenerator!.getData()
    }

    templateEditorModal.value = true
  } catch (e: any) {
    console.log(e)
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isParsingData.value = false
    preImportLoading.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    :width="modalWidth"
    wrap-class-name="nc-modal-quick-import"
    @keydown.esc="dialogShow = false"
  >
    <a-spin :spinning="isParsingData" :tip="progressMsg" size="large">
      <div class="px-5">
        <div class="prose-xl font-weight-bold my-5">{{ importMeta.header }}</div>

        <div class="mt-5">
          <LazyTemplateEditor
            v-if="templateEditorModal"
            ref="templateEditorRef"
            :base-template="templateData"
            :import-data="importData"
            :import-columns="importColumns"
            :import-data-only="importDataOnly"
            :quick-import-type="importType"
            :max-rows-to-parse="importState.parserConfig.maxRowsToParse"
            :source-id="sourceId"
            :import-worker="importWorker"
            class="nc-quick-import-template-editor"
            @import="handleImport"
          />

          <a-tabs v-else v-model:activeKey="activeKey" hide-add type="editable-card" tab-position="top">
            <a-tab-pane key="uploadTab" :closable="false">
              <template #tab>
                <!--              Upload -->
                <div class="flex items-center gap-2">
                  <component :is="iconMap.fileUpload" />
                  {{ $t('general.upload') }}
                </div>
              </template>

              <div class="py-6">
                <a-upload-dragger
                  v-model:fileList="importState.fileList"
                  name="file"
                  class="nc-input-import !scrollbar-thin-dull"
                  list-type="picture"
                  :accept="importMeta.acceptTypes"
                  :max-count="isImportTypeCsv ? 5 : 1"
                  :multiple="true"
                  :custom-request="customReqCbk"
                  :before-upload="beforeUpload"
                  @change="handleChange"
                  @reject="rejectDrop"
                >
                  <component :is="iconMap.plusCircle" size="large" />

                  <!-- Click or drag file to this area to upload -->
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
                  <component :is="iconMap.json" />
                  {{ $t('title.jsonEditor') }}
                </span>
              </template>

              <div class="pb-3 pt-3">
                <LazyMonacoEditor ref="jsonEditorRef" v-model="importState.jsonEditor" class="min-h-60 max-h-80" />
              </div>
            </a-tab-pane>

            <a-tab-pane v-else key="urlTab" :closable="false">
              <template #tab>
                <span class="flex items-center gap-2">
                  <component :is="iconMap.link" />
                  {{ $t('datatype.URL') }}
                </span>
              </template>

              <div class="pr-10 pt-5">
                <a-form :model="importState" name="quick-import-url-form" layout="vertical" class="mb-0">
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

            <a-form-item v-if="!importDataOnly" class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.autoSelectFieldTypes">
                <span class="caption">Auto-Select Field Types</span>
              </a-checkbox>
            </a-form-item>

            <a-form-item v-if="isImportTypeCsv || IsImportTypeExcel" class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.firstRowAsHeaders">
                <span class="caption">{{ $t('labels.firstRowAsHeaders') }}</span>
              </a-checkbox>
            </a-form-item>

            <!-- Flatten nested -->
            <a-form-item v-if="isImportTypeJson" class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.normalizeNested">
                <span class="caption">{{ $t('labels.flattenNested') }}</span>
              </a-checkbox>
            </a-form-item>

            <!-- Import Data -->
            <a-form-item v-if="!importDataOnly" class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.shouldImportData">{{ $t('labels.importData') }} </a-checkbox>
            </a-form-item>
          </div>
        </div>
      </div>
    </a-spin>
    <template #footer>
      <a-button v-if="templateEditorModal" key="back" class="!rounded-md" @click="templateEditorModal = false"
        >{{ $t('general.back') }}
      </a-button>

      <a-button v-else key="cancel" class="!rounded-md" @click="dialogShow = false">{{ $t('general.cancel') }} </a-button>

      <a-button
        v-if="activeKey === 'jsonEditorTab' && !templateEditorModal"
        key="format"
        class="!rounded-md"
        :disabled="disableFormatJsonButton"
        @click="formatJson"
      >
        {{ $t('labels.formatJson') }}
      </a-button>

      <a-button
        v-if="!templateEditorModal"
        key="pre-import"
        type="primary"
        class="nc-btn-import !rounded-md"
        :loading="preImportLoading"
        :disabled="disablePreImportButton"
        @click="handlePreImport"
      >
        {{ $t('activity.import') }}
      </a-button>

      <a-button
        v-else
        key="import"
        type="primary"
        class="!rounded-md"
        :loading="importLoading"
        :disabled="disableImportButton"
        @click="handleImport"
      >
        {{ $t('activity.import') }}
      </a-button>
    </template>
  </a-modal>
</template>
