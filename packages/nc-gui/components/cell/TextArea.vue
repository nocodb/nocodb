<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

import {
  ActiveCellInj,
  EditColumnInj,
  EditModeInj,
  IsExpandedFormOpenInj,
  ReadonlyInj,
  RowHeightInj,
  iconMap,
  inject,
  useVModel,
} from '#imports'

const props = defineProps<{
  modelValue?: string | number
  isFocus?: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(1 as const))

const isForm = inject(IsFormInj, ref(false))

const { showNull } = useGlobal()

const vModel = useVModel(props, 'modelValue', emits, { defaultValue: '' })

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) => !isExpandedFormOpen.value && !isEditColumn.value && (el as HTMLTextAreaElement)?.focus()

const height = computed(() => {
  if (!rowHeight.value) return 60

  return rowHeight.value * 60
})

const isVisible = ref(false)
const inputWrapperRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

const active = inject(ActiveCellInj, ref(false))

const readOnly = inject(ReadonlyInj)

watch(isVisible, () => {
  if (isVisible.value) {
    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  }
})

onClickOutside(inputWrapperRef, (e) => {
  if ((e.target as HTMLElement)?.className.includes('nc-long-text-toggle-expand')) return

  isVisible.value = false
})
</script>

<template>
  <NcDropdown v-model:visible="isVisible" class="overflow-visible" :trigger="[]" placement="bottomLeft">
    <div
      class="flex flex-row pt-0.5 w-full"
      :class="{
        'min-h-10': rowHeight !== 1,
        'min-h-6.5': rowHeight === 1,
        'h-full': isForm,
      }"
    >
      <textarea
        v-if="editEnabled && !isVisible"
        :ref="focus"
        v-model="vModel"
        rows="4"
        class="h-full w-full outline-none border-none"
        :class="{
          'p-2': editEnabled,
          'py-1 h-full': isForm,
          'px-1': isExpandedFormOpen,
        }"
        :style="{
          minHeight: `${height}px`,
        }"
        :placeholder="isEditColumn ? $t('labels.optional') : ''"
        @blur="editEnabled = false"
        @keydown.alt.enter.stop
        @keydown.shift.enter.stop
        @keydown.down.stop
        @keydown.left.stop
        @keydown.right.stop
        @keydown.up.stop
        @keydown.delete.stop
        @selectstart.capture.stop
        @mousedown.stop
      />

      <span v-else-if="vModel === null && showNull" class="nc-null uppercase">{{ $t('general.null') }}</span>

      <LazyCellClampedText
        v-else-if="rowHeight"
        :value="vModel"
        :lines="rowHeight"
        class="mr-7 nc-text-area-clamped-text"
        :style="{
          'word-break': 'break-word',
        }"
      />

      <span v-else>{{ vModel }}</span>

      <div
        v-if="active && !isExpandedFormOpen"
        class="!absolute right-0 bottom-0 h-6 w-5 group cursor-pointer flex justify-end gap-1 items-center active:(ring ring-accent ring-opacity-100) rounded border-none p-1 hover:(bg-primary bg-opacity-10) dark:(!bg-slate-500)"
        :class="{ 'right-2 bottom-2': editEnabled }"
        data-testid="attachment-cell-file-picker-button"
        @click.stop="isVisible = !isVisible"
      >
        <NcTooltip placement="bottom">
          <template #title>{{ $t('title.expand') }}</template>
          <component
            :is="iconMap.expand"
            class="transform dark:(!text-white) group-hover:(!text-grey-800 scale-120) text-gray-500 text-xs"
          />
        </NcTooltip>
      </div>
    </div>
    <template #overlay>
      <div ref="inputWrapperRef" class="flex flex-col min-w-120 min-h-70 py-3 pl-3 pr-1 expanded-cell-input">
        <div
          v-if="column"
          class="flex flex-row gap-x-1 items-center font-medium pb-2.5 mb-1 py-1 mr-3 ml-1 border-b-1 border-gray-100"
        >
          <SmartsheetHeaderCellIcon class="flex" />
          <div class="flex">
            {{ column.title }}
          </div>
        </div>
        <a-textarea
          ref="inputRef"
          v-model:value="vModel"
          class="p-1 !pt-1 !pr-3 !border-0 !border-r-0 !focus:outline-transparent nc-scrollbar-md !text-black"
          :placeholder="$t('activity.enterText')"
          :bordered="false"
          :auto-size="{ minRows: 20, maxRows: 20 }"
          :disabled="readOnly"
          @keydown.stop
          @keydown.escape="isVisible = false"
        />
      </div>
    </template>
  </NcDropdown>
</template>

<style>
textarea:focus {
  box-shadow: none;
}
</style>
