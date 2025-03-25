<script setup lang="ts">
import { toRaw, unref } from '@vue/runtime-core'
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import { Upload } from 'ant-design-vue'
import { type TableType, charsetOptions, charsetOptionsMap, ncHasProperties } from 'nocodb-sdk'
import rfdc from 'rfdc'
import type { ProgressMessageObjType } from '../../helpers/parsers/TemplateGenerator'

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
  baseId: string
  sourceId: string
  importDataOnly?: boolean
  transition?: string
  showBackBtn?: boolean
}

const { importType, importDataOnly = false, baseId, sourceId, transition, showBackBtn, ...rest } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'back'])

enum ImportTypeTabs {
  'upload' = 'upload',
  'uploadFromUrl' = 'uploadFromUrl',
  'uploadJSON' = 'uploadJSON',
}

const { $api, $importWorker } = useNuxtApp()

let importWorker: Worker

const { appInfo } = useGlobal()

const config = useRuntimeConfig()

const meta = inject(MetaInj, ref())

const existingColumns = computed(() => meta.value?.columns?.filter((col) => !col.system) || [])

const isWorkerSupport = typeof Worker !== 'undefined'

const { t } = useI18n()

const progressMsg = ref('Reading data ...')
const progressMsgNew = ref<Record<string, string>>({})

const { tables } = storeToRefs(useBase())

const tablesStore = useTablesStore()
const { loadProjectTables } = tablesStore
const { baseTables } = storeToRefs(tablesStore)

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

const activeTab = ref<ImportTypeTabs>(ImportTypeTabs.upload)

const isError = ref(false)

const refMonacoEditor = ref()

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

watch(
  dialogShow,
  async (newValue) => {
    if (newValue) {
      Object.assign(importState, structuredClone(defaultImportState))
      if (isWorkerSupport) {
        importWorker = await $importWorker?.get()
      }
    }
  },
  { immediate: true },
)

const isPreImportFileFilled = computed(() => {
  return importState.fileList?.length > 0
})

const isPreImportUrlFilled = computed(() => {
  return validateInfos?.url?.validateStatus === 'success' && !!importState.url
})

const isPreImportJsonFilled = computed(() => {
  try {
    return refMonacoEditor.value.isValid && JSON.stringify(importState.jsonEditor).length > 2
  } catch {
    return false
  }
})

const localImportError = ref('')

const importError = computed(() => localImportError.value ?? templateEditorRef.value?.importError ?? '')

const maxFileUploadLimit = computed(() => (isImportTypeCsv.value ? 3 : 1))

const hideUpload = computed(() => preImportLoading.value || importState.fileList.length >= maxFileUploadLimit.value)

const disablePreImportButton = computed(() => {
  if (activeTab.value === ImportTypeTabs.upload) {
    return !isPreImportFileFilled.value
  } else if (activeTab.value === ImportTypeTabs.uploadFromUrl) {
    return !isPreImportUrlFilled.value
  } else if (activeTab.value === ImportTypeTabs.uploadJSON) {
    return !isPreImportJsonFilled.value
  }

  return true
})

const getBtnText = (isLoading: boolean = false) => {
  // configure field screen
  if (templateEditorModal.value) {
    if (isLoading) {
      return importDataOnly ? t('labels.uploading') : t('labels.importing')
    }

    return importDataOnly ? t('activity.upload') : t('activity.import')
  }

  const type = isImportTypeJson.value ? t('labels.jsonCapitalized') : t('objects.files')

  // upload file screen
  if (isLoading) {
    return importDataOnly ? `${t('labels.uploading')} ${type}` : `${t('labels.importing')} ${type}`
  }

  return importDataOnly ? `${t('activity.upload')} ${type}` : `${t('activity.import')} ${type}`
}

const importBtnText = computed(() => {
  return getBtnText(importLoading.value || preImportLoading.value)
})

const disableImportButton = computed(() => !templateEditorRef.value?.isValid || isError.value)

let templateGenerator: CSVTemplateAdapter | JSONTemplateAdapter | ExcelTemplateAdapter | null

