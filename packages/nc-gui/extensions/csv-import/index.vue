<script setup lang="ts">
import type { UploadFile } from 'ant-design-vue'
import { type ColumnType, UITypes } from 'nocodb-sdk'
import papaparse from 'papaparse'

const CHUNK_SIZE = 100

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

const { fullscreen, extension, tables, insertData, upsertData, getTableMeta, reloadData } = useExtensionHelperOrThrow()

const fileList = ref<UploadFile[]>([])

// step 0: upload file
// step 1: preview & map
// step 2: importing
// step 3: stats
const step = ref(0)

const stats = ref<{ inserted: number; updated: number; error?: { title?: string; message: string } }>({
  inserted: 0,
  updated: 0,
})

const processingFile = ref(false)

const totalRecords = ref(0)

const processedRecords = ref(0)

const parsedData = ref<any>()

const columns = ref<Record<string, ColumnType>>({})

const tableList = computed(() => {
  return tables.value.map((table) => {
    return {
      label: table.title,
      value: table.id,
    }
  })
})

interface ImportColumnType {
  enabled: boolean
  mapIndex: string
  columnId: string
}

const savedPayloads = ref<
  {
    csvFields: number
    lastUsed: number
    tableId?: string
    upsert: boolean
    header: boolean
    upsertColumnId?: string
    importColumns: ImportColumnType[]
  }[]
>([])

const importPayload = computed(() => {
  const fieldsInCsv = parsedData.value?.data[0]?.length || 0
  const saved = savedPayloads.value.find((payload) => payload.csvFields === fieldsInCsv)
  if (saved) {
    return saved
  }
  savedPayloads.value.push({
    csvFields: fieldsInCsv,
    lastUsed: Date.now(),
    tableId: undefined,
    upsert: false,
    header: true,
    upsertColumnId: undefined,
    importColumns: [],
  })
  return savedPayloads.value[savedPayloads.value.length - 1]
})

const updateHistory = async () => {
  // update last used
  importPayload.value.lastUsed = Date.now()

  // keep only last 5
  savedPayloads.value = savedPayloads.value.sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 5)

  await extension.value.kvStore.set('savedPayloads', savedPayloads.value)
}

const headers = computed(() => {
  if (!parsedData.value || !parsedData.value.data[0].length) return []
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
  return (
    importPayload.value.tableId &&
    Object.values(importPayload.value.importColumns).some((column) => column.enabled && column.mapIndex) &&
    (!importPayload.value.upsert || importPayload.value.upsertColumnId)
  )
})

const onTableSelect = async () => {
  const table = tables.value.find((table) => table.id === importPayload.value.tableId)
  if (table?.id) {
    const tableMeta = await getTableMeta(table.id)
    if (tableMeta?.columns) {
      columns.value = tableMeta.columns.reduce((acc, column) => {
        if (!column.id) return acc
        acc[column.id] = column
        return acc
      }, {} as Record<string, ColumnType>)

      importPayload.value.importColumns.push(
        ...tableMeta.columns.reduce((acc, column) => {
          if (!column.id || column.system || GENERATED_COLUMN_TYPES.includes(column.uidt as UITypes)) return acc
          if (importPayload.value.importColumns.find((m) => m.columnId === column.id)) return acc
          acc.push({ enabled: false, mapIndex: '', columnId: column.id })
          return acc
        }, [] as ImportColumnType[]),
      )
    }
  }

  updateHistory()
}

const handleChange = (info: { file: UploadFile }) => {
  processingFile.value = true
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result
    if (!text || typeof text !== 'string') {
      fileList.value = []
      return
    }
    papaparse.parse(text.trim(), {
      worker: true,
      complete: (results) => {
        parsedData.value = results
        step.value = 1
        processingFile.value = false
      },
      error: () => {
        fileList.value = []
        processingFile.value = false
        message.error('There was an error parsing the file. Please check the file and try again.')
      },
    })

    if (importPayload.value.tableId) {
      onTableSelect()
    }
  }

  if (info.file.originFileObj instanceof File) {
    reader.readAsText(info.file.originFileObj)
  }
}

const onMappingField = (columnId: string, _value: string) => {
  const columnMeta = importPayload.value.importColumns.find((m) => m.columnId === columnId)
  if (columnMeta && !columnMeta.enabled) columnMeta.enabled = true
  updateHistory()
}

const onUpsertColumnChange = (columnId: string) => {
  const columnMeta = importPayload.value.importColumns.find((m) => m.columnId === columnId)
  if (columnMeta && !columnMeta.enabled) columnMeta.enabled = true
  updateHistory()
}

const clearImport = () => {
  fileList.value = []
  step.value = 0
  parsedData.value = null
  stats.value = { inserted: 0, updated: 0 }
  totalRecords.value = 0
  processedRecords.value = 0
  Object.assign(importPayload.value, {
    tableId: undefined,
    upsert: false,
    header: true,
    upsertColumnId: undefined,
    importColumns: {},
  })
  fullscreen.value = false
}

const previewPage = ref(1)

