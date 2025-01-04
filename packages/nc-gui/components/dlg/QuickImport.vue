<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import { Upload } from 'ant-design-vue'
import { toRaw, unref } from '@vue/runtime-core'
// import worker script according to the doc of Vite
import importWorkerUrl from '~/workers/importWorker?worker&url'

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
  baseId: string
  sourceId: string
  importDataOnly?: boolean
}

const { importType, importDataOnly = false, baseId, sourceId, ...rest } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { $api } = useNuxtApp()

const { appInfo } = useGlobal()

const config = useRuntimeConfig()

const isWorkerSupport = typeof Worker !== 'undefined'

let importWorker: Worker | null

const { t } = useI18n()

const progressMsg = ref('Parsing Data ...')

const { tables } = storeToRefs(useBase())

const tablesStore = useTablesStore()
const { loadProjectTables } = tablesStore
const { baseTables } = storeToRefs(tablesStore)

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
    importDataOnly: true,
  },
}
const importState = reactive(defaultImportState)

const { token } = useGlobal()

const isImportTypeJson = computed(() => importType === 'json')

const isImportTypeCsv = computed(() => importType === 'csv')

const IsImportTypeExcel = computed(() => importType === 'excel')

const validators = computed(() => ({
  url: [fieldRequiredValidator(), importUrlValidator, isImportTypeCsv.value ? importCsvUrlValidator : importExcelUrlValidator],
}))

const { validate, validateInfos } = useForm(importState, validators)

const importMeta = computed(() => {
  if (IsImportTypeExcel.value) {
    return {
      header: `${t('title.quickImportExcel')}`,
      icon: 'importExcel',
      uploadHint: t('msg.info.excelSupport'),
      urlInputLabel: t('msg.info.excelURL'),
      loadUrlDirective: ['c:quick-import:excel:load-url'],
      acceptTypes: '.xls, .xlsx, .xlsm, .ods, .ots',
    }
  } else if (isImportTypeCsv.value) {
    return {
      header: `${t('title.quickImportCSV')}`,
      icon: 'importCsv',
      uploadHint: '',
      urlInputLabel: t('msg.info.csvURL'),
      loadUrlDirective: ['c:quick-import:csv:load-url'],
      acceptTypes: '.csv',
    }
  } else if (isImportTypeJson.value) {
    return {
      header: `${t('title.quickImportJSON')}`,
      icon: 'cellJson',
      uploadHint: '',
      acceptTypes: '.json',
    }
  }
  return {}
})

const dialogShow = useVModel(rest, 'modelValue', emit)

