<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'

const { formState, integrationFetchDestinationSchema } = useSyncStoreOrThrow()

// Initialize custom_schema if it doesn't exist
if (!formState.value.config.custom_schema) {
  formState.value.config.custom_schema = {}
}

// Define type for our schema structure
interface CustomSyncSchema {
  [key: string]: {
    title: string
    columns: {
      title: string
      uidt: string
      abstractType: string
      exclude?: boolean
    }[]
    relations: any[]
    systemFields?: {
      primaryKey: string[]
      createdAt?: string
      updatedAt?: string
    }
  }
}

const destinationSchema = computed<CustomSyncSchema>(() => formState.value.config.custom_schema)

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

// Set the first table as selected when data is loaded
const initializeSelectedTable = () => {
  if (tableNames.value.length > 0 && !selectedTable.value) {
    selectedTable.value = tableNames.value[0] || ''
  }
}

// Get allowed UITypes for a specific column based on its abstractType
const getAllowedUITypes = (abstractType: string) => {
  // Try to match the abstractType to our known types
  const typeKey = Object.keys(abstractTypeToUITypes).find((key) => abstractType.includes(key)) as AbstractTypeKey | undefined

  if (typeKey && abstractTypeToUITypes[typeKey]) {
    return abstractTypeToUITypes[typeKey]
  }

  return [UITypes.SingleLineText, UITypes.LongText]
}

// Generate UI type options for a specific column
const getUITypeOptions = (column: { abstractType: string }) => {
  const allowedTypes = getAllowedUITypes(column.abstractType)
  return allowedTypes.map((type) => ({
    text: type,
    value: type,
  }))
}

// Update the schema with a new value
const updateSchema = (newSchema: CustomSyncSchema) => {
  formState.value.config.custom_schema = newSchema
}

// Helper functions for primary key management
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

const toggleSelectAll = (checked: boolean) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (tableToUpdate && tableToUpdate.columns) {
    tableToUpdate.columns.forEach((column) => {
      // Don't exclude primary key columns
      if (!isPrimaryKeyColumn(column.title)) {
        column.exclude = !checked
      }
    })
  }

  updateSchema(updatedSchema)
}

const updateColumn = (columnIndex: number, field: string, value: any) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable || !currentTable.columns || !currentTable.columns[columnIndex]) return

  // If trying to exclude a primary key column, prevent it
  const column = currentTable.columns[columnIndex]
  if (field === 'exclude' && value === true && isPrimaryKeyColumn(column.title)) {
    return // Prevent excluding primary key columns
  }

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (tableToUpdate && tableToUpdate.columns && tableToUpdate.columns[columnIndex]) {
    // Use type assertion to help TypeScript understand we can index with a string
    ;(tableToUpdate.columns[columnIndex] as any)[field] = value
  }

  updateSchema(updatedSchema)
}

// Toggle the primary key status for a column
const togglePrimaryKey = (columnTitle: string, checked: boolean) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  // Check if this would leave us with no primary keys
  if (!checked && isPrimaryKeyColumn(columnTitle) && countPrimaryKeys() === 1) {
    // Don't allow removing the last primary key
    return
  }

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (!tableToUpdate) return

  // Initialize systemFields if it doesn't exist
  if (!tableToUpdate.systemFields) {
    tableToUpdate.systemFields = { primaryKey: [] }
  }

  // Update the primaryKey array based on the checkbox state
  if (checked) {
    // Add to primaryKey if not already there
    if (!tableToUpdate.systemFields.primaryKey.includes(columnTitle)) {
      tableToUpdate.systemFields.primaryKey.push(columnTitle)

      // If this column is marked as a primary key, ensure it's not excluded
      const columnIndex = tableToUpdate.columns.findIndex((col) => col.title === columnTitle)
      if (columnIndex !== -1 && tableToUpdate.columns[columnIndex]) {
        tableToUpdate.columns[columnIndex].exclude = false
      }
    }
  } else {
    // Remove from primaryKey
    tableToUpdate.systemFields.primaryKey = tableToUpdate.systemFields.primaryKey.filter((key) => key !== columnTitle)
  }

  updateSchema(updatedSchema)
}

// Toggle a column as createdAt timestamp
const toggleCreatedAtColumn = (columnTitle: string) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (!tableToUpdate) return

  // Initialize systemFields if it doesn't exist
  if (!tableToUpdate.systemFields) {
    tableToUpdate.systemFields = { primaryKey: [] }
  }

  // Toggle the createdAt field
  if (tableToUpdate.systemFields.createdAt === columnTitle) {
    tableToUpdate.systemFields.createdAt = undefined
  } else {
    tableToUpdate.systemFields.createdAt = columnTitle
  }

  updateSchema(updatedSchema)
}

// Toggle a column as updatedAt timestamp
const toggleUpdatedAtColumn = (columnTitle: string) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (!tableToUpdate) return

  // Initialize systemFields if it doesn't exist
  if (!tableToUpdate.systemFields) {
    tableToUpdate.systemFields = { primaryKey: [] }
  }

  // Toggle the updatedAt field
  if (tableToUpdate.systemFields.updatedAt === columnTitle) {
    tableToUpdate.systemFields.updatedAt = undefined
  } else {
    tableToUpdate.systemFields.updatedAt = columnTitle
  }

  updateSchema(updatedSchema)
}

// Get current createdAt column for the selected table
const currentCreatedAtColumn = computed(() => {
  const currentTable = destinationSchema.value[selectedTable.value]
  return currentTable?.systemFields?.createdAt
})

