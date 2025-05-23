<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue'
import type { ColumnType, LinkToAnotherRecordType, TableType, UITypes } from 'nocodb-sdk'
import { RelationTypes, isHiddenCol, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  modelValue?: string
  isSort?: boolean
  columns?: ColumnTypeForFilter[]
  allowEmpty?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const localValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const options = computed<SelectProps['options']>(() =>
  // sort by view column order and keep system columns at the end
  [...(props.columns ?? [])]
    ?.sort((field1, field2) => {
      let orderVal1 = 0
      let orderVal2 = 0
      let sortByOrder = 0

      if (isSystemColumn(field1)) {
        orderVal1 = 1
      }
      if (isSystemColumn(field2)) {
        orderVal2 = 1
      }

      if (field1?.order && field2?.order) {
        sortByOrder = field1.order - field2.order
      }

      return orderVal1 - orderVal2 || sortByOrder
    })
    ?.map((c) => ({
      value: c.id!,
      label: c.filterTitle ?? c.title,
      icon: h(
        isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'),
        {
          columnMeta: c,
        },
      ),
      c,
    })),
)

const filterOption = (input: string, option: any) => option.label.toLowerCase()?.includes(input.toLowerCase())

// when a new filter is created, select a field by default
if (!localValue.value && props.allowEmpty !== true) {
  localValue.value = (options.value?.[0]?.value as string) || ''
}

const relationColor = {
  [RelationTypes.BELONGS_TO]: 'text-blue-500',
  [RelationTypes.ONE_TO_ONE]: 'text-purple-500',
  [RelationTypes.HAS_MANY]: 'text-orange-500',
  [RelationTypes.MANY_TO_MANY]: 'text-pink-500',
}

// extract colors for Lookup and Rollup columns
const colors = computed(() => {
  return (
    props.columns?.reduce((obj, col) => {
      if ((col && isLookup(col)) || isRollup(col)) {
        const relationColumn = props.columns?.find((c) => c.id === col.colOptions?.fk_relation_column_id) as ColumnType

        if (relationColumn) {
          obj[col.id] = relationColor[relationColumn.colOptions?.type as RelationTypes]
        }
      }
      return obj
    }, {}) || {}
  )
})
</script>

<template>
  <NcSelect
    v-model:value="localValue"
    :dropdown-match-select-width="false"
    show-search
    :placeholder="$t('placeholder.selectField')"
    :filter-option="filterOption"
    dropdown-class-name="nc-dropdown-toolbar-field-list"
  >
    <a-select-option v-for="option in options" :key="option.value" :label="option.label" :value="option.value">
      <div class="flex items-center w-full justify-between w-full gap-2 max-w-50">
        <div class="flex gap-1.5 flex-1 items-center truncate items-center h-full">
          <component :is="option.icon" class="!w-3.5 !h-3.5 !mx-0" :class="colors[option.value] || '!text-gray-500'" />
          <NcTooltip
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            class="max-w-[15rem] truncate select-none"
            show-on-truncate-only
          >
            <template #title> {{ option.label }}</template>
            <span>
              {{ option.label }}
            </span>
          </NcTooltip>
        </div>
        <component
          :is="iconMap.check"
          v-if="localValue === option.value"
          id="nc-selected-item-icon"
          class="text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NcSelect>
</template>

<style lang="scss">
.ant-select-selection-search-input {
  box-shadow: none !important;
}
</style>
