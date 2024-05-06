<script setup lang="ts">
import dayjs from 'dayjs'
import { isSystemColumn } from 'nocodb-sdk'
import { ActiveCellInj, EditColumnInj, IsFormInj, ReadonlyInj, computed, inject, onClickOutside, ref, watch } from '#imports'

interface Props {
  modelValue?: number | string | null
  isPk?: boolean
}

const { modelValue, isPk = false } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { showNull, isMobileMode } = useGlobal()

const column = inject(ColumnInj, null)!

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isYearInvalid = ref(false)

const datePickerRef = ref<HTMLInputElement>()

const isClearedInputMode = ref<boolean>(false)

const { t } = useI18n()

const open = ref<boolean>(false)

const localState = computed({
  get() {
    if (!modelValue || isClearedInputMode.value) {
      return undefined
    }

    const yearDate = dayjs(modelValue.toString(), 'YYYY')
    if (!yearDate.isValid()) {
      isYearInvalid.value = true
      return undefined
    }

    return yearDate
  },
  set(val?: dayjs.Dayjs) {
    isClearedInputMode.value = false

    if (!val) {
      emit('update:modelValue', null)
      return
    }

    if (val?.isValid()) {
      emit('update:modelValue', val.format('YYYY'))
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
    ((isForm.value || isExpandedForm.value) && !isYearInvalid.value) ||
    (isGrid.value && !showNull.value && !isYearInvalid.value && !isSystemColumn(column.value) && active.value)
  ) {
    return 'YYYY'
  } else if (isEditColumn.value && (modelValue === '' || modelValue === null)) {
    return t('labels.optional')
  } else if (modelValue === null && showNull.value) {
    return t('general.null').toUpperCase()
  } else if (isYearInvalid.value) {
    return t('msg.invalidTime')
  } else {
    return ''
  }
})

const isOpen = computed(() => {
  if (readOnly.value) return false
  return (readOnly.value || (localState.value && isPk)) && !active.value && !editable.value ? false : open.value
})

const clickHandler = () => {
  if (readOnly.value || open.value) return
  open.value = active.value || editable.value
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
    :tabindex="0"
    picker="year"
    :bordered="false"
    class="nc-cell-field !w-full !py-1 !border-none !text-current"
    :class="[`nc-${randomClass}`, { 'nc-null': modelValue === null && showNull }]"
    :placeholder="placeholder"
    :allow-clear="!readOnly && !isPk"
    :input-read-only="!!isMobileMode"
    :open="isOpen"
    :dropdown-class-name="`${randomClass} nc-picker-year children:border-1 children:border-gray-200 ${open ? 'active' : ''}`"
    @blur="onBlur"
    @keydown="handleKeydown"
    @click="clickHandler"
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
