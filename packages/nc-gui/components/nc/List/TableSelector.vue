<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

interface Props {
  baseId?: string
  tableId?: string
  value?: string | null | undefined
  forceLayout?: 'vertical' | 'horizontal'
  filterTable?: (table: TableType) => boolean
  forceLoadBaseTables?: boolean
  disableLabel?: boolean
  autoSelect?: boolean
  disabled?: boolean
  dropdownClass?: string
  dropdownOverlayClassName?: string
  defaultSlotWrapperClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  forceLoadBaseTables: false,
  disableLabel: false,
  autoSelect: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:value': [value: string | null | undefined]
}>()

const { t } = useI18n()

const tableStore = useTablesStore()

const { activeTables, baseTables } = storeToRefs(tableStore)

const modelValue = useVModel(props, 'value', emit)

const isOpenTableSelectDropdown = ref(false)

const handleValueUpdate = (value: any) => {
  const stringValue = String(value)
  modelValue.value = stringValue
}

const tableList = computedAsync(async () => {
  let tables: TableType[]

  if (props.baseId) {
    await tableStore.loadProjectTables(props.baseId, props.forceLoadBaseTables)
    tables = baseTables.value.get(props.baseId) || []
  } else {
    tables = activeTables.value || []
  }

  if (props.filterTable) {
    tables = tables.filter(props.filterTable)
  }

  return tables.map((table) => {
    const ncItemTooltip = ''

    return {
      label: table.title || table.table_name,
      value: table.id,
      ncItemDisabled: false,
      ncItemTooltip,
      ...table,
    }
  })
}, [])

const tableListMap = computed(() => {
  if (!tableList.value || tableList.value.length === 0) return new Map()

  return new Map(tableList.value.map((table) => [table.value, table]))
})

const selectedTable = computed(() => {
  if (!tableListMap.value || tableListMap.value.size === 0) return undefined

  return tableListMap.value.get(modelValue.value) || undefined
})

watch(
  tableList,
  (newTableList) => {
    if (newTableList && newTableList.length > 0) {
      const newTableListMap = new Map(newTableList.map((table) => [table.value, table]))

      // Check if current value exists in the new table list
      if (modelValue.value && !newTableListMap.has(modelValue.value)) {
        // Current value is not in the list, set null to clear it
        modelValue.value = null
        return
      }

      // Auto-select logic (only if autoSelect is enabled and no current value)
      if (!modelValue.value && props.autoSelect) {
        const newTableId = props.tableId || newTableList[0]?.value

        const tableObj = newTableListMap.get(newTableId)

        if (tableObj && tableObj.ncItemDisabled && tableObj.value === newTableList[0]?.value) {
          const selectedValue = newTableList.find((table) => !table.ncItemDisabled)?.value || newTableList[0]?.value
          modelValue.value = selectedValue
        } else {
          modelValue.value = newTableId
        }
      }
    }
  },
  { immediate: true },
)

defineExpose({
  modelValue,
  selectedTable,
  isOpenTableSelectDropdown,
  tableList,
  tableListMap,
})
</script>

<template>
  <a-form-item
    name="tableId"
    class="!mb-0 nc-table-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedTable?.ncItemDisabled ? 'error' : ''"
    :help="selectedTable?.ncItemDisabled ? [selectedTable.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template v-if="!disableLabel" #label>
      <div>
        <slot name="label">{{ t('objects.table') }}</slot>
      </div>
    </template>
    <NcListDropdown
      v-model:is-open="isOpenTableSelectDropdown"
      :disabled="disabled"
      :has-error="!!selectedTable?.ncItemDisabled"
      :class="dropdownClass"
      :overlay-class-name="dropdownOverlayClassName"
      :default-slot-wrapper-class="defaultSlotWrapperClass"
    >
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <div v-if="selectedTable" class="min-w-5 flex items-center justify-center">
          <NcIconTable :table="selectedTable || { title: '', table_name: '' }" class="text-nc-content-muted" />
        </div>
        <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
          <span
            v-if="selectedTable"
            :key="selectedTable?.value"
            class="text-sm flex-1 truncate"
            :class="{ 'text-nc-content-gray-muted': !selectedTable }"
          >
            {{ selectedTable?.label }}
          </span>
          <template v-else>
            <slot name="placeholder">
              <span class="text-sm flex-1 truncate text-nc-content-gray-muted">-- Select table --</span>
            </slot>
          </template>

          <template #title>
            <template v-if="selectedTable?.label">
              {{ selectedTable?.label }}
            </template>
            <slot v-else name="placeholderTooltip"> Select table </slot>
          </template>
        </NcTooltip>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none h-4 w-4 transition-transform opacity-70"
          :class="{ 'transform rotate-180': isOpenTableSelectDropdown }"
        />
      </div>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isOpenTableSelectDropdown"
          :value="modelValue || selectedTable?.value || ''"
          :list="tableList"
          variant="medium"
          class="!w-auto"
          wrapper-class-name="!h-auto"
          @update:value="handleValueUpdate"
          @escape="onEsc"
        >
          <template #listItemExtraLeft="{ option }">
            <div class="min-w-5 flex items-center justify-center">
              <NcIconTable :table="option as TableType" class="text-nc-content-muted" />
            </div>
          </template>
          <template v-if="$slots.listHeader" #listHeader>
            <slot name="listHeader" :length="tableList.length" />
          </template>
          <template v-if="$slots.emptyState" #emptyState>
            <slot name="emptyState" :length="tableList.length" />
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </a-form-item>
</template>
