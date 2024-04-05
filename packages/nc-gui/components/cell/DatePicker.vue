<script setup lang="ts">
import dayjs from 'dayjs'
import { isDateMonthFormat, isSystemColumn } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellClickHookInj,
  ColumnInj,
  EditColumnInj,
  EditModeInj,
  ReadonlyInj,
  computed,
  inject,
  onClickOutside,
  onMounted,
  onUnmounted,
  parseProp,
  ref,
  useGlobal,
  useI18n,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | null
  isPk?: boolean
}

const { modelValue, isPk } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { showNull, isMobileMode } = useGlobal()

const columnMeta = inject(ColumnInj, null)!

const readOnly = inject(ReadonlyInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isDateInvalid = ref(false)

const datePickerRef = ref<HTMLInputElement>()

const dateFormat = computed(() => parseProp(columnMeta?.value?.meta)?.date_format ?? 'YYYY-MM-DD')

const picker = computed(() => (isDateMonthFormat(dateFormat.value) ? 'month' : ''))

const isClearedInputMode = ref<boolean>(false)

const open = ref<boolean>(false)

const localState = computed({
  get() {
    if (!modelValue || isClearedInputMode.value) {
      return undefined
    }

    if (!dayjs(modelValue).isValid()) {
      isDateInvalid.value = true
      return undefined
    }

    const format = picker.value === 'month' ? dateFormat : 'YYYY-MM-DD'

    return dayjs(/^\d+$/.test(modelValue) ? +modelValue : modelValue, format)
  },
  set(val?: dayjs.Dayjs) {
    isClearedInputMode.value = false

    if (!val) {
      emit('update:modelValue', null)
      return
    }

    if (picker.value === 'month') {
      // reset day to 1st
      val = dayjs(val).date(1)
    }

    if (val.isValid()) {
      emit('update:modelValue', val?.format('YYYY-MM-DD'))
    }

    open.value = false
  },
})

const randomClass = `picker_${Math.floor(Math.random() * 99999)}`

onClickOutside(datePickerRef, (e) => {
  if ((e.target as HTMLElement)?.closest(`.${randomClass}`)) return
  datePickerRef.value?.blur?.()
  open.value = false
})

const onBlur = (e) => {
  if ((e?.relatedTarget as HTMLElement)?.closest(`.${randomClass}`)) return

  open.value = false
}

watch(
  open,
  (next) => {
    if (next) {
      editable.value = true
      datePickerRef.value?.focus?.()

      onClickOutside(document.querySelector(`.${randomClass}`)! as HTMLDivElement, (e) => {
        if ((e?.target as HTMLElement)?.closest(`.nc-${randomClass}`)) {
          return
        }
        open.value = false
      })
    } else {
      isClearedInputMode.value = false
    }
  },
  { flush: 'post' },
)

watch(editable, (nextValue) => {
  if (isGrid.value && nextValue && !open.value) {
    open.value = true
  }
})

const placeholder = computed(() => {
  if (
    ((isForm.value || isExpandedForm.value) && !isDateInvalid.value) ||
    (isGrid.value && !showNull.value && !isDateInvalid.value && !isSystemColumn(columnMeta.value) && active.value)
  ) {
    return dateFormat.value
  } else if (isEditColumn.value && (modelValue === '' || modelValue === null)) {
    return t('labels.optional')
  } else if (modelValue === null && showNull.value) {
    return t('general.null').toUpperCase()
  } else if (isDateInvalid.value) {
    return t('msg.invalidDate')
  } else {
    return ''
  }
})

const isOpen = computed(() => {
  if (readOnly.value) return false

  return (readOnly.value || (localState.value && isPk)) && !active.value && !editable.value ? false : open.value
})

const cellClickHook = inject(CellClickHookInj, null)

const cellClickHandler = () => {
  if (readOnly.value || open.value) return

  open.value = active.value || editable.value
}

onMounted(() => {
  cellClickHook?.on(cellClickHandler)
})

onUnmounted(() => {
  cellClickHook?.on(cellClickHandler)
})

const clickHandler = () => {
  if (cellClickHook) {
    return
  }
  cellClickHandler()
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Enter') {
    e.stopPropagation()
  }

  switch (e.key) {
    case 'Enter':
      open.value = !open.value
      if (!open.value) {
        editable.value = false
        if (isGrid.value && !isExpandedForm.value && !isEditColumn.value) {
          datePickerRef.value?.blur?.()
        }
      }
      return
    case 'Escape':
      if (open.value) {
        open.value = false
        editable.value = false
        if (isGrid.value && !isExpandedForm.value && !isEditColumn.value) {
          datePickerRef.value?.blur?.()
        }
      } else {
        editable.value = false

        datePickerRef.value?.blur?.()
      }

      return
    default:
      if (!open.value && /^[0-9a-z]$/i.test(e.key)) {
        open.value = true
      }
  }
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  // To prevent event listener on non active cell
  if (!active.value) return

  if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey || !isGrid.value || isExpandedForm.value || isEditColumn.value) return

  switch (e.key) {
    case ';':
      localState.value = dayjs(new Date())
      e.preventDefault()
      break
    default:
      if (!isOpen.value && datePickerRef.value && /^[0-9a-z]$/i.test(e.key)) {
        isClearedInputMode.value = true
        datePickerRef.value.focus()
        editable.value = true
        open.value = true
      }
  }
})
</script>

<template>
  <a-date-picker
    ref="datePickerRef"
    v-model:value="localState"
    :disabled="readOnly"
    :picker="picker"
    :tabindex="0"
    :bordered="false"
    class="nc-cell-field !w-full !py-1 !border-none !text-current"
    :class="[`nc-${randomClass}`, { 'nc-null': modelValue === null && showNull }]"
    :format="dateFormat"
    :placeholder="placeholder"
    :allow-clear="!readOnly && !isEditColumn"
    :input-read-only="!!isMobileMode"
    :dropdown-class-name="`${randomClass} nc-picker-date  children:border-1 children:border-gray-200  ${open ? 'active' : ''} `"
    :open="isOpen"
    @blur="onBlur"
    @click="clickHandler"
    @keydown="handleKeydown"
    @mouseup.stop
    @mousedown.stop
  >
    <template #suffixIcon></template>
  </a-date-picker>
  <div v-if="!editable && isGrid" class="absolute inset-0 z-90 cursor-pointer"></div>
</template>

<style scoped>
:deep(.ant-picker-input > input) {
  @apply !text-current;
}
</style>
