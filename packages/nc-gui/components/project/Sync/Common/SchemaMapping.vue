<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

const { integrationConfigs, integrationFetchDestinationSchema } = useSyncFormOrThrow()

integrationConfigs.value.forEach((integration) => {
  if (!integration.config) {
    integration.config = {}
  }
  if (!integration.config.custom_schema) {
    integration.config.custom_schema = {}
  }
})

const destinationSchema = computed<CustomSyncSchema>(() => {
  const mergedSchema: CustomSyncSchema = {}

  integrationConfigs.value.forEach((integration) => {
    if (integration.config?.custom_schema) {
      Object.assign(mergedSchema, integration.config.custom_schema)
    }
  })

  return mergedSchema
})

const selectedTable = ref('')

const tableNames = computed(() => Object.keys(destinationSchema.value))

const abstractTypeToUITypes = {
  string: [
    UITypes.SingleLineText,
    UITypes.LongText,
    UITypes.Email,
    UITypes.URL,
    UITypes.PhoneNumber,
    UITypes.SingleSelect,
    UITypes.MultiSelect,
  ],
  number: [UITypes.Number, UITypes.Decimal, UITypes.Rating, UITypes.Percent],
  boolean: [UITypes.Checkbox],
  date: [UITypes.Date],
  datetime: [UITypes.DateTime],
  json: [UITypes.JSON],
  jsonb: [UITypes.JSON],
  decimal: [UITypes.Decimal, UITypes.Number],
}

type AbstractTypeKey = keyof typeof abstractTypeToUITypes

const tableSelectedAll = computed(() => {
  const table = destinationSchema.value[selectedTable.value]
  return table?.columns?.every((column) => !column.exclude) ?? false
})

// Table columns for NcTable
const tableColumns = computed(() => [
  {
    name: 'Include',
    key: 'include',
    width: 80,
  },
  {
    name: 'Column Name',
    key: 'columnName',
    width: 200,
  },
  {
    name: 'Original Type',
    key: 'originalType',
    width: 150,
  },
  {
    name: 'Target Type',
    key: 'targetType',
    width: 200,
  },
  {
    name: 'Unique ID',
    key: 'uniqueId',
    width: 100,
  },
  {
    name: 'Created At',
    key: 'createdAt',
    width: 100,
  },
  {
    name: 'Updated At',
    key: 'updatedAt',
    width: 100,
  },
])

const tableData = computed(() => {
  const table = destinationSchema.value[selectedTable.value]
  if (!table?.columns) return []

  return table.columns.map((column, index) => ({
    ...column,
    _index: index,
  }))
})

// Helper functions
const isPrimaryKeyColumn = (columnTitle: string): boolean => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable?.systemFields?.primaryKey) return false
  return currentTable.systemFields.primaryKey.includes(columnTitle)
}

const countPrimaryKeys = (): number => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable?.systemFields?.primaryKey) return 0
  return currentTable.systemFields.primaryKey.length
}

const getAllowedUITypes = (abstractType: string) => {
  const typeKey = Object.keys(abstractTypeToUITypes).find((key) => abstractType.includes(key)) as AbstractTypeKey | undefined
  if (typeKey && abstractTypeToUITypes[typeKey]) {
    return abstractTypeToUITypes[typeKey]
  }
  return [UITypes.SingleLineText, UITypes.LongText]
}

const getUITypeOptions = (column: { abstractType: string }) => {
  const allowedTypes = getAllowedUITypes(column.abstractType)
  return allowedTypes.map((type) => ({
    label: type,
    value: type,
  }))
}

const updateSchema = (newSchema: CustomSyncSchema) => {
  integrationConfigs.value.forEach((integration) => {
    if (integration.config?.custom_schema) {
      Object.keys(integration.config.custom_schema).forEach((tableName) => {
        if (newSchema[tableName]) {
          integration.config.custom_schema[tableName] = newSchema[tableName]
        }
      })
    }
  })
}

const toggleSelectAll = (checked: boolean) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (tableToUpdate?.columns) {
    tableToUpdate.columns.forEach((column) => {
      if (!isPrimaryKeyColumn(column.title)) {
        column.exclude = !checked
      }
    })
  }

  updateSchema(updatedSchema)
}

