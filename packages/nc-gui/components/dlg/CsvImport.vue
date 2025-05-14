<script setup lang="ts">
import { toRaw, unref } from '@vue/runtime-core'
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import { Upload } from 'ant-design-vue'
import { type TableType, charsetOptions, charsetOptionsMap, ncHasProperties } from 'nocodb-sdk'
import { parse } from 'papaparse'
import rfdc from 'rfdc'

interface Props {
  modelValue: boolean
  baseId: string
  sourceId: string
  modelId?: string
  transition?: string
  showBackBtn?: boolean
}

const { baseId, sourceId, modelId, transition, showBackBtn, ...rest } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'back'])

enum ImportTypeTabs {
  'upload' = 'upload',
  'uploadFromUrl' = 'uploadFromUrl',
}

const { $api } = useNuxtApp()

const { appInfo } = useGlobal()

const config = useRuntimeConfig()

const meta = inject(MetaInj, ref())

const existingColumns = computed(() => meta.value?.columns?.filter((col) => !col.system) || [])

const { t } = useI18n()

const progressMsg = ref('Reading data ...')
const progressMsgNew = ref<Record<string, string>>({})

const workspace = useWorkspace()

const { activeWorkspace } = storeToRefs(workspace)

const { tables } = storeToRefs(useBase())

const tablesStore = useTablesStore()
const { loadProjectTables } = tablesStore
const { baseTables } = storeToRefs(tablesStore)

const preImportLoading = ref(false)

const importLoading = ref(false)

const isParsingData = ref(false)

const collapseKey = ref('')

const activeTab = ref<ImportTypeTabs>(ImportTypeTabs.upload)

const isError = ref(false)

const useForm = Form.useForm

const defaultImportState = {
  fileList: [] as any[],
  url: '',
  parserConfig: {
    maxRowsToParse: 100,
    firstRowAsHeaders: true,
    delimiter: ',',
    encoding: 'utf-8',
    createNewTable: !modelId,
    tableName: '',
  },
}
const importState = reactive(structuredClone(defaultImportState))

const { token } = useGlobal()

const validators = computed(() => ({
  url: [importUrlValidator, importCsvUrlValidator],
}))

const { validate, validateInfos } = useForm(importState, validators)

const importMeta = computed(() => {
  return {
    header: modelId ? t('activity.uploadCSV') : t('title.quickImportCSV'),
    icon: 'importCsv',
    uploadHint: '',
    urlInputLabel: t('msg.info.csvURL'),
    loadUrlDirective: ['c:quick-import:csv:load-url'],
    acceptTypes: '.csv',
  }
})

const dialogShow = useVModel(rest, 'modelValue', emit)

// CSV data and column mapping
const csvData = ref<string>('')
const csvHeaders = ref<string[]>([])
const csvSampleData = ref<any[]>([])
const columnMapping = ref<Record<string, string>>({})
const mappingModalVisible = ref(false)

// Watch for file changes
watch(
  () => importState.fileList,
  async (newValue) => {
    if (newValue.length > 0) {
      const file = newValue[0]
      if (file.originFileObj) {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            csvData.value = e.target.result as string
            parseCSVData()
          }
        }
        reader.readAsText(file.originFileObj, importState.parserConfig.encoding)
      }
    } else {
      csvData.value = ''
      csvHeaders.value = []
      csvSampleData.value = []
      columnMapping.value = {}
    }
  },
  { deep: true }
)

// Parse CSV data to extract headers and sample data
function parseCSVData() {
  if (!csvData.value) return

  const parseResult = parse(csvData.value, {
    header: importState.parserConfig.firstRowAsHeaders,
    skipEmptyLines: true,
    preview: importState.parserConfig.maxRowsToParse,
    delimiter: importState.parserConfig.delimiter,
  })

  if (importState.parserConfig.firstRowAsHeaders) {
    csvHeaders.value = parseResult.meta.fields || []
  } else {
    // Generate field names if no headers
    csvHeaders.value = parseResult.data[0] 
      ? Object.keys(parseResult.data[0]).map((_, i) => `field_${i + 1}`) 
      : []
  }

  csvSampleData.value = parseResult.data

  // Initialize column mapping
  if (modelId) {
    // For existing table, map to existing columns
    columnMapping.value = {}
  } else {
    // For new table, use headers as column names
    csvHeaders.value.forEach(header => {
      columnMapping.value[header] = header
    })
  }
}

