<script setup lang="ts">
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import { Upload } from 'ant-design-vue'
import { type TableType, charsetOptions, charsetOptionsMap } from 'nocodb-sdk'
import { defineAsyncComponent } from 'vue'

const {
  importType,
  importDataOnly = false,
  baseId,
  sourceId,
  transition,
  showBackBtn,
  wrapClassName = '',
  showSourceSelector = true,
  ...rest
} = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'back'])

// Define Monaco Editor as an async component
const MonacoEditor = defineAsyncComponent(() => import('~/components/monaco/Editor.vue'))

interface Props {
  modelValue: boolean
  importType: 'csv' | 'json' | 'excel'
  baseId: string
  sourceId: string
  importDataOnly?: boolean
  transition?: string
  showBackBtn?: boolean
  wrapClassName?: string
  showSourceSelector?: boolean
}

enum ImportTypeTabs {
  'upload' = 'upload',
  'uploadFromUrl' = 'uploadFromUrl',
  'uploadJSON' = 'uploadJSON',
}

const { $api } = useNuxtApp()

const { appInfo } = useGlobal()

const { t } = useI18n()

const progressMsg = 'Reading data ...'

const workspace = useWorkspace()

const { activeWorkspace } = storeToRefs(workspace)

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

const collapseKey = ref('')

const temporaryJson = ref({})

const jsonErrorText = ref('')

const activeTab = ref<ImportTypeTabs>(ImportTypeTabs.upload)

const isError = ref(false)

const refMonacoEditor = ref()

const sourceSelectorRef = ref()

const sourceIdRef = ref(sourceId)

const { clone } = useUndoRedo()

const useForm = Form.useForm

// Parser settings (how to read the file) live here.
const defaultParserConfig = {
  firstRowAsHeaders: true,
  normalizeNested: true,
  autoSelectFieldTypes: true,
  maxRowsToParse: 500,
}

// Post-parse decisions (what to do with the rows) live here. This matches
// the backend shape — see `FileImportOptions` in nocodb-sdk.
const defaultOptions = {
  shouldImportData: true,
  importDataOnly: false,
  typecast: false,
}

const defaultImportState = {
  fileList: [] as importFileList | streamImportFileList,
  url: '',
  jsonEditor: {},
  parserConfig: { ...defaultParserConfig },
  options: { ...defaultOptions, importDataOnly },
}
const importState = reactive(clone(defaultImportState))

const isImportTypeJson = computed(() => importType === 'json')

const isImportTypeCsv = computed(() => importType === 'csv')

const IsImportTypeExcel = computed(() => importType === 'excel')

const showMaxFileLimitError = ref(false)

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
      acceptTypes: '.xls, .xlsx, .xlsm, .ods, .ots',
    }
  } else if (isImportTypeCsv.value) {
    return {
      header: importDataOnly ? t('activity.uploadCSV') : t('title.quickImportCSV'),
      icon: 'importCsv',
      uploadHint: '',
      urlInputLabel: t('msg.info.csvURL'),
      acceptTypes: '.csv, text/csv, text/comma-separated-values, application/csv',
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
      Object.assign(importState, clone(defaultImportState))
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

// Only CSV supports multiple files; Excel and JSON are one file at a time.
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
      // Return empty string when loading to only show the loader
      return ''
    }

    return importDataOnly ? t('activity.upload') : t('activity.import')
  }

  const type = isImportTypeJson.value ? t('labels.jsonCapitalized') : t('objects.files')

  // upload file screen
  if (isLoading) {
    // Return empty string when loading to only show the loader
    return ''
  }

  return importDataOnly ? `${t('activity.upload')} ${type}` : `${t('activity.import')} ${type}`
}

const importBtnText = computed(() => {
  return getBtnText(importLoading.value || preImportLoading.value)
})

const disableImportButton = computed(() => !templateEditorRef.value?.isValid || isError.value)

function buildPreviewParserConfig(encoding = 'utf-8') {
  return {
    ...importState.parserConfig,
    encoding,
    delimiter: undefined as string | undefined,
  }
}

function sanitizeTableName(raw: string) {
  return (raw || 'file_import')
    .replace(/\.[^/.]+$/, '')
    .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_')
    .trim()
}

async function uploadImportFile(file: File, contentType = 'multipart/form-data') {
  const formData = new FormData()
  formData.append('files', file)
  const { data } = await $api.instance.post('/api/v1/db/data-import/upload', formData, {
    headers: { 'Content-Type': contentType },
  })
  return data[0]
}

/**
 * Uploads the selected source (files, URL, or JSON editor), previews each,
 * and turns each preview sheet into a table entry for the editor.
 */
