<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

interface Props {
  baseId?: string
  tableId?: string
  value?: string
  showTableSelector?: boolean
  forceLayout?: 'vertical' | 'horizontal'
  filterTable?: (table: TableType) => boolean
  forceLoadBaseTables?: boolean
  disableLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTableSelector: true,
  forceLoadBaseTables: false,
  disableLabel: false,
})

const emit = defineEmits<{
  'update:value': [value: string | undefined]
}>()

const { t } = useI18n()

const tableStore = useTablesStore()

const { activeTables, baseTables } = storeToRefs(tableStore)

const modelValue = useVModel(props, 'value', emit)

const isOpenTableSelectDropdown = ref(false)

const handleValueUpdate = (value: any) => {
  const stringValue = String(value)
  modelValue.value = stringValue
  emit('update:value', stringValue)
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
})

const selectedTable = computed(() => {
  if (!tableList.value || tableList.value.length === 0) return undefined

  return tableList.value.find((table) => table.value === modelValue.value) || tableList.value[0]
})

watch(tableList, (newTableList) => {
  if (!modelValue.value && newTableList && newTableList.length > 0) {
    const newTableId = props.tableId || newTableList[0]?.value

    const tableObj = newTableList.find((table) => table.value === newTableId)

    if (tableObj && tableObj.ncItemDisabled && tableObj.value === newTableList[0]?.value) {
      modelValue.value = newTableList.find((table) => !table.ncItemDisabled)?.value || newTableList[0]?.value
    } else {
      modelValue.value = newTableId
    }
  }
}, { immediate: true })

defineExpose({
  modelValue,
  selectedTable,
  isOpenTableSelectDropdown,
  tableList,
})
</script>

<template>
  <a-form-item
    v-if="selectedTable"
    name="tableId"
    class="!mb-0 nc-table-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedTable?.ncItemDisabled ? 'error' : ''"
    :help="selectedTable?.ncItemDisabled ? [selectedTable.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template v-if="!disableLabel" #label>
      <div>{{ t('general.table') }}</div>
    </template>
    <NcListDropdown
      v-model:is-open="isOpenTableSelectDropdown"
      :disabled="!showTableSelector"
      :default-slot-wrapper-class="
        !showTableSelector
          ? 'text-nc-content-gray-muted cursor-not-allowed bg-nc-bg-gray-light children:opacity-60'
          : 'text-nc-content-gray'
      "
      :has-error="!!selectedTable?.ncItemDisabled"
    >
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <div class="min-w-5 flex items-center justify-center">
          <NIconTable :table="selectedTable" class="text-gray-500" />
        </div>
        <span :key="selectedTable?.value" class="text-sm flex-1 truncate">{{ selectedTable?.label || t('general.table') }}</span>

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
          class="!w-auto !max-w-xs"
          wrapper-class-name="!h-auto"
          @update:value="handleValueUpdate"
          @escape="onEsc"
        >
          <template #item="{ item }">
            <div class="w-full flex items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <NIconTable :table="item" class="text-gray-500" />
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
.nc-table-selector.ant-form-item {
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
