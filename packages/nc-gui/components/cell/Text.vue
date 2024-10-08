<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  modelValue?: string | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const readOnly = inject(ReadonlyInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    v-if="!readOnly && editEnabled"
    :ref="focus"
    v-model="vModel"
    class="nc-cell-field h-full w-full outline-none py-1 bg-transparent"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @keydown.alt.stop
    @selectstart.capture.stop
    @mousedown.stop
  />

  <span v-else-if="vModel === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>

  <LazyCellClampedText v-else class="nc-cell-field" :value="vModel" :lines="rowHeight" :style="{ 'word-break': 'break-word' }" />
</template>
