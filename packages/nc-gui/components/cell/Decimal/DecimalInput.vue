<script lang="ts" setup>
import { composeNewDecimalValue, ncIsNaN } from 'nocodb-sdk'
import type { StyleValue } from 'vue'

interface Props {
  placeholder?: string
  inputStyle?: StyleValue
  modelValue?: number | null
  disabled?: boolean
  precision?: number
  isFocusOnMounted?: boolean
}

interface Emits {
  (event: 'update:modelValue', model: number): void
  (event: 'blur', model: FocusEvent): void
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
  }
  if (selectionEnd || selectionEnd === 0) {
    const newCursorIndex = target.value.length - (lastValue.length - selectionEnd)
    target.setSelectionRange(newCursorIndex, newCursorIndex)
  }
}
const refreshVModel = () => {
  if (inputRef.value && vModel.value) {
    if (typeof vModel.value === 'number') {
      if (props.precision) {
        inputRef.value.value = vModel.value.toFixed(props.precision) ?? ''
      } else {
        inputRef.value.value = vModel.value.toString()
      }
    } else if (typeof vModel.value === 'string') {
      const numberValue = Number(vModel.value)
      if (!ncIsNaN(numberValue)) {
        if (props.precision) {
          inputRef.value.value = numberValue.toFixed(props.precision) ?? ''
        } else {
          inputRef.value.value = numberValue.toString()
        }
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
    // mac's double space insert period
    // not perfect, but better
    if (target.value.match(/\.\s/)?.[0]) {
      target.value = target.value.replace(/\.\s/, '')
    }
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
  const functionKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']
  if (
    [
      'ArrowLeft',
      'ArrowRight',
      'Enter',
      'Escape',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'Delete',
      'Backspace',
      'Tab',
      ...functionKeys,
    ].includes(e.key) ||
    e.ctrlKey ||
    e.altKey ||
    e.metaKey
  ) {
    return
  }
  if (e.key === 'ArrowDown') {
    target.setSelectionRange(target.value.length, target.value.length)
    return
  } else if (e.key === 'ArrowUp') {
    target.setSelectionRange(0, 0)
    return
  } else if (e.key.match('[^-0-9\.]')) {
    // prevent everything non ctrl / alt and non . and non number
    e.preventDefault()
    e.stopPropagation()
    return
  }
  pasteText(target, e.key)
  e.preventDefault()
  e.stopPropagation()
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
  emits('blur', e)
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
