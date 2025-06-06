<script setup lang="ts">
import type { UploadFile } from 'ant-design-vue'
import { type ColumnType, SupportedExportCharset, UITypes, charsetOptions, csvColumnSeparatorOptions } from 'nocodb-sdk'
import papaparse from 'papaparse'
import dayjs from 'dayjs'

import ImportStatus from './ImportStatus.vue'

const { $api, $e } = useNuxtApp()

const CHUNK_SIZE = 200

const GENERATED_COLUMN_TYPES = [
  UITypes.Links,
  UITypes.LinkToAnotherRecord,
  UITypes.Barcode,
  UITypes.QrCode,
  UITypes.AutoNumber,
  UITypes.CreatedBy,
  UITypes.CreatedTime,
  UITypes.LastModifiedBy,
  UITypes.LastModifiedTime,
  UITypes.Formula,
  UITypes.Lookup,
  UITypes.Rollup,
]

const autoDetect = 'autoDetect'

const delimiters = [
  {
    label: 'Auto detect',
    value: autoDetect,
  },
  ...csvColumnSeparatorOptions,
]

interface ImportType {
  type: 'insert' | 'update' | 'insertAndUpdate'
  title: string
  tooltip: string
}

interface ImportColumnType {
  enabled: boolean
  mapIndex: string
  columnId: string
}

interface ImportPayloadType {
  step: number
  file: {
    name: string
    size: string
  }
  lastUsed: number
  tableId?: string
  tableName?: string
  tableIcon?: string
  upsert: boolean
  header: boolean
  upsertColumnId?: string
  importColumns: ImportColumnType[]
  importType: ImportType['type']
  stats: { inserted: number | null; updated: number | null; error?: { title?: string; message: string } }
  status?: 'initial' | 'inprogress' | 'completed' | 'failed'
  order: number
}

interface ImportConfigPayloadType {
  delimiter?: string
  encoding?: SupportedExportCharset
}

const importTypeOptions = [
  {
    type: 'insert',
    title: 'Create new records only',
    tooltip: 'Identifies and creates new records from csv.',
  },
  {
    type: 'update',
    title: 'Update existing records only',
    tooltip: 'Identifies updated records from csv and updates values in nocodb table.',
  },
  {
    type: 'insertAndUpdate',
    title: 'Create and update records',
    tooltip: 'Updates existing records and creates new records from csv to the nocodb table.',
  },
] as ImportType[]

const { fullscreen, fullscreenModalSize, extension, tables, insertData, getTableMeta, reloadData, activeTableId } =
  useExtensionHelperOrThrow()
const { getMeta } = useMetas()

const EXTENSION_ID = extension.value.extensionId

const fileList = ref<UploadFile[]>([])

// step 0: upload file
// step 1: preview & map
// step 2: importing
// step 3: stats
const step = ref(0)

const stats = ref<{ inserted: number | null; updated: number | null; error?: { title?: string; message: string } }>({
  inserted: null,
  updated: null,
})

const fileInfo = ref({
  name: '',
  size: '0 MB',
  processingFile: false,
})

const totalRecords = ref(0)

const totalRecordsBeforeUpsert = ref(0)

const isImportVerified = ref(false)

const isVerifyImportDlgVisible = ref(false)

const isVerifyImportLoading = ref(false)

const processedRecords = ref(0)

const isImportingRecords = ref(false)

const viewImportHistory = ref(false)

const autoInsertOption = ref(false)

const parsedData = ref<any>()

const columns = ref<Record<string, ColumnType>>({})

const importPayloadPlaceholder: ImportPayloadType = {
  step: 0,
  file: {
    name: '',
    size: '0 MB',
  },
  lastUsed: Date.now(),
  tableId: undefined,
  tableIcon: undefined,
  tableName: undefined,
  upsert: false,
  header: true,
  upsertColumnId: undefined,
  importColumns: [],
  importType: 'insertAndUpdate',
  stats: {
    inserted: null,
    updated: null,
  },
  order: 0,
}

const savedPayloads = ref<ImportPayloadType[]>([])

const importConfig = ref<ImportConfigPayloadType>({
  delimiter: autoDetect,
  encoding: SupportedExportCharset['utf-8'],
})

const importHistory = computed(() => {
  return savedPayloads.value.filter((payload) => payload.step > 1).sort((a, b) => b.order - a.order)
})

const openImportDetailsItemIndex = ref<number | null>(0)

const importPayload = computedAsync(async () => {
  if (!savedPayloads.value.length) {
    let saved = await extension.value.kvStore.get('savedPayloads')

    saved =
      (Array.isArray(saved) ? saved : [])
        .filter((payload) => {
          if (
            payload?.step === undefined ||
            payload?.order === undefined ||
            (payload?.step === 1 && (!parsedData.value || !parsedData.value?.data[0]?.length))
          ) {
            return false
          }

          return true
        })
        .sort((a, b) => b.order - a.order) || []

    if (saved && saved.length) {
      savedPayloads.value = saved
    } else {
      savedPayloads.value.unshift({
        ...importPayloadPlaceholder,
        lastUsed: Date.now(),
        order: getNextOrder(savedPayloads.value),
      })
    }
  }
  return savedPayloads.value[0]
}, importPayloadPlaceholder)

const updateHistory = async (updateImportVerified = false) => {
  // update last used
  importPayload.value.lastUsed = Date.now()

  // keep only last 5
  savedPayloads.value = savedPayloads.value.sort((a, b) => b.order - a.order).slice(0, 5)

  if (updateImportVerified) {
    isImportVerified.value = false
  }

  await extension.value.kvStore.set('savedPayloads', savedPayloads.value)
}

const updateImportConfig = async () => {
  await extension.value.kvStore.set('importConfig', importConfig.value)
}

function getNextOrder(data: ImportPayloadType[]) {
  const validOrders = data.map((item) => item?.order).filter(Number) // Filters out non-numeric values, null, undefined, NaN

  return validOrders.length > 0 ? Math.max(...validOrders) + 1 : 0
}

const headers = computed(() => {
  if (!parsedData.value || !parsedData.value?.data[0]?.length) return []
  if (importPayload.value.header) {
    return parsedData.value.data[0].map((header: string, index: number) => {
      return { label: header, value: `${index}` }
    })
  }
  return Array(parsedData.value.data[0].length)
    .fill('')
    .map((_, index) => {
      return { label: `Field-${index + 1}`, value: `${index}` }
    })
})