// watch dialogShow to init or terminate worker
if (isWorkerSupport && process.env.NODE_ENV === 'production') {
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

const isError = ref(false)

const disableImportButton = computed(() => !templateEditorRef.value?.isValid || isError.value)

const disableFormatJsonButton = computed(() => !jsonEditorRef.value?.isValid)

let templateGenerator: CSVTemplateAdapter | JSONTemplateAdapter | ExcelTemplateAdapter | null

async function handlePreImport() {
  preImportLoading.value = true
  isParsingData.value = true

  if (!baseTables.value.get(baseId)) {
    await loadProjectTables(baseId)
  }

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

  isParsingData.value = false
  preImportLoading.value = false
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

function populateUniqueTableName(tn: string, draftTn: string[] = []) {
  let c = 1
  while (
    draftTn.includes(tn) ||
    baseTables.value.get(baseId)?.some((t: TableType) => {
      const s = t.table_name.split('___')
      let target = t.table_name
      if (s.length > 1) target = s[1]
      return target === `${tn}` || t.table_name === `${tn}`
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
  const exceedLimit = file.size! / 1024 / 1024 > 25
  if (exceedLimit) {
    message.error(`File ${file.name} is too big. The accepted file size is less than 25MB.`)
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
        const draftTableNames = [] as string[]

        templateData.value.tables = templateData.value.tables.map((table: Record<string, any>) => {
          const table_name = populateUniqueTableName(table.table_name, draftTableNames)
          draftTableNames.push(table_name)
          return { ...table, table_name }
        })
      }
      importData.value = templateGenerator!.getData()
    }

    templateEditorModal.value = true
  } catch (e: any) {
    console.log(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const onError = () => {
  isError.value = true
}

const onChange = () => {
  isError.value = false
}

onMounted(() => {
  importState.parserConfig.importDataOnly = importDataOnly
  importState.parserConfig.autoSelectFieldTypes = importDataOnly
})

const collapseKey = ref('');
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    :closable="false"
    width="448px"
    class="!top-[12.5vh]"
    wrap-class-name="nc-modal-quick-import"
    @keydown.esc="dialogShow = false"
  >
    <a-spin :spinning="isParsingData" :tip="progressMsg" size="large">
        
      <div class="text-base font-weight-700 m-0 flex items-center gap-3">
        <GeneralIcon :icon="importMeta.icon" class="w-6 h-6" />
        {{ importMeta.header }}
        <a
          href="https://docs.nocodb.com/tables/create-table-via-import/"
          class="!text-gray-500 prose-sm ml-auto"
          target="_blank"
          rel="noopener">
          Docs
        </a>
      </div>

      <div
        class="mt-5"
        :class="{
          'mb-4': templateEditorModal,
        }"
      >
        <LazyTemplateEditor
          v-if="templateEditorModal"
          ref="templateEditorRef"
          :base-template="templateData"
          :import-data="importData"
          :import-columns="importColumns"
          :import-data-only="importDataOnly"
          :quick-import-type="importType"
          :max-rows-to-parse="importState.parserConfig.maxRowsToParse"
          :base-id="baseId"
          :source-id="sourceId"
          :import-worker="importWorker"
          class="nc-quick-import-template-editor"
          @import="handleImport"
          @error="onError"
          @change="onChange"
        />
        <div v-else>

          <a-upload-dragger
            v-model:fileList="importState.fileList"
            name="file"
            class="nc-input-import !scrollbar-thin-dull !py-4"
            list-type="picture"
            :accept="importMeta.acceptTypes"
            :max-count="isImportTypeCsv ? 5 : 1"
            :multiple="true"
            :custom-request="customReqCbk"
            :before-upload="beforeUpload"
            @change="handleChange"
            @reject="rejectDrop"
          >
            <component :is="iconMap.upload" class="w-6 h-6" />

            <!-- Click or drag file to this area to upload -->
            <p class="!mt-2 text-[13px]">
              Drop your document here or
              <span class="text-primary">browse file</span>
            </p>

            <p class="!mt-3 text-[13px] text-gray-500">
              Supported: {{ importMeta.acceptTypes }}
            </p>

            <p class="ant-upload-hint">
              {{ importMeta.uploadHint }}
            </p>

            <template #removeIcon>
              <component :is="iconMap.deleteListItem" />
            </template>
          </a-upload-dragger>

          <LazyMonacoEditor v-if="isImportTypeJson" ref="jsonEditorRef" v-model="importState.jsonEditor" class="min-h-60 max-h-80 mt-4" />

          <a-form v-if="!isImportTypeJson" :model="importState" name="quick-import-url-form" layout="vertical" class="mb-0 !mt-4">
            <a-form-item :label="importMeta.urlInputLabel" v-bind="validateInfos.url" :required="false">
              <a-input v-model:value="importState.url" class="!rounded-md" placeholder="Paste file link here..." />
            </a-form-item>
          </a-form>

        </div>
      </div>

      <div v-if="!templateEditorModal">
        <nc-button type="text" size="small" @click="collapseKey = !collapseKey ? 'advanced-settings' : ''">
          {{ $t('title.advancedSettings') }}
          <GeneralIcon icon="chevronDown" class="ml-2 !transition-all !transform" :class="{ '!rotate-180': collapseKey === 'advanced-settings' }" />
        </nc-button>

        <a-collapse ghost class="nc-import-collapse" v-model:active-key="collapseKey">
          <a-collapse-panel key="advanced-settings">

            <a-form-item v-if="isImportTypeCsv || IsImportTypeExcel" class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.firstRowAsHeaders">
                <span class="caption">{{ $t('labels.firstRowAsHeaders') }}</span>
              </a-checkbox>
            </a-form-item>

            <a-form-item v-if="isImportTypeJson" class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.normalizeNested">
                <span class="caption">{{ $t('labels.flattenNested') }}</span>
              </a-checkbox>
            </a-form-item>

            <a-form-item v-if="!importDataOnly" class="!my-2">
              <a-checkbox v-model:checked="importState.parserConfig.shouldImportData">{{ $t('labels.importData') }} </a-checkbox>
            </a-form-item>

          </a-collapse-panel>
        </a-collapse>
      </div>

    </a-spin>
    <template #footer>
      <div class="flex items-center gap-2 pt-3">

        <nc-button v-if="templateEditorModal" key="back" type="text" size="small" @click="templateEditorModal = false">
          {{ $t('general.back') }}
        </nc-button>
  
        <nc-button v-else key="cancel" type="text" size="small" @click="dialogShow = false">
          {{ $t('general.back') }}
        </nc-button>
  
        <div class="flex-1" />
  
        <nc-button
          v-if="activeKey === 'jsonEditorTab' && !templateEditorModal"
          key="format"
          size="small"
          :disabled="disableFormatJsonButton"
          @click="formatJson"
        >
          {{ $t('labels.formatJson') }}
        </nc-button>
  
        <nc-button
          v-if="!templateEditorModal"
          key="pre-import"
          size="small"
          class="nc-btn-import"
          :loading="preImportLoading"
          :disabled="disablePreImportButton"
          @click="handlePreImport"
        >
          {{ $t('activity.import') }}
        </nc-button>
  
        <nc-button
          v-else
          key="import"
          size="small"
          :loading="importLoading"
          :disabled="disableImportButton"
          @click="handleImport"
        >
          {{ $t('activity.import') }}
        </nc-button>

      </div>
    </template>
  </a-modal>
</template>

<style lang="scss">
.nc-modal-quick-import .ant-modal-footer {
  border: none;
  padding: 0 !important;
}
.nc-modal-quick-import .ant-collapse-content-box {
  padding-top: 0 !important;
  padding-left: 6px;
}
</style>

<style lang="scss" scoped>
.nc-modal-quick-import :deep(.ant-modal-footer) {
  @apply !px-0 !pb-0;
}
:deep(.ant-upload-list-item-thumbnail) {
  line-height: 48px;
}
:deep(.ant-upload-list-item-card-actions-btn.ant-btn-icon-only) {
  @apply !h-6;
}
.nc-import-collapse :deep(.ant-collapse-header) {
  display: none !important;
}
</style>
