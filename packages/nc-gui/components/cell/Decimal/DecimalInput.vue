<script lang="ts" setup>
import { composeNewDecimalValue, formatNumberWithSeparator, ncIsNaN } from 'nocodb-sdk'
import type { StyleValue } from 'vue'

interface Props {
  placeholder?: string
  inputStyle?: StyleValue
  modelValue?: number | null
  disabled?: boolean
  precision?: number
  isFocusOnMounted?: boolean
  decimalSeparator?: string
  thousandSeparator?: string | null
}

interface Emits {
  (event: 'update:modelValue', model: number): void
  (event: 'blur', model: FocusEvent): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const { isMobileMode } = useGlobal()

const inputRef = templateRef('input-ref')

const { getCurrentCopiedCellClipboardData } = useNcClipboardData()

const pasteText = (target: HTMLInputElement, value: string) => {
  if (!value || value === '') {
    return { changed: false }
  }
  const decSep = props.decimalSeparator || '.'
  const selectionEnd = target.selectionEnd
  const lastValue = target.value

  // composeNewDecimalValue only understands '.' as decimal separator,
  // so normalize to '.' before composing and convert back after
  const normalizedLast = decSep !== '.' ? lastValue.replace(new RegExp(`\\${decSep}`, 'g'), '.') : lastValue
  let normalizedNew: string
  if (decSep !== '.') {
    // Strip dots first — they are not the decimal separator for this column
    normalizedNew = value.replace(/\./g, '')
    // Then convert column's decimal separator to dot
    normalizedNew = normalizedNew.replace(new RegExp(`\\${decSep}`, 'g'), '.')
  } else {
    normalizedNew = value
  }

  let newValue = composeNewDecimalValue({
    selectionStart: target.selectionStart,
    selectionEnd: target.selectionEnd,
    lastValue: normalizedLast,
    newValue: normalizedNew,
  })

  // Convert back to the column's decimal separator
  if (decSep !== '.') {
    newValue = newValue.replace('.', decSep)
  }

  if (target.value !== newValue) {
    target.value = newValue
  }
  if (selectionEnd || selectionEnd === 0) {
    const newCursorIndex = target.value.length - (lastValue.length - selectionEnd)
    target.setSelectionRange(newCursorIndex, newCursorIndex)
  }
}

const getFormattedModelValue = (format = true) => {
  if (vModel.value || vModel.value === 0) {
    const decSep = props.decimalSeparator || '.'
    let numValue: number | undefined

    if (typeof vModel.value === 'number') {
      numValue = vModel.value
    } else if (typeof vModel.value === 'string') {
      const parsed = Number(vModel.value)
      if (!ncIsNaN(parsed)) {
        numValue = parsed
      }
    }

    if (numValue !== undefined) {
      // Idle/non-focused: apply thousand grouping and precision so the input
      // matches the readonly display (e.g. "1,234,567.89" / "1 234 567,89").
      // Focused/editing: bare number with only the decimal separator so the
      // user can type/paste cleanly.
      if (format) {
        return formatNumberWithSeparator(numValue, props.thousandSeparator ?? null, decSep, props.precision)
      }
      const result = numValue.toString()
      return decSep !== '.' ? result.replace('.', decSep) : result
    }
  }

  return ''
}
const refreshVModel = (format = true) => {
  if (inputRef.value && (vModel.value || vModel.value === 0)) {
    inputRef.value.value = getFormattedModelValue(format)
  }
}
const saveValue = (targetValue: string) => {
  if (targetValue === '') {
    vModel.value = null
    return
  }
  const decSep = props.decimalSeparator || '.'
  // Strip everything that isn't a digit, minus, or the column's decimal separator.
  // This lets users type/paste thousand-separator chars (`,` `.` ` ` NBSP) freely;
  // they're treated as visual noise and removed before parsing.
  let cleaned = targetValue.replace(new RegExp(`[^0-9\\-\\${decSep}]`, 'g'), '')
  if (decSep !== '.') {
    cleaned = cleaned.replace(new RegExp(`\\${decSep}`, 'g'), '.')
  }
  const value = Number(cleaned)
  if (ncIsNaN(value)) {
    vModel.value = null
    return
  }
  vModel.value = value
}
let savingHandle: any
const onInputKeyUp = (e: KeyboardEvent, debounce = true) => {
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
    if (!debounce) {
      saveValue(target.value)
    } else {
      savingHandle = setTimeout(() => {
        saveValue(target.value)
      }, 100)
    }
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
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    // Step the value by ±1 — matches Currency/Percent/Float native behavior.
    // Works regardless of view (form / grid / expanded) since this input is
    // text-mode (inputmode="decimal") and never has native ↑/↓ stepping.
    e.preventDefault()
    // The template has .left/.right/.delete.stop but NOT .up/.down.stop, so
    // bubble would reach grid's row-navigation handler. Stop it here.
    e.stopPropagation()
    // Commit any in-flight typed value (debounced 100ms) before stepping,
    // so the increment is applied on top of what the user can see.
    if (savingHandle) {
      clearTimeout(savingHandle)
    }
    // Parse the current displayed value rather than vModel.value — useVModel
    // here returns a computed that reads from props, so vModel.value still
    // reflects the *old* prop until the parent re-renders. Reading the input
    // directly avoids that one-tick lag.
    const decSep = props.decimalSeparator || '.'
    const cleaned = target.value.replace(new RegExp(`[^0-9\\-\\${decSep}]`, 'g'), '')
    const rawCurrent = Number(cleaned.replace(decSep, '.') || '0')
    if (ncIsNaN(rawCurrent)) return
    // Preserve the precision the user typed so the result doesn't gain
    // floating-point noise (e.g. 1.2345 + 1 = 2.234499999... → 2.2345).
    const decIndex = cleaned.indexOf(decSep)
    const inputPrecision = decIndex === -1 ? 0 : cleaned.length - decIndex - 1
    const direction = e.key === 'ArrowUp' ? 1 : -1
    const newVal = Number((rawCurrent + direction).toFixed(inputPrecision))
    vModel.value = newVal
    // Update the visible input directly — refreshVModel would read the
    // (stale) vModel.value and refuse to update for this same reason.
    target.value = decSep !== '.' ? newVal.toString().replace('.', decSep) : newVal.toString()
    return
  }

