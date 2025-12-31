<script setup lang="ts">
import type { ColumnType, FilterType } from 'nocodb-sdk'
import { IntegrationsType, isSystemColumn } from 'nocodb-sdk'

interface RecordMatchesConditionConfig {
  modelId: string
  filters: FilterType[]
}

const { selectedNodeId, updateNode, selectedNode, fetchNodeIntegrationOptions, isWorkflowEditAllowed } = useWorkflowOrThrow()

const { base } = storeToRefs(useBase())

const config = computed<RecordMatchesConditionConfig>(() => {
  return (selectedNode.value?.data?.config || {
    modelId: '',
    filters: [],
  }) as RecordMatchesConditionConfig
})

const tableOptions = ref<any[]>([])

const columns = ref<ColumnType[]>([])

const isFilterDropdownOpen = ref(false)

const updateConfig = (updates: Partial<RecordMatchesConditionConfig>) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: {
        ...config.value,
        ...updates,
      },
      testResult: {
        ...(selectedNode.value?.data?.testResult || {}),
        isStale: true,
      },
    },
  })
}

const loadConfig = async (key: string) => {
  if (!selectedNode.value) return
  try {
    const options = await fetchNodeIntegrationOptions(
      {
        type: IntegrationsType.WorkflowNode,
        sub_type: selectedNode.value.type,
        config: config.value,
      },
      key,
    )

    if (key === 'tables') {
      tableOptions.value = options || []
    } else if (key === 'columns') {
      columns.value = (options || []).map((opt: any) => opt.column).filter(Boolean)
    }
  } catch (e) {
    console.error('Failed to load tables:', e)
  } finally {
    if (key === 'tables' && config.value.modelId) {
      await Promise.all([loadConfig('columns')])
    }
  }
}

const meta = computed(() => {
  const table = tableOptions.value.find((t) => t.table.id === config.value.modelId)?.table
  if (!table) return null
  table.columns = columns.value.filter((c) => !isSystemColumn(c))
  table.columnsById = columns.value.reduce((acc, col) => {
    acc[col.id] = col
    return acc
  }, {} as Record<string, ColumnType>)
  return table
})

provide(MetaInj, meta)

// Handle table selection
const onTableSelect = async (tableId?: string | null) => {
  if (!tableId) {
    columns.value = []
    return
  }
  updateConfig({
    modelId: tableId,
    filters: [],
  })

  await loadConfig('columns')
}

const filters = computed({
  get: () => config.value.filters || [],
  set: (newFilters: FilterType[]) => {
    updateConfig({ filters: newFilters })
  },
})

const filtersCount = computed(() => {
  const countFilters = (filterList: FilterType[]): number => {
    return filterList.reduce((count, filter) => {
      if (filter.is_group && filter.children) {
        return count + countFilters(filter.children)
      }
      return count + 1
    }, 0)
  }
  return countFilters(filters.value)
})

// Initialize
onMounted(() => {
  loadConfig('tables')
})
</script>

<template>
  <div class="record-matches-condition-config flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Table</label>
      <NcFormBuilderInputSelectTable
        :value="config.modelId"
        :disabled="!isWorkflowEditAllowed"
        :base-id="base?.id"
        :multiple="false"
        :options="tableOptions"
        @update:value="onTableSelect"
      />
    </div>

    <div v-if="config.modelId && columns.length > 0" class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Filter</label>

      <NcListDropdown
        v-model:visible="isFilterDropdownOpen"
        placement="bottomLeft"
        :disabled="!isWorkflowEditAllowed"
        overlay-class-name="nc-list-records-filter-dropdown"
      >
        <div
          class="nc-filters-count flex-1"
          :class="{
            'text-nc-content-brand': filtersCount > 0,
            'text-nc-content-gray-muted': filtersCount === 0,
          }"
        >
          {{ filtersCount > 0 ? `${filtersCount} filter${filtersCount !== 1 ? 's' : ''}` : 'No filters' }}
        </div>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none w-4 h-4"
          :class="{
            'text-nc-content-brand': filtersCount > 0,
            'text-nc-content-gray-muted': filtersCount === 0,
          }"
        />

        <template #overlay>
          <div class="nc-list-records-filter-container p-3">
            <SmartsheetToolbarColumnFilter
              v-model="filters"
              class="w-full"
              :auto-save="false"
              :show-loading="false"
              :web-hook="false"
              :workflow="true"
              :show-dynamic-condition="false"
              :link="false"
              @update:filters-length="isFilterDropdownOpen = $event > 0"
            />
          </div>
        </template>
      </NcListDropdown>
    </div>
  </div>
</template>

<style lang="scss">
.nc-record-filter-dropdown {
  @apply !min-w-[600px] !max-w-[800px];

  .ant-dropdown-menu {
    @apply !p-0;
  }
}
</style>

<style scoped lang="scss">
.record-matches-condition-config {
  :deep(.ant-select-selector) {
    @apply !min-h-8;
  }
}

.nc-record-filter-dropdown-container {
  @apply max-h-[500px] overflow-y-auto;
}
</style>