const previewData = computed(() => {
  if (!parsedData.value || !Object.values(importPayload.value.importColumns).some((m) => m.enabled && m.mapIndex)) return []
  let data = parsedData.value.data
  if (importPayload.value.header) {
    data = data.slice(1 + (previewPage.value - 1) * 10, 1 + (previewPage.value - 1) * 10 + 10)
  } else {
    data = data.slice((previewPage.value - 1) * 10, (previewPage.value - 1) * 10 + 10)
  }

  return data.map((row: string[]) => {
    return importPayload.value.importColumns.reduce((acc, importMeta) => {
      const column = columns.value[importMeta.columnId]
      if (importMeta.enabled && importMeta.mapIndex && column.title) {
        acc[column.title] = row[parseInt(importMeta.mapIndex)]
      }
      return acc
    }, {} as Record<string, any>)
  })
})

// dummy row store for preview
useProvideSmartsheetRowStore({} as any, {} as any)

const previewColumns = computed(() => {
  return importPayload.value.importColumns.reduce((acc, importMeta) => {
    const column = columns.value[importMeta.columnId]
    if (!column.id || !column.title || GENERATED_COLUMN_TYPES.includes(column.uidt as UITypes)) return acc
    acc[column.title] = column
    return acc
  }, {} as Record<string, ColumnType>)
})

const onImport = async () => {
  if (!importPayload.value.tableId) {
    return message.error('Please select a table')
  }

  if (importPayload.value.upsert && !importPayload.value.upsertColumnId) {
    return message.error('Please select a column for upsert')
  }

  step.value = 2

  // prepare data
  let data = parsedData.value.data
  if (importPayload.value.header) {
    data = data.slice(1)
  }

  totalRecords.value = data.length

  // map data
  data = data.map((row: string[]) => {
    return importPayload.value.importColumns.reduce((acc, importMeta) => {
      const column = columns.value[importMeta.columnId]
      if (importMeta.enabled && importMeta.mapIndex && column.title) {
        acc[column.title] = row[parseInt(importMeta.mapIndex)]
      }
      return acc
    }, {} as Record<string, any>)
  })

  const chunks = []

  while (data.length) {
    chunks.push(data.splice(0, CHUNK_SIZE))
  }

  try {
    for (const chunk of chunks) {
      if (importPayload.value.upsert) {
        // upsert data
        const upsertStats = await upsertData({
          tableId: importPayload.value.tableId,
          upsertField: columns.value[importPayload.value.upsertColumnId!],
          data: chunk,
        })

        stats.value.inserted += upsertStats.inserted
        stats.value.updated += upsertStats.updated
      } else {
        // insert data
        const insertStats = await insertData({
          tableId: importPayload.value.tableId,
          data: chunk,
        })

        stats.value.inserted += insertStats.inserted
      }

      processedRecords.value += chunk.length
    }
  } catch (e: any) {
    stats.value.error = {
      title: `Import failed for records between ${processedRecords.value} - ${processedRecords.value + CHUNK_SIZE}`,
      message: await extractSdkResponseErrorMsg(e),
    }
  }

  step.value = 3

  reloadData()

  if (!stats.value.error) message.success('Data imported successfully')
}

onMounted(async () => {
  const saved = await extension.value.kvStore.get('savedPayloads')
  if (saved) {
    savedPayloads.value = saved
  }
})
</script>

