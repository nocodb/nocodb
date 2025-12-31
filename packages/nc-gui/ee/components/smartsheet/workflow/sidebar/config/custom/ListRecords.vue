<script setup lang="ts">
import type { ColumnType, FilterType, SortType } from 'nocodb-sdk'
import { IntegrationsType, UITypes, isSystemColumn } from 'nocodb-sdk'

interface ListRecordsNodeConfig {
  modelId?: string
  viewId?: string
  limit?: number
  offset?: number
  filters?: FilterType[]
  sorts?: SortType[]
}

const { selectedNodeId, updateNode, selectedNode, fetchNodeIntegrationOptions } = useWorkflowOrThrow()

const { t } = useI18n()

const { base } = storeToRefs(useBase())

const config = computed<ListRecordsNodeConfig>(() => {
  return (selectedNode.value?.data?.config || {
    limit: 25,
    offset: 0,
    filters: [],
    sorts: [],
  }) as ListRecordsNodeConfig
})

const tableOptions = ref<any[]>([])

const viewOptions = ref<any[]>([])

const columns = ref<ColumnType[]>([])

const isFilterDropdownOpen = ref(false)

const isSortDropdownOpen = ref(false)

const meta = computed(() => {
  const table = tableOptions.value.find((t) => t.table.id === config.value.modelId)?.table
  if (!table) return null
  table.columns = columns.value.filter((c) => !isSystemColumn(c))
  table.views = viewOptions.value.map((v) => v.view)
  table.columnsById = columns.value.reduce((acc, col) => {
    acc[col.id] = col
    return acc
  }, {} as Record<string, ColumnType>)
  return table
})

provide(MetaInj, meta)

const workflowContext = inject(WorkflowVariableInj, null)

const groupedVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const flatVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

const sortSupportedColumns = computed(() => {
  return columns.value.filter((c) => {
    // Exclude system columns
    if (isSystemColumn(c)) {
      return false
    }
    // Exclude unsupported types
    return ![UITypes.QrCode, UITypes.Barcode, UITypes.ID, UITypes.Button].includes(c.uidt as UITypes)
  })
})

const availableColumnsForSort = computed(() => {
  return sortSupportedColumns.value.filter((c) => !config.value.sorts?.find((s) => s.fk_column_id === c.id))
})

const updateConfig = (updates: Partial<ListRecordsNodeConfig>) => {
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
    } else if (key === 'views') {
      viewOptions.value = options || []
    } else if (key === 'columns') {
      columns.value = (options || []).map((opt: any) => opt.column).filter(Boolean)
    }
  } catch (e) {
    console.error('Failed to load tables:', e)
  } finally {
    if (key === 'tables' && config.value.modelId) {
      await Promise.all([loadConfig('views'), loadConfig('columns')])
    }
  }
}

// Handle table selection
const onTableSelect = async (tableId?: string | null) => {
  if (!tableId) return
  updateConfig({
    modelId: tableId || undefined,
    viewId: undefined,
    filters: [],
    sorts: [],
  })

  if (tableId) {
    await Promise.all([loadConfig('views'), loadConfig('columns')])
  } else {
    viewOptions.value = []
    columns.value = []
  }
}

const onViewSelect = (viewId: string | null) => {
  updateConfig({ viewId: viewId || undefined })
}

const onLimitChange = (value: number) => {
  updateConfig({ limit: value })
}

const onOffsetChange = (value: number) => {
  updateConfig({ offset: value })
}

const filters = computed({
  get: () => config.value.filters || [],
  set: (newFilters: FilterType[]) => {
    updateConfig({ filters: newFilters })
  },
})

const filtersCount = computed(() => {
  return (config.value.filters || []).filter((f) => !f.is_group).length
})

const sortsCount = computed(() => {
  return (config.value.sorts || []).length
})

const updateSorts = (newSorts: SortType[]) => {
  updateConfig({ sorts: newSorts })
}

const getAvailableColumnsForSort = (sort: SortType) => {
  // Find Columns not in sort, also include the current column if it is not in sort
  return sortSupportedColumns.value.filter(
    (c) => !config.value.sorts?.find((s) => s.fk_column_id === c.id) || c.id === sort.fk_column_id,
  )
}

