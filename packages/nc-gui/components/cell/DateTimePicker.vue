<script setup lang="ts">
import dayjs from 'dayjs'
import { dateFormats, isSystemColumn, isValidTimeFormat, timeFormats } from 'nocodb-sdk'

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

const timePickerRef = ref<HTMLInputElement>()

const dateTimeFormat = computed(() => {
  const dateFormat = parseProp(column?.value?.meta)?.date_format ?? dateFormats[0]
  const timeFormat = parseProp(column?.value?.meta)?.time_format ?? timeFormats[0]
  return `${dateFormat} ${timeFormat}`
})

const dateFormat = computed(() => parseProp(column?.value?.meta)?.date_format ?? dateFormats[0])
const timeFormat = computed(() => parseProp(column?.value?.meta)?.time_format ?? timeFormats[0])

let localModelValue = modelValue ? dayjs(modelValue).utc().local() : undefined

const isClearedInputMode = ref<boolean>(false)

const open = ref(false)

const tempDate = ref<dayjs.Dayjs | undefined>()

const isDatePicker = ref<boolean>(true)

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

watchEffect(() => {
  if (localState.value) {
    tempDate.value = localState.value
  }
})

const isOpen = computed(() => {
  if (readOnly.value) return false

  return readOnly.value || (localState.value && isPk) ? false : open.value && (active.value || editable.value)
})

const randomClass = `picker_${Math.floor(Math.random() * 99999)}`

onClickOutside(datePickerRef, (e) => {
  if ((e.target as HTMLElement)?.closest(`.${randomClass}, .nc-${randomClass}`)) return

  datePickerRef.value?.blur?.()
  timePickerRef.value?.blur?.()
  open.value = false
})

const onFocus = (_isDatePicker: boolean) => {
  isDatePicker.value = _isDatePicker
  open.value = true
}