<template>
  <template v-if="step === 0">
    <template v-if="processingFile">
      <div class="flex flex-col h-full items-center justify-center p-4">
        <GeneralLoader size="xlarge" />
      </div>
    </template>
    <a-upload-dragger v-else v-model:fileList="fileList" name="file" accept=".csv" :multiple="false" @change="handleChange">
      <GeneralIcon class="text-[30px]" icon="inbox" />
      <p class="ant-upload-text">Drag and drop a CSV file</p>
      <p class="ant-upload-hint">Or click to select a file</p>
    </a-upload-dragger>
  </template>
  <template v-else-if="step === 1">
    <template v-if="fullscreen">
      <div class="flex flex-col h-full">
        <div class="flex flex-1 w-full">
          <div class="flex flex-col w-1/3 p-2">
            <div class="text-sm font-weight-700">Table</div>
            <NcDivider class="mb-2" />
            <div class="input-wrapper">
              <NcSelect v-model:value="importPayload.tableId" :options="tableList" class="w-full" @change="onTableSelect" />
            </div>
            <div class="input-wrapper">
              <NcCheckbox v-model:checked="importPayload.upsert" @change="updateHistory()">Merge existing records</NcCheckbox>
              <template v-if="importPayload.upsert">
                <div class="p-2">
                  <NcSelect
                    v-model:value="importPayload.upsertColumnId"
                    :options="tableColumns"
                    class="w-full"
                    @change="onUpsertColumnChange"
                  />
                  <span class="text-xs">
                    Rows on your table will be merged with records that have same values for this field in CSV file
                  </span>
                </div>
              </template>
            </div>
            <div class="input-wrapper">
              <NcCheckbox v-model:checked="importPayload.header" @change="updateHistory()">First row as header</NcCheckbox>
            </div>
            <div class="text-sm font-weight-700 mt-2">Field Mappings</div>
            <NcDivider class="mb-2" />
            <template v-for="importMeta in importPayload.importColumns" :key="importMeta.columnId">
              <template v-if="importMeta.columnId">
                <div class="flex items-center gap-2 justify-between">
                  <div class="w-1/3 flex items-center gap-4">
                    <NcCheckbox
                      v-model:checked="importMeta.enabled"
                      :disabled="importPayload.upsertColumnId === importMeta.columnId"
                      @change="updateHistory()"
                    />
                    <div class="flex-1 font-weight-600">{{ columns[importMeta.columnId].title }}</div>
                  </div>
                  <GeneralIcon class="text-[20px] mr-4" icon="ncArrowLeft" />
                  <div class="w-1/3 flex items-center">
                    <NcSelect
                      v-model:value="importMeta.mapIndex"
                      :options="headers"
                      class="w-full"
                      @change="onMappingField(importMeta.columnId, $event)"
                    />
                  </div>
                </div>
                <NcDivider class="mb-2" />
              </template>
            </template>
          </div>
          <div class="flex flex-col w-2/3 gap-2 overflow-auto p-2 h-full">
            <div v-if="previewData.length" class="flex flex-col h-full">
              <div class="flex justify-between items-center">
                <div class="text-sm font-weight-700">Preview</div>
              </div>
              <NcDivider class="mb-2" />
              <div class="flex flex-col gap-2 p-2">
                <div v-for="(row, index) in previewData" :key="index" class="flex gap-2">
                  <div class="flex flex-col border-1 rounded-lg w-full p-2 justify-between">
                    <div class="flex">
                      <template v-for="importMeta in Object.values(importPayload.importColumns)" :key="importMeta.columnId">
                        <div v-if="importMeta.enabled && importMeta.mapIndex" class="w-[200px] flex items-center justify-center">
                          <LazySmartsheetHeaderCell :column="columns[importMeta.columnId]" :hide-menu="true" />
                        </div>
                      </template>
                    </div>
                    <div class="flex">
                      <template v-for="[title, value] in Object.entries(row)" :key="`${title}${index}`">
                        <div class="w-[200px] flex items-center justify-center">
                          <SmartsheetCell
                            :model-value="value"
                            :column="previewColumns[title]"
                            :edit-enabled="false"
                            :read-only="true"
                          />
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-center items-center p-2 flex-1">
                <a-pagination
                  :current="previewPage"
                  :total="parsedData.data.length - (importPayload.header ? 1 : 0)"
                  :page-size="10"
                  :show-quick-jumper="false"
                  :show-size-changer="false"
                  @change="previewPage = $event"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="w-full flex justify-end items-center py-2 pr-2 gap-2">
          <NcButton type="ghost" @click="clearImport()">Cancel</NcButton>
          <NcButton :disabled="!readyForImport" @click="onImport">Import</NcButton>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="m-auto flex justify-center items-center py-4 gap-2">
        <NcButton class="w-1/3" @click="fullscreen = true">Expand To Continue</NcButton>
        <NcButton type="ghost" @click="clearImport()">Cancel</NcButton>
      </div>
    </template>
  </template>
  <template v-else-if="step === 2">
    <div class="flex flex-col h-full p-4 items-center justify-center">
      <div class="font-weight-600">Importing {{ processedRecords }} / {{ totalRecords }}</div>
      <div class="mt-4">
        <GeneralLoader size="xlarge" />
      </div>
    </div>
  </template>
  <template v-else-if="step === 3">
    <div class="flex flex-col h-full p-4 items-center justify-center">
      <div class="flex">
        <div class="w-[200px] border-1 border-r-0 p-2">
          <div class="text-gray-500 pb-2">Inserted</div>
          <div class="text-[30px]">{{ stats.inserted }}</div>
        </div>
        <div class="w-[200px] border-1 p-2">
          <div class="text-gray-500 pb-2">Updated</div>
          <div class="text-[30px]">{{ stats.updated }}</div>
        </div>
      </div>
      <template v-if="stats.error">
        <div class="mt-4 flex flex-col gap-2">
          <a-alert type="error">
            <template #message>
              <div class="flex gap-2 items-center text-red-500">
                <GeneralIcon class="text-[25px]" icon="error" />
                <span>{{ stats.error.title || 'There was an error with import' }}</span>
              </div>
            </template>
            <template #description>
              <div class="p-2 text-gray-500"><span class="font-weight-600">Error:</span> {{ stats.error.message }}</div>
            </template>
          </a-alert>
          <div class="flex gap-2 items-center justify-center">
            <NcButton @click="clearImport()">Okay</NcButton>
            <NcButton type="ghost" @click="step = 1">Return</NcButton>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="mt-4">
          <NcButton @click="clearImport()">Okay</NcButton>
        </div>
      </template>
    </div>
  </template>
</template>

<style lang="scss" scoped>
.input-wrapper {
  @apply mb-2;
}
</style>
