<script lang="ts" setup>
import type { LocalSelectOptionType } from './utils'

interface Props {
  disabled?: boolean
  options: LocalSelectOptionType[]
  rowIndex?: number
  location?: 'cell' | 'filter'
  selectedOptions: string[]
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:selectedOptions'])

const { selectedOptions, disabled, options } = toRefs(props)

const column = inject(ColumnInj)!

const searchVal = ref('')

const filteredOptions = computed(() => {
  return options.value.filter((op) => {
    return searchVal.value ? searchCompare(op.title, searchVal.value) : true
  })
})

const handleUpdateSelectedOptions = (val: string[]) => {
  if (disabled.value) return

  searchVal.value = ''
  emits('update:selectedOptions', val)
}
</script>

<template>
  <div class="rounded-lg border-1 border-nc-border-gray-medium w-full max-w-full">
    <div v-if="options.length > 6" class="border-b-1 border-nc-border-gray-medium pl-1 group" @click.stop>
      <a-input
        ref="inputRef"
        v-model:value="searchVal"
        :placeholder="$t('general.search')"
        class="nc-multi-select-search-field-input !pl-2 !pr-1.5 flex-1 !py-2"
        allow-clear
        autocomplete="off"
        :bordered="false"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="nc-search-icon text-nc-content-gray-muted opacity-50 h-4 w-4 mr-1.5" />
        </template>
      </a-input>
    </div>
    <div class="w-full max-w-full max-h-[252px] nc-scrollbar-thin p-1">
      <a-checkbox-group
        :value="selectedOptions"
        :disabled="disabled"
        class="nc-field-layout-list"
        @click.stop
        @update:value="handleUpdateSelectedOptions($event as string[])"
      >
        <a-checkbox
          v-for="op of options"
          :key="op.title"
          :value="op.title"
          :data-testid="`select-option-${column.title}-${location === 'filter' ? 'filter' : rowIndex}`"
          :class="[
            `nc-select-option-${column.title}-${op.title}`,
            {
              '!hidden nc-hidden-option': !searchCompare(op.title, searchVal),
            },
          ]"
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

      <div
        v-if="options.length && searchVal && !filteredOptions.length"
        class="h-full text-center flex items-center justify-center gap-3 mt-4"
      >
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rounded-tag {
  @apply py-[0.5px] px-2 rounded-[12px];
}
</style>