const tableColumns = computed(() => {
  return importPayload.value.importColumns.reduce((acc, importColumn) => {
    const column = columns.value[importColumn.columnId]
    if (!column.id || !column.title || GENERATED_COLUMN_TYPES.includes(column.uidt as UITypes)) return acc
    acc.push({
      label: column.title,
      value: column.id,
    })
    return acc
  }, [] as { label: string; value: string }[])
})

const readyForImport = computed(() => {
  const isUpsertColumnSelected = importPayload.value.upsert
    ? importPayload.value.upsertColumnId &&
      importPayload.value.importColumns.find(
        (column) => column.columnId === importPayload.value.upsertColumnId && !!column.mapIndex,
      )
    : true
  return (
    importPayload.value.tableId &&
    Object.values(importPayload.value.importColumns).some((column) => column.enabled && column.mapIndex) &&
    isUpsertColumnSelected
  )
})

const selectedFieldDetails = computed(() => {
  return {
    total: importPayload.value?.importColumns?.length ?? 0,
    selected: (importPayload.value?.importColumns || []).filter((c) => !!c?.enabled)?.length ?? 0,
  }
})

const onTableSelect = async (resetUpsertColumnId = false) => {
  const table = tables.value.find((table) => table.id === importPayload.value.tableId)
  if (table?.id) {
    const tableMeta = await getTableMeta(table.id)
    if (tableMeta?.columns) {
      columns.value = tableMeta.columns.reduce((acc, column) => {
        if (!column.id) return acc
        acc[column.id] = column
        return acc
      }, {} as Record<string, ColumnType>)

      importPayload.value.importColumns = tableMeta.columns.reduce((acc, column) => {
        if (!column.id || column.system || GENERATED_COLUMN_TYPES.includes(column.uidt as UITypes)) return acc

        const mapIndex =
          headers.value.find((h) => h.label === column.title && column.title?.toLocaleLowerCase() !== 'id')?.value ?? ''

        acc.push({ enabled: !!mapIndex, mapIndex, columnId: column.id })

        return acc
      }, [] as ImportColumnType[])
    }
    importPayload.value.tableName = table?.title
    importPayload.value.tableIcon = table?.meta?.icon
    if (resetUpsertColumnId) {
      importPayload.value.upsertColumnId = undefined
    }
  }

  updateHistory(true)
}

const handleChange = (info: { file: UploadFile }) => {
  fileInfo.value = {
    ...fileInfo.value,
    name: info?.file?.name || '',
    size: info?.file?.size ? getReadableFileSize(info?.file?.size) : '0 MB',
    processingFile: true,
  }
  importPayload.value.file.name = fileInfo.value.name
  importPayload.value.file.size = fileInfo.value.size

  const reader = new FileReader()
  reader.onload = (e) => {
    const arrayBuffer = e.target?.result
    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
      fileList.value = []
      fileInfo.value = {
        ...fileInfo.value,
        processingFile: false,
      }
      return
    }

    // Use TextDecoder to handle more encodings
    const encoding = importConfig.value.encoding || SupportedExportCharset['utf-8'] // Default to UTF8 if no encoding is specified
    const decoder = new TextDecoder(encoding)
    const text = decoder.decode(arrayBuffer)

    papaparse.parse(text.trim(), {
      worker: true,
      delimiter: importConfig.value.delimiter === autoDetect ? undefined : importConfig.value.delimiter,
      complete: (results) => {
        parsedData.value = results
        step.value = 1
        importPayload.value.step = 1

        $e(`c:extension:${EXTENSION_ID}:csv-loaded`)

        fileInfo.value = {
          ...fileInfo.value,
          processingFile: false,
        }

        updateHistory(true)

        if (!importPayload.value.tableId && tables.value?.length) {
          importPayload.value.tableId = tables.value.find((t) => t.id === activeTableId.value)
            ? activeTableId.value
            : tables.value[0].id
        }

        onTableSelect()

        if (!fullscreen.value) {
          fullscreen.value = true
        }
      },
      error: () => {
        fileList.value = []

        fileInfo.value = {
          ...fileInfo.value,
          processingFile: false,
          name: '',
          size: '0 MB',
        }
        importPayload.value.file.name = ''
        importPayload.value.file.size = '0 MB'

        updateHistory(true)

        message.error('There was an error parsing the file. Please check the file and try again.')
      },
    })
  }

  if (info.file.originFileObj instanceof File) {
    // Read as ArrayBuffer to allow TextDecoder to interpret encoding
    reader.readAsArrayBuffer(info.file.originFileObj)
  }
}

const onMappingField = (columnId: string, value: string) => {
  const columnMeta = importPayload.value.importColumns.find((m) => m.columnId === columnId)

  if (columnMeta && !columnMeta.enabled) columnMeta.enabled = true

  if (columnMeta) {
    if (value && !columnMeta.enabled) columnMeta.enabled = true
    if (!value && columnMeta.enabled) columnMeta.enabled = false
  }

  updateHistory(true)
}

const onUpsertColumnChange = (columnId: string) => {
  importPayload.value.importColumns.forEach((m) => {
    if (m.columnId === columnId && !m.enabled) {
      m.enabled = true
    } else if (!m.mapIndex && m.enabled) {
      m.enabled = false
    }
  })

  updateHistory(true)
}

const filterOption = (input = '', params: { key: string }) => {
  return params.key?.toLowerCase().includes(input?.toLowerCase())
}

const selectedTable = computed(() => {
  return tables.value.find((table) => table.id === importPayload.value.tableId)
})

const clearImport = () => {
  fileInfo.value = {
    name: '',
    size: '0 MB',
    processingFile: false,
  }
  fileList.value = []
  step.value = 0
  parsedData.value = null
  stats.value = { inserted: null, updated: null }
  totalRecords.value = 0
  processedRecords.value = 0
  isImportingRecords.value = false
  Object.assign(importPayload.value, {
    ...importPayloadPlaceholder,
    lastUsed: Date.now(),
  })
  fullscreen.value = false
}

// dummy row store for preview
useProvideSmartsheetRowStore({} as any)

const errorMsgs = ref<string[]>([])

const mergeFieldValueCount = ref<Record<string, number>>({})

const showMoreRecordsDetectedPlaceholder = ref(false)

const dataToImport = ref([])

