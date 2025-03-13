<script lang="ts" setup>
import { composeNewDecimalValue, ncIsNaN } from 'nocodb-sdk'
import type { StyleValue } from 'vue'

interface Props {
  placeholder?: string
  inputStyle?: StyleValue
  modelValue?: number | null
  disabled?: boolean
  onBlur?: (payload: FocusEvent) => void
  precision?: number
  isFocusOnMounted?: boolean
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const inputRef = templateRef('input-ref')

const pasteText = (target: HTMLInputElement, value: string) => {
  if (!value || value === '') {
    return { changed: false }
  }
  const selectionEnd = target.selectionEnd
  const lastValue = target.value
  const newValue = composeNewDecimalValue({
    selectionStart: target.selectionStart,
    selectionEnd: target.selectionEnd,
    lastValue,
    newValue: value,
  })
  if (target.value !== newValue) {
    target.value = newValue
    if (selectionEnd || selectionEnd === 0) {
      const newCursorIndex = target.value.length - (lastValue.length - selectionEnd)
      target.setSelectionRange(newCursorIndex, newCursorIndex)
    }
    return { changed: true }
  }
  return { changed: false }
}
const refreshVModel = () => {
  if (inputRef.value && vModel.value) {
    if (typeof vModel.value === 'number') {
      inputRef.value.value = vModel.value.toFixed(props.precision ?? 2) ?? ''
    } else if (typeof vModel.value === 'string') {
      const numberValue = Number(vModel.value)
      if (!ncIsNaN(numberValue)) {
        inputRef.value.value = numberValue.toFixed(props.precision ?? 2) ?? ''
      }
    }
  }
}
const saveValue = (targetValue: string) => {
  if (targetValue === '') {
    vModel.value = null
    return
  }
  const value = Number(targetValue)
  if (ncIsNaN(value)) {
    vModel.value = null
    return
  }
  vModel.value = value
}
let savingHandle: any
const onInputKeyUp = (e: KeyboardEvent) => {
  const target: HTMLInputElement = e.target as HTMLInputElement
  if (target) {
    // debounce, maybe there's some helpers in vue?
    if (savingHandle) {
      clearTimeout(savingHandle)
    }
    savingHandle = setTimeout(() => {
      saveValue(target.value)
    }, 100)
  }
}
// Handle the arrow keys as its default behavior is to increment/decrement the value
const onInputKeyDown = (e: KeyboardEvent) => {
  const target: HTMLInputElement = e.target as HTMLInputElement
  if (!target) {
    return
  }
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Delete', 'Backspace'].includes(e.key)) {
    return
  }
  if (e.key === 'ArrowDown') {
    target.setSelectionRange(target.value.length, target.value.length)
    return
  } else if (e.key === 'ArrowUp') {
    target.setSelectionRange(0, 0)
    return
  }
  if (!e.metaKey) {
    const { changed } = pasteText(target, e.key)
    if (changed || ['.'].includes(e.key)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
}

const onInputPaste = (e: ClipboardEvent) => {
  if (e.clipboardData === null || typeof e.clipboardData === 'undefined') {
    return
  }
  const target: HTMLInputElement = e.target as HTMLInputElement
  if (!target) {
    return
  }
  const value = e.clipboardData.getData('text/plain')
  if (value === null || value === '' || typeof value === 'undefined') {
    return
  }
  e.preventDefault()
  e.stopPropagation()
  pasteText(target, value)
}
const onInputBlur = (e: FocusEvent) => {
  if (e.target) {
    const targetValue = (e.target as HTMLInputElement).value
    saveValue(targetValue)
    setTimeout(() => {
      // allow for debouncing to clear first
      refreshVModel()
    }, 100)
  }
}

const registerEvents = (input: HTMLInputElement) => {
  input.addEventListener('keydown', onInputKeyDown)
  input.addEventListener('keyup', onInputKeyUp)
  input.addEventListener('paste', onInputPaste)
  input.addEventListener('blur', onInputBlur)
}

onMounted(() => {
  if (inputRef.value) {
    registerEvents(inputRef.value as HTMLInputElement)
    refreshVModel()
    if (props.isFocusOnMounted) {
      inputRef.value.focus()
    }
  }
})
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    ref="input-ref"
    class="nc-cell-field outline-none rounded-md"
    :placeholder="placeholder"
    style="letter-spacing: 0.06rem; height: 24px !important"
    :style="inputStyle"
    :disabled="disabled"
    @blur="onBlur"
    @keydown.left.stop
    @keydown.right.stop
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
