<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  // when we set a number, then it is number type
  // for sqlite, when we clear a cell or empty the cell, it returns ""
  // otherwise, it is null type
  modelValue?: number | null | string
  placeholder?: string
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const editEnabled = inject(EditModeInj, ref(false))
const column = inject(ColumnInj, null)!
const isEditColumn = inject(EditColumnInj, ref(false))
const readOnly = inject(ReadonlyInj, ref(false))
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!
const isForm = inject(IsFormInj)!
const isCanvasInjected = inject(IsCanvasInjectionInj, false)

const inputRef = ref<HTMLInputElement>()
const _vModel = useVModel(props, 'modelValue', emits)

const vModel = computed({
  get: () => _vModel.value,
  set: (value) => {
    if (value === '') {
      // if we clear / empty a cell in sqlite,
      // the value is considered as ''
      _vModel.value = null
    } else {
      _vModel.value = value
    }
  },
})

const precision = computed(() => {
  const meta = typeof column?.value.meta === 'string' ? JSON.parse(column.value.meta) : column?.value.meta ?? {}
  const _precision = meta.precision ?? 1
  return Number(0.1 ** _precision).toFixed(_precision)
})

// Handle the arrow keys as its default behavior is to increment/decrement the value
const onKeyDown = (e: any) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    // Move the cursor to the end of the input
    e.target.type = 'text'
    e.target?.setSelectionRange(e.target.value.length, e.target.value.length)
    e.target.type = 'number'
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    e.target.type = 'text'
    e.target?.setSelectionRange(0, 0)
    e.target.type = 'number'
  }
}

const focus: VNodeRef = (el) => {
  if (!isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    inputRef.value = el as HTMLInputElement
    inputRef.value?.focus()
  }
}

onMounted(() => {
  if (isCanvasInjected && !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    inputRef.value?.focus()
  }
})
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <a-input-number
    :ref="focus"
    v-model:value="vModel"
    class="nc-cell-field outline-none rounded-md"
    :step="precision"
    :placeholder="placeholder"
    style="letter-spacing: 0.06rem; height: 24px !important"
    :style="{
      ...(!isForm && !isExpandedFormOpen && { 'margin-left': '-10px' }),
      ...(!isForm && !isExpandedFormOpen && { width: 'calc(100% + 20px)' }),
      ...(!isForm && !isExpandedFormOpen && { 'margin-top': '1px' }),
      ...((isForm || isExpandedFormOpen) && { width: '100%' }),
    }"
    :disabled="readOnly"
    @blur="editEnabled = false"
    @keydown.down.stop="onKeyDown"
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop="onKeyDown"
    @keydown.delete.stop
    @keydown.alt.stop
    @selectstart.capture.stop
    @mousedown.stop
  />
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
}

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

<style lang="scss">
.ant-input-number {
  border: none;
}
.ant-input-number .ant-input-number-input-wrap,
.ant-input-number input {
  height: 100%;
}

div.ant-input-number > .ant-input-number-input-wrap > input.ant-input-number-input {
  border: none;
  outline: 0;
  text-align: right;
}

div.ant-input-number > .ant-input-number-input-wrap > input.ant-input-number-input:hover,
div.ant-input-number > .ant-input-number-input-wrap > input.ant-input-number-input:focus {
  padding-right: 26px !important;
}

.ant-input-number.ant-input-number-focused .ant-input-number-wrapper,
.ant-input-number.ant-input-number-focused input,
.ant-input-number.ant-input-number-focused,
.ant-input-number {
  -webkit-appearance: none;
  border: none !important;
  outline: none !important;
  box-shadow: none;
}
</style>
