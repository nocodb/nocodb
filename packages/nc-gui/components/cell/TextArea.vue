<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, IsExpandedFormOpenInj, RowHeightInj, inject, useVModel } from '#imports'

const props = defineProps<{
  modelValue?: string | number
}>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const rowHeight = inject(RowHeightInj, ref(undefined))

const { showNull } = useGlobal()

const vModel = useVModel(props, 'modelValue', emits, { defaultValue: '' })

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) => !isExpandedFormOpen.value && (el as HTMLTextAreaElement)?.focus()

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

onClickOutside(inputWrapperRef, () => {
  isVisible.value = false
})
</script>

<template>
  <NcDropdown v-model:visible="isVisible" class="overflow-visible h-full" :trigger="[]" placement="bottomLeft">
    <div class="flex flex-row h-full">
      <textarea
        v-if="editEnabled"
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

      <LazyCellClampedText v-else-if="rowHeight" :value="vModel" :lines="rowHeight" />

      <span v-else>{{ vModel }}</span>

      <NcButton class="!absolute right-0 top-1.5 bottom-0" type="secondary" size="xsmall" @click="isVisible = !isVisible">
        <GeneralIcon icon="edit" />
      </NcButton>
    </div>
    <template #overlay>
      <div ref="inputWrapperRef" class="flex flex-col min-w-120 min-h-70 py-3 pl-3 pr-1">
        <a-textarea
          ref="inputRef"
          v-model:value="vModel"
          class="p-1 !pr-3 !border-0 !border-r-0 !focus:outline-transparent nc-scrollbar-md"
          :bordered="false"
          :auto-size="{ minRows: 20, maxRows: 20 }"
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
