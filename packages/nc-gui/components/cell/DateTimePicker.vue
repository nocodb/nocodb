<script setup lang="ts">
import dayjs from 'dayjs'
import { dateFormats, isSystemColumn, timeFormats } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellClickHookInj,
  ColumnInj,
  EditColumnInj,
  IsFormInj,
  ReadonlyInj,
  inject,
  parseProp,
  ref,
  useBase,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | null
  isPk?: boolean
  isUpdatedFromCopyNPaste?: Record<string, boolean>
}

const { modelValue, isPk, isUpdatedFromCopyNPaste } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { isMssql, isXcdbBase } = useBase()

const { showNull, isMobileMode } = useGlobal()

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const { t } = useI18n()

const isEditColumn = inject(EditColumnInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const column = inject(ColumnInj)!

const isDateInvalid = ref(false)

const datePickerRef = ref<HTMLInputElement>()

const dateTimeFormat = computed(() => {
  const dateFormat = parseProp(column?.value?.meta)?.date_format ?? dateFormats[0]
  const timeFormat = parseProp(column?.value?.meta)?.time_format ?? timeFormats[0]
  return `${dateFormat} ${timeFormat}`
})

let localModelValue = modelValue ? dayjs(modelValue).utc().local() : undefined

const isClearedInputMode = ref<boolean>(false)

const open = ref(false)

const localState = computed({
  get() {
    if (!modelValue || isClearedInputMode.value) {
      return undefined
    }

    if (!dayjs(modelValue).isValid()) {
      isDateInvalid.value = true
      return undefined
    }

    const isXcDB = isXcdbBase(column.value.source_id)

    // cater copy and paste
    // when copying a datetime cell, the copied value would be local time
    // when pasting a datetime cell, UTC (xcdb) will be saved in DB
    // we convert back to local time
    if (column.value.title! in (isUpdatedFromCopyNPaste ?? {})) {
      localModelValue = dayjs(modelValue).utc().local()
      return localModelValue
    }

    // ext db
    if (!isXcDB) {
      return /^\d+$/.test(modelValue) ? dayjs(+modelValue) : dayjs(modelValue)
    }

    if (isMssql(column.value.source_id)) {
      // e.g. 2023-04-29T11:41:53.000Z
      return dayjs(modelValue)
    }

    // if cdf is defined, that means the value is auto-generated
    // hence, show the local time
    if (column?.value?.cdf) {
      return dayjs(modelValue).utc().local()
    }

    // if localModelValue is defined, show localModelValue instead
    // localModelValue is set in setter below
    if (localModelValue) {
      const res = localModelValue
      // resetting localModelValue here
      // e.g. save in expanded form -> render the correct modelValue
      localModelValue = undefined
      return res
    }

    // empty cell - use modelValue in local time
    return dayjs(modelValue).utc().local()
  },
  set(val?: dayjs.Dayjs) {
    isClearedInputMode.value = false
    if (!val) {
      emit('update:modelValue', null)

      return
    }

    if (val.isValid()) {
      // setting localModelValue to cater NOW function in date picker
      localModelValue = dayjs(val)
      // send the payload in UTC format
      emit('update:modelValue', dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ'))
    }
  },
})

const isOpen = computed(() => {
  if (readOnly.value) return false

  return readOnly.value || (localState.value && isPk) ? false : open.value && (active.value || editable.value)
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

const placeholder = computed(() => {
  if (
    ((isForm.value || isExpandedForm.value) && !isDateInvalid.value) ||
    (isGrid.value && !showNull.value && !isDateInvalid.value && !isSystemColumn(column.value) && active.value)
  ) {
    return dateTimeFormat.value
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

const cellClickHook = inject(CellClickHookInj, null)
const cellClickHandler = () => {
  if (readOnly.value || open.value) return
  open.value = active.value || editable.value
}

function okHandler(val: dayjs.Dayjs | string) {
  isClearedInputMode.value = false

  if (!val) {
    emit('update:modelValue', null)
  } else if (dayjs(val).isValid()) {
    // setting localModelValue to cater NOW function in date picker
    localModelValue = dayjs(val)
    // send the payload in UTC format
    emit('update:modelValue', dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ'))
  }

  open.value = !open.value
  if (!open.value && isGrid.value && !isExpandedForm.value && !isEditColumn.value) {
    datePickerRef.value?.blur?.()
    editable.value = false
  }
}

onMounted(() => {
  cellClickHook?.on(cellClickHandler)
})
onUnmounted(() => {
  cellClickHook?.on(cellClickHandler)
})

const clickHandler = (e) => {
  if ((e.target as HTMLElement).closest(`.nc-${randomClass} .ant-picker-clear`)) {
    e.stopPropagation()
    emit('update:modelValue', null)
    open.value = false
    return
  }

  if (cellClickHook) {
    return
  }
  cellClickHandler()
}

const isColDisabled = computed(() => {
  return isSystemColumn(column.value) || readOnly.value || (localState.value && isPk)
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Enter') {
    e.stopPropagation()
  }

  switch (e.key) {
    case 'Enter':
      if (isOpen.value) {
        return okHandler((e.target as HTMLInputElement).value)
      } else {
        open.value = true
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
    case 'Tab':
      open.value = false
      if (isGrid.value) {
        editable.value = false
        datePickerRef.value?.blur()
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

watch(editable, (nextValue) => {
  if (isGrid.value && nextValue && !open.value) {
    open.value = true
  }
})
</script>

<template>
  <a-date-picker
    ref="datePickerRef"
    :value="localState"
    :disabled="isColDisabled"
    :show-time="true"
    :bordered="false"
    class="nc-cell-field nc-cell-picker-datetime !w-full !py-1 !border-none !text-current"
    :class="[`nc-${randomClass}`, { 'nc-null': modelValue === null && showNull }]"
    :format="dateTimeFormat"
    :placeholder="placeholder"
    :allow-clear="!isColDisabled && !isEditColumn"
    :input-read-only="!!isMobileMode"
    :dropdown-class-name="`${randomClass} nc-picker-datetime children:border-1 children:border-gray-200 ${open ? 'active' : ''}`"
    :open="isOpen"
    @blur="onBlur"
    @click="clickHandler"
    @ok="okHandler"
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
