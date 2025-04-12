<script lang="ts" setup>
import type { ColumnType, UITypes } from 'nocodb-sdk'

interface Props {
  modelValue: ColumnFilterType
  index: number
  columns: {
    id?: string
    title?: string
    uidt?: UITypes
    filterUidt?: UITypes
    meta?: any
  }[]
  comparisonOps?: ComparisonOpUiType[]
  comparisonSubOps?: ComparisonOpUiType[]

  renderMode?: null | string
  disabled?: boolean
  isLogicalOpChangeAllowed?: boolean
  showNullAndEmptyInFilter?: boolean
}
interface Emits {
  (event: 'update:modelValue', model: string): void
  (
    event: 'change',
    model: {
      filter: ColumnFilterType
      type: 'logical_op' | 'fk_column_id' | 'comparison_op' | 'comparison_sub_op' | 'value'
      prevValue: any
      value: any
    },
  ): void
}
const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

// t is a standalone dependency, so not need to abstract it
const { t } = useI18n()

const logicalOps = [
  { value: 'and', text: t('general.and') },
  { value: 'or', text: t('general.or') },
]

// #region utils & computed
const column = computed(() => {
  const fk_column_id = vModel.value.fk_column_id
  if (!vModel.value.fk_column_id) {
    return undefined
  }
  return props.columns.find((col) => col.id === fk_column_id)
})

const showFilterInput = computed(() => {
  const filter = vModel.value
  if (!filter.comparison_op) return false

  if (filter.comparison_sub_op) {
    return !comparisonSubOpList(filter.comparison_op, parseProp(column.value?.meta)?.date_format).find(
      (op) => op.value === filter.comparison_sub_op,
    )?.ignoreVal
  } else {
    return !comparisonOpList(
      (column.value?.filterUidt ?? column.value?.uidt) as UITypes,
      parseProp(column.value?.meta)?.date_format,
    ).find((op) => op.value === filter.comparison_op)?.ignoreVal
  }
})
// #endregion

// #region event handling
const onColumnChange = (fk_column_id: string) => {
  const prevValue = vModel.value.fk_column_id
  vModel.value.fk_column_id = fk_column_id
  emits('change', {
    filter: vModel.value,
    type: 'fk_column_id',
    prevValue,
    value: fk_column_id,
  })
}
const onLogicalOpChange = (logical_op: string) => {
  const prevValue = vModel.value.logical_op
  vModel.value.logical_op = logical_op as any
  emits('change', {
    filter: vModel.value,
    type: 'logical_op',
    prevValue,
    value: logical_op,
  })
}
const onComparisonOpChange = (comparison_op: string) => {
  const prevValue = vModel.value.comparison_op
  vModel.value.comparison_op = comparison_op as any
  emits('change', {
    filter: vModel.value,
    type: 'comparison_op',
    prevValue,
    value: comparison_op,
  })
}
const onComparisonSubOpChange = (comparison_sub_op: string) => {
  const prevValue = vModel.value.comparison_sub_op
  vModel.value.comparison_sub_op = comparison_sub_op as any
  emits('change', {
    filter: vModel.value,
    type: 'comparison_sub_op',
    prevValue,
    value: comparison_sub_op,
  })
}
const onValueChange = (value: string) => {
  const prevValue = vModel.value.value
  vModel.value.value = value as any
  emits('change', {
    filter: vModel.value,
    type: 'value',
    prevValue,
    value,
  })
}
// #endregion
</script>

<template>
  <div class="inline-block">
    <div class="flex flex-row gap-x-0 w-full nc-filter-wrapper bg-white">
      <!-- #region logical op -->
      <template v-if="index === 0">
        <div class="flex items-center !min-w-18 !max-w-18 pl-3 nc-filter-where-label">
          {{ $t('labels.where') }}
        </div>
      </template>
      <tempalte v-else>
        <NcSelect
          v-e="['c:filter:logical-op:select']"
          :value="vModel.logical_op"
          :dropdown-match-select-width="false"
          class="h-full !max-w-18 !min-w-18 capitalize"
          hide-details
          :disabled="vModel.readOnly || (index > 1 && !isLogicalOpChangeAllowed) || disabled"
          dropdown-class-name="nc-dropdown-filter-logical-op"
          :class="{
            'nc-disabled-logical-op': vModel.readOnly || (index > 1 && !isLogicalOpChangeAllowed) || disabled,
          }"
          @change="onLogicalOpChange($event)"
          @click.stop
        >
          <a-select-option v-for="op of logicalOps" :key="op.value" :value="op.value">
            <div class="flex items-center w-full justify-between w-full gap-2">
              <div class="truncate flex-1 capitalize">{{ op.text }}</div>
              <component
                :is="iconMap.check"
                v-if="vModel.logical_op === op.value"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </NcSelect>
      </tempalte>
      <!-- #endregion logical op -->
      <div>column</div>
      <div>
        <NcSelect
          v-if="comparisonOps && comparisonOps.length > 0"
          v-e="['c:filter:comparison-op:select']"
          :value="vModel.comparison_op"
          :dropdown-match-select-width="false"
          class="caption nc-filter-operation-select !min-w-26.75 max-h-8"
          :placeholder="$t('labels.operation')"
          density="compact"
          variant="solo"
          :disabled="vModel.readOnly || disabled"
          hide-details
          dropdown-class-name="nc-dropdown-filter-comp-op !max-w-80"
          @change="onComparisonOpChange($event)"
        >
          <template v-for="compOp of comparisonOps" :key="compOp.value">
            <a-select-option :value="compOp.value">
              <div class="flex items-center w-full justify-between w-full gap-2">
                <div class="truncate flex-1">{{ compOp.text }}</div>
                <component
                  :is="iconMap.check"
                  v-if="vModel.comparison_op === compOp.value"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </template>
        </NcSelect>
      </div>
      <div v-if="comparisonSubOps && comparisonSubOps.length > 0">
        <NcSelect
          v-model:value="vModel"
          v-e="['c:filter:sub-comparison-op:select']"
          :dropdown-match-select-width="false"
          class="caption nc-filter-sub_operation-select min-w-28"
          :class="{
            'flex-grow w-full': !showFilterInput,
            'max-w-28': showFilterInput,
          }"
          :placeholder="$t('labels.operationSub')"
          density="compact"
          variant="solo"
          :disabled="vModel.readOnly || disabled"
          hide-details
          dropdown-class-name="nc-dropdown-filter-comp-sub-op"
          @change="onChange"
        >
          <template v-for="compSubOp of comparisonSubOps" :key="compSubOp.value">
            <a-select-option :value="compSubOp.value">
              <div class="flex items-center w-full justify-between w-full gap-2 max-w-40">
                <NcTooltip show-on-truncate-only class="truncate flex-1">
                  <template #title>{{ compSubOp.text }}</template>
                  {{ compSubOp.text }}
                </NcTooltip>
                <component
                  :is="iconMap.check"
                  v-if="vModel.comparison_sub_op === compSubOp.value"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </template>
        </NcSelect>
      </div>
      <div>value</div>
      <div>delete</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-filter-where-label {
  @apply text-gray-400;
}
</style>
