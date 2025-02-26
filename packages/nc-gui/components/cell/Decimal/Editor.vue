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
  <input
    :ref="focus"
    v-model="vModel"
    class="nc-cell-field outline-none py-1 border-none rounded-md w-full h-full"
    type="number"
    :step="precision"
    :placeholder="placeholder"
    style="letter-spacing: 0.06rem"
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
