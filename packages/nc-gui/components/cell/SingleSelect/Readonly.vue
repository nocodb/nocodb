<script lang="ts" setup>
import { useSingleSelect } from './utils'

interface Props {
  modelValue?: string | undefined
  rowIndex?: number
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const isForm = inject(IsFormInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const { options, getOptionTextColor } = useSingleSelect()

const selectedOpt = computed(() => {
  return options.value.find((o) => o.value === modelValue || o.value === modelValue?.toString()?.trim())
})
</script>

<template>
  <div
    class="nc-cell-field h-full w-full flex items-center nc-single-select focus:outline-transparent readonly-ra"
    :class="{ 'read-only': readOnly, 'max-w-full': isForm }"
  >
    <div v-if="isForm && parseProp(column.meta)?.isList" class="w-full max-w-full">
      <a-radio-group :value="modelValue" disabled class="nc-field-layout-list" @click.stop>
        <a-radio
          v-for="op of options"
          :key="op.title"
          :value="op.title"
          :data-testid="`select-option-${column.title}-${rowIndex}`"
          :class="`nc-select-option-${column.title}-${op.title}`"
        >
          <a-tag class="rounded-tag max-w-full" :color="op.color">
            <span
              :style="{
                color: getOptionTextColor(op.color),
              }"
              class="text-small"
            >
              <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                <template #title>
                  {{ op.title }}
                </template>
                <span
                  class="text-ellipsis overflow-hidden"
                  :style="{
                    wordBreak: 'keep-all',
                    whiteSpace: 'nowrap',
                    display: 'inline',
                  }"
                >
                  {{ op.title }}
                </span>
              </NcTooltip>
            </span>
          </a-tag>
        </a-radio>
      </a-radio-group>
    </div>

    <div v-else class="w-full">
      <a-tag v-if="selectedOpt" class="rounded-tag max-w-full" :color="selectedOpt.color">
        <span
          :style="{
            color: getOptionTextColor(selectedOpt.color),
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

:deep(.ant-select-clear) {
  opacity: 1;
  border-radius: 100%;
}

.nc-single-select:not(.read-only) {
  :deep(.ant-select-selector),
  :deep(.ant-select-selector input) {
    @apply !cursor-pointer;
  }
}

:deep(.ant-select-selector) {
  @apply !pl-0 !pr-4;
}

:deep(.ant-select-selector .ant-select-selection-item) {
  @apply flex items-center;
  text-overflow: clip;
}

:deep(.ant-select-selection-search) {
  @apply flex items-center;

  .ant-select-selection-search-input {
    @apply !text-small;
  }
}

:deep(.ant-select-clear > span) {
  @apply block;
}
</style>

<style lang="scss">
.ant-select-item-option-content {
  @apply !flex !items-center;
}
</style>