async function handlePreImport() {
  preImportLoading.value = true
  localImportError.value = ''

  if (!baseTables.value.get(baseId)) {
    await loadProjectTables(baseId)
  }

  try {
    // ── Collect upload targets: one entry per physical file
    const isFileMode = isPreImportFileFilled.value && activeTab.value === ImportTypeTabs.upload
    const targets: Array<{ attachment: any; fileName: string; encoding?: string }> = []

    if (isFileMode) {
      for (const file of importState.fileList as streamImportFileList) {
        if (!file?.originFileObj) continue
        targets.push({
          attachment: await uploadImportFile(file.originFileObj as any),
          fileName: file.name || 'file_import',
          encoding: (file as any).encoding || 'utf-8',
        })
      }
    } else if (isImportTypeJson.value && isPreImportJsonFilled.value) {
      const blob = new Blob([JSON.stringify(importState.jsonEditor)], { type: 'application/json' })
      targets.push({
        attachment: await uploadImportFile(new File([blob], 'editor_input.json', { type: 'application/json' })),
        fileName: 'editor_input.json',
        encoding: 'utf-8',
      })
    } else if (isPreImportUrlFilled.value) {
      await validate()
      const result = await $api.storage.uploadByUrl({}, [
        { url: importState.url, fileName: importState.url.split('/').pop() || 'file-import' },
      ])
      targets.push({
        attachment: result[0],
        fileName: importState.url.split('/').pop() || 'file_import',
        encoding: 'utf-8',
      })
    }

    if (!targets.length) return

    // ── Preview each file and fan its sheets into editor tables
    const draftTableNames: string[] = []
    const tables: any[] = []
    const allImportData: Record<string, any[]> = {}
    const allImportColumns: any[] = []

    for (const target of targets) {
      const { sheets = [] } = (await $api.internal.postOperation(
        activeWorkspace.value?.id,
        baseId,
        { operation: 'dataImportPreview' },
        {
          importType,
          attachment: target.attachment,
          parserConfig: buildPreviewParserConfig(target.encoding),
        },
      )) as { sheets: Array<{ name?: string; columns: any[]; previewData: any[]; totalRows: number }> }

      const baseName = sanitizeTableName(target.fileName)
      for (const sheet of sheets) {
        const rawName = sheet.name ? sanitizeTableName(sheet.name) : baseName
        const uniqueName = populateUniqueTableName(rawName, draftTableNames)
        draftTableNames.push(uniqueName)

        tables.push({
          table_name: uniqueName,
          ref_table_name: uniqueName,
          columns: (sheet.columns || []).map((col: any) => ({ ...col, selected: true })),
          _serverAttachment: target.attachment,
          _sheetName: sheet.name,
          _totalRows: sheet.totalRows ?? 0,
        })
        allImportData[uniqueName] = sheet.previewData ?? []
        allImportColumns.push(sheet.columns ?? [])
      }
    }

    templateData.value = { tables }
    importData.value = allImportData
    if (importDataOnly) {
      importColumns.value = allImportColumns as any
    }

    templateEditorModal.value = true
    showMaxFileLimitError.value = false
  } catch (e: any) {
    localImportError.value = (await extractSdkResponseErrorMsg(e)) || e?.toString()
  } finally {
    preImportLoading.value = false
  }
}