// Get current updatedAt column for the selected table
const currentUpdatedAtColumn = computed(() => {
  const currentTable = destinationSchema.value[selectedTable.value]
  return currentTable?.systemFields?.updatedAt
})

onMounted(async () => {
  if (destinationSchema.value && Object.keys(destinationSchema.value).length > 0) {
    // check formState.value.tables match with destinationSchema.value
    const selectedTables = formState.value.config.tables || []
    if (Object.keys(destinationSchema.value).every((table) => selectedTables.includes(table))) {
      initializeSelectedTable()
      return
    }
  }

  // Fetch the schema and set it in formState
  const schema = await integrationFetchDestinationSchema(formState.value)
  formState.value.config.custom_schema = schema

  // Initialize all columns and systemFields
  const updatedSchema = { ...destinationSchema.value }

  Object.keys(updatedSchema).forEach((tableName) => {
    const table = updatedSchema[tableName]
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
        // Set default exclude to false (include all)
        column.exclude = !!column.exclude
      })

      // If no primary key is set, default to the first column (usually id)
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

  updateSchema(updatedSchema)
  initializeSelectedTable()
})
</script>

<template>
  <div class="column-mapping-container">
    <!-- Table Selector -->
    <div class="table-selector">
      <div class="header">
        <h2>Map Table Columns</h2>
        <p>Review and configure the columns for each selected table</p>
      </div>

      <div class="tabs-container">
        <div class="tabs">
          <button
            v-for="tableName in tableNames"
            :key="tableName"
            class="tab-button"
            :class="{ active: selectedTable === tableName }"
            @click="selectedTable = tableName"
          >
            {{ tableName }}
          </button>
        </div>
      </div>
    </div>

    <!-- Column Mapping -->
    <div v-if="selectedTable && destinationSchema[selectedTable]" class="column-mapping">
      <div class="table-header">
        <h3>Table: {{ selectedTable }}</h3>
        <div class="select-all">
          <a-checkbox :checked="tableSelectedAll" @update:checked="toggleSelectAll">Select All Columns</a-checkbox>
        </div>
      </div>

      <div class="table-container">
        <table class="column-table">
          <thead>
            <tr>
              <th>Include</th>
              <th>Column Name</th>
              <th>Original Type</th>
              <th>Target Type</th>
              <th>Unique ID</th>
              <th>Created At</th>
              <th>Updated At</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(column, index) in destinationSchema[selectedTable]?.columns || []" :key="column.title">
              <td>
                <a-checkbox
                  :checked="!column.exclude || isPrimaryKeyColumn(column.title)"
                  :disabled="isPrimaryKeyColumn(column.title)"
                  @update:checked="(checked) => updateColumn(index, 'exclude', !checked)"
                />
              </td>
              <td>{{ column.title }}</td>
              <td>{{ column.abstractType }}</td>
              <td>
                <a-select
                  v-model:value="column.uidt"
                  :options="getUITypeOptions(column)"
                  style="width: 100%"
                  @update:value="(value) => updateColumn(index, 'uidt', value)"
                />
              </td>
              <td class="center-column">
                <a-checkbox
                  :checked="isPrimaryKeyColumn(column.title)"
                  @update:checked="(checked) => togglePrimaryKey(column.title, checked)"
                />
              </td>
              <td class="center-column">
                <a-button
                  type="text"
                  size="small"
                  class="radio-button"
                  :class="{ selected: currentCreatedAtColumn === column.title }"
                  @click="toggleCreatedAtColumn(column.title)"
                >
                  <div class="custom-radio-circle" />
                </a-button>
              </td>
              <td class="center-column">
                <a-button
                  type="text"
                  size="small"
                  class="radio-button"
                  :class="{ selected: currentUpdatedAtColumn === column.title }"
                  @click="toggleUpdatedAtColumn(column.title)"
                >
                  <div class="custom-radio-circle" />
                </a-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="no-table">
      <p>No tables available for mapping</p>
    </div>
  </div>
</template>

<style scoped>
.column-mapping-container {
  padding: 1.5rem;
  background-color: white;
  border-radius: 0.5rem;
}

.table-selector {
  margin-bottom: 1.5rem;
}

.header {
  margin-bottom: 1.5rem;
}

.header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.header p {
  color: #64748b;
}

.tabs-container {
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1rem;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tab-button {
  padding: 0.5rem 1rem;
  border: none;
  background-color: transparent;
  cursor: pointer;
  border-radius: 0.25rem 0.25rem 0 0;
  font-weight: 500;
  transition: all 0.2s;
}

.tab-button.active {
  background-color: #f1f5f9;
  color: #0891b2;
  border-bottom: 2px solid #0891b2;
}

.tab-button:hover:not(.active) {
  background-color: #f8fafc;
}

.column-mapping {
  margin-top: 1rem;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.table-container {
  overflow-x: auto;
}

.column-table {
  width: 100%;
  border-collapse: collapse;
}

.column-table th,
.column-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.column-table th {
  background-color: #f8fafc;
  font-weight: 500;
}

.center-column {
  text-align: center;
}

.radio-button {
  width: 20px;
  height: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.custom-radio-circle {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #d1d5db;
  background-color: #fff;
}

.radio-button.selected .custom-radio-circle {
  border: 2px solid #0891b2;
  background-color: #fff;
  position: relative;
}

.radio-button.selected .custom-radio-circle::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #0891b2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.no-table {
  padding: 2rem;
  text-align: center;
  background-color: #f8fafc;
  border-radius: 0.375rem;
}
</style>