const prepareDataToImport = () => {
  // prepare data
  let data = parsedData.value.data
  if (importPayload.value.header) {
    data = data.slice(1)
  }

  totalRecordsBeforeUpsert.value = importPayload.value.upsert ? data.length : 0

  // If upsert is enabled, then we have to select only unique merge field values
  const upsertColumnTitle = importPayload.value.upsert ? columns.value[importPayload.value.upsertColumnId!].title : null

  const uniqueMergeFieldValues: Record<string, boolean> = {}

  // map data
  data = data
    .map((row: string[]) => {
      return importPayload.value.importColumns.reduce((acc, importMeta) => {
        const column = columns.value[importMeta.columnId]
        if (importMeta.enabled && importMeta.mapIndex && column.title) {
          acc[column.title] = row[parseInt(importMeta.mapIndex)]
        }
        return acc
      }, {} as Record<string, any>)
    })
    .filter((row: Record<string, any>) => {
      if (importPayload.value.upsert) {
        const upsertColumnValue = row[upsertColumnTitle]
        if (uniqueMergeFieldValues[upsertColumnValue]) {
          return false
        }
        uniqueMergeFieldValues[upsertColumnValue] = true
      }

      return true
    })

  totalRecords.value = data.length

  return data
}

const verifyRequiredFields = () => {
  if (!importPayload.value.tableId) {
    return message.error('Please select a table')
  }

  if (importPayload.value.upsert && !importPayload.value.upsertColumnId) {
    return message.error('Please select a column for upsert')
  }
}

const recordsToInsert = ref<Record<string, any>[]>([])
const recordsToUpdate = ref<Record<string, any>[]>([])

const totalRecordsToInsert = ref(0)
const totalRecordsToUpdate = ref(0)
const processedRecordsToInsert = ref(0)
const processedRecordsToUpdate = ref(0)

const onVerifyImport = async () => {
  if (verifyRequiredFields()) return

  errorMsgs.value = []
  showMoreRecordsDetectedPlaceholder.value = false
  mergeFieldValueCount.value = {}

  isVerifyImportLoading.value = true

  const data = prepareDataToImport()

  dataToImport.value = data

  if (importPayload.value.upsert && totalRecordsBeforeUpsert.value !== totalRecords.value) {
    const duplicateRowsCount = totalRecordsBeforeUpsert.value - totalRecords.value
    errorMsgs.value.push(
      `${duplicateRowsCount} ${
        duplicateRowsCount === 1 ? 'row' : 'rows'
      } have duplicate merge field values. Only the first matching row from the CSV will be used; the rest will be skipped.`,
    )
  }

  const tableMeta = (await getMeta(importPayload.value.tableId))!

  const upsertFieldTitle = columns.value[importPayload.value.upsertColumnId!]?.title ?? ''

  const chunks = []

  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE))
  }

  recordsToInsert.value = []
  recordsToUpdate.value = []

  totalRecordsToInsert.value = 0
  totalRecordsToUpdate.value = 0

  processedRecordsToInsert.value = 0
  processedRecordsToUpdate.value = 0

  for (const chunk of chunks) {
    // select chunk of data to determine if it's an insert or update
    let page = 1
    let fetchRecords = true
    let totalRecords = 0

    const list = []

    const seen = new Set<string>()

    while (fetchRecords) {
      const { list: existingRecordsPage, pageInfo } = await $api.dbDataTableRow.list(importPayload.value.tableId, {
        where: `(${upsertFieldTitle},in,${chunk.map((record: Record<string, any>) => record[upsertFieldTitle]).join(',')})`,
        limit: CHUNK_SIZE,
        offset: (page - 1) * CHUNK_SIZE,
      })

      list.push(...existingRecordsPage)

      page++

      if (!totalRecords && pageInfo.totalRows) {
        totalRecords = pageInfo.totalRows
      }

      for (const existingRecord of existingRecordsPage as Record<string, any>[]) {
        const mergeVal = existingRecord[upsertFieldTitle]
        if (!seen.has(mergeVal)) {
          seen.add(mergeVal)
        }

        const matchingCsvRecord = chunk.find((record: Record<string, any>) => `${record[upsertFieldTitle]}` === `${mergeVal}`)

        if (matchingCsvRecord) {
          mergeFieldValueCount.value[mergeVal] = (mergeFieldValueCount.value[mergeVal] ?? 0) + 1

          if (importPayload.value!.importType !== 'insert') {
            recordsToUpdate.value.push({
              ...matchingCsvRecord,
              ...rowPkData(existingRecord, tableMeta.columns!),
            })
          }
        }
      }

      if (pageInfo.isLastPage) {
        fetchRecords = false
      }
    }

    if (importPayload.value!.importType !== 'update') {
      recordsToInsert.value.push(...chunk.filter((record: Record<string, any>) => !seen.has(record[upsertFieldTitle])))
    }
  }

  totalRecordsToInsert.value = recordsToInsert.value.length
  totalRecordsToUpdate.value = recordsToUpdate.value.length

  isImportVerified.value = true
  isVerifyImportDlgVisible.value = true

  isVerifyImportLoading.value = false
}

const errorMsgsTableData = computed(() => {
  const data: { title: string }[] = []

  errorMsgs.value.forEach((msg) => {
    data.push({
      title: msg,
    })
  })

  for (const mergeFieldValue in mergeFieldValueCount.value) {
    data.push({
      title: `Detected ${mergeFieldValueCount.value[mergeFieldValue]} ${
        mergeFieldValueCount.value[mergeFieldValue] === 1 ? 'record' : 'records'
      } with merge field value "${mergeFieldValue}". They will be overridden to match the first matching CSV row.`,
    })
  }

  return data
})

