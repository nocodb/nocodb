<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  // when we set a number, then it is number type
  // for sqlite, when we clear a cell or empty the cell, it returns ""
  // otherwise, it is null type
  modelValue?: number | null | string
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj)

const isEditColumn = inject(EditColumnInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const column = inject(ColumnInj, null)!

const _vModel = useVModel(props, 'modelValue', emits)

const displayValue = computed(() => {
  if (_vModel.value === null) return null

  if (isNaN(Number(_vModel.value))) return null

  if (parseProp(column.value.meta).isLocaleString) return Number(_vModel.value).toLocaleString()

  return Number(_vModel.value)
})

const vModel = computed({
  get: () => _vModel.value,
  set: (value) => {
    if (value === '') {
      // if we clear / empty a cell in sqlite,
      // the value is considered as ''
      _vModel.value = null
    } else if (isForm.value && !isEditColumn.value) {
      _vModel.value = isNaN(Number(value)) ? value : Number(value)
    } else {
      _vModel.value = value
    }
  },
})

const inputType = computed(() => (isForm.value && !isEditColumn.value ? 'text' : 'number'))

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()

function onKeyDown(e: any) {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (cmdOrCtrl && !e.altKey) {
    switch (e.keyCode) {
      case 90: {
        e.stopPropagation()
        break
      }
    }
  }
  if (e.key === '.') {
    return e.preventDefault()
  }

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
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    v-if="!readOnly && editEnabled"
    :ref="focus"
    v-model="vModel"
    class="nc-cell-field outline-none py-1 border-none w-full h-full"
    :type="inputType"
    style="letter-spacing: 0.06rem"
    @blur="editEnabled = false"
    @keydown="onKeyDown"
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
  <span v-else class="nc-cell-field">{{ displayValue }}</span>
</template>

<style scoped lang="scss">
input[type='number']:focus,
input[type='text']:focus {
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
