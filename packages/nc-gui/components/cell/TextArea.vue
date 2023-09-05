<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, IsExpandedFormOpenInj, RowHeightInj, inject, useVModel } from '#imports'

const props = defineProps<{
  modelValue?: string | number
  isFocus?: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const { showNull } = useGlobal()

const vModel = useVModel(props, 'modelValue', emits, { defaultValue: '' })

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) => !isExpandedFormOpen.value && props.isFocus && (el as HTMLTextAreaElement)?.focus()

const height = computed(() => {
  if (!rowHeight.value) return 60

  return rowHeight.value * 60
})

const isVisible = ref(false)
const inputWrapperRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

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
      class="flex flex-row pt-0.5"
      :class="{
        'min-h-10': rowHeight !== 1,
        'min-h-6.5': rowHeight === 1,
      }"
    >
      <textarea
        v-if="editEnabled && !isVisible"
        :ref="focus"
        v-model="vModel"
        rows="4"
        class="h-full w-full outline-none border-none"
        :class="`${editEnabled ? 'p-2' : ''}`"
        :style="{
          minHeight: `${height}px`,
        }"
        @blur="editEnabled = false"
        @keydown.alt.enter.stop
        @keydown.shift.enter.stop
        @keydown.down.stop
        @keydown.left.stop
        @keydown.right.stop
        @keydown.up.stop
        @keydown.delete.stop
        @keydown.ctrl.z.stop
        @keydown.meta.z.stop
        @selectstart.capture.stop
        @mousedown.stop
      />

      <span v-else-if="vModel === null && showNull" class="nc-null">NULL</span>

      <LazyCellClampedText v-else-if="rowHeight" :value="vModel" :lines="rowHeight" class="mr-7" />

      <span v-else>{{ vModel }}</span>

      <NcButton
        class="!absolute right-0 bottom-0 nc-long-text-toggle-expand !duration-0"
        :class="{
          'top-1': rowHeight !== 1,
          'mt-2': editEnabled,
          'top-0.15': rowHeight === 1,
          '!hidden': isExpandedFormOpen,
        }"
        type="text"
        size="xsmall"
        @click.stop="isVisible = !isVisible"
      >
        <GeneralIcon v-if="isVisible" icon="shrink" class="nc-long-text-toggle-expand h-3.75 w-3.75 !text-xs" />
        <GeneralIcon v-else icon="expand" class="nc-long-text-toggle-expand h-3.75 w-3.75 !text-xs" />
      </NcButton>
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
          placeholder="Enter text"
          class="p-1 !pt-1 !pr-3 !border-0 !border-r-0 !focus:outline-transparent nc-scrollbar-md"
          :bordered="false"
          :auto-size="{ minRows: 20, maxRows: 20 }"
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
