<script lang="ts" setup>
import type { ColumnType, UITypes } from 'nocodb-sdk'

interface Props {
  modelValue: string
  filter: ColumnFilterType
  column: ColumnType
  uidt: UITypes
  link: boolean
  webHook: boolean
  isLockedView: boolean
  readOnly: boolean
  showNullAndEmptyInFilter: boolean
}
interface Emits {
  (event: 'update:modelValue', model: string): void
  (event: 'change', model: { filter: ColumnFilterType; comparison_op: string }): void
}
const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const allowedComparisonOp = computed(() => {
  const { filter, uidt, showNullAndEmptyInFilter } = props
  return comparisonOpList(props.uidt, parseProp(props.column?.meta)?.date_format).filter((compOp) =>
    isComparisonOpAllowed(filter, compOp, uidt, showNullAndEmptyInFilter),
  )
})

const onChange = (filter: ColumnFilterType) => {
  emits('change', {
    filter,
    comparison_op: filter.comparison_op,
  })
}
</script>

<template>
  <NcSelect
    v-model:value="vModel"
    v-e="['c:filter:comparison-op:select', { link: !!link, webHook: !!webHook }]"
    :dropdown-match-select-width="false"
    class="caption nc-filter-operation-select !min-w-26.75 max-h-8"
    :placeholder="$t('labels.operation')"
    :class="{
      '!max-w-26.75': !webHook,
      '!w-full': webHook,
    }"
    density="compact"
    variant="solo"
    :disabled="filter.readOnly || isLockedView || readOnly"
    hide-details
    dropdown-class-name="nc-dropdown-filter-comp-op !max-w-80"
    @change="onChange(filter)"
  >
    <template v-for="compOp of allowedComparisonOp" :key="compOp.value">
      <a-select-option :value="compOp.value">
        <div class="flex items-center w-full justify-between w-full gap-2">
          <div class="truncate flex-1">{{ compOp.text }}</div>
          <component
            :is="iconMap.check"
            v-if="filter.comparison_op === compOp.value"
            id="nc-selected-item-icon"
            class="text-primary w-4 h-4"
          />
        </div>
      </a-select-option>
    </template>
  </NcSelect>
</template>