async function handleImport() {
  localImportError.value = ''
  try {
    importLoading.value = true
    await templateEditorRef.value.importTemplate()

    templateEditorModal.value = false
    Object.assign(importState, defaultImportState)
    dialogShow.value = false

    if (activeWorkspace.value?.id) {
      workspace.loadWorkspace(activeWorkspace.value.id)
    }
  } catch (e: any) {
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
    if (!importState.fileList.find((f) => f.uid === info.file.uid)) {
      ;(importState.fileList as streamImportFileList).push({
        ...info.file,
        status: 'done',
        encoding: 'utf-8',
      })
    } else {
      importState.fileList.find((f) => f.uid === info.file.uid)!.encoding = 'utf-8'
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
const beforeUpload = (file: UploadFile, fileList: UploadFile[]) => {
  if (importState.fileList.length + fileList.length > maxFileUploadLimit.value) {
    showMaxFileLimitError.value = true
  }

  const maxSizeMB = Math.round((appInfo.value.ncDataImportFileSize || 100 * 1024 * 1024) / (1024 * 1024))
  const exceedLimit = file.size! / 1024 / 1024 > maxSizeMB
  if (exceedLimit) {
    message.error(t('msg.error.fileTooLarge', { name: file.name, size: `${maxSizeMB}MB` }))
  }
  return !exceedLimit || Upload.LIST_IGNORE
}

const onError = () => {
  isError.value = true
}

const onChange = () => {
  isError.value = false
}

onMounted(() => {
  // When importing into an existing table we want exact column names from the
  // source so the user-supplied mapping wins — skip type auto-detection.
  importState.parserConfig.autoSelectFieldTypes = !importDataOnly
  importState.options.importDataOnly = importDataOnly
})

const onCancelImport = () => {
  Object.assign(importState, defaultImportState)
  preImportLoading.value = false
  importLoading.value = false
  templateData.value = undefined
  importData.value = undefined
  importColumns.value = []

  templateEditorModal.value = false
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
    :wrap-class-name="`nc-modal-quick-import ${wrapClassName}`"
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
          href="https://nocodb.com/docs/product-docs/tables/create-table-via-import"
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
        <TemplateEditor
          v-if="templateEditorModal"
          ref="templateEditorRef"
          :base-template="templateData"
          :import-data="importData"
          :import-columns="importColumns"
          :import-data-only="importDataOnly"
          :quick-import-type="importType"
          :max-rows-to-parse="importState.parserConfig.maxRowsToParse"
          :parser-config="importState.parserConfig"
          :options="importState.options"
          :base-id="baseId"
          :source-id="sourceIdRef"
          :table-icon="importMeta.icon"
          class="nc-quick-import-template-editor"
          @import="handleImport"
          @error="onError"
          @change="onChange"
        />
        <div v-else>
          <NcTabs v-model:active-key="activeTab" class="nc-quick-import-tabs" @update:active-key="handleResetImportError">
            <a-tab-pane :key="ImportTypeTabs.upload" :disabled="preImportLoading" class="!h-full">
              <template #tab>
                <div class="flex gap-2 items-center">
                  <span class="text-sm">{{ $t('general.upload') }} </span>
                </div>
              </template>
              <div class="relative mt-5">
                <a-upload-dragger
                  v-model:file-list="importState.fileList"
                  name="file"
                  class="nc-modern-drag-import nc-input-import !scrollbar-thin-dull !py-4 !transition !rounded-lg !border-nc-border-gray-medium"
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
                  <component :is="iconMap.upload" class="w-6 h-6 text-nc-content-gray-subtle" />

                  <p class="!mt-2 text-[13px] text-nc-content-gray-subtle">
                    {{ $t('msg.dropYourDocHere') }} {{ $t('general.or').toLowerCase() }}
                    <span class="text-nc-content-brand hover:underline">{{ $t('labels.browseFiles') }}</span>
                  </p>

                  <p class="!mt-3 text-[13px] text-nc-content-gray-muted">
                    {{ $t('general.supported') }}: {{ importMeta.acceptTypes }}
                  </p>

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
                          :key="progressMsg"
                          class="!max-w-[120px] min-w-[120p] !leading-[18px] truncate"
                          show-on-truncate-only
                        >
                          <template #title> {{ progressMsg }}</template>

                          <span class="!text-small text-nc-content-gray-muted">
                            {{ progressMsg }}
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
                            :key="progressMsg"
                            class="!max-w-1/2 min-w-[120p] !leading-[18px] truncate"
                            show-on-truncate-only
                          >
                            <template #title> {{ progressMsg }}</template>

                            <span class="!text-small text-nc-content-gray-muted">
                              {{ progressMsg }}
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
                    <NcTooltip :key="progressMsg" class="!max-w-1/2 min-w-[120p] !leading-[25px] truncate" show-on-truncate-only>
                      <template #title> {{ progressMsg }}</template>

                      <span class="!text-small text-nc-content-gray-muted">
                        {{ progressMsg }}
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
                  <Suspense>
                    <template #default>
                      <MonacoEditor
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
                    </template>

                    <template #fallback>
                      <MonacoLoading class="!h-full min-h-30" />
                    </template>
                  </Suspense>
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
        :description="importError"
        @close="handleResetImportError"
      />

      <div v-if="!templateEditorModal" class="mt-5">
        <div class="mb-4">
          <NcListSourceSelector
            ref="sourceSelectorRef"
            v-model:source-id="sourceIdRef"
            :base-id="baseId"
            :show-source-selector="showSourceSelector"
            force-layout="vertical"
          />
        </div>

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
              <NcCheckbox v-model:checked="importState.options.shouldImportData">{{ $t('labels.importData') }} </NcCheckbox>
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
          :disabled="disablePreImportButton || preImportLoading || sourceSelectorRef?.selectedSource?.ncItemDisabled"
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
.nc-modal-quick-import .ant-modal-content {
  @apply xs:!p-4;
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

/* Keep the primary button blue during loading state */
.nc-modal-quick-import .nc-button.ant-btn-primary.ant-btn-loading {
  @apply bg-brand-500;

  /* Keep the button width consistent during loading state */
  min-width: 80px;

  /* Increase the weight of the loader */
  .ant-btn-loading-icon {
    .anticon {
      svg {
        stroke-width: 3px;
      }
    }
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
.nc-import-collapse :deep(.ant-collapse-content-box) {
  @apply !pr-0.2;
}
span:has(> .nc-modern-drag-import) {
  display: flex;
  flex-direction: column-reverse;
  :deep(& > .ant-upload-list:has(.ant-upload-list-picture-container)) {
    @apply mb-4 space-y-2 transition-all nc-scrollbar-thin overflow-hidden;
  }
}
:deep(.nc-modern-drag-import:not(.ant-upload-disabled)) {
  @apply bg-nc-bg-default hover:bg-nc-bg-gray-extralight;
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
    @apply px-2 text-nc-content-gray-subtle2 rounded-md hover:bg-nc-bg-gray-light transition-colors;
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
