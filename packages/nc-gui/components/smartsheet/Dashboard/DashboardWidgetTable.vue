<script setup lang="ts">
import type { TableWidgetConfig, WidgetType } from 'nocodb-sdk'
import dayjs from 'dayjs'

interface Props {
  widget?: WidgetType
  config?: TableWidgetConfig
  isReadonly?: boolean
}

const props = defineProps<Props>()

const isLoading = ref(false)
const error = ref<string | null>(null)
const tableData = ref<any[]>([])
const currentPage = ref(1)
const pageSize = computed(() => props.config?.limit || 10)

// Column definitions
const visibleColumns = computed(() => {
  // TODO: Get actual column definitions from the data source
  // This is a placeholder implementation
  if (!tableData.value.length) return []

  const sampleRow = tableData.value[0]
  const allColumns = Object.keys(sampleRow).map((key) => ({
    key,
    title: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    type: typeof sampleRow[key],
  }))

  // Filter columns if specific columns are configured
  if (props.config?.columns?.length) {
    return allColumns.filter((col) => props.config?.columns?.includes(col.key))
  }

  return allColumns
})

// Pagination
const totalPages = computed(() => Math.ceil(tableData.value.length / pageSize.value))

const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, tableData.value.length))

const paginatedData = computed(() => {
  if (!props.config?.showPagination) return tableData.value

  return tableData.value.slice(startIndex.value, startIndex.value + pageSize.value)
})

// Load table data
const loadTableData = async () => {
  try {
    isLoading.value = true
    error.value = null

    // TODO: Implement actual data fetching based on config
    // This is a placeholder implementation

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Generate mock data
    const mockData = Array.from({ length: 50 }, (_, index) => ({
      id: index + 1,
      name: `Item ${index + 1}`,
      status: ['Active', 'Inactive', 'Pending'][Math.floor(Math.random() * 3)],
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      value: Math.floor(Math.random() * 1000),
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
    }))

    tableData.value = mockData
  } catch (e) {
    console.error('Error loading table data:', e)
    error.value = 'Failed to load table data'
  } finally {
    isLoading.value = false
  }
}

// Format cell values based on type
const formatCellValue = (value: any, type: string) => {
  if (value === null || value === undefined) return '—'

  if (value instanceof Date) {
    return dayjs(value).format('MMM D, YYYY')
  }

  if (type === 'number') {
    return value.toLocaleString()
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

// Load data when component mounts or config changes
watchEffect(() => {
  loadTableData()
})

// Reset page when data changes
watch(tableData, () => {
  currentPage.value = 1
})
</script>

<template>
  <div class="table-widget">
    <div v-if="isLoading" class="loading-state">
      <a-spin size="large" />
      <p class="text-gray-500 text-sm mt-2">Loading table data...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <GeneralIcon icon="table" class="text-4xl text-red-400 mb-2" />
      <p class="text-red-500 text-sm">{{ error }}</p>
    </div>

    <div v-else-if="!tableData?.length" class="no-data">
      <GeneralIcon icon="table" class="text-4xl text-gray-400 mb-2" />
      <p class="text-gray-500 text-sm">No data available</p>
    </div>

    <div v-else class="table-container">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="column in visibleColumns" :key="column.key" class="table-header">
                {{ column.title }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in paginatedData" :key="index" class="table-row">
              <td v-for="column in visibleColumns" :key="column.key" class="table-cell">
                <div class="cell-content">
                  {{ formatCellValue(row[column.key], column.type) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="config?.showPagination && totalPages > 1" class="pagination-container">
        <div class="pagination-info">Showing {{ startIndex + 1 }}-{{ endIndex }} of {{ tableData.length }} rows</div>

        <div class="pagination-controls">
          <NcButton size="small" :disabled="currentPage === 1" @click="currentPage--"> Previous </NcButton>

          <span class="page-info"> {{ currentPage }} / {{ totalPages }} </span>

          <NcButton size="small" :disabled="currentPage === totalPages" @click="currentPage++"> Next </NcButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.table-widget {
  @apply w-full h-full flex flex-col;
}

.loading-state,
.error-state,
.no-data {
  @apply w-full h-full flex flex-col items-center justify-center;
}

.table-container {
  @apply flex flex-col h-full;
}

.table-wrapper {
  @apply flex-1 overflow-auto;
}

.data-table {
  @apply w-full text-sm;
  border-collapse: collapse;
}

.table-header {
  @apply bg-gray-50 border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-900;
  position: sticky;
  top: 0;
  z-index: 1;
}

.table-row {
  @apply border-b border-gray-100;

  &:hover {
    @apply bg-gray-50;
  }
}

.table-cell {
  @apply px-3 py-2 border-r border-gray-100 last:border-r-0;
}

.cell-content {
  @apply truncate;
  max-width: 200px;
}

.pagination-container {
  @apply flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50;
}

.pagination-info {
  @apply text-xs text-gray-600;
}

.pagination-controls {
  @apply flex items-center gap-2;
}

.page-info {
  @apply text-xs text-gray-600 mx-2;
}
</style>