const addSort = () => {
  if (!availableColumnsForSort.value.length) return
  const newSorts = [...(config.value.sorts || [])]
  newSorts.push({
    fk_column_id: availableColumnsForSort.value[0].id,
    direction: 'asc',
  } as SortType)
  updateSorts(newSorts)
}

const updateSort = (index: number, updates: Partial<SortType>) => {
  const newSorts = [...(config.value.sorts || [])]
  newSorts[index] = { ...newSorts[index], ...updates }
  updateSorts(newSorts)
}

const removeSort = (index: number) => {
  const newSorts = [...(config.value.sorts || [])]
  newSorts.splice(index, 1)
  updateSorts(newSorts)
}

const getColumnUidtByID = (key?: string) => {
  if (!key) return ''
  const column = sortSupportedColumns.value.find((col) => col.id === key)
  if (!column) return ''
  return column.uidt || ''
}

// Initialize
onMounted(() => {
  loadConfig('tables')
})
</script>

<template>
  <div class="list-records-config flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Table</label>
      <NcFormBuilderInputSelectTable
        :value="config.modelId"
        :base-id="base?.id"
        :multiple="false"
        :options="tableOptions"
        @update:value="onTableSelect"
      />
    </div>

    <div v-if="config.modelId" class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">View</label>
      <NcFormBuilderInputSelectView
        :value="config.viewId"
        :table-id="config.modelId"
        :options="viewOptions"
        @update:value="onViewSelect"
      />
    </div>

    <div class="flex gap-3">
      <div class="flex flex-col gap-2 flex-1">
        <label class="text-sm font-medium text-nc-content-gray-emphasis">Limit</label>
        <a-input-number
          :value="config.limit || 25"
          :min="1"
          :max="1000"
          :controls="false"
          placeholder="25"
          class="w-full !rounded-lg"
          @update:value="onLimitChange"
        />
      </div>
      <div class="flex flex-col gap-2 flex-1">
        <label class="text-sm font-medium text-nc-content-gray-emphasis">Offset</label>
        <a-input-number
          :value="config.offset || 0"
          :min="0"
          :controls="false"
          placeholder="0"
          class="w-full !rounded-lg"
          @update:value="onOffsetChange"
        />
      </div>
    </div>

    <div v-if="config.modelId && columns.length > 0" class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Filter</label>

      <NcDropdown
        v-model:visible="isFilterDropdownOpen"
        placement="bottomLeft"
        overlay-class-name="nc-list-records-filter-dropdown"
      >
        <div
          class="h-9 border-1 rounded-lg py-1 px-3 flex items-center justify-between gap-2 transition-all cursor-pointer select-none text-sm"
          :class="{
            '!border-nc-border-brand shadow-selected': isFilterDropdownOpen,
            'border-nc-border-gray-medium': !isFilterDropdownOpen,
            'bg-nc-bg-brand-light': filtersCount > 0,
          }"
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
        </div>

        <template #overlay>
          <div class="nc-list-records-filter-container p-3">
            <SmartsheetToolbarColumnFilter
              v-model="filters"
              class="w-full"
              :auto-save="false"
              :show-loading="false"
              :web-hook="false"
              :show-dynamic-condition="true"
              :workflow="true"
              :link="false"
              @update:filters-length="isFilterDropdownOpen = $event > 0"
            >
              <template #dynamic-filter="{ filter, onUpdateFilterValue }">
                <NcFormBuilderInputWorkflowInput
                  class="h-8"
                  :model-value="filter.value"
                  :grouped-variables="groupedVariables"
                  :variables="flatVariables"
                  placeholder="Enter value"
                  @update:model-value="(value) => onUpdateFilterValue(value)"
                />
              </template>
            </SmartsheetToolbarColumnFilter>
          </div>
        </template>
      </NcDropdown>
    </div>

    <div v-if="config.modelId && columns.length > 0" class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Sort</label>

      <NcDropdown v-model:visible="isSortDropdownOpen" placement="bottomLeft" overlay-class-name="nc-list-records-sort-dropdown">
        <div
          class="h-9 border-1 rounded-lg py-1 px-3 flex items-center justify-between gap-2 transition-all cursor-pointer select-none text-sm"
          :class="{
            '!border-nc-border-brand shadow-selected': isSortDropdownOpen,
            'border-nc-border-gray-medium': !isSortDropdownOpen,
            'bg-nc-bg-brand-light': sortsCount > 0,
          }"
        >
          <div
            class="nc-sorts-count flex-1"
            :class="{
              'text-nc-content-brand': sortsCount > 0,
              'text-nc-content-gray-muted': sortsCount === 0,
            }"
          >
            {{ sortsCount > 0 ? `${sortsCount} sort${sortsCount !== 1 ? 's' : ''}` : 'No sorting' }}
          </div>

          <GeneralIcon
            icon="ncChevronDown"
            class="flex-none w-4 h-4"
            :class="{
              'text-nc-content-brand': sortsCount > 0,
              'text-nc-content-gray-muted': sortsCount === 0,
            }"
          />
        </div>

        <template #overlay>
          <div class="nc-list-records-sort-container p-3">
            <div v-if="!config.sorts || config.sorts.length === 0" class="text-nc-content-gray-disabled mb-2">
              No sorting added
            </div>

            <div v-else class="space-y-2 mb-3">
              <div v-for="(sort, index) in config.sorts" :key="index" class="flex items-center flex-1 gap-2">
                <NcSelect
                  :value="sort.fk_column_id"
                  class="flex-1 min-w-[150px]"
                  @update:value="updateSort(index, { fk_column_id: $event })"
                >
                  <a-select-option v-for="(column, idx) in getAvailableColumnsForSort(sort)" :key="idx" :value="column.id">
                    <div class="flex items-center gap-2">
                      <SmartsheetHeaderIcon :column="column" />
                      <span>{{ column.title }}</span>
                    </div>
                  </a-select-option>
                </NcSelect>

                <NcSelect
                  :value="sort.direction"
                  class="flex-1"
                  dropdown-class-name="sort-dir-dropdown nc-dropdown-sort-dir"
                  @update:value="(val) => updateSort(index, { direction: val })"
                >
                  <a-select-option
                    v-for="(option, j) of getSortDirectionOptions(getColumnUidtByID(sort.fk_column_id))"
                    :key="j"
                    :value="option.value"
                  >
                    <div class="w-full flex items-center justify-between gap-2">
                      <div class="truncate flex-1">{{ option.text }}</div>
                      <component
                        :is="iconMap.check"
                        v-if="sort.direction === option.value"
                        id="nc-selected-item-icon"
                        class="text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>

                <NcButton size="small" type="secondary" @click="removeSort(index)">
                  <GeneralIcon icon="delete" />
                </NcButton>
              </div>
            </div>

            <NcButton type="text" size="small" :disabled="!availableColumnsForSort.length" @click="addSort">
              <template #icon>
                <GeneralIcon icon="ncPlus" class="w-4 h-4" />
              </template>
              {{ t('activity.addSort') }}
            </NcButton>
          </div>
        </template>
      </NcDropdown>
    </div>
  </div>
</template>

<style lang="scss">
.nc-list-records-filter-dropdown,
.nc-list-records-sort-dropdown {
  @apply !min-w-[500px] !max-w-[600px];

  .ant-dropdown-menu {
    @apply !p-0;
  }
}
</style>

<style scoped lang="scss">
.list-records-config {
  :deep(.ant-select-selector) {
    @apply !min-h-8;
  }

  :deep(.ant-input-number) {
    @apply w-full;
  }
}

:deep(.nc-workflow-input) {
  .ProseMirror {
    @apply !h-8 !min-h-8 border-none w-40 !py-1;
  }

  .nc-workflow-input-insert-btn {
    @apply !-top-0.5;
  }
}

.nc-list-records-filter-container,
.nc-list-records-sort-container {
  @apply max-h-[500px] overflow-y-auto;
}
</style>