// Handle URL import
async function handleUrlImport() {
  try {
    await validate()
    preImportLoading.value = true
    
    // Fetch CSV from URL
    const response = await fetch(importState.url)
    csvData.value = await response.text()
    parseCSVData()
    
    preImportLoading.value = false
    showMappingModal()
  } catch (e: any) {
    message.error(`Error fetching CSV: ${e.message}`)
    preImportLoading.value = false
  }
}

// Show column mapping modal
function showMappingModal() {
  if (csvHeaders.value.length === 0) {
    message.error('No data found in CSV file')
    return
  }
  
  mappingModalVisible.value = true
}

// Handle import after mapping
async function handleImport() {
  try {
    importLoading.value = true
    
    // Prepare data for import
    const importData = {
      csvData: csvData.value,
      columnMapping: columnMapping.value,
      options: {
        firstRowAsHeaders: importState.parserConfig.firstRowAsHeaders,
        delimiter: importState.parserConfig.delimiter,
        encoding: importState.parserConfig.encoding,
        createNewTable: importState.parserConfig.createNewTable,
        tableName: importState.parserConfig.tableName || 'imported_csv',
      },
    }
    
    // Call API to start import job
    let job
    if (modelId) {
      // Import to existing table
      job = await $api.base.csvImportToExistingTable(baseId, sourceId, modelId, importData)
    } else {
      // Create new table
      job = await $api.base.csvImportNewTable(baseId, sourceId, importData)
    }
    
    message.success('CSV import job started successfully')
    
    // Reset state and close dialog
    Object.assign(importState, defaultImportState)
    mappingModalVisible.value = false
    dialogShow.value = false
    
    if (activeWorkspace.value?.id) {
      workspace.loadWorkspace(activeWorkspace.value.id)
    }
  } catch (e: any) {
    message.error(`Error starting import job: ${e.message}`)
  } finally {
    importLoading.value = false
  }
}

const isPreImportFileFilled = computed(() => {
  return importState.fileList?.length > 0
})

const isPreImportUrlFilled = computed(() => {
  return validateInfos?.url?.validateStatus === 'success' && !!importState.url
})

const localImportError = ref('')

const importError = computed(() => localImportError.value ?? '')

const maxFileUploadLimit = computed(() => 1)

const hideUpload = computed(() => preImportLoading.value || importState.fileList.length >= maxFileUploadLimit.value)

const disablePreImportButton = computed(() => {
  if (activeTab.value === ImportTypeTabs.upload) {
    return !isPreImportFileFilled.value
  } else if (activeTab.value === ImportTypeTabs.uploadFromUrl) {
    return !isPreImportUrlFilled.value
  }

  return true
})

const getBtnText = (isLoading: boolean = false) => {
  // upload file screen
  if (isLoading) {
    return `${t('labels.uploading')} ${t('objects.files')}`
  }

  return `${t('activity.upload')} ${t('objects.files')}`
}

const importBtnText = computed(() => {
  return getBtnText(importLoading.value || preImportLoading.value)
})

function rejectDrop(fileList: UploadFile[]) {
  fileList.map((file) => {
    return message.error(`${t('msg.error.fileUploadFailed')} ${file.name}`)
  })
}

function handleChange(info: UploadChangeParam) {
  const status = info.file.status

  if (status && status !== 'uploading' && status !== 'removed') {
    if (!importState.fileList.find((f) => f.uid === info.file.uid)) {
      importState.fileList.push({
        ...info.file,
        status: 'done',
        encoding: 'utf-8',
      })
    } else {
      // need to set default encoding to utf-8
      importState.fileList.find((f) => f.uid === info.file.uid)!.encoding = 'utf-8'
    }
  }
}

