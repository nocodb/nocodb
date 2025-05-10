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
}
interface Emits {
  (event: 'update:modelValue', model: string): void
  (event: 'change', model: { filter: ColumnFilterType; comparison_op: string }): void
}
const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const showFilterInput = (filter: Filter) => {
  if (!filter.comparison_op) return false

  if (filter.comparison_sub_op) {
    return !comparisonSubOpList(filter.comparison_op, parseProp(props.column?.meta)?.date_format).find(
      (op) => op.value === filter.comparison_sub_op,
    )?.ignoreVal
  } else {
    return !comparisonOpList(props.uidt as UITypes, parseProp(props.column?.meta)?.date_format).find(
      (op) => op.value === filter.comparison_op,
    )?.ignoreVal
  }
}
const allowedComparisonSubOp = computed(() => {
  const { filter, uidt } = props
  return comparisonSubOpList(filter.comparison_op!, parseProp(props.column?.meta)?.date_format).filter((compSubOp) =>
    isComparisonSubOpAllowed(filter, compSubOp, uidt),
  )
})

const onChange = () => {
  const { filter } = props
  emits('change', {
    filter,
    comparison_op: filter.comparison_op,
  })
}
</script>

<template>
  <NcSelect
    v-model:value="vModel"
    v-e="['c:filter:sub-comparison-op:select', { link: !!link, webHook: !!webHook }]"
    :dropdown-match-select-width="false"
    class="caption nc-filter-sub_operation-select min-w-28"
    :class="{
      'flex-grow w-full': !showFilterInput(filter),
      'max-w-28': showFilterInput(filter) && !webHook,
    }"
    :placeholder="$t('labels.operationSub')"
    density="compact"
    variant="solo"
    :disabled="filter.readOnly || isLockedView || readOnly"
    hide-details
    dropdown-class-name="nc-dropdown-filter-comp-sub-op"
    @change="onChange"
  >
    <template v-for="compSubOp of allowedComparisonSubOp" :key="compSubOp.value">
      <a-select-option :value="compSubOp.value">
        <div class="flex items-center w-full justify-between w-full gap-2 max-w-40">
          <NcTooltip show-on-truncate-only class="truncate flex-1">
            <template #title>{{ compSubOp.text }}</template>
            {{ compSubOp.text }}
          </NcTooltip>
          <component
            :is="iconMap.check"
            v-if="filter.comparison_sub_op === compSubOp.value"
            id="nc-selected-item-icon"
            class="text-primary w-4 h-4"
          />
        </div>
      </a-select-option>
    </template>
  </NcSelect>
</template>
