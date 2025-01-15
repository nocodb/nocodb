<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  modelValue?: string | number | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()

const textareaValue = computed({
  get: () => vModel.value ?? '',
  set: (val) => (vModel.value = val),
})
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    v-if="!isExpandedFormOpen"
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
  <a-textarea
    v-else
    :ref="focus"
    v-model:value="textareaValue"
    :auto-size="{ minRows: 1, maxRows: 6 }"
    class="!border-0 !border-none !outline-0 !ring-0 focus:!border-0 focus:!outline-0 focus:!ring-0 !px-2 !py-1 nc-scrollbar-thin"
    style="color: inherit; resize: auto !important; min-height: 32px !important; height: 32px !important"
    @keydown.enter.prevent
  />
</template>