  const decSep = props.decimalSeparator || '.'

  // Allow only one decimal separator
  if (e.key === decSep && target.value.includes(decSep)) {
    e.preventDefault()
    e.stopPropagation()
    return
  }

  // Minus must be unique and at the beginning of the input
  if (e.key === '-') {
    if (target.value.includes('-') || (target.selectionStart ?? 0) !== 0) {
      e.preventDefault()
      e.stopPropagation()
    }
    return
  }

  // Allow digits, the column's decimal separator, and "noise" thousand-separator
  // candidates (comma, period, space, NBSP). Noise chars are kept visually and
  // stripped at save-time — same behavior as Airtable.
  if (/^[0-9]$/.test(e.key) || e.key === decSep || /^[,. \u00A0]$/.test(e.key)) {
    return
  }

  // Block everything else
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

  // Check ncClipboardData for a stored numeric dbCellValue
  const storedData = getCurrentCopiedCellClipboardData(value)
  if (storedData) {
    const clipboardItem = storedData.dbCellValueArr?.[0]?.[0]
    if (clipboardItem !== undefined && clipboardItem !== null && !isNaN(Number(clipboardItem))) {
      e.preventDefault()
      e.stopPropagation()
      const numValue = Number(clipboardItem)
      const decSep = props.decimalSeparator || '.'
      // Format the number with the target's decimal separator for display
      let displayValue: string
      if (props.precision) {
        displayValue = numValue.toFixed(props.precision)
      } else {
        displayValue = numValue.toString()
      }
      if (decSep !== '.') {
        displayValue = displayValue.replace('.', decSep)
      }
      target.value = displayValue
      target.setSelectionRange(target.value.length, target.value.length)
      saveValue(target.value)
      return
    }
  }

  // Fall through to existing text-based paste
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

const onInputFocus = () => {
  refreshVModel(false)
}

const registerEvents = (input: HTMLInputElement) => {
  input.addEventListener('keydown', onInputKeyDown)
  input.addEventListener('keyup', onInputKeyUp)
  input.addEventListener('paste', onInputPaste)
  input.addEventListener('blur', onInputBlur)
  input.addEventListener('focus', onInputFocus)
}

const removeEvents = (input: HTMLInputElement) => {
  input.removeEventListener('keydown', onInputKeyDown)
  input.removeEventListener('keyup', onInputKeyUp)
  input.removeEventListener('paste', onInputPaste)
  input.removeEventListener('blur', onInputBlur)
  input.removeEventListener('focus', onInputFocus)
}

const onBeforeInput = (e: InputEvent) => {
  if (!e.data || !isMobileMode.value) return // may be null for deletions etc.

  // allow digits, minus, the decimal separator, and noise thousand-separator chars
  const decSep = props.decimalSeparator || '.'
  if (!new RegExp(`^[0-9\\-\\${decSep},. \\u00A0]$`).test(e.data)) {
    e.preventDefault()
  }
}

onMounted(() => {
  if (inputRef.value) {
    registerEvents(inputRef.value as HTMLInputElement)
    nextTick(() => {
      refreshVModel()
      if (props.isFocusOnMounted) {
        inputRef.value.focus()
      }
    })
  }
})

onBeforeUnmount(() => {
  if (inputRef.value) {
    removeEvents(inputRef.value as HTMLInputElement)
  }
})

watch(vModel, (newValue) => {
  if (!inputRef.value) return

  // Don't touch the input while the user is actively typing — vModel updates
  // also come from saveValue() on keyup, and overwriting would clobber input.
  if (document.activeElement === inputRef.value) return

  if (inputRef.value.value === getFormattedModelValue() || inputRef.value.value === (newValue?.toString() || '')) {
    return
  }

  if (newValue || newValue === 0) {
    // Sync DOM to the new prop value. Covers switching records in the expanded
    // form, where the same DecimalInput instance receives a new modelValue.
    refreshVModel()
  } else if (inputRef.value.value && !['.', '-'].includes(inputRef.value.value)) {
    inputRef.value.value = ''
  }
})
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    ref="input-ref"
    class="nc-cell-field outline-none rounded-md w-full"
    :placeholder="placeholder"
    style="letter-spacing: 0.06rem; height: 24px !important"
    :style="inputStyle"
    inputmode="decimal"
    :disabled="disabled"
    @keydown.enter.exact="onInputKeyUp($event, false)"
    @keydown.left.stop
    @keydown.right.stop
    @keydown.delete.stop
    @keydown.alt.stop
    @selectstart.capture.stop
    @mousedown.stop
    @beforeinput="onBeforeInput"
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
