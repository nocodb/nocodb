<script setup lang="ts">
import { type TableType, charsetOptions } from 'nocodb-sdk'
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import { Upload } from 'ant-design-vue'
import { toRaw, unref } from '@vue/runtime-core'
// import worker script according to the doc of Vite
import getCrossOriginWorkerURL from 'crossoriginworker'
import importWorkerUrl from '~/workers/importWorker?worker&url'

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
  baseId: string
  sourceId: string
  importDataOnly?: boolean
  transition?: string
}

const { importType, importDataOnly = false, baseId, sourceId, transition, ...rest } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'back'])

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

const templateEditorRef = ref()

const preImportLoading = ref(false)

const importLoading = ref(false)

const templateData = ref()

const importData = ref()

const importColumns = ref([])

const templateEditorModal = ref(false)

const isParsingData = ref(false)

const collapseKey = ref('')

const temporaryJson = ref({})

const jsonErrorText = ref('')

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
const importState = reactive(structuredClone(defaultImportState))

const { token } = useGlobal()

const isImportTypeJson = computed(() => importType === 'json')

const isImportTypeCsv = computed(() => importType === 'csv')

const IsImportTypeExcel = computed(() => importType === 'excel')

const validators = computed(() => ({
  url: [importUrlValidator, isImportTypeCsv.value ? importCsvUrlValidator : importExcelUrlValidator],
}))

const { validate, validateInfos } = useForm(importState, validators)

const importMeta = computed(() => {
  if (IsImportTypeExcel.value) {
    return {
      header: importDataOnly ? t('activity.uploadExcel') : t('title.quickImportExcel'),
      icon: 'importExcel',
      uploadHint: '',
      urlInputLabel: t('msg.info.excelURL'),
      loadUrlDirective: ['c:quick-import:excel:load-url'],
      acceptTypes: '.xls, .xlsx, .xlsm, .ods, .ots',
    }
  } else if (isImportTypeCsv.value) {
    return {
      header: importDataOnly ? t('activity.uploadCSV') : t('title.quickImportCSV'),
      icon: 'importCsv',
      uploadHint: '',
      urlInputLabel: t('msg.info.csvURL'),
      loadUrlDirective: ['c:quick-import:csv:load-url'],
      acceptTypes: '.csv',
    }
  } else if (isImportTypeJson.value) {
    return {
      header: `${t('title.quickImportJSON')}`,
      icon: 'importJson',
      uploadHint: '',
      acceptTypes: '.json',
    }
  }
  return {}
})

const dialogShow = useVModel(rest, 'modelValue', emit)

watch(dialogShow, (newValue) => {
  if (newValue) {
    Object.assign(importState, structuredClone(defaultImportState))
  }
})

// watch dialogShow to init or terminate worker
if (isWorkerSupport) {
  watch(
    dialogShow,
    async (val) => {
      if (val) {
        importWorker = new Worker(
          await getCrossOriginWorkerURL(importWorkerUrl),
          process.env.NODE_ENV === 'development' ? { type: 'module' } : undefined,
        )
      } else {
        importWorker?.terminate()
      }
    },
    { immediate: true },
  )
}

const filterOption = (input = '', params: { key: string }) => {
  return params.key?.toLowerCase().includes(input.toLowerCase())
}

const isPreImportFileFilled = computed(() => {
  return importState.fileList?.length > 0
})

const isPreImportUrlFilled = computed(() => {
  return validateInfos?.url?.validateStatus === 'success' && !!importState.url
})

const isPreImportJsonFilled = computed(() => {
  return JSON.stringify(importState.jsonEditor).length > 2 && !jsonErrorText.value
})

const disablePreImportButton = computed(() => {
  if (isImportTypeCsv.value) {
    return isPreImportFileFilled.value === isPreImportUrlFilled.value
  } else if (IsImportTypeExcel.value) {
    return isPreImportFileFilled.value === isPreImportUrlFilled.value
  } else if (isImportTypeJson.value) {
    return !isPreImportFileFilled.value && !isPreImportJsonFilled.value
  }
})

const isError = ref(false)
const refMonacoEditor = ref()

const disableImportButton = computed(() => !templateEditorRef.value?.isValid || isError.value)