const onImport = async () => {
  if (isVerifyImportDlgVisible.value) {
    isVerifyImportDlgVisible.value = false
  }

  if (verifyRequiredFields()) return

  isImportingRecords.value = true

  // prepare data
  const data = importPayload.value.upsert ? dataToImport.value : prepareDataToImport()
  const chunks = []

  while (data.length) {
    chunks.push(data.splice(0, CHUNK_SIZE))
  }

  const dataToInsert = recordsToInsert.value
  const dataToUpdate = recordsToUpdate.value

  try {
    if (importPayload.value?.upsert) {
      $e(`c:extension:${EXTENSION_ID}:upsert`)

      const tableMeta = await getMeta(importPayload.value.tableId)

      if (!tableMeta?.columns) throw new Error('Table not found')

      // upsert data
      while (dataToInsert.length) {
        const chunk = dataToInsert.splice(0, 100)

        processedRecordsToInsert.value += chunk.length

        await $api.dbDataTableRow.create(
          importPayload.value.tableId,
          chunk,
          autoInsertOption.value ? ({ typecast: 'true' } as any) : undefined,
        )

        stats.value = {
          ...stats.value,
          inserted: (stats.value.inserted ?? 0) + chunk.length,
        }
        importPayload.value.stats = {
          ...importPayload.value.stats,
          inserted: (importPayload.value.stats.inserted ?? 0) + chunk.length,
        }
      }

      while (dataToUpdate.length) {
        const chunk = dataToUpdate.splice(0, 100)

        processedRecordsToUpdate.value += chunk.length

        await $api.dbDataTableRow.update(
          importPayload.value.tableId,
          chunk,
          autoInsertOption.value ? ({ typecast: 'true' } as any) : undefined,
        )

        stats.value = {
          ...stats.value,
          updated: (stats.value.updated ?? 0) + chunk.length,
        }
        importPayload.value.stats = {
          ...importPayload.value.stats,
          updated: (importPayload.value.stats.updated ?? 0) + chunk.length,
        }
      }

      if (autoInsertOption.value) {
        await getMeta(importPayload.value.tableId, true)
      }
    } else {
      $e(`c:extension:${EXTENSION_ID}:insert`)
      for (const chunk of chunks) {
        // insert data

        const insertStats = await insertData({
          tableId: importPayload.value.tableId,
          data: chunk,
          autoInsertOption: autoInsertOption.value,
        })

        stats.value = {
          ...stats.value,
          inserted: (stats.value.inserted ?? 0) + insertStats.inserted,
        }
        importPayload.value.stats = {
          ...importPayload.value.stats,
          inserted: (importPayload.value.stats.inserted ?? 0) + insertStats.inserted,
        }

        if (autoInsertOption.value) {
          await getMeta(importPayload.value.tableId, true)
        }

        processedRecords.value += chunk.length
      }
    }

    step.value = 2
    importPayload.value.step = 2
  } catch (e: any) {
    if (importPayload.value?.upsert) {
      const insertErrorTitle = totalRecordsToInsert.value
        ? `Import failed while inserting records between ${processedRecordsToInsert.value} - ${totalRecordsToInsert.value}`
        : ''

      const updateErrorTitle = totalRecordsToUpdate.value
        ? `Import failed while updating records between ${processedRecordsToUpdate.value} - ${totalRecordsToUpdate.value}`
        : ''

      stats.value.error = {
        title: `${insertErrorTitle} ${updateErrorTitle}`,
        message: await extractSdkResponseErrorMsg(e),
      }
      step.value = 3

      importPayload.value.stats.error = {
        title: `${insertErrorTitle} ${updateErrorTitle}`,
        message: await extractSdkResponseErrorMsg(e),
      }
      importPayload.value.step = 3
    } else {
      const errorTitle = `Import failed for records between ${processedRecords.value} - ${processedRecords.value + CHUNK_SIZE}`
      stats.value.error = {
        title: errorTitle,
        message: await extractSdkResponseErrorMsg(e),
      }
      step.value = 3

      importPayload.value.stats.error = {
        title: errorTitle,
        message: await extractSdkResponseErrorMsg(e),
      }

      importPayload.value.step = 3
    }
  } finally {
    openImportDetailsItemIndex.value = 0
    isImportingRecords.value = false
    importPayload.value.lastUsed = Date.now()
    updateHistory()
    $e(`a:extension:${EXTENSION_ID}:imported`, {
      error: !!stats.value.error,
      inserted: stats.value.inserted,
      updated: stats.value.updated,
    })
  }

  fullscreen.value = false
  reloadData()

  if (!stats.value.error) message.success('Data imported successfully')
}

const importRecordPercentage = computed(() => {
  return parseInt(`${(processedRecords.value / totalRecords.value) * 100}`)
})

const newImport = () => {
  if (viewImportHistory.value) {
    viewImportHistory.value = false
    return
  }

  savedPayloads.value.unshift({
    ...importPayloadPlaceholder,
    lastUsed: Date.now(),
    order: getNextOrder(savedPayloads.value),
  })
  updateHistory(true)

  $e(`c:extension:${EXTENSION_ID}:new-import-created`)

  fileInfo.value = {
    name: '',
    size: '0 MB',
    processingFile: false,
  }
  fileList.value = []
  step.value = 0
  parsedData.value = null
  stats.value = { inserted: null, updated: null }
  totalRecords.value = 0
  processedRecords.value = 0
  isImportingRecords.value = false
}

const isAllMappedFieldsSelected = computed(() => {
  return (
    !!importPayload.value.importColumns.length &&
    importPayload.value.importColumns.filter((c) => !!c.mapIndex).every((c) => c.enabled === true)
  )
})

const isSomeFieldsSelected = computed(() => {
  return !!importPayload.value.importColumns.length && importPayload.value.importColumns.some((c) => c.enabled === true)
})

const onClickSelectAllFields = (value: boolean) => {
  for (const importMeta of importPayload.value.importColumns) {
    if (!importMeta.mapIndex) continue

    if (!value && importPayload.value.upsertColumnId === importMeta.columnId) continue

    importMeta.enabled = value
  }

  isImportVerified.value = false
  updateHistory()
}

const handleUpdateOpenImportDetailsItemIndex = (index: number) => {
  if (openImportDetailsItemIndex.value === index) {
    openImportDetailsItemIndex.value = null
  } else {
    openImportDetailsItemIndex.value = index
  }
}

const fieldMappingColumns: NcTableColumnProps[] = [
  {
    key: 'select',
    title: '',
    minWidth: 52,
    width: 52,
    padding: '0 16px',
  },
  {
    key: 'nocodb-field',
    title: 'NocoDB Field',
    minWidth: 252,
    padding: '0 16px',
  },
  {
    key: 'mapping',
    title: '<-',
    minWidth: 48,
    width: 48,
    padding: '0 16px',
  },
  {
    key: 'csv-column',
    title: 'CSV Column',
    minWidth: 252,
    padding: '0 16px',
  },
]

function updateModalSize() {
  if (importPayload.value.step === 1 ? fullscreenModalSize.value === 'lg' : fullscreenModalSize.value === 'sm') {
    return
  }

  fullscreenModalSize.value = importPayload.value.step === 1 ? 'lg' : 'sm'
}

watch(fullscreen, () => {
  if (fullscreen.value && !Object.keys(columns.value).length && importPayload.value.tableId) {
    onTableSelect()
  }
})

watch(
  [() => importPayload.value.step, () => importPayload.value.order],
  () => {
    updateModalSize()
  },
  {
    immediate: true,
  },
)

onMounted(async () => {
  isImportVerified.value = false
  importConfig.value = (await extension.value.kvStore.get('importConfig')) || {}
  importConfig.value.delimiter = importConfig.value.delimiter || autoDetect
  importConfig.value.encoding = importConfig.value.encoding || SupportedExportCharset['utf-8']
})

