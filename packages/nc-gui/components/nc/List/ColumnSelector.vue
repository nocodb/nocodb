<script lang="ts" setup>
import { type ColumnType, isSystemColumn } from 'nocodb-sdk'

interface Props {
  tableId?: string
  columnId?: string
  value?: string
  forceLayout?: 'vertical' | 'horizontal'
  filterColumn?: (column: ColumnType) => boolean
  forceLoadTableFields?: boolean
  disableLabel?: boolean
  autoSelect?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  forceLoadTableFields: false,
  disableLabel: false,
  autoSelect: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:value': [value: string | undefined]
}>()

const { t } = useI18n()

const tableStore = useTablesStore()
const { loadTableMeta } = useTablesStore()
const { activeTable } = storeToRefs(tableStore)

const modelValue = useVModel(props, 'value', emit)

const isOpenColumnSelectDropdown = ref(false)

const handleValueUpdate = (value: any) => {
  const stringValue = String(value)
  modelValue.value = stringValue
}

const columnList = computedAsync(async () => {
  let fields: ColumnType[]
  
  if (props.tableId) {
    const tableMeta = await loadTableMeta(props.tableId)
    fields = tableMeta?.columns || []
  } else {
    fields = activeTable.value?.columns || []
  }
  
  if (props.filterColumn) {
    fields = fields.filter(props.filterColumn)
  } else {
    fields = fields.filter((f) => !isSystemColumn(f) || f.pk)
  }

  return fields.map((column) => {
    const isDisabled = Boolean(column.system && !column.pk)
    
    const ncItemTooltip = isDisabled
      ? t('tooltip.systemColumnNotEditable')
      : ''

    return {
      label: column.title || column.column_name,
      value: column.id,
      ncItemDisabled: isDisabled,
      ncItemTooltip,
      ...column,
    }
  })
})

const columnListMap = computed(() => {
  if (!columnList.value || columnList.value.length === 0) return new Map()
  
  return new Map(columnList.value.map((column) => [column.value, column]))
})

const selectedColumn = computed(() => {
  if (!columnListMap.value || columnListMap.value.size === 0) return undefined

  return columnListMap.value.get(modelValue.value) || undefined
})

// Watch for columnList changes and set initial value
watch(columnList, (newColumnList) => {
  if (newColumnList && newColumnList.length > 0) {
    const newColumnListMap = new Map(newColumnList.map((column) => [column.value, column]))
    
    // Check if current value exists in the new column list
    if (modelValue.value && !newColumnListMap.has(modelValue.value)) {
      // Current value is not in the list, set null to clear it
      modelValue.value = undefined
      return
    }

    // Auto-select logic (only if autoSelect is enabled and no current value)
    if (!modelValue.value && props.autoSelect) {
      const newColumnId = props.columnId || newColumnList[0]?.value

      const columnObj = newColumnListMap.get(newColumnId)

      // Change column id only if it is default column selected initially and its not enabled
      if (columnObj && columnObj.ncItemDisabled && columnObj.value === newColumnList[0]?.value) {
        const selectedValue = newColumnList.find((column) => !column.ncItemDisabled)?.value || newColumnList[0]?.value
        modelValue.value = selectedValue
      } else {
        modelValue.value = newColumnId
      }
    }
  }
}, { immediate: true })

defineExpose({
  modelValue,
  selectedColumn,
  isOpenColumnSelectDropdown,
  columnList,
  columnListMap,
})
</script>

<template>
  <a-form-item
    name="columnId"
    class="!mb-0 nc-column-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedColumn?.ncItemDisabled ? 'error' : ''"
    :help="selectedColumn?.ncItemDisabled ? [selectedColumn.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template v-if="!disableLabel" #label>
      <div>
        <slot name="label">{{ t('general.column') }}</slot>
      </div>
    </template>
    <NcListDropdown
      v-model:is-open="isOpenColumnSelectDropdown"
      :disabled="disabled"
      :default-slot-wrapper-class="
        disabled
          ? 'text-nc-content-gray-muted cursor-not-allowed bg-nc-bg-gray-light children:opacity-60'
          : 'text-nc-content-gray'
      "
      :has-error="!!selectedColumn?.ncItemDisabled"
    >
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <div v-if="selectedColumn" class="min-w-5 flex items-center justify-center">
          <NIconField :field="selectedColumn" class="text-gray-500" />
        </div>
        <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only> 
          <span v-if="selectedColumn" class="text-sm flex-1 truncate text-nc-content-gray-default">
            {{ selectedColumn?.label }}
          </span>
          <span v-else class="text-sm flex-1 truncate text-nc-content-gray-muted">-- Select field --</span>

          <template #title>
            {{ selectedColumn?.label || 'Select field' }}
          </template>
        </NcTooltip>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none h-4 w-4 transition-transform opacity-70"
          :class="{ 'transform rotate-180': isOpenColumnSelectDropdown }"
        />
      </div>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isOpenColumnSelectDropdown"
          :value="modelValue || selectedColumn?.value || ''"
          :list="columnList"
          variant="medium"
          class="!w-auto !max-w-xs"
          wrapper-class-name="!h-auto"
          @update:value="handleValueUpdate"
          @escape="onEsc"
        >
          <template #item="{ item }">
            <div class="w-full flex items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <NIconField :field="item" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ item.label }}</template>
                <span>{{ item.label }}</span>
              </NcTooltip>
              <component
                :is="iconMap.check"
                v-if="modelValue === item.value"
                id="nc-selected-item-icon"
                class="flex-none text-primary w-4 h-4"
              />
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </a-form-item>
</template>

<style lang="scss">
.nc-column-selector.ant-form-item {
  &.nc-force-layout-vertical {
    @apply !flex-col;

    & > .ant-form-item-label {
      @apply pb-2 text-left;

      &::after {
        @apply hidden;
      }

      & > label {
        @apply !h-auto;
        &::after {
          @apply !hidden;
        }
      }
    }
  }

  &.nc-force-layout-horizontal {
    @apply !flex-row !items-center;

    & > .ant-form-item-label {
      @apply pb-0 items-center;

      &::after {
        @apply content-[':'] !mr-2 !ml-0.5 relative top-[0.5px];
      }
    }
  }
}
</style>
