<script lang="ts" setup>
import { type LocalSelectOptionType, getOptions } from './utils'

interface Props {
  modelValue?: string | undefined
  rowIndex?: number
  options?: LocalSelectOptionType[]
}

const { modelValue, options: selectOptions } = defineProps<Props>()

const column = inject(ColumnInj)!

const isForm = inject(IsFormInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const isEditColumn = inject(EditModeInj, ref(false))

const options = computed(() => {
  return selectOptions ?? getOptions(column.value, isEditColumn.value, isForm.value)
})

const optionsMap = computed(() => {
  return options.value.reduce((acc, op) => {
    if (op.value) {
      acc[op.value.trim()] = op
    }
    return acc
  }, {} as Record<string, (typeof options.value)[number]>)
})

const selectedOpt = computed(() => {
  return modelValue ? optionsMap.value[modelValue?.trim()] : undefined
})
</script>

<template>
  <div
    class="nc-cell-field h-full w-full flex items-center nc-single-select focus:outline-transparent read-only"
    :class="{ 'max-w-full': isForm }"
  >
    <div v-if="isForm && parseProp(column.meta)?.isList" class="w-full max-w-full">
      <CellSingleSelectLayoutList :options="options" :model-value="modelValue" disabled :row-index="rowIndex" />
    </div>

    <div v-else class="w-full flex items-center">
      <a-tag v-if="selectedOpt" class="rounded-tag !h-[22px] max-w-full" :color="selectedOpt.color">
        <span
          :style="{
            color: getSelectTypeOptionTextColor(selectedOpt.color),
          }"
          :class="{ 'text-sm': isKanban, 'text-small': !isKanban }"
        >
          <NcTooltip class="truncate max-w-full" show-on-truncate-only>
            <template #title>
              {{ selectedOpt.title }}
            </template>
            <span
              class="text-ellipsis overflow-hidden"
              :style="{
                wordBreak: 'keep-all',
                whiteSpace: 'nowrap',
                display: 'inline',
              }"
            >
              {{ selectedOpt.title }}
            </span>
          </NcTooltip>
        </span>
      </a-tag>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rounded-tag {
  @apply py-[1px] px-2 rounded-[12px];
}

:deep(.ant-tag) {
  @apply "rounded-tag";
}
</style>