let templateGenerator: CSVTemplateAdapter | JSONTemplateAdapter | ExcelTemplateAdapter | null

async function handlePreImport() {
  preImportLoading.value = true
  isParsingData.value = true

  if (!baseTables.value.get(baseId)) {
    await loadProjectTables(baseId)
  }

  if (isImportTypeCsv.value) {
    if (isPreImportFileFilled.value) {
      await parseAndExtractData(importState.fileList as streamImportFileList)
    } else if (isPreImportUrlFilled.value) {
      try {
        await validate()
        await parseAndExtractData(importState.url)
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }
  } else if (isImportTypeJson.value) {
    if (isPreImportFileFilled.value) {
      if (isWorkerSupport && importWorker) {
        await parseAndExtractData(importState.fileList as streamImportFileList)
      } else {
        await parseAndExtractData((importState.fileList as importFileList)[0].data)
      }
    } else {
      await parseAndExtractData(JSON.stringify(importState.jsonEditor))
    }
  } else if (IsImportTypeExcel) {
    if (isPreImportFileFilled.value) {
      if (isWorkerSupport && importWorker) {
        await parseAndExtractData(importState.fileList as streamImportFileList)
      } else {
        await parseAndExtractData((importState.fileList as importFileList)[0].data)
      }
    } else if (isPreImportUrlFilled.value) {
      try {
        await validate()
        await parseAndExtractData(importState.url)
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }
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
          encoding: 'utf-8',
        })
      } else {
        // need to set default encoding to utf-8
        importState.fileList.find((f) => f.uid === info.file.uid)!.encoding = 'utf-8'
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
              encoding: 'utf-8',
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
  refMonacoEditor.value?.format()
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
    if (isPreImportFileFilled.value) {
      return new CSVTemplateAdapter(val, {
        ...importState.parserConfig,
        importFromURL: false,
      })
    } else {
      return new CSVTemplateAdapter(val, {
        ...importState.parserConfig,
        importFromURL: true,
      })
    }
  } else if (IsImportTypeExcel.value) {
    if (isPreImportFileFilled.value) {
      return new ExcelTemplateAdapter(val, importState.parserConfig)
    } else {
      return new ExcelUrlTemplateAdapter(val, importState.parserConfig, $api)
    }
  } else if (isImportTypeJson.value) {
    if (isPreImportFileFilled.value) {
      return new JSONTemplateAdapter(val, importState.parserConfig)
    } else {
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
  let importType: ImportType
  if (isImportTypeCsv.value) {
    importType = ImportType.CSV
  } else if (IsImportTypeExcel.value) {
    importType = ImportType.EXCEL
  } else if (isImportTypeJson.value) {
    importType = ImportType.JSON
  }
  importType = importType! ?? ImportType.CSV

  let importSource: ImportSource
  if (isPreImportFileFilled.value) {
    importSource = ImportSource.FILE
  } else if (isPreImportUrlFilled.value && importType !== ImportType.JSON) {
    importSource = ImportSource.URL
  } else if (importType === ImportType.JSON) {
    importSource = ImportSource.STRING
  }
  importSource = importSource! ?? ImportSource.FILE

  return {
    config: {
      ...toRaw(importState.parserConfig),
      importFromURL: importSource === ImportSource.URL,
    },
    value,
    importType,
    importSource,
  }
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

function handleJsonChange(newValue: any) {
  try {
    temporaryJson.value = newValue
    importState.jsonEditor = JSON.parse(JSON.stringify(newValue))
    jsonErrorText.value = ''
  } catch (e: any) {
    jsonErrorText.value = e.message || 'Invalid JSON'
  }
}

watch(
  () => importState.fileList,
  () => {
    if (isImportTypeJson.value) {
      setTimeout(() => {
        const data = importState.fileList?.[0]?.data
        if (data && 'TextDecoder' in window) {
          try {
            temporaryJson.value = JSON.parse(new TextDecoder().decode(data))
            importState.jsonEditor = JSON.parse(new TextDecoder().decode(data))
          } catch (e) {
            console.log(e)
          }
        }
      }, 500)
    }
  },
)
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    :closable="false"
    :width="templateEditorModal && importDataOnly ? '640px' : '448px'"
    class="!top-[12.5vh]"
    wrap-class-name="nc-modal-quick-import"
    :transition-name="transition"
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
          rel="noopener"
        >
          Docs
        </a>
      </div>

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
          :base-id="baseId"
          :source-id="sourceId"
          :import-worker="importWorker"
          :table-icon="importMeta.icon"
          class="nc-quick-import-template-editor"
          @import="handleImport"
          @error="onError"
          @change="onChange"
        />
        <div v-else>
          <a-upload-dragger
            v-model:fileList="importState.fileList"
            name="file"
            class="nc-modern-drag-import nc-input-import !scrollbar-thin-dull !py-4 !transition !rounded-lg !border-gray-200"
            list-type="picture"
            :accept="importMeta.acceptTypes"
            :max-count="isImportTypeCsv ? 3 : 1"
            :multiple="true"
            :custom-request="customReqCbk"
            :before-upload="beforeUpload"
            :disabled="isImportTypeJson ? isPreImportJsonFilled && !isPreImportFileFilled : isPreImportUrlFilled"
            @change="handleChange"
            @reject="rejectDrop"
          >
            <component :is="iconMap.upload" class="w-6 h-6" />

            <p class="!mt-2 text-[13px]">
              {{ $t('msg.dropYourDocHere') }} {{ $t('general.or').toLowerCase() }}
              <span class="text-nc-content-brand hover:underline">{{ $t('labels.browseFiles') }}</span>
            </p>

            <p class="!mt-3 text-[13px] text-gray-500">{{ $t('general.supported') }}: {{ importMeta.acceptTypes }}</p>

            <p class="ant-upload-hint">
              {{ importMeta.uploadHint }}
            </p>

            <template #itemRender="{ file, actions }">
              <div class="flex items-center gap-4">
                <div class="bg-gray-100 h-10 flex flex-shrink items-center justify-center rounded-lg">
                  <CellAttachmentIconView :item="{ title: file.name, mimetype: file.type }" class="w-9 h-9" />
                </div>
                <div class="flex flex-col flex-grow min-w-[0px]">
                  <div class="text-[14px] text-[#15171A] font-weight-500">
                    <NcTooltip>
                      <template #title>
                        {{ file.name }}
                      </template>
                      <span class="inline-block truncate w-full">
                        {{ file.name }}
                      </span>
                    </NcTooltip>
                  </div>
                  <div class="text-[14px] text-[#565B66] mt-1 font-weight-500">
                    {{ getReadableFileSize(file.size) }}
                  </div>
                </div>
                <a-form-item class="flex-1 !my-0 max-w-[120px] min-w-[120px]">
                  <NcSelect
                    v-model:value="file.encoding"
                    :filter-option="filterOption"
                    class="w-[120px] max-w-[120px] nc-select-shadow"
                    show-search
                  >
                    <a-select-option v-for="enc of charsetOptions" :key="enc.label" :value="enc.value">
                      <div class="w-full flex items-center gap-2">
                        <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                          <template #title>{{ enc.label }}</template>
                          <span>{{ enc.label }}</span>
                        </NcTooltip>
                        <component
                          :is="iconMap.check"
                          v-if="file.encoding === enc.value"
                          id="nc-selected-item-icon"
                          class="text-nc-content-purple-medium w-4 h-4"
                        />
                      </div>
                    </a-select-option>
                  </NcSelect>
                </a-form-item>
                <nc-button type="text" size="xsmall" class="flex-shrink" @click="actions?.remove?.()">
                  <GeneralIcon icon="deleteListItem" />
                </nc-button>
              </div>
            </template>
          </a-upload-dragger>

          <div v-if="isImportTypeJson" class="my-5">
            <div class="flex items-end gap-2">
              <label> Enter Json </label>
              <div class="flex-1" />
              <NcButton type="text" size="xsmall" class="!px-2" @click="formatJson()"> Format </NcButton>
            </div>
            <LazyMonacoEditor
              ref="refMonacoEditor"
              class="nc-import-monaco-editor h-30 !border-1 !rounded-lg !mt-2"
              :auto-focus="false"
              hide-minimap
              :read-only="isPreImportFileFilled"
              :monaco-config="{
                lineNumbers: 'on',
              }"
              :model-value="temporaryJson"
              @update:model-value="handleJsonChange($event)"
            />
            <a-alert v-if="jsonErrorText && !isPreImportFileFilled" type="error" class="!rounded-lg !mt-2 !border-none !p-3">
              <template #message>
                <div class="flex flex-row items-center gap-2 mb-2">
                  <GeneralIcon icon="ncAlertCircleFilled" class="text-red-500 w-4 h-4" />
                  <span class="font-weight-700 text-[14px]">Json Error</span>
                </div>
              </template>
              <template #description>
                <div class="text-gray-500 text-[13px] leading-5 ml-6">
                  {{ jsonErrorText }}
                </div>
              </template>
            </a-alert>
          </div>

          <a-form v-if="!isImportTypeJson" :model="importState" name="quick-import-url-form" layout="vertical" class="mb-0 !mt-5">
            <a-form-item :label="importMeta.urlInputLabel" v-bind="validateInfos.url" :required="false">
              <a-input
                v-model:value="importState.url"
                class="!rounded-md"
                placeholder="Paste file link here..."
                :disabled="isPreImportFileFilled"
              />
            </a-form-item>
          </a-form>
        </div>
      </div>

      <div v-if="!templateEditorModal" class="mt-5">
        <nc-button type="text" size="small" @click="collapseKey = !collapseKey ? 'advanced-settings' : ''">
          {{ $t('title.advancedSettings') }}
          <GeneralIcon
            icon="chevronDown"
            class="ml-2 !transition-all !transform"
            :class="{ '!rotate-180': collapseKey === 'advanced-settings' }"
          />
        </nc-button>

        <a-collapse v-model:active-key="collapseKey" ghost class="nc-import-collapse">
          <a-collapse-panel key="advanced-settings">
            <a-form-item v-if="isImportTypeCsv || IsImportTypeExcel" class="!my-2 nc-dense-checkbox-container">
              <a-checkbox v-model:checked="importState.parserConfig.firstRowAsHeaders">
                <span class="caption">{{ $t('labels.firstRowAsHeaders') }}</span>
              </a-checkbox>
            </a-form-item>

            <a-form-item v-if="isImportTypeJson" class="!my-2 nc-dense-checkbox-container">
              <a-checkbox v-model:checked="importState.parserConfig.normalizeNested">
                <span class="caption">{{ $t('labels.flattenNested') }}</span>
              </a-checkbox>
            </a-form-item>

            <a-form-item v-if="!importDataOnly" class="!my-2 nc-dense-checkbox-container">
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

        <nc-button
          v-else
          key="cancel"
          type="text"
          size="small"
          @click="
            () => {
              dialogShow = false
              emit('back')
            }
          "
        >
          {{ $t('general.back') }}
        </nc-button>

        <div class="flex-1" />

        <nc-button
          v-if="!templateEditorModal"
          key="pre-import"
          size="small"
          class="nc-btn-import"
          :loading="preImportLoading"
          :disabled="disablePreImportButton"
          @click="handlePreImport"
        >
          {{ importDataOnly ? $t('activity.upload') : $t('activity.import') }}
        </nc-button>

        <nc-button
          v-else
          key="import"
          size="small"
          :loading="importLoading"
          :disabled="disableImportButton"
          @click="handleImport"
        >
          {{ importDataOnly ? $t('activity.upload') : $t('activity.import') }}
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
.nc-import-monaco-editor .monaco-editor {
  outline-width: 0 !important;
  & * {
    outline-width: 0 !important;
    border-width: 0 !important;
  }
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
span:has(> .nc-modern-drag-import) {
  display: flex;
  flex-direction: column-reverse;
  :deep(& > .ant-upload-list:has(.ant-upload-list-picture-container)) {
    @apply mb-4 space-y-2 transition-all nc-scrollbar-thin overflow-hidden;
  }
}
:deep(.nc-modern-drag-import:not(.ant-upload-disabled)) {
  @apply bg-white hover:bg-gray-50;
}
:deep(.nc-dense-checkbox-container .ant-form-item-control-input) {
  min-height: unset !important;
}
</style>