function handleRemove(file: UploadFile) {
  importState.fileList = importState.fileList.filter((f) => f.uid !== file.uid)
  return true
}

function onClickCancel() {
  if (showBackBtn) {
    emit('back')
  } else {
    dialogShow.value = false
  }
}

function handleResetImportError() {
  localImportError.value = ''
}

// Validate URL
function importUrlValidator(_: any, value: string) {
  if (!value) {
    return Promise.resolve()
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return Promise.reject(new Error(t('msg.error.invalidURL')))
    }
    return Promise.resolve()
  } catch (e) {
    return Promise.reject(new Error(t('msg.error.invalidURL')))
  }
}

// Validate CSV URL
function importCsvUrlValidator(_: any, value: string) {
  if (!value) {
    return Promise.resolve()
  }

  if (!value.endsWith('.csv')) {
    return Promise.reject(new Error(t('msg.error.invalidCSVURL')))
  }
  return Promise.resolve()
}
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :title="importMeta.header"
    :class="[transition ? `nc-modal-${transition}` : '', 'nc-modal-csv-import']"
    :width="mappingModalVisible ? 900 : 600"
    :footer="null"
    :closable="true"
    :maskClosable="false"
    @cancel="onClickCancel"
  >
    <div v-if="!mappingModalVisible">
      <div class="flex flex-col">
        <NcTabs v-model:activeKey="activeTab" class="nc-csv-import-tabs">
          <a-tab-pane :key="ImportTypeTabs.upload" :disabled="preImportLoading">
            <template #tab>
              <div class="flex gap-2 items-center">
                <span class="text-sm">{{ $t('labels.uploadFile') }} </span>
              </div>
            </template>
            <div class="mt-5">
              <div class="flex items-center justify-between">
                <label class="text-nc-content-gray text-sm"> {{ $t('labels.uploadFile') }} </label>
                <template v-if="preImportLoading">
                  <NcTooltip
                    :key="progressMsgNew[importState.fileList[0]?.name ?? ''] || progressMsg"
                    class="!max-w-1/2 min-w-[120p] !leading-[25px] truncate"
                    show-on-truncate-only
                  >
                    <template #title>
                      {{ progressMsgNew[importState.fileList[0]?.name ?? ''] || progressMsg }}</template
                    >

                    <span class="!text-small text-nc-content-gray-muted">
                      {{ progressMsgNew[importState.fileList[0]?.name ?? ''] || progressMsg }}
                    </span>
                  </NcTooltip>
                  <GeneralLoader class="flex text-nc-content-brand" size="medium" />
                </template>
              </div>

              <Upload
                v-show="!hideUpload"
                :accept="importMeta.acceptTypes"
                :multiple="false"
                :file-list="importState.fileList"
                :before-upload="() => false"
                :disabled="preImportLoading"
                class="nc-modern-drag-import"
                @change="handleChange"
                @drop-rejected="rejectDrop"
                @remove="handleRemove"
              >
                <div class="flex flex-col items-center justify-center p-8 border-1 border-dashed rounded-lg">
                  <GeneralIcon icon="upload" class="text-nc-content-gray-muted mb-2" />
                  <div class="text-nc-content-gray-muted text-small">
                    {{ $t('msg.info.dragDropFiles') }}
                    <span class="text-nc-content-brand">{{ $t('general.browse') }}</span>
                  </div>
                </div>
              </Upload>
            </div>
          </a-tab-pane>
          <a-tab-pane :key="ImportTypeTabs.uploadFromUrl" :disabled="preImportLoading">
            <template #tab>
              <div class="flex gap-2 items-center">
                <span class="text-sm">{{ $t('labels.importFromURL') }} </span>
              </div>
            </template>
            <div class="mt-5">
              <a-form layout="vertical" class="!my-0">
                <a-form-item v-bind="validateInfos.url" :required="false" class="!my-0 csv-import-url-form">
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
        </NcTabs>
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

      <div class="mt-5">
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
            <a-form-item class="!my-2 nc-dense-checkbox-container">
              <NcCheckbox v-model:checked="importState.parserConfig.firstRowAsHeaders">
                <span class="caption">{{ $t('labels.firstRowAsHeaders') }}</span>
              </NcCheckbox>
            </a-form-item>

            <a-form-item class="!my-2">
              <div class="flex items-center gap-2">
                <span class="caption">{{ $t('labels.delimiter') }}</span>
                <a-input v-model:value="importState.parserConfig.delimiter" class="!w-16" />
              </div>
            </a-form-item>

            <a-form-item class="!my-2">
              <div class="flex items-center gap-2">
                <span class="caption">{{ $t('labels.encoding') }}</span>
                <a-select v-model:value="importState.parserConfig.encoding" class="!w-32">
                  <a-select-option value="utf-8">UTF-8</a-select-option>
                  <a-select-option value="ascii">ASCII</a-select-option>
                  <a-select-option value="iso-8859-1">ISO-8859-1</a-select-option>
                </a-select>
              </div>
            </a-form-item>

            <a-form-item v-if="!modelId" class="!my-2">
              <div class="flex items-center gap-2">
                <span class="caption">{{ $t('labels.tableName') }}</span>
                <a-input v-model:value="importState.parserConfig.tableName" placeholder="imported_csv" />
              </div>
            </a-form-item>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </div>

    <!-- Column Mapping Modal -->
    <div v-if="mappingModalVisible" class="column-mapping-container">
      <h3 class="text-lg font-medium mb-4">{{ $t('labels.mapColumns') }}</h3>
      
      <div class="mb-4">
        <p class="text-sm text-nc-content-gray mb-2">{{ $t('msg.info.mapColumnsDescription') }}</p>
        
        <!-- Sample data preview -->
        <div class="overflow-auto max-h-[300px] border rounded-md">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50">
                <th v-for="header in csvHeaders" :key="header" class="p-2 border-b text-left">
                  {{ header }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in csvSampleData.slice(0, 5)" :key="index" class="border-b">
                <td v-for="header in csvHeaders" :key="header" class="p-2">
                  {{ row[header] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Column mapping -->
      <div class="grid grid-cols-2 gap-4">
        <div v-for="header in csvHeaders" :key="header" class="flex items-center">
          <div class="flex-1 truncate pr-2">{{ header }}</div>
          <div class="flex-1">
            <a-select 
              v-if="modelId" 
              v-model:value="columnMapping[header]" 
              class="w-full"
              :placeholder="$t('labels.selectColumn')"
            >
              <a-select-option v-for="column in existingColumns" :key="column.id" :value="column.title">
                {{ column.title }}
              </a-select-option>
            </a-select>
            <a-input v-else v-model:value="columnMapping[header]" class="w-full" />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center gap-2 pt-5">
        <NcButton
          v-if="mappingModalVisible"
          key="back"
          type="text"
          size="small"
          :disabled="importLoading"
          @click="mappingModalVisible = false"
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
          v-if="!mappingModalVisible"
          key="pre-import"
          size="small"
          class="nc-btn-import"
          :loading="preImportLoading"
          :disabled="disablePreImportButton || preImportLoading"
          @click="activeTab === ImportTypeTabs.upload ? showMappingModal() : handleUrlImport()"
        >
          {{ $t('labels.next') }}
        </NcButton>

        <NcButton
          v-else
          key="import"
          size="small"
          :loading="importLoading"
          :disabled="importLoading"
          @click="handleImport"
        >
          {{ $t('activity.import') }}
        </NcButton>
      </div>
    </template>
  </a-modal>
</template>

<style lang="scss">
.nc-modal-csv-import .ant-modal-footer {
  border: none;
  padding: 0 !important;
}
.nc-modal-csv-import .ant-collapse-content-box {
  @apply !pb-0;
  padding-top: 0 !important;
  padding-left: 6px;
}
</style>

<style lang="scss" scoped>
.nc-modal-csv-import :deep(.ant-modal-footer) {
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

.nc-csv-import-tabs {
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

  :deep(.csv-import-url-form label) {
    @apply w-full;
  }
}

.column-mapping-container {
  max-height: 70vh;
  overflow-y: auto;
}
</style>