const errorMsgsTableColumns = [
  {
    key: 'title',
    title: 'The following duplicates have been found',
    name: 'title',
    dataIndex: 'title',
    basis: '100%',
    minWidth: 220,
    padding: '0px 12px',
  },
] as NcTableColumnProps[]
</script>

<template>
  <ExtensionsExtensionWrapper>
    <template #headerExtra>
      <template v-if="importPayload.step === 2 || importPayload.step === 3 || viewImportHistory">
        <div class="flex justify-end">
          <NcButton size="small" @click="newImport">New Import</NcButton>
        </div>
      </template>
      <template v-else-if="importPayload.step === 0 && !fileInfo.processingFile && importHistory.length">
        <div class="flex items-center justify-end">
          <NcButton size="small" type="secondary" @click="viewImportHistory = true">View Import History</NcButton>
        </div>
      </template>
      <template v-else-if="importPayload.step === 1">
        <NcButton :disabled="isImportingRecords" size="small" type="secondary" @click="clearImport()">Cancel</NcButton>

        <NcButton
          v-if="importPayload?.upsert"
          size="small"
          type="secondary"
          :disabled="!readyForImport || isImportVerified"
          :loading="isVerifyImportLoading"
          @click="onVerifyImport"
        >
          <template v-if="isImportVerified" #icon>
            <GeneralIcon icon="check" />
          </template>
          Verify Import
        </NcButton>
        <NcButton
          size="small"
          :disabled="!readyForImport || (importPayload?.upsert && !isImportVerified)"
          :loading="isImportingRecords"
          @click="onImport"
        >
          Import
        </NcButton>
      </template>
    </template>

    <div
      class="h-full flex children:(flex-none w-full)"
      :class="{
        'bg-nc-bg-gray-extralight': fullscreen && importPayload.step !== 1,
      }"
    >
      <div
        v-if="importPayload.step === 2 || importPayload.step === 3 || viewImportHistory"
        class="h-full flex flex-col justify-between"
      >
        <div
          class="flex h-full flex-col overflow-hidden"
          :class="{
            'h-[calc(100%_-_40px)]': !fullscreen,
          }"
        >
          <div class="border-b-1 border-nc-border-gray-medium bg-nc-bg-gray-light text-tiny py-1 px-3 text-gray-600">
            Recent Imports
          </div>
          <div class="flex-1 flex flex-col nc-scrollbar-thin">
            <ImportStatus
              v-for="(history, idx) of importHistory"
              :key="idx"
              :status="history.step === 2 ? 'compeleted' : 'failed'"
              :filename="history.file.name"
              :tablename="history.tableName || 'table'"
              :tableicon="history.tableIcon"
              :inserted="history.stats.inserted"
              :updated="history.stats.updated"
              :is-open="openImportDetailsItemIndex === idx"
              @click="handleUpdateOpenImportDetailsItemIndex(idx)"
            >
              <template v-if="history.step === 3" #error>
                {{ history.stats?.error?.title || 'There was an error with import' }} :

                <div>
                  <NcTooltip v-if="history.stats?.error?.message" class="truncate" show-on-truncate-only>
                    <template #title>
                      {{ history.stats?.error?.message }}
                    </template>
                    {{ history.stats?.error?.message }}
                  </NcTooltip>
                </div>
              </template>
              <template v-if="history.lastUsed" #timestamp>
                {{ timeAgo(dayjs(history.lastUsed).toString()) }}
              </template>
            </ImportStatus>
          </div>
        </div>

        <div v-if="!fullscreen" class="flex justify-end p-3 border-t-1 border-t-nc-border-gray-medium bg-white">
          <NcButton size="small" @click="newImport">New Import</NcButton>
        </div>
      </div>
      <template v-else-if="importPayload.step === 0">
        <div
          v-if="fileInfo.processingFile"
          class="h-full flex flex-col justify-between gap-3"
          :class="{
            'p-4': fullscreen,
            'p-3': !fullscreen,
          }"
        >
          <div
            class="w-full flex items-center p-2 rounded-lg flex gap-4 border-1 border-nc-border-gray-medium cursor-pointer"
            @click="fullscreen = true"
          >
            <div
              class="aspect-square w-[48px] h-[48px] p-2 bg-nc-bg-gray-extralight rounded-lg flex items-center justify-center children:flex-none"
            >
              <GeneralLoader size="large" />
            </div>
            <div class="flex-1 w-[calc(100%_-_108px)]">
              <NcTooltip class="truncate flex-1" show-on-truncate-only>
                <template #title>{{ importPayload.file.name }}</template>
                {{ importPayload.file.name }}
              </NcTooltip>
              <div class="text-nc-content-gray-muted text-sm">{{ importPayload.file.size }}</div>
            </div>

            <NcButton size="xs" type="text" class="!px-1" @click.stop="clearImport()">
              <GeneralIcon icon="close" class="opacity-80" />
            </NcButton>
          </div>

          <div class="flex justify-end">
            <NcButton size="small" disabled @click="fullscreen = true">Continue</NcButton>
          </div>
        </div>
        <div
          v-else
          class="nc-csv-upload-wrapper flex flex-col gap-3"
          :class="{
            'p-4': fullscreen,
            'p-3': !fullscreen,
          }"
        >
          <div
            class="flex items-center gap-3"
            :class="{
              '-mx-4 px-4 -mt-4 py-4 bg-white': fullscreen,
              'max-w-full': !fullscreen,
            }"
          >
            <div class="flex flex-col gap-2 w-[calc(50%_-_6px)]">
              <div>Separator</div>
              <a-form-item class="!my-0 flex-1">
                <NcSelect
                  v-model:value="importConfig.delimiter"
                  placeholder="-select separator-"
                  class="nc-csv-import-separator nc-select-shadow"
                  dropdown-class-name="w-[160px]"
                  :filter-option="filterOption"
                  show-search
                  @change="updateImportConfig"
                >
                  <a-select-option v-for="delimiter of delimiters" :key="delimiter.label" :value="delimiter.value">
                    <div class="w-full flex items-center gap-2">
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ delimiter.label }}</template>
                        <span>{{ delimiter.label }}</span>
                      </NcTooltip>
                      <component
                        :is="iconMap.check"
                        v-if="importConfig.delimiter === delimiter.value"
                        id="nc-selected-item-icon"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>
              </a-form-item>
            </div>
            <div class="flex flex-col gap-2 w-[calc(50%_-_6px)]">
              <div>Encoding</div>
              <a-form-item class="!my-0 flex-1">
                <NcSelect
                  v-model:value="importConfig.encoding"
                  placeholder="-select encoding-"
                  class="nc-csv-import-encoding nc-select-shadow"
                  dropdown-class-name="w-[190px]"
                  :filter-option="filterOption"
                  show-search
                  @change="updateImportConfig"
                >
                  <a-select-option v-for="encoding of charsetOptions" :key="encoding.label" :value="encoding.value">
                    <div class="w-full flex items-center gap-2">
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ encoding.label }}</template>
                        <span>{{ encoding.label }}</span>
                      </NcTooltip>
                      <component
                        :is="iconMap.check"
                        v-if="importConfig.encoding === encoding.value"
                        id="nc-selected-item-icon"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>
              </a-form-item>
            </div>
          </div>
          <a-upload-dragger
            v-model:fileList="fileList"
            name="file"
            accept=".csv"
            class="nc-csv-file-uploader !flex-1"
            :multiple="false"
            @change="handleChange"
          >
            <p class="ant-upload-drag-icon !mb-2">
              <GeneralIcon class="h-6 w-6" icon="upload" />
            </p>
            <p class="ant-upload-text !text-nc-content-gray !text-sm">
              Drop your CSV here or <span class="text-nc-content-brand hover:underline">browse file</span>
            </p>
          </a-upload-dragger>
          <div v-if="importHistory.length && !fullscreen" class="flex items-center justify-end">
            <NcButton size="small" type="secondary" @click="viewImportHistory = true">View Import History</NcButton>
          </div>
        </div>
      </template>
      <template v-else-if="importPayload.step === 1">
        <div v-if="fullscreen" class="h-full relative">
          <div class="flex w-full h-full">
            <div class="h-full w-[420px] flex flex-col nc-scrollbar-thin border-r border-nc-border-gray-medium">
              <section>
                <h1>Table</h1>
                <a-form-item class="!my-0 w-full">
                  <NcSelect
                    v-model:value="importPayload.tableId"
                    class="w-full nc-select-shadow"
                    placeholder="-select table-"
                    :filter-option="filterOption"
                    :show-search="tables?.length > 6"
                    dropdown-match-select-width
                    @change="onTableSelect(true)"
                  >
                    <a-select-option v-for="table of tables || []" :key="table.title" :value="table.id">
                      <div class="w-full flex items-center gap-2">
                        <LazyGeneralEmojiPicker :emoji="table?.meta?.icon" readonly size="xsmall">
                          <template #default>
                            <GeneralIcon icon="table" class="min-w-4 !text-gray-500" />
                          </template>
                        </LazyGeneralEmojiPicker>
                        <NcTooltip show-on-truncate-only class="flex-1 truncate">
                          <template #title>
                            {{ table.title }}
                          </template>
                          {{ table.title }}
                        </NcTooltip>

                        <component
                          :is="iconMap.check"
                          v-if="importPayload.tableId === table.id"
                          id="nc-selected-item-icon"
                          class="flex-none text-primary w-4 h-4"
                        />
                      </div>
                    </a-select-option>
                  </NcSelect>
                </a-form-item>
              </section>

              <section v-if="importPayload.tableId">
                <h1>Settings</h1>

                <div class="nc-import-upsert-type">
                  <a-radio-group v-model:value="importPayload.upsert" name="upsert" @change="updateHistory(true)">
                    <div class="input-wrapper border-1 border-nc-border-gray-medium rounded-lg px-3 py-2 flex flex-col gap-2">
                      <a-radio :value="false">
                        <div class="flex flex-col">
                          <div>Add records</div>
                          <div class="text-small leading-[18px] text-nc-content-gray-muted">Adds all records from CSV.</div>
                        </div>
                      </a-radio>
                    </div>
                    <div class="input-wrapper border-1 border-nc-border-gray-medium rounded-lg px-3 py-2 flex flex-col gap-2">
                      <a-radio :value="true">
                        <div class="flex flex-col">
                          <div>Merge records</div>
                          <div class="text-small leading-[18px] text-nc-content-gray-muted">
                            Updates existing records from CSV.
                          </div>
                        </div>
                      </a-radio>
                      <div v-if="importPayload.upsert" class="pl-6 flex flex-col gap-3" @click.stop>
                        <div class="flex gap-2 w-full">
                          <div class="text-sm text-nc-content-gray flex items-center gap-1 min-w-[100px]">Import type</div>
                          <a-form-item class="!my-0 w-[calc(100%_-_108px)]">
                            <NcSelect
                              v-model:value="importPayload.importType"
                              class="w-full nc-select-shadow"
                              dropdown-class-name="w-[254px]"
                              @change="updateHistory(true)"
                            >
                              <a-select-option v-for="(opt, i) of importTypeOptions" :key="i" :value="opt.type">
                                <NcTooltip class="!w-full" placement="right">
                                  <template #title>
                                    {{ opt.tooltip }}
                                  </template>
                                  <div class="flex items-center gap-2 w-full">
                                    <div class="truncate flex-1">
                                      {{ opt.title }}
                                    </div>

                                    <component
                                      :is="iconMap.check"
                                      v-if="importPayload.importType === opt.type"
                                      id="nc-selected-item-icon"
                                      class="flex-none text-primary w-4 h-4"
                                    />
                                  </div>
                                </NcTooltip>
                              </a-select-option>
                            </NcSelect>
                          </a-form-item>
                        </div>
                        <div class="flex gap-2 w-full">
                          <div class="text-sm text-nc-content-gray flex items-center gap-1 min-w-[100px]">
                            Merge field
                            <NcTooltip placement="bottomLeft">
                              <template #title
                                >Rows on your table will be merged with records that have same values for this field in CSV
                                file</template
                              >
                              <GeneralIcon icon="info" class="text-nc-content-gray-muted h-4 w-4" />
                            </NcTooltip>
                          </div>
                          <a-form-item class="!my-0 w-[calc(100%_-_108px)]">
                            <NcSelect
                              v-model:value="importPayload.upsertColumnId"
                              class="w-full nc-select-shadow"
                              placeholder="-select a field-"
                              dropdown-class-name="w-[254px]"
                              @change="onUpsertColumnChange"
                            >
                              <a-select-option v-for="(opt, i) of tableColumns" :key="i" :value="opt.value">
                                <div class="flex items-center gap-2 w-full">
                                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                                    <template #title>
                                      {{ opt.label }}
                                    </template>
                                    {{ opt.label }}
                                  </NcTooltip>

                                  <component
                                    :is="iconMap.check"
                                    v-if="importPayload.upsertColumnId === opt.value"
                                    id="nc-selected-item-icon"
                                    class="flex-none text-primary w-4 h-4"
                                  />
                                </div>
                              </a-select-option>
                            </NcSelect>
                          </a-form-item>
                        </div>
                      </div>
                    </div>
                  </a-radio-group>
                </div>
                <div>
                  <NcCheckbox v-model:checked="importPayload.header" @change="updateHistory(true)">
                    Use first record as header
                  </NcCheckbox>
                </div>
                <div>
                  <NcCheckbox v-model:checked="autoInsertOption">
                    {{ $t('labels.autoCreateMissingSelectionOptions') }}
                  </NcCheckbox>
                </div>
              </section>
            </div>

            <div class="w-[calc(100%_-_420px)] flex flex-col overflow-auto nc-scrollbar-thin h-full">
              <NcModal
                v-if="importPayload.upsert && isImportVerified"
                v-model:visible="isVerifyImportDlgVisible"
                :show-separator="false"
                :size="errorMsgsTableColumns.length ? 'md' : 'small'"
                wrap-class-name="nc-modal-csv-import-verification"
              >
                <div class="h-full flex flex-col gap-4 text-nc-content-gray">
                  <div class="text-base text-nc-content-gray font-weight-700">CSV Import Verification complete</div>
                  <template v-if="errorMsgsTableColumns.length">
                    <NcTable
                      :columns="errorMsgsTableColumns"
                      :data="errorMsgsTableData"
                      :bordered="false"
                      class="nc-warnings-table-list flex-1 h-[calc(100%_-_200px)]"
                      pagination
                    >
                      <template #bodyCell="{ record: errorMsg }">
                        <div class="flex items-center gap-2">
                          <GeneralIcon icon="ncAlertTriangle" class="h-4 w-4 flex-none text-yellow-600" />
                          <span class="text-nc-content-gray-subtle2">{{ errorMsg.title }}</span>
                        </div>
                      </template>
                    </NcTable>
                  </template>

                  <div v-else class="flex-1 flex gap-3">
                    <span>No issues found. The file is ready for import. </span>
                  </div>

                  <div class="flex flex-row w-full justify-end gap-2">
                    <NcButton type="secondary" size="small" @click="isVerifyImportDlgVisible = false">{{
                      $t('general.cancel')
                    }}</NcButton>
                    <NcButton size="small" @click="onImport">{{ $t('general.proceedImport') }}</NcButton>
                  </div>
                </div>
              </NcModal>
              <div class="flex-1 bg-nc-bg-gray-extralight flex flex-col gap-4 p-4">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-sm font-weight-700 text-nc-content-gray">Select destination fields</div>
                  <div>
                    <NcBadge class="!text-sm !h-5 bg-nc-bg-gray-medium truncate" :border="false"
                      >{{ selectedFieldDetails.selected }}/{{ selectedFieldDetails.total }} selected
                    </NcBadge>
                  </div>
                </div>

                <NcTable
                  :columns="fieldMappingColumns"
                  :data="importPayload.importColumns"
                  class="flex-1"
                  :bordered="false"
                  :disable-table-scroll="!!errorMsgs.length"
                  header-row-height="40px"
                  header-cell-class-name="!text-nc-content-gray-subtle2 !font-weight-700"
                  body-row-class-name="!cursor-default"
                  row-height="48px"
                >
                  <template #headerCell="{ column }">
                    <template v-if="column.key === 'select'">
                      <NcCheckbox
                        :checked="isAllMappedFieldsSelected"
                        :indeterminate="isSomeFieldsSelected && !isAllMappedFieldsSelected"
                        @update:checked="onClickSelectAllFields"
                      />
                    </template>
                    <div v-if="column.key === 'nocodb-field'" class="w-full flex items-center gap-3">
                      {{ column.title }}

                      <NcBadge
                        v-if="importPayload.tableId"
                        class="!text-sm !h-5 bg-nc-bg-gray-medium truncate font-normal"
                        :border="false"
                      >
                        <LazyGeneralEmojiPicker
                          :emoji="importPayload.tableIcon || selectedTable?.meta?.icon"
                          readonly
                          size="xsmall"
                        >
                          <template #default>
                            <GeneralIcon icon="table" class="min-w-4 !text-gray-500" />
                          </template>
                        </LazyGeneralEmojiPicker>
                        <NcTooltip class="max-w-[80px] ml-1 text-nc-content-gray-subtle2 truncate" show-on-truncate-only>
                          <template #title>
                            {{ importPayload.tableName || selectedTable.title }}
                          </template>

                          {{ importPayload.tableName || selectedTable.title }}
                        </NcTooltip>
                      </NcBadge>
                    </div>
                    <template v-if="column.key === 'mapping'">
                      <GeneralIcon icon="ncArrowLeft" />
                    </template>
                    <div v-if="column.key === 'csv-column'" class="w-full pl-3 text-left">
                      {{ column.title }}
                    </div>
                  </template>

                  <template #bodyCell="{ column, record: importMeta }">
                    <template v-if="column.key === 'select'">
                      <NcTooltip :disabled="importMeta.enabled || !!importMeta.mapIndex">
                        <template #title>Select CSV Column to map</template>
                        <NcCheckbox
                          v-model:checked="importMeta.enabled"
                          :disabled="importPayload.upsertColumnId === importMeta.columnId || !importMeta.mapIndex"
                          @change="updateHistory(true)"
                        />
                      </NcTooltip>
                    </template>
                    <div v-if="column.key === 'nocodb-field'" class="w-full flex items-center gap-2">
                      <template v-if="columns[importMeta.columnId]">
                        <component
                          :is="getUIDTIcon(columns[importMeta.columnId].uidt!)"
                          v-if="columns[importMeta.columnId]?.uidt"
                          class="flex-none w-3.5 h-3.5"
                        />
                        <NcTooltip class="truncate max-w-[calc(100%_-_24px)]" show-on-truncate-only>
                          <template #title> {{ columns[importMeta.columnId].title }} </template>

                          {{ columns[importMeta.columnId].title }}
                        </NcTooltip>
                      </template>
                    </div>
                    <template v-if="column.key === 'mapping'">
                      <GeneralIcon icon="ncArrowLeft" />
                    </template>
                    <template v-if="column.key === 'csv-column'">
                      <a-form-item class="!my-0 w-full">
                        <NcSelect
                          :value="importMeta.mapIndex || null"
                          show-search
                          allow-clear
                          :filter-option="(input, option) => antSelectFilterOption(input, option, 'data-label')"
                          class="nc-field-select-input w-full nc-select-shadow !border-none"
                          :placeholder="`-${$t('labels.multiField.selectField').toLowerCase()}-`"
                          @update:value="(value) => (importMeta.mapIndex = value)"
                          @change="onMappingField(importMeta.columnId, $event)"
                        >
                          <a-select-option v-for="(col, i) of headers" :key="i" :value="col.value" :data-label="col.label">
                            <div class="flex items-center gap-2 w-full">
                              <NcTooltip class="truncate flex-1" show-on-truncate-only>
                                <template #title>
                                  {{ col.label }}
                                </template>
                                {{ col.label }}
                              </NcTooltip>
                              <component
                                :is="iconMap.check"
                                v-if="importMeta.mapIndex === col.value"
                                id="nc-selected-item-icon"
                                class="flex-none text-primary w-4 h-4"
                              />
                            </div>
                          </a-select-option>
                        </NcSelect>
                      </a-form-item>
                    </template>
                  </template>
                </NcTable>
              </div>
            </div>
          </div>
          <general-overlay :model-value="isImportingRecords" inline transition class="!bg-opacity-15">
            <div class="flex flex-col items-center justify-center h-full w-full !bg-white !bg-opacity-55">
              <a-spin size="large" />
              <template v-if="importPayload?.upsert">
                <div v-if="recordsToInsert.length" class="text-brand-600">
                  Inserting {{ processedRecordsToInsert }}/{{ totalRecordsToInsert }}
                </div>
                <div v-if="recordsToUpdate.length" class="text-brand-600">
                  Updating {{ processedRecordsToUpdate }}/{{ totalRecordsToUpdate }}
                </div>
              </template>

              <div v-else class="text-brand-600">Importing {{ processedRecords }}/{{ totalRecords }}</div>
            </div>
          </general-overlay>
        </div>

        <div v-else class="h-full flex flex-col justify-between gap-3 p-3">
          <div v-if="isImportingRecords">
            <ImportStatus
              status="inprogress"
              :filename="importPayload.file.name"
              :inprogress-percentage="importRecordPercentage"
              :tablename="importPayload.tableName || 'table'"
              :tableicon="importPayload.tableIcon"
              :inserted="importPayload.stats.inserted"
              :updated="importPayload.stats.updated"
            ></ImportStatus>
          </div>
          <template v-else>
            <div
              class="w-full flex items-center p-2 rounded-lg flex gap-4 border-1 border-nc-border-gray-medium cursor-pointer"
              @click="fullscreen = true"
            >
              <div
                class="w-[48px] h-[48px] p-2 bg-nc-bg-gray-extralight rounded-lg flex items-center justify-center children:flex-none text-nc-content-gray-subtle2"
              >
                <GeneralIcon icon="fileBig" class="h-8 w-8" />
              </div>

              <div class="flex-1 w-[calc(100%_-_108px)]">
                <NcTooltip class="truncate flex-1" show-on-truncate-only>
                  <template #title>{{ importPayload.file.name }}</template>
                  {{ importPayload.file.name }}
                </NcTooltip>
                <div class="text-nc-content-gray-muted text-sm">{{ importPayload.file.size }}</div>
              </div>

              <NcButton size="xs" type="text" class="!px-1" @click.stop="clearImport()">
                <GeneralIcon icon="delete" class="opacity-80" />
              </NcButton>
            </div>

            <div class="flex justify-end">
              <NcButton size="small" @click="fullscreen = true">Continue</NcButton>
            </div>
          </template>
        </div>
      </template>
    </div>
  </ExtensionsExtensionWrapper>