const updateColumn = (columnIndex: number, field: string, value: any) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable?.columns?.[columnIndex]) return

  const column = currentTable.columns[columnIndex]
  if (field === 'exclude' && value === true && isPrimaryKeyColumn(column.title)) {
    return
  }

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (tableToUpdate?.columns?.[columnIndex]) {
    ;(tableToUpdate.columns[columnIndex] as any)[field] = value
  }

  updateSchema(updatedSchema)
}

const togglePrimaryKey = (columnTitle: string, checked: boolean) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  if (!checked && isPrimaryKeyColumn(columnTitle) && countPrimaryKeys() === 1) {
    return
  }

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (!tableToUpdate) return

  if (!tableToUpdate.systemFields) {
    tableToUpdate.systemFields = { primaryKey: [] }
  }

  if (checked) {
    if (!tableToUpdate.systemFields.primaryKey.includes(columnTitle)) {
      tableToUpdate.systemFields.primaryKey.push(columnTitle)

      const columnIndex = tableToUpdate.columns.findIndex((col) => col.title === columnTitle)
      if (columnIndex !== -1 && tableToUpdate.columns[columnIndex]) {
        tableToUpdate.columns[columnIndex].exclude = false
      }
    }
  } else {
    tableToUpdate.systemFields.primaryKey = tableToUpdate.systemFields.primaryKey.filter((key) => key !== columnTitle)
  }

  updateSchema(updatedSchema)
}

const toggleTimestampColumn = (columnTitle: string, type: 'createdAt' | 'updatedAt') => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (!tableToUpdate) return

  if (!tableToUpdate.systemFields) {
    tableToUpdate.systemFields = { primaryKey: [] }
  }

  if (tableToUpdate.systemFields[type] === columnTitle) {
    tableToUpdate.systemFields[type] = undefined
  } else {
    tableToUpdate.systemFields[type] = columnTitle
  }

  updateSchema(updatedSchema)
}

const currentCreatedAtColumn = computed(() => {
  const currentTable = destinationSchema.value[selectedTable.value]
  return currentTable?.systemFields?.createdAt
})

const currentUpdatedAtColumn = computed(() => {
  const currentTable = destinationSchema.value[selectedTable.value]
  return currentTable?.systemFields?.updatedAt
})

// Initialize selected table
watch(
  tableNames,
  (names) => {
    if (names.length > 0 && !selectedTable.value) {
      selectedTable.value = names[0]
    }
  },
  { immediate: true },
)

