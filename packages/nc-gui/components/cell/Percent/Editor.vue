<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  modelValue?: number | string | null
  placeholder?: string
  localEditEnabled?: boolean
}

const props = defineProps<Props>()
const emits = defineEmits(['update:modelValue'])

const col = inject(ColumnInj)
const editEnabled = inject(EditModeInj, ref(false))
const isEditColumn = inject(EditColumnInj, ref(false))
const readOnly = inject(ReadonlyInj, ref(false))
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!
const isForm = inject(IsFormInj)!
const isCanvasInjected = inject(IsCanvasInjectionInj, false)

const _vModel = useVModel(props, 'modelValue', emits)
const localEditEnabled = useVModel(props, 'localEditEnabled', emits, { defaultValue: false })
const cellFocused = ref(false)
const inputRef = ref<HTMLInputElement>()

const focus: VNodeRef = (el) => {
  if ((!isExpandedFormOpen.value || localEditEnabled.value) && !isEditColumn.value) {
    inputRef.value = el as HTMLInputElement

    if (cellFocused.value) return

    if (isExpandedFormOpen.value) {
      inputRef.value?.focus()
      inputRef.value?.select()
    } else if (!isForm.value) {
      inputRef.value?.focus()
    }
  }
}

const vModel = computed({
  get: () => {
    return isForm.value && !isEditColumn.value && _vModel.value && !cellFocused.value && !isNaN(Number(_vModel.value))
      ? `${_vModel.value}%`
      : _vModel.value
  },
  set: (value) => {
    if (value === '') {
      _vModel.value = null
    } else if (isForm.value && !isEditColumn.value) {
      _vModel.value = isNaN(Number(value)) ? value : Number(value)
    } else {
      _vModel.value = value
    }
  },
})
const vModelNumber = computed<number>(() => {
  if (_vModel.value && _vModel.value !== '' && !isNaN(Number(_vModel.value))) {
    return Number(_vModel.value)
  }
  return 0
})

const inputType = computed(() => (isForm.value && !isEditColumn.value ? 'text' : 'number'))

const onBlur = () => {
  if (isExpandedFormOpen.value) {
    editEnabled.value = false
    cellFocused.value = false
    localEditEnabled.value = false
  }
}

const onFocus = () => {
  cellFocused.value = true
}
onMounted(() => {
  if (isCanvasInjected || (!isEditColumn.value && !isForm.value)) {
    inputRef.value?.focus()
    if (isExpandedFormOpen.value) {
      inputRef.value?.select()
    }
  }
})
</script>

<template>
  <CellPercentProgressBar
    v-if="parseProp(col!.meta).is_progress && (isForm || isExpandedFormOpen)"
    :style="{
      ...((isForm || isExpandedFormOpen) && { 'min-height': '22px', 'height': '22px' }),
    }"
    :is-show-number="true"
    :percentage="vModelNumber"
  >
    <!-- eslint-disable vue/use-v-on-exact -->
    <input
      :ref="focus"
      v-model="vModel"
      class="nc-cell-field w-full !border-none !outline-none focus:ring-0 h-full min-h-[18px]"
      :class="isExpandedFormOpen ? 'py-1' : ''"
      :type="inputType"
      :placeholder="placeholder"
      :disabled="readOnly"
      @blur="onBlur"
      @focus="onFocus"
      @keydown.down.stop
      @keydown.left.stop
      @keydown.right.stop
      @keydown.up.stop
      @keydown.delete.stop
      @keydown.alt.stop
      @selectstart.capture.stop
      @mousedown.stop
    />
  </CellPercentProgressBar>
  <div v-else>
    <!-- eslint-disable vue/use-v-on-exact -->
    <input
      :ref="focus"
      v-model="vModel"
      class="nc-cell-field w-full !border-none !outline-none focus:ring-0 py-1"
      :type="inputType"
      :placeholder="placeholder"
      :disabled="readOnly"
      @blur="onBlur"
      @focus="onFocus"
      @keydown.down.stop
      @keydown.left.stop
      @keydown.right.stop
      @keydown.up.stop
      @keydown.delete.stop
      @keydown.alt.stop
      @selectstart.capture.stop
      @mousedown.stop
    />
  </div>
</template>

<style lang="scss" scoped>
/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
