<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { abbreviateNumber, shouldAbbreviateNumber, toSafeInteger } from 'nocodb-sdk'

interface Props {
  // when we set a number, then it is number type
  // for sqlite, when we clear a cell or empty the cell, it returns ""
  // otherwise, it is null type
  modelValue?: number | null | string
  location?: 'cell' | 'filter'
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const editEnabled = inject(EditModeInj)
const isEditColumn = inject(EditColumnInj, ref(false))
const readOnly = inject(ReadonlyInj, ref(false))
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!
const isForm = inject(IsFormInj)!
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const column = inject(ColumnInj, null)

const { getCurrentCopiedCellClipboardData } = useNcClipboardData()

const inputRef = ref<HTMLInputElement>()
const _vModel = useVModel(props, 'modelValue', emits)

const isFocused = ref(false)

// Off only for the two inputs that aren't a record value: filter operands and the
// field-editor's default. Every surface that shows a stored number abbreviates at
// idle — incl. the interface record sheet, which provides IsFormInj for its own
// staging semantics but still displays a saved record.
const abbreviates = computed(
  () => !isEditColumn.value && props.location !== 'filter' && shouldAbbreviateNumber(parseProp(column?.value?.meta)),
)

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
      const currentValue = +(value ?? 0)
      _vModel.value = toSafeInteger(currentValue)
    }
  },
})

const rawText = computed(() => {
  if (_vModel.value === null || _vModel.value === undefined) return ''

  // form view stores what was typed even when it isn't a number — keep it visible
  if (typeof _vModel.value === 'string') return _vModel.value

  if (isNaN(Number(_vModel.value))) return ''

  return String(_vModel.value)
})

const idleText = computed(() => {
  if (!abbreviates.value || !rawText.value) return rawText.value

  // form view can hold what was typed rather than a number — abbreviating that
  // would render the string 'NaN'
  const num = Number(_vModel.value)
  if (!isFinite(num)) return rawText.value

  // no precision arg — matches parseIntValue, so the editor reads like the grid
  return abbreviateNumber(num, parseProp(column?.value?.meta))
})

// the DOM stays authoritative while typing; only focus changes and external
// model updates reassign this
const inputText = ref(idleText.value)

const syncInputText = () => {
  inputText.value = isFocused.value ? rawText.value : idleText.value
}

const inputType = computed(() => {
  if (abbreviates.value) return 'text'

  return isForm.value && !isEditColumn.value && props.location !== 'filter' ? 'text' : 'number'
})

const onInput = (e: Event) => {
  const text = (e.target as HTMLInputElement).value

  if (text === '') {
    _vModel.value = null
    return
  }

  if (isForm.value && !isEditColumn.value) {
    _vModel.value = isNaN(Number(text)) ? (text as any) : Number(text)
    return
  }

  const parsed = Number(text)
  // a half-typed value ('-', '1e') leaves the model alone until it parses
  if (isNaN(parsed)) return

  _vModel.value = toSafeInteger(parsed)
}

const onFocus = () => {
  isFocused.value = true
  syncInputText()
}

const onBlur = () => {
  isFocused.value = false
  syncInputText()
  if (editEnabled) editEnabled.value = false
}

watch([() => _vModel.value, abbreviates], () => {
  if (isFocused.value) return

  syncInputText()
})

const focus: VNodeRef = (el) => {
  if (!isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    inputRef.value = el as HTMLInputElement
    inputRef.value?.focus()
  }
}

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

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    // Step the value by ±1 — matches Currency/Percent/Float native behavior
    // and works regardless of whether the input is rendered as type=number
    // (grid / expanded form) or type=text (form view).
    e.preventDefault()
    const current = Number(_vModel.value ?? 0)
    if (isNaN(current)) return
    const direction = e.key === 'ArrowUp' ? 1 : -1
    const stepped = toSafeInteger(current + direction)
    vModel.value = stepped
    // the model watcher skips while focused, so drive the visible value here
    inputText.value = String(stepped)
  }
}

const onPaste = (e: ClipboardEvent) => {
  const value = e.clipboardData?.getData('text/plain')
  if (!value) return

  const storedData = getCurrentCopiedCellClipboardData(value)
  if (storedData) {
    const clipboardItem = storedData.dbCellValueArr?.[0]?.[0]
    if (clipboardItem !== undefined && clipboardItem !== null && !isNaN(Number(clipboardItem))) {
      e.preventDefault()
      e.stopPropagation()
      const pasted = parseInt(String(clipboardItem), 10)
      vModel.value = pasted
      inputText.value = String(pasted)
    }
  }
  // Fall through to browser native paste for external clipboard
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
    v-model="inputText"
    class="nc-cell-field outline-none py-1 border-none w-full h-full"
    :type="inputType"
    :inputmode="abbreviates ? 'numeric' : undefined"
    style="letter-spacing: 0.06rem"
    :disabled="readOnly"
    @input="onInput"
    @focus="onFocus"
    @blur="onBlur"
    @paste="onPaste"
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