onMounted(async () => {
  for (const integration of integrationConfigs.value) {
    if (!integration.config?.custom_schema || Object.keys(integration.config.custom_schema).length === 0) {
      try {
        const schema = await integrationFetchDestinationSchema(integration)

        if (!integration.config) {
          integration.config = {}
        }
        integration.config.custom_schema = schema

        Object.keys(schema).forEach((tableName) => {
          const table = schema[tableName]
          if (table && table.columns) {
            // Ensure relations array exists
            if (!table.relations) {
              table.relations = []
            }

            // Ensure systemFields exists with primaryKey array
            if (!table.systemFields) {
              table.systemFields = { primaryKey: [] }
            }

            // Initialize column properties
            table.columns.forEach((column) => {
              column.exclude = !!column.exclude
            })

            // If no primary key is set, default to the first column
            if (table.systemFields.primaryKey.length === 0 && table.columns.length > 0) {
              const firstColumn = table.columns[0]
              if (firstColumn) {
                table.systemFields.primaryKey = [firstColumn.title]
              }
            }

            // Ensure primary key columns are not excluded
            table.systemFields.primaryKey.forEach((pkColumn) => {
              const column = table.columns.find((col) => col.title === pkColumn)
              if (column) {
                column.exclude = false
              }
            })
          }
        })
      } catch (error) {
        console.error('Failed to fetch destination schema for integration:', integration.sub_type, error)
      }
    }
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <div class="text-bodyLgBold text-nc-content-gray mb-1">Map Table Columns</div>
      <div class="text-bodyDefaultSm text-nc-content-gray-subtle2">Review and configure the columns for each selected table</div>
    </div>

    <div v-if="tableNames.length > 0">
      <NcTabs v-model:active-key="selectedTable" class="nc-sync-schema-tabs">
        <a-tab-pane v-for="tableName in tableNames" :key="tableName" :tab="tableName" />
      </NcTabs>
    </div>

    <div v-if="selectedTable && destinationSchema[selectedTable]" class="flex flex-col gap-4">
      <!-- Table Header with Select All -->
      <div class="flex items-center justify-between">
        <div class="text-bodyDefaultSmBold text-nc-content-gray">Table: {{ selectedTable }}</div>
        <NcCheckbox :checked="tableSelectedAll" @update:checked="toggleSelectAll">
          <span class="text-bodyDefaultSm text-nc-content-gray-subtle2">Select All Columns</span>
        </NcCheckbox>
      </div>

      <!-- Columns Table -->
      <NcTable :columns="tableColumns" :data="tableData" :bordered="true" :sticky-header="true" class="nc-sync-schema-table">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'include'">
            <div class="flex items-center justify-center">
              <NcCheckbox
                :checked="!record.exclude || isPrimaryKeyColumn(record.title)"
                :disabled="isPrimaryKeyColumn(record.title)"
                @update:checked="(checked) => updateColumn(record._index, 'exclude', !checked)"
              />
            </div>
          </template>

          <template v-else-if="column.key === 'columnName'">
            <div class="text-bodyDefaultSm text-nc-content-gray font-medium">
              {{ record.title }}
            </div>
          </template>

          <template v-else-if="column.key === 'originalType'">
            <div class="text-bodyDefaultSm text-nc-content-gray-subtle2">
              {{ record.abstractType }}
            </div>
          </template>

          <template v-else-if="column.key === 'targetType'">
            <a-select
              :value="record.uidt"
              :options="getUITypeOptions(record)"
              class="nc-select-shadow w-full"
              @update:value="(value) => updateColumn(record._index, 'uidt', value)"
            >
              <template #suffixIcon>
                <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
              </template>
            </a-select>
          </template>

          <template v-else-if="column.key === 'uniqueId'">
            <div class="flex items-center justify-center">
              <NcCheckbox
                :checked="isPrimaryKeyColumn(record.title)"
                @update:checked="(checked) => togglePrimaryKey(record.title, checked)"
              />
            </div>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            <div class="flex items-center justify-center">
              <NcButton
                type="text"
                size="xxsmall"
                class="!w-5 !h-5 !p-0"
                @click="toggleTimestampColumn(record.title, 'createdAt')"
              >
                <div
                  class="w-4 h-4 rounded-full border-2 transition-all"
                  :class="
                    currentCreatedAtColumn === record.title ? 'border-brand-500 bg-white relative' : 'border-gray-300 bg-white'
                  "
                >
                  <div
                    v-if="currentCreatedAtColumn === record.title"
                    class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-500"
                  />
                </div>
              </NcButton>
            </div>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            <div class="flex items-center justify-center">
              <NcButton
                type="text"
                size="xxsmall"
                class="!w-5 !h-5 !p-0"
                @click="toggleTimestampColumn(record.title, 'updatedAt')"
              >
                <div
                  class="w-4 h-4 rounded-full border-2 transition-all"
                  :class="
                    currentUpdatedAtColumn === record.title ? 'border-brand-500 bg-white relative' : 'border-gray-300 bg-white'
                  "
                >
                  <div
                    v-if="currentUpdatedAtColumn === record.title"
                    class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-500"
                  />
                </div>
              </NcButton>
            </div>
          </template>
        </template>
      </NcTable>
    </div>
    <div v-else class="flex flex-col items-center justify-center py-12 px-4 bg-nc-bg-gray-extralight rounded-lg">
      <GeneralIcon icon="ncZap" class="w-12 h-12 text-nc-content-gray-subtle2 mb-5" />
      <div class="text-bodyDefaultSmBold text-nc-content-gray mb-1">No tables available</div>
      <div class="text-bodyDefaultSm text-nc-content-gray-subtle2">Please select atleast one table in your sync source</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-sync-schema-tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
  }
}

.nc-sync-schema-table {
  :deep(.nc-table-header-cell) {
    @apply bg-gray-50 text-bodyDefaultSmBold text-nc-content-gray;
  }

  :deep(.nc-table-cell) {
    @apply text-bodyDefaultSm;
  }
}
</style>