watch(
  open,
  (next) => {
    if (next) {
      editable.value = true

      isDatePicker.value ? datePickerRef.value?.focus?.() : timePickerRef.value?.focus?.()

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
    return { dateTime: dateTimeFormat.value, date: dateFormat.value, time: timeFormat.value }
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

onMounted(() => {
  cellClickHook?.on(cellClickHandler)
})
onUnmounted(() => {
  cellClickHook?.on(cellClickHandler)
})

const clickHandler = (e: MouseEvent, _isDatePicker?: boolean = false) => {
  isDatePicker.value = _isDatePicker

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

const handleKeydown = (e: KeyboardEvent, _open?: boolean, _isDatePicker?: boolean = false) => {
  if (e.key !== 'Enter') {
    e.stopPropagation()
  }

  switch (e.key) {
    case 'Enter':
      e.preventDefault()
      localState.value = tempDate.value
      if (!_isDatePicker) {
        e.stopPropagation()
        timePickerRef.value?.blur?.()
        isDatePicker.value = false
        datePickerRef.value?.focus?.()
        cellClickHandler()
      } else {
        datePickerRef.value?.blur?.()
        open.value = false
        editable.value = false
      }

      return
    case 'Escape':
      if (_open) {
        open.value = false
        editable.value = false
        if (isGrid.value && !isExpandedForm.value && !isEditColumn.value) {
          _isDatePicker ? datePickerRef.value?.blur?.() : timePickerRef.value?.blur?.()
        }
      } else {
        editable.value = false

        _isDatePicker ? datePickerRef.value?.blur?.() : timePickerRef.value?.blur?.()
      }

      return
    case 'Tab':
      open.value = false
      if (isGrid.value) {
        _isDatePicker ? datePickerRef.value?.blur?.() : timePickerRef.value?.blur?.()

        if (e.shiftKey && _isDatePicker) {
          editable.value = false
        } else if (e.shiftKey && !_isDatePicker) {
          editable.value = false
        } else {
          e.stopPropagation()
        }
      }

      return
    default:
      if (!_open && /^[0-9a-z]$/i.test(e.key)) {
        open.value = true
      }
  }
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  // To prevent event listener on non active cell
  if (!active.value) return

  if (
    e.altKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.metaKey ||
    !isGrid.value ||
    isExpandedForm.value ||
    isEditColumn.value ||
    isExpandedFormOpen()
  ) {
    return
  }

  switch (e.key) {
    case ';':
      localState.value = dayjs(new Date())
      e.preventDefault()
      break
    default:
      if (!isOpen.value && (datePickerRef.value || timePickerRef.value) && /^[0-9a-z]$/i.test(e.key)) {
        isClearedInputMode.value = true
        isDatePicker.value ? datePickerRef.value?.focus() : timePickerRef.value?.focus()
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

const handleUpdateValue = (e: Event, _isDatePicker: boolean) => {
  let targetValue = (e.target as HTMLInputElement).value

  if (_isDatePicker) {
    if (!targetValue) {
      tempDate.value = undefined
      return
    }

    const date = dayjs(targetValue, dateFormat.value)

    if (date.isValid()) {
      if (localState.value) {
        tempDate.value = dayjs(`${date.format('YYYY-MM-DD')} ${localState.value.format(timeFormat.value)}`)
      } else {
        tempDate.value = date
      }
    }
  }

  if (!_isDatePicker) {
    if (!targetValue) {
      tempDate.value = dayjs(dayjs().format('YYYY-MM-DD'))
      return
    }

    if (timeFormat.value === 'HH:mm' && targetValue.length > 5) {
      targetValue = targetValue.slice(0, 5)
    }

    if (isValidTimeFormat(targetValue, timeFormat.value)) {
      tempDate.value = dayjs(`${(tempDate.value ?? dayjs()).format('YYYY-MM-DD')} ${targetValue}`)
    }
  }
}

function handleSelectDate(value?: dayjs.Dayjs) {
  if (value && localState.value) {
    const dateTime = dayjs(`${value.format('YYYY-MM-DD')} ${localState.value.format(timeFormat.value)}`)
    tempDate.value = dateTime
    localState.value = dateTime
  } else {
    tempDate.value = value
    localState.value = value
  }
  open.value = false
}

function handleSelectTime(value: string) {
  if (value && localState.value) {
    const dateTime = dayjs(`${localState.value.format('YYYY-MM-DD')} ${value}:00`)
    tempDate.value = dateTime
    localState.value = dateTime
  } else if (!localState.value) {
    const dateTime = dayjs(`${dayjs().format('YYYY-MM-DD')} ${value}:00`)
    tempDate.value = dateTime
    localState.value = dateTime
  }

  open.value = false
}
function generateTimeArray() {
  return Array.from({ length: 24 }).flatMap((_, h) => {
    return [0, 30].map((m) => {
      const hour24 = h.toString().padStart(2, '0')
      const minute = m.toString().padStart(2, '0')

      return { label: `${hour24}:${minute}`, value: `${hour24}:${minute}` }
    })
  })
}
const timeOptions = ref<
  {
    label: string
    value: string
  }[]
>(generateTimeArray())

const selectedTime = computed(() => {
  const result = {
    value: '',
    label: '',
  }
  if (localState.value) {
    const time = localState.value.format(timeFormat.value)

    const [hours, minutes] = time.split(':')

    result.value = `${hours}:${minutes}`

    result.label = time
  }

  return result
})

watch([isDatePicker, isOpen], () => {
  if (!isDatePicker.value && isOpen.value && selectedTime.value.value) {
    setTimeout(() => {
      const timeEl = document.querySelector(`.nc-picker-datetime [data-testid="time-option-${selectedTime.value.value}"]`)

      timeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }
})
</script>

<template>
  <NcDropdown
    :visible="isOpen"
    :placement="isDatePicker ? 'bottomLeft' : 'bottomRight'"
    :auto-close="false"
    :trigger="['click']"
    class="nc-cell-field nc-cell-picker-datetime -ml-1"
    :class="[`nc-${randomClass}`, { 'nc-null': modelValue === null && showNull }]"
    :overlay-class-name="`${randomClass} nc-picker-datetime ${open ? 'active' : ''} !min-w-[0] overflow-hidden`"
    :disabled="isColDisabled"
  >
    <div
      :title="localState?.format(dateTimeFormat)"
      class="nc-date-picker flex items-center ant-picker-input relative group !w-auto"
    >
      <div
        class="flex-none hover:bg-gray-200 px-1 rounded-md w-[60%] max-w-[100px]"
        :class="{
          'py-0': isForm,
          'py-0.5': !isForm,
          'bg-gray-200': isDatePicker && isOpen,
        }"
      >
        <input
          ref="datePickerRef"
          :value="localState?.format(dateFormat) ?? ''"
          :placeholder="typeof placeholder === 'string' ? placeholder : placeholder?.date"
          class="nc-date-input w-full !truncate border-transparent outline-none !text-current !bg-transparent !focus:(border-none outline-none ring-transparent)"
          :readonly="!!isMobileMode || isColDisabled"
          @focus="onFocus(true)"
          @keydown="handleKeydown($event, open, true)"
          @mouseup.stop
          @mousedown.stop
          @click.stop="clickHandler($event, true)"
          @input="handleUpdateValue($event, true)"
        />
      </div>
      <div
        class="flex-none hover:bg-gray-200 ml-2 px-1 rounded-md w-[calc(40%_-_8px)] max-w-[100px]"
        :class="{
          'py-0': isForm,
          'py-0.5': !isForm,
          'bg-gray-200': !isDatePicker && isOpen,
        }"
      >
        <input
          ref="timePickerRef"
          :value="selectedTime.value ? `${selectedTime.label}` : ''"
          :placeholder="typeof placeholder === 'string' ? placeholder : placeholder?.time"
          class="nc-time-input w-full !truncate border-transparent outline-none !text-current !bg-transparent !focus:(border-none outline-none ring-transparent)"
          :readonly="!!isMobileMode || isColDisabled"
          @focus="onFocus(false)"
          @keydown="handleKeydown($event, open)"
          @mouseup.stop
          @mousedown.stop
          @click.stop="clickHandler($event, false)"
          @input="handleUpdateValue($event, false)"
        />
      </div>
    </div>

    <template #overlay>
      <div
        class="min-w-[154px]"
        :class="{
          'w-[256px]': isDatePicker,
          'h-[252px]': !isDatePicker,
        }"
      >
        <NcDatePicker
          v-if="isDatePicker"
          v-model:page-date="tempDate"
          :selected-date="localState"
          :is-open="isOpen"
          type="date"
          size="medium"
          @update:selected-date="handleSelectDate"
        />

        <template v-else>
          <div class="h-[calc(100%_-_40px)] overflow-y-auto nc-scrollbar-thin">
            <div
              v-for="time of timeOptions"
              :key="time.value"
              class="hover:bg-gray-200 py-0.5 px-3 text-sm text-gray-600 font-weight-500 text-center cursor-pointer"
              :class="{
                'bg-gray-200': selectedTime.value === time.value,
              }"
              :data-testid="`time-option-${time.value}`"
              @click="handleSelectTime(time.value)"
            >
              {{ time.label }}
            </div>
          </div>
          <div class="flex items-center justify-center px-2 pb-2 pt-1">
            <NcButton
              :tabindex="-1"
              class="!h-7"
              size="small"
              type="secondary"
              @click="handleSelectTime(dayjs().format('HH:mm'))"
            >
              <span class="text-small"> {{ $t('general.now') }} </span>
            </NcButton>
          </div>
        </template>
      </div>
    </template>
  </NcDropdown>
  <div v-if="!editable && isGrid" class="absolute inset-0 z-90 cursor-pointer"></div>
</template>

<style scoped>
:deep(.ant-picker-input > input) {
  @apply !text-current;
}
</style>
