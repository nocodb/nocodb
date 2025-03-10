<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  modelValue?: number | string | null
  placeholder?: string
  localEditEnabled?: boolean
}

const props = defineProps<Props>()
const emits = defineEmits(['update:modelValue'])

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
  if ((!isExpandedFormOpen.value || localEditEnabled.value) && !isEditColumn.value && !isForm.value) {
    inputRef.value = el as HTMLInputElement

    if (cellFocused.value) return

    if (isExpandedFormOpen.value) {
      inputRef.value?.focus()
      inputRef.value?.select()
    } else {
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
const labelMarginLeft = computed<number>(() => {
  return Math.max(1, Math.min(vModelNumber.value / 2, 50))
})

const inputType = computed(() => (isForm.value && !isEditColumn.value ? 'text' : 'number'))

const onBlur = () => {
  editEnabled.value = false
  cellFocused.value = false
  localEditEnabled.value = false
}

const onFocus = () => {
  cellFocused.value = true
}
const onContainerFocus = ($event) => {
  setTimeout(() => $event?.target?.querySelector('input').focus(), 100)
}
onMounted(() => {
  if (isCanvasInjected && (!isExpandedFormOpen.value || localEditEnabled.value) && !isEditColumn.value && !isForm.value) {
    inputRef.value?.focus()
    if (isExpandedFormOpen.value) {
      inputRef.value?.select()
    }
  }
})
</script>

<template>
  <div
    v-if="isForm"
    tabindex="0"
    class="flex h-full w-full progress-container"
    style="align-self: stretch; justify-self: stretch"
    @focus="onContainerFocus"
  >
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
    <div class="h-full w-full progress-bar flex" style="align-self: stretch; border-radius: 9999px; overflow: hidden">
      <div style="align-self: stretch; background-color: #3366ff" :style="{ width: `${vModelNumber}%` }"></div>
      <div style="align-self: stretch; background-color: #e5e5e5" :style="{ width: `${100 - vModelNumber}%` }"></div>
      <div style="position: absolute" :style="{ 'margin-left': `${labelMarginLeft}%` }">
        <span
          style="mix-blend-mode: difference; color: #ffffff"
          :style="{
            'margin-left': `${-Math.min(vModelNumber, 50)}%`,
          }"
        >
          {{ `${vModelNumber}%` }}
        </span>
      </div>
      <div style="position: absolute" :style="{ 'margin-left': `${labelMarginLeft}%` }">
        <span
          style="mix-blend-mode: overlay; color: #ffffff"
          :style="{
            'margin-left': `${-Math.min(vModelNumber, 50)}%`,
          }"
        >
          {{ `${vModelNumber}%` }}
        </span>
      </div>
    </div>
  </div>
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
.progress-container:not(:focus-within) > input {
  visibility: collapse;
  display: none;
}
.progress-container:focus > div.progress-bar,
.progress-container > input:focus ~ div.progress-bar {
  visibility: collapse;
  display: none;
}
</style>
