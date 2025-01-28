<script lang="ts" setup>
import { type LocalSelectOptionType, getOptions, getSelectedTitles } from './utils'

interface Props {
  modelValue?: string | string[]
  rowIndex?: number
  location?: 'cell' | 'filter'
  options?: LocalSelectOptionType[]
}

const { modelValue, options: selectOptions } = defineProps<Props>()

const column = inject(ColumnInj)!

const isForm = inject(IsFormInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const isKanban = inject(IsKanbanInj, ref(false))

const isEditColumn = inject(EditModeInj, ref(false))

const { isMysql } = useBase()

const options = computed(() => {
  return selectOptions ?? getOptions(column.value, isEditColumn.value, isForm.value)
})

const optionsMap = computed(() => {
  return options.value.reduce((acc, op) => {
    if (op.title) {
      acc[op.title.trim()] = op
    }
    return acc
  }, {} as Record<string, (typeof options.value)[number]>)
})

const selectedOpts = computed(() => {
  return getSelectedTitles(column.value, optionsMap.value, isMysql, modelValue).reduce((acc, el) => {
    const item = optionsMap.value[el?.trim()]

    if (item?.id || item?.title) {
      acc.push(item)
    }

    return acc
  }, [] as LocalSelectOptionType[])
})

const selectedOptsListLayout = computed(() => selectedOpts.value.map((item) => item.title!))
</script>

<template>
  <div class="nc-cell-field nc-multi-select h-full w-full flex items-center read-only" :class="{ 'max-w-full': isForm }">
    <div v-if="isForm && parseProp(column.meta)?.isList" class="w-full max-w-full">
      <a-checkbox-group :value="selectedOptsListLayout" disabled class="nc-field-layout-list" @click.stop>
        <a-checkbox
          v-for="op of options"
          :key="op.title"
          :value="op.title"
          class="gap-2"
          :data-testid="`select-option-${column.title}-${location === 'filter' ? 'filter' : rowIndex}`"
          :class="`nc-select-option-${column.title}-${op.title}`"
        >
          <a-tag class="rounded-tag max-w-full" :color="op.color">
            <span
              :style="{
                color: getSelectTypeOptionTextColor(op.color),
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
        </a-checkbox>
      </a-checkbox-group>
    </div>

    <div
      v-else
      class="flex flex-wrap"
      :style="{
        'display': '-webkit-box',
        'max-width': '100%',
        '-webkit-line-clamp': rowHeightTruncateLines(rowHeight, true),
        '-webkit-box-orient': 'vertical',
        '-webkit-box-align': 'center',
        'overflow': 'hidden',
      }"
    >
      <template v-for="selectedOpt of selectedOpts" :key="selectedOpt.value">
        <a-tag
          class="rounded-tag max-w-full"
          :class="{
            '!my-0': !rowHeight || rowHeight === 1,
          }"
          :color="selectedOpt.color"
        >
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
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ms-close-icon {
  color: rgba(0, 0, 0, 0.25);
  cursor: pointer;
  display: flex;
  font-size: 12px;
  font-style: normal;
  height: 12px;
  line-height: 1;
  text-align: center;
  text-transform: none;
  transition: color 0.3s ease, opacity 0.15s ease;
  width: 12px;
  z-index: 1;
  margin-right: -6px;
  margin-left: 3px;
}

.ms-close-icon:before {
  display: block;
}

.ms-close-icon:hover {
  color: rgba(0, 0, 0, 0.45);
}

.read-only {
  .ms-close-icon {
    display: none;
  }
}

.rounded-tag {
  @apply py-[0.5px] px-2 rounded-[12px];
}

:deep(.ant-tag) {
  @apply "rounded-tag" my-[1px];
}

:deep(.ant-tag-close-icon) {
  @apply "text-slate-500";
}
</style>