async function handlePreImport() {
  preImportLoading.value = true
  isParsingData.value = true
  localImportError.value = ''

  if (!baseTables.value.get(baseId)) {
    await loadProjectTables(baseId)
  }

  const isPreImportFileMode = isPreImportFileFilled.value && activeTab.value === ImportTypeTabs.upload

  if (isImportTypeCsv.value) {
    if (isPreImportFileMode) {
      await parseAndExtractData(importState.fileList as streamImportFileList)
    } else if (isPreImportUrlFilled.value) {
      try {
        await validate()
        await parseAndExtractData(importState.url)
      } catch (e: any) {
        localImportError.value = await extractSdkResponseErrorMsg(e)
      }
    }
  } else if (isImportTypeJson.value) {
    if (isPreImportFileMode) {
      if (isWorkerSupport && importWorker) {
        await parseAndExtractData(importState.fileList as streamImportFileList)
      } else {
        await parseAndExtractData((importState.fileList as importFileList)[0].data)
      }
    } else if (isPreImportJsonFilled.value) {
      await parseAndExtractData(JSON.stringify(importState.jsonEditor))
    }
  } else if (IsImportTypeExcel) {
    if (isPreImportFileMode) {
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
        localImportError.value = await extractSdkResponseErrorMsg(e)
      }
    }
  }

  isParsingData.value = false
  preImportLoading.value = false
}

