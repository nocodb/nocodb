<script lang="ts" setup>
import { isCreatedOrLastModifiedTimeCol, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { ClientType, UITypes } from 'nocodb-sdk'
import { SmartsheetToolbarFilterRow } from '#components'

interface Props {
  modelValue: ColumnFilterType
  index: number
  columns: ColumnTypeForFilter[]
  dbClientType?: ClientType
  showNullAndEmptyInFilter?: boolean

  disabled?: boolean
  // some view is different when locked view but not disabled
  isLockedView?: boolean
  isLogicalOpChangeAllowed?: boolean
  sentryProps?: any
  containerProps?: any
  logicalOpsProps?: any
  columnSelectProps?: any
  comparisonOpsProps?: any
  comparisonSubOpsProps?: any
  inputValueProps?: any
  deleteButtonProps?: any
}
interface Emits {
  (event: 'update:modelValue', model: string): void
  (event: 'change', model: FilterRowChangeEvent): void
  (
    event: 'delete',
    model: {
      filter: ColumnFilterType
      index: number
    },
  ): void
}
const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

// t is a standalone dependency, so not need to abstract it
const { t } = useI18n()

const column = computed(() => {
  const fk_column_id = vModel.value.fk_column_id
  if (!vModel.value.fk_column_id) {
    return undefined
  }
  return props.columns.find((col) => col.id === fk_column_id)
})

const columns = computed(() => {
  if (!column.value) return []
  return getDynamicColumns(props.columns, column.value, props.dbClientType)
})

// #endregion
</script>

<template>
  <div v-if="link && (filter.dynamic || filter.fk_value_col_id)" class="flex-grow">
    <SmartsheetToolbarFilterFieldListDropdownLite
      v-model="vModel.fk_value_col_id"
      class="nc-filter-field-select min-w-32 w-full max-h-8"
      :columns="columns"
      @change="saveOrUpdate(filter, i)"
    />
  </div>
  <template v-else>
    <a-checkbox
      v-if="filter.field && types[filter.field] === 'boolean'"
      v-model:checked="filter.value"
      dense
      :disabled="filter.readOnly || isLockedView || readOnly"
      @change="saveOrUpdate(filter, i)"
    />

    <SmartsheetToolbarFilterInput
      v-if="showFilterInput(filter)"
      class="nc-filter-value-select rounded-md min-w-34"
      :class="{
        '!w-full': webHook,
      }"
      :column="{ ...getColumn(filter), uidt: types[filter.fk_column_id] }"
      :filter="filter"
      :disabled="isLockedView || readOnly"
      @update-filter-value="(value) => updateFilterValue(value, filter, i)"
      @click.stop
    />

    <div v-else-if="!isDateType(types[filter.fk_column_id])" class="flex-grow"></div>
  </template>
  >
</template>
