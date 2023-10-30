<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditColumnInj, EditModeInj, IsExpandedFormOpenInj, ReadonlyInj, RowHeightInj, inject, ref, useVModel } from '#imports'

interface Props {
  modelValue?: string | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const readonly = inject(ReadonlyInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) => !isExpandedFormOpen.value && !isEditColumn.value && (el as HTMLInputElement)?.focus()
</script>

<template>
  <input
    v-if="!readonly && editEnabled"
    :ref="focus"
    v-model="vModel"
    class="h-full w-full outline-none p-2 bg-transparent"
    :placeholder="isEditColumn ? $t('labels.optional') : ''"
    :class="{
      'px-1': isExpandedFormOpen,
    }"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @selectstart.capture.stop
    @mousedown.stop
  />

  <span v-else-if="vModel === null && showNull" class="nc-null uppercase">{{ $t('general.null') }}</span>

  <LazyCellClampedText v-else :value="vModel" :lines="rowHeight" />
</template>