async function handleImport() {
  localImportError.value = ''
  try {
    if (!templateGenerator && !importWorker) {
      localImportError.value = t('msg.error.templateGeneratorNotFound')
      return
    }
    importLoading.value = true
    await templateEditorRef.value.importTemplate()

    templateEditorModal.value = false
    Object.assign(importState, defaultImportState)
    dialogShow.value = false
  } catch (e: any) {
    console.log(e)

    const errorMsg = await extractSdkResponseErrorMsg(e)
    localImportError.value = errorMsg
    return
  } finally {
    importLoading.value = false
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

  if (status === 'error') {
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
  const isPreImportFileMode = isPreImportFileFilled.value && activeTab.value === ImportTypeTabs.upload

  if (isImportTypeCsv.value) {
    if (isPreImportFileMode) {
      return new CSVTemplateAdapter(
        val,
        {
          ...importState.parserConfig,
          importFromURL: false,
        },
        undefined,
        unref(existingColumns),
      )
    } else {
      return new CSVTemplateAdapter(
        val,
        {
          ...importState.parserConfig,
          importFromURL: true,
        },
        undefined,
        unref(existingColumns),
      )
    }
  } else if (IsImportTypeExcel.value) {
    if (isPreImportFileMode) {
      return new ExcelTemplateAdapter(val, importState.parserConfig, undefined, undefined, unref(existingColumns))
    } else {
      return new ExcelUrlTemplateAdapter(val, importState.parserConfig, $api, undefined, undefined, unref(existingColumns))
    }
  } else if (isImportTypeJson.value) {
    if (isPreImportFileMode) {
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

const showMaxFileLimitError = ref(false)

/** check if the file size exceeds the limit */
const beforeUpload = (file: UploadFile, fileList: UploadFile[]) => {
  if (importState.fileList.length + fileList.length > maxFileUploadLimit.value) {
    showMaxFileLimitError.value = true
  }

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

  const isPreImportFileMode = isPreImportFileFilled.value && activeTab.value === ImportTypeTabs.upload

  if (isPreImportFileMode) {
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
    existingColumns: rfdc()(unref(existingColumns)),
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
              if (ncHasProperties<ProgressMessageObjType>(payload, ['title', 'value'])) {
                progressMsgNew.value = { ...progressMsgNew.value, [payload.title]: payload?.value ?? '' }
              } else {
                progressMsg.value = payload
              }

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
        localImportError.value = t('msg.error.templateGeneratorNotFound')
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
    showMaxFileLimitError.value = false
  } catch (e: any) {
    console.log(e)

    /**
     * If it is import url and it fail to send req due to cross origin or any other reason the e type will be string
     * @example: Failed to execute 'send' on 'XMLHttpRequest': Failed to load '<url>'
     */
    if (typeof e === 'string' && isPreImportUrlFilled.value && activeTab.value === ImportTypeTabs.uploadFromUrl) {
      localImportError.value = e.replace(importState.url, '').replace(/''/, '')
    } else {
      localImportError.value = (await extractSdkResponseErrorMsg(e)) || e?.toString()
    }
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

const onCancelImport = () => {
  $importWorker.terminate()
  Object.assign(importState, defaultImportState)
  preImportLoading.value = false
  importLoading.value = false
  templateData.value = undefined
  importData.value = undefined
  importColumns.value = []

  templateEditorModal.value = false
  isParsingData.value = false
  temporaryJson.value = {}
  jsonErrorText.value = ''
  isError.value = false
  localImportError.value = ''
}

onUnmounted(() => {
  onCancelImport()
})

const onClickCancel = () => {
  dialogShow.value = false
  emit('back')
  onCancelImport()
}

function handleJsonChange(newValue: any) {
  try {
    temporaryJson.value = newValue
    importState.jsonEditor = JSON.parse(JSON.stringify(newValue))
    jsonErrorText.value = ''
  } catch (e: any) {
    jsonErrorText.value = e.message || 'Invalid JSON'
  }
}

function handleResetImportError() {
  localImportError.value = ''
  templateEditorRef.value?.updateImportError?.('')
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

    // Hide max file limit error on removing file
    if (importState.fileList.length < maxFileUploadLimit.value && showMaxFileLimitError.value) {
      showMaxFileLimitError.value = false
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
    <div
      class="relative"
      :class="{
        'cursor-wait': preImportLoading || importLoading,
      }"
    >
      <div class="text-base font-weight-700 m-0 flex items-center gap-3">
        <GeneralIcon :icon="importMeta.icon" class="w-6 h-6" />
        {{ importMeta.header }}
        <a
          href="https://docs.nocodb.com/tables/create-table-via-import/"
          class="!text-nc-content-gray-subtle2 text-sm font-weight-500 ml-auto"
          target="_blank"
          rel="noopener"
        >
          Docs
        </a>
      </div>

      <div
        class="mt-5"
        :class="{
          'pointer-events-none': importLoading,
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
          :table-icon="importMeta.icon"
          class="nc-quick-import-template-editor"
          @import="handleImport"
          @error="onError"
          @change="onChange"
        />
        <div v-else>
          <NcTabs v-model:activeKey="activeTab" class="nc-quick-import-tabs" @update:active-key="handleResetImportError">
            <a-tab-pane :key="ImportTypeTabs.upload" :disabled="preImportLoading" class="!h-full">
              <template #tab>
                <div class="flex gap-2 items-center">
                  <span class="text-sm">{{ $t('general.upload') }} </span>
                </div>
              </template>
              <div class="relative mt-5">
                <a-upload-dragger
                  v-model:fileList="importState.fileList"
                  name="file"
                  class="nc-modern-drag-import nc-input-import !scrollbar-thin-dull !py-4 !transition !rounded-lg !border-gray-200"
                  :class="{
                    hidden: hideUpload,
                  }"
                  list-type="picture"
                  :accept="importMeta.acceptTypes"
                  :max-count="maxFileUploadLimit"
                  :multiple="true"
                  :disabled="preImportLoading"
                  :custom-request="customReqCbk"
                  :before-upload="beforeUpload"
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
                      <div class="bg-nc-bg-gray-extralight h-9 w-9 flex flex-none items-center justify-center rounded-lg">
                        <GeneralIcon :icon="importMeta.icon" class="w-5 h-5 flex-none" />
                      </div>
                      <div class="flex flex-col flex-grow min-w-[0px] w-[calc(100%_-_233px)]">
                        <div class="flex-none">
                          <NcTooltip show-on-truncate-only class="truncate text-sm text-nc-content-gray font-weight-500">
                            <template #title>
                              {{ file.name }}
                            </template>

                            {{ file.name }}
                          </NcTooltip>
                        </div>

                        <div class="text-small text-nc-content-gray-muted font-weight-500">
                          {{ getReadableFileSize(file.size) }}
                        </div>
                      </div>
                      <template v-if="!preImportLoading">
                        <a-form-item class="flex-1 !my-0 max-w-[120px] min-w-[120px]">
                          <NcDropdown placement="bottomRight" overlay-class-name="overflow-hidden !w-[170px]">
                            <template #default="{ visible }">
                              <NcButton size="small" type="secondary" class="w-[120px] children:children:w-full !text-small">
                                <NcTooltip class="flex-none w-[85px] truncate text-left !leading-[20px]" show-on-truncate-only>
                                  <template #title> {{ charsetOptionsMap[file.encoding]?.sortLabel ?? '' }}</template>

                                  {{ charsetOptionsMap[file.encoding]?.sortLabel?.replace('Windows', 'Win') ?? '' }}
                                </NcTooltip>

                                <GeneralIcon
                                  icon="chevronDown"
                                  class="flex-none transform"
                                  :class="{
                                    'rotate-180': visible,
                                  }"
                                />
                              </NcButton>
                            </template>

                            <template #overlay="{ visible, onChange: onChangeVisibility }">
                              <NcList
                                v-model:value="file.encoding"
                                :open="visible"
                                :list="charsetOptions"
                                search-input-placeholder="Search"
                                option-label-key="sortLabel"
                                option-value-key="value"
                                class="!w-full"
                                variant="small"
                                @update:open="onChangeVisibility"
                              >
                              </NcList>
                            </template>
                          </NcDropdown>
                        </a-form-item>
                        <NcButton type="text" size="xsmall" class="flex-shrink" @click="actions?.remove?.()">
                          <GeneralIcon icon="deleteListItem" />
                        </NcButton>
                      </template>
                      <template v-else>
                        <NcTooltip
                          :key="progressMsgNew[file.name] || progressMsg"
                          class="!max-w-[120px] min-w-[120p] !leading-[18px] truncate"
                          show-on-truncate-only
                        >
                          <template #title> {{ progressMsgNew[file.name] || progressMsg }}</template>

                          <span class="!text-small text-nc-content-gray-muted">
                            {{ progressMsgNew[file.name] || progressMsg }}
                          </span>
                        </NcTooltip>
                        <GeneralLoader class="flex text-nc-content-brand" size="medium" />
                      </template>
                    </div>
                  </template>
                </a-upload-dragger>

                <NcAlert
                  v-model:visible="showMaxFileLimitError"
                  closable
                  align="center"
                  type="warning"
                  show-icon
                  message-class="!text-sm"
                  description-class="!text-small !leading-[18px]"
                  class="mt-5"
                  :message="$t('msg.warning.reachedUploadLimit')"
                  :description="
                    $t(
                      `msg.warning.${
                        maxFileUploadLimit > 1
                          ? 'youCanOnlyUploadMaxLimitFilesAtATimePlural'
                          : 'youCanOnlyUploadMaxLimitFilesAtATime'
                      }`,
                      {
                        limit: maxFileUploadLimit,
                        type: $t(`labels.${importType}`),
                      },
                    )
                  "
                />
              </div>
            </a-tab-pane>
            <a-tab-pane v-if="!isImportTypeJson" :key="ImportTypeTabs.uploadFromUrl" :disabled="preImportLoading" class="!h-full">
              <template #tab>
                <div class="flex gap-2 items-center">
                  <span class="text-sm">{{ $t('labels.addFromUrl') }} </span>
                </div>
              </template>
              <div class="relative mt-5 mb-1 px-1">
                <a-form :model="importState" name="quick-import-url-form" layout="vertical" class="!my-0">
                  <a-form-item v-bind="validateInfos.url" :required="false" class="!my-0 quick-import-url-form">
                    <template #label>
                      <div class="flex items-center space-x-2 w-full">
                        <span class="flex-1 text-nc-content-gray text-sm">
                          {{ importMeta.urlInputLabel }}
                        </span>
                        <template v-if="preImportLoading">
                          <NcTooltip
                            :key="progressMsgNew[importState.url.split('/').pop() ?? ''] || progressMsg"
                            class="!max-w-1/2 min-w-[120p] !leading-[18px] truncate"
                            show-on-truncate-only
                          >
                            <template #title>
                              {{ progressMsgNew[importState.url.split('/').pop() ?? ''] || progressMsg }}</template
                            >

                            <span class="!text-small text-nc-content-gray-muted">
                              {{ progressMsgNew[importState.url.split('/').pop() ?? ''] || progressMsg }}
                            </span>
                          </NcTooltip>
                          <GeneralLoader class="flex text-nc-content-brand" size="medium" />
                        </template>
                      </div>
                    </template>
                    <a-input
                      v-model:value="importState.url"
                      class="!rounded-md"
                      placeholder="Paste file link here..."
                      :disabled="preImportLoading"
                    />
                  </a-form-item>
                </a-form>
              </div>
            </a-tab-pane>
            <a-tab-pane v-if="isImportTypeJson" :key="ImportTypeTabs.uploadJSON" :disabled="preImportLoading" class="!h-full">
              <template #tab>
                <div class="flex gap-2 items-center">
                  <span class="text-sm">{{ $t('labels.enterJson') }} </span>
                </div>
              </template>
              <div class="relative mt-5">
                <div class="flex items-end gap-2">
                  <label class="text-nc-content-gray text-sm"> Enter Json </label>
                  <div class="flex-1" />

                  <template v-if="preImportLoading">
                    <NcTooltip
                      :key="progressMsgNew[importState.url.split('/').pop() ?? ''] || progressMsg"
                      class="!max-w-1/2 min-w-[120p] !leading-[25px] truncate"
                      show-on-truncate-only
                    >
                      <template #title> {{ progressMsgNew[importState.url.split('/').pop() ?? ''] || progressMsg }}</template>

                      <span class="!text-small text-nc-content-gray-muted">
                        {{ progressMsgNew[importState.url.split('/').pop() ?? ''] || progressMsg }}
                      </span>
                    </NcTooltip>
                    <GeneralLoader class="flex text-nc-content-brand" size="medium" />
                  </template>
                  <NcButton v-else type="text" size="xsmall" class="!px-2" @click="formatJson()"> Format </NcButton>
                </div>

                <div
                  class="mx-0.5 mb-0.5 h-30 min-h-30 resize-y overflow-y-auto h-[calc(100%_-_8px)] max-h-[400px] border-1 rounded-lg mt-2 transition duration-300 focus-within:(shadow-selected border-primary)"
                  :class="{
                    'border-nc-border-red focus-within:(shadow-error border-nc-border-red) ':
                      jsonErrorText || refMonacoEditor?.error,
                  }"
                >
                  <LazyMonacoEditor
                    ref="refMonacoEditor"
                    class="nc-import-monaco-editor !h-full min-h-30"
                    :auto-focus="false"
                    hide-minimap
                    :monaco-config="{
                      lineNumbers: 'on',
                    }"
                    :model-value="temporaryJson"
                    @update:model-value="handleJsonChange($event)"
                  />
                </div>

                <div v-if="jsonErrorText || refMonacoEditor?.error" class="text-nc-content-red-medium text-small mt-2">
                  {{ jsonErrorText || refMonacoEditor?.error }}
                </div>
                <div v-else></div>
              </div>
            </a-tab-pane>
          </NcTabs>
        </div>
      </div>

      <NcAlert
        :visible="!!importError"
        closable
        align="center"
        type="error"
        show-icon
        class="mt-5"
        message-class="!text-sm"
        description-class="!text-small !leading-[18px]"
        :copy-text="importError"
        :message="$t('msg.error.importError')"
        :description="
          $t('msg.error.anErrorOccuredWhileImporting', {
            type: getBtnText(true),
          })
        "
        @close="handleResetImportError"
      />

      <div v-if="!templateEditorModal" class="mt-5">
        <NcButton type="text" size="small" @click="collapseKey = !collapseKey ? 'advanced-settings' : ''">
          {{ $t('title.advancedSettings') }}
          <GeneralIcon
            icon="chevronDown"
            class="ml-2 !transition-all !transform"
            :class="{ '!rotate-180': collapseKey === 'advanced-settings' }"
          />
        </NcButton>

        <a-collapse
          v-model:active-key="collapseKey"
          ghost
          class="nc-import-collapse"
          :class="{
            'pointer-events-none': preImportLoading || importLoading,
          }"
        >
          <a-collapse-panel key="advanced-settings">
            <a-form-item v-if="isImportTypeCsv || IsImportTypeExcel" class="!my-2 nc-dense-checkbox-container">
              <NcCheckbox v-model:checked="importState.parserConfig.firstRowAsHeaders">
                <span class="caption">{{ $t('labels.firstRowAsHeaders') }}</span>
              </NcCheckbox>
            </a-form-item>

            <a-form-item v-if="isImportTypeJson" class="!my-2 nc-dense-checkbox-container">
              <NcCheckbox v-model:checked="importState.parserConfig.normalizeNested">
                <span class="caption">{{ $t('labels.flattenNested') }}</span>
              </NcCheckbox>
            </a-form-item>

            <a-form-item v-if="!importDataOnly" class="!my-2 nc-dense-checkbox-container">
              <NcCheckbox v-model:checked="importState.parserConfig.shouldImportData">{{ $t('labels.importData') }} </NcCheckbox>
            </a-form-item>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center gap-2 pt-5">
        <NcButton
          v-if="templateEditorModal"
          key="back"
          type="text"
          size="small"
          :disabled="importLoading"
          @click="templateEditorModal = false"
        >
          <GeneralIcon icon="chevronLeft" class="mr-1" />
          {{ $t('general.back') }}
        </NcButton>

        <NcButton v-else key="cancel" type="text" size="small" @click="onClickCancel">
          <GeneralIcon v-if="showBackBtn" icon="chevronLeft" class="mr-1" />

          {{ showBackBtn ? $t('general.back') : $t('general.cancel') }}
        </NcButton>

        <div class="flex-1" />

        <NcButton
          v-if="!templateEditorModal"
          key="pre-import"
          size="small"
          class="nc-btn-import"
          :loading="preImportLoading"
          :disabled="disablePreImportButton || preImportLoading"
          @click="handlePreImport"
        >
          {{ importBtnText }}
        </NcButton>

        <NcButton
          v-else
          key="import"
          size="small"
          :loading="importLoading"
          :disabled="disableImportButton || importLoading"
          @click="handleImport"
        >
          {{ importBtnText }}
        </NcButton>
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
  @apply !pb-0;
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

:deep(.nc-modern-drag-import.hidden + .ant-upload-list) {
  @apply !mb-0;
}

:deep(.nc-dense-checkbox-container .ant-form-item-control-input) {
  min-height: unset !important;
}

.nc-quick-import-tabs {
  :deep(.ant-tabs-nav) {
    @apply !pl-0;
  }
  :deep(.ant-tabs-tab) {
    @apply px-0 pt-0 pb-2;

    &.ant-tabs-tab-active {
      @apply font-medium;
    }
  }

  :deep(.ant-tabs-tab + .ant-tabs-tab) {
    @apply ml-4;
  }

  .tab-title,
  :deep(.ant-tabs-tab-btn) {
    @apply px-2 text-nc-content-gray-subtle2 rounded-md hover:bg-gray-100 transition-colors;
    span {
      @apply text-small !leading-[24px];
    }
  }

  :deep(.ant-tabs-tab-disabled) {
    .ant-tabs-tab-btn,
    .tab-title {
      @apply text-nc-content-gray-muted hover:bg-transparent;
    }
  }

  :deep(.quick-import-url-form label) {
    @apply w-full;
  }
}
</style>