</template>

<style lang="scss" scoped>
:deep(.nc-import-upsert-type .ant-radio-group) {
  @apply flex flex-col gap-2;

  .ant-radio-wrapper {
    @apply transition-all justify-between !mr-0;

    // &.ant-radio-wrapper-checked:not(.ant-radio-wrapper-disabled):focus-within {
    //   @apply border-brand-500;
    // }

    span:not(.ant-radio):not(.nc-ltar-icon) {
      @apply flex-1 pl-2 pr-0 gap-2;
    }

    .ant-radio {
      @apply top-[3px];
    }

    .nc-ltar-icon {
      @apply inline-flex items-center p-1 rounded-md;
    }
  }
}

:deep(.ant-spin-nested-loading) {
  .ant-spin-container {
    @apply h-full;
  }
}

:deep(.nc-field-select-input.ant-select) {
  .ant-select-selector {
    @apply !bg-transparent rounded-lg;

    .ant-select-selection-item {
      @apply text-nc-content-gray text-sm font-weight-500;
    }
  }

  &:not(.ant-select-focused):hover .ant-select-selector {
    @apply !bg-nc-bg-gray-medium;
  }

  &:not(.ant-select-disabled):not(:hover):not(.ant-select-focused) .ant-select-selector,
  &:not(.ant-select-disabled):hover.ant-select-disabled .ant-select-selector {
    @apply !shadow-none;
  }

  &:hover:not(.ant-select-focused):not(.ant-select-disabled) .ant-select-selector {
    @apply shadow-none;
  }
  &:not(.ant-select-focused):not(.ant-select-disabled) .ant-select-selector {
    @apply !border-transparent;
  }

  &:not(.ant-select-focused):hover .ant-select-clear {
    @apply !bg-nc-bg-gray-medium;
  }
}

:deep(.ant-select-selection-item) {
  @apply font-weight-400 text-sm !text-nc-content-gray;
}

:deep(.nc-csv-import-separator.ant-select),
:deep(.nc-csv-import-encoding.ant-select) {
  .ant-select-selector {
    @apply !rounded-lg h-8;
  }
}
</style>

<style lang="scss">
.nc-nc-csv-import {
  .nc-csv-file-uploader {
    &.ant-upload.ant-upload-drag {
      @apply !rounded-lg !bg-white !hover:bg-nc-bg-gray-light !transition-colors duration-300;
    }
    .ant-upload-btn {
      @apply !flex flex-col items-center justify-center;
    }
  }

  .nc-csv-upload-wrapper {
    & > span {
      @apply flex-1;
    }
  }
  section {
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-bottom: 1px solid var(--nc-border-grey-medium, #e7e7e9);
    h1 {
      font-size: 16px;
      font-weight: 700;
    }
  }
  .nc-import-upsert-type .ant-radio-group {
    gap: 0;
    > :first-child {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }
    > :last-child {
      border-top: 0;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
  }
}
</style>
