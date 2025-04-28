<script setup lang="ts">
import dayjs from 'dayjs'
import { dateFormats, isSystemColumn, timeFormats } from 'nocodb-sdk'
import { timeCellMaxWidthMap, timeFormatsObj } from './utils'
const { modelValue, isPk, isUpdatedFromCopyNPaste } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'currentDate'])

interface Props {
  modelValue?: string | null
  isPk?: boolean
  showCurrentDateOption?: boolean | 'disabled'
  isUpdatedFromCopyNPaste?: Record<string, boolean>
}

const { isXcdbBase } = useBase()

const { showNull } = useGlobal()

const readOnly = inject(ReadonlyInj, ref(false))

const rawReadOnly = inject(RawReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isUnderLookup = inject(IsUnderLookupInj, ref(false))
const canvasSelectCell = inject(CanvasSelectCellInj, null)

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))
const canvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const { t } = useI18n()

const isEditColumn = inject(EditColumnInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const column = inject(ColumnInj)!

const isDateInvalid = ref(false)

const datePickerRef = ref<HTMLInputElement>()

const timePickerRef = ref<HTMLInputElement>()

const { width: timePickerWidth } = useElementBounding(timePickerRef)

const dateTimeFormat = computed(() => {
  const dateFormat = parseProp(column?.value?.meta)?.date_format ?? dateFormats[0]
  const timeFormat = parseProp(column?.value?.meta)?.time_format ?? timeFormats[0]
  return `${dateFormat} ${timeFormat}`
})

const dateFormat = computed(() => parseProp(column?.value?.meta)?.date_format ?? dateFormats[0])
const timeFormat = computed(() => parseProp(column?.value?.meta)?.time_format ?? timeFormats[0])

const { dayjsTz, timezonize: timezonizeDayjs } = withTimezone(column.value?.meta?.timezone)

let localModelValue = modelValue ? timezonizeDayjs(dayjs(modelValue)) : undefined

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
      localModelValue = timezonizeDayjs(dayjs(modelValue))
      return localModelValue
    }

    // ext db
    if (!isXcDB) {
      return /^\d+$/.test(modelValue) ? timezonizeDayjs(dayjs(+modelValue)) : timezonizeDayjs(dayjs(modelValue))
    }

    // if cdf is defined, that means the value is auto-generated
    // hence, show the local time
    if (column?.value?.cdf) {
      return timezonizeDayjs(dayjs(modelValue))
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
    return timezonizeDayjs(dayjs(modelValue))
  },
  set(val?: dayjs.Dayjs) {
    isClearedInputMode.value = false

    saveChanges(val)
  },
})

const timeZoneDisplay = computed(() => {
  if (!isEeUI) {
    return undefined
  }
  if (!localState.value) {
    return undefined
  }
  if ((column.value.meta as any)?.isDisplayTimezone) {
    return getTimeZoneFromName((column.value.meta as any)?.timezone)?.abbreviation
  }

  return undefined
})

const savingValue = ref()

function saveChanges(val?: dayjs.Dayjs, saveOnChange = false) {
  if (!val) {
    if (savingValue.value === null) {
      return
    }

    savingValue.value = null
    emit('update:modelValue', null)

    return
  }

  if (saveOnChange && localState.value?.isSame(val)) {
    return
  }

  if (val.isValid()) {
    // setting localModelValue to cater NOW function in date picker
    localModelValue = dayjsTz(val)
    // send the payload in UTC format

    const formattedValue = dayjsTz(val).utc().format('YYYY-MM-DD HH:mm:ssZ')

    if (savingValue.value === formattedValue) {
      return
    }

    savingValue.value = formattedValue
    emit('update:modelValue', formattedValue)
  }
}

watchEffect(() => {
  if (localState.value) {
    tempDate.value = localState.value
  }
})

const isColDisabled = computed(() => {
  return isSystemColumn(column.value) || readOnly.value || (localState.value && isPk)
})

const isOpen = computed(() => {
  if (readOnly.value || isColDisabled.value) return false

  return readOnly.value || (localState.value && isPk) ? false : open.value && (active.value || editable.value)
})

const handleUpdateValue = (e: Event, _isDatePicker: boolean, save = false) => {
  let targetValue = (e.target as HTMLInputElement).value

  if (_isDatePicker) {
    if (!targetValue) {
      tempDate.value = undefined
      return
    }

    if (dayjs(targetValue, dateFormat.value).isValid()) {
      const date = dayjsTz(targetValue, dateFormat.value)

      if (localState.value) {
        tempDate.value = dayjsTz(`${date.format('YYYY-MM-DD')} ${localState.value.format(timeFormat.value)}`)
      } else {
        tempDate.value = date
      }

      if (save) {
        saveChanges(tempDate.value, true)
      }
    }
  }

  if (!_isDatePicker) {
    if (!targetValue) {
      tempDate.value = dayjsTz(dayjsTz().format('YYYY-MM-DD'))
      return
    }

    targetValue = parseProp(column.value.meta).is12hrFormat
      ? targetValue
          .trim()
          .toUpperCase()
          .replace(/(AM|PM)$/, ' $1')
          .replace(/\s+/g, ' ')
      : targetValue.trim()

    const parsedDateValue = dayjs(
      targetValue,
      parseProp(column.value.meta).is12hrFormat ? timeFormatsObj[timeFormat.value] : timeFormat.value,
    )

    if (parsedDateValue.isValid()) {
      const parsedDate = dayjsTz(
        targetValue,
        parseProp(column.value.meta).is12hrFormat ? timeFormatsObj[timeFormat.value] : timeFormat.value,
      )

      tempDate.value = dayjsTz(`${(tempDate.value ?? dayjsTz()).format('YYYY-MM-DD')} ${parsedDate.format(timeFormat.value)}`)

      if (save) {
        saveChanges(tempDate.value, true)
      }
    }
  }
}

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

const onBlur = (e: Event, _isDatePicker: boolean) => {
  handleUpdateValue(e, _isDatePicker, true)
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
    (isGrid.value && !showNull.value && !isDateInvalid.value && !isSystemColumn(column.value) && active.value) ||
    isEditColumn.value
  ) {
    return {
      dateTime: dateTimeFormat.value,
      date: dateFormat.value,
      time: parseProp(column.value.meta).is12hrFormat ? `${timeFormat.value} AM` : timeFormat.value,
    }
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
onUnmounted(() => {
  cellClickHook?.off(cellClickHandler)
})

const clickHandler = (e: MouseEvent, _isDatePicker = false) => {
  isDatePicker.value = _isDatePicker

  if (cellClickHook) {
    return
  }
  cellClickHandler()
}

const handleKeydown = (e: KeyboardEvent, _open?: boolean, _isDatePicker = false) => {
  if (e.key !== 'Enter') {
    e.stopPropagation()
  }

  switch (e.key) {
    case 'Enter':
      e.preventDefault()
      if (isSurveyForm.value) {
        e.stopPropagation()
      }

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
      if (canvasSelectCell) {
        canvasSelectCell.trigger()
        return
      }
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
      if (isGrid.value && !isExpandedForm.value && !isEditColumn.value) {
        _isDatePicker ? datePickerRef.value?.blur?.() : timePickerRef.value?.blur?.()

        if (e.shiftKey && _isDatePicker) {
          editable.value = false
        } else if (!e.shiftKey && !_isDatePicker) {
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

useSelectedCellKeydownListener(
  active,
  (e) => {
    if (e.altKey || e.shiftKey) {
      return
    }

    if (e.metaKey || e.ctrlKey) {
      if (e.key === ';') {
        if (isGrid.value && !isExpandedForm.value && !isEditColumn.value) {
          localState.value = dayjsTz(new Date())
          e.preventDefault()
        }
      } else return
    }

    if (!isOpen.value && (datePickerRef.value || timePickerRef.value) && /^[0-9a-z]$/i.test(e.key)) {
      isClearedInputMode.value = true
      isDatePicker.value ? datePickerRef.value?.focus() : timePickerRef.value?.focus()
      editable.value = true
      open.value = true
    }
  },
  {
    immediate: true,
    isGridCell: true,
  },
)

watch(editable, (nextValue) => {
  if (isGrid.value && nextValue && !open.value) {
    isDatePicker.value = true
    open.value = true
  }
})

function handleSelectDate(value?: dayjs.Dayjs) {
  if (value && localState.value) {
    const dateTime = dayjsTz(`${value.format('YYYY-MM-DD')} ${localState.value.format(timeFormat.value)}`)
    tempDate.value = dateTime
    localState.value = dateTime
  } else {
    tempDate.value = value
    localState.value = value
  }
  open.value = false
}

function handleSelectTime(value: dayjs.Dayjs) {
  if (!value.isValid()) return

  if (localState.value) {
    const dateTime = dayjsTz(`${localState.value.format('YYYY-MM-DD')} ${value.format('HH:mm')}:00`)
    tempDate.value = dateTime
    localState.value = dateTime
  } else {
    const dateTime = dayjsTz(`${dayjsTz().format('YYYY-MM-DD')} ${value.format('HH:mm')}:00`)
    tempDate.value = dateTime
    localState.value = dateTime
  }

  open.value = false
}

const timeCellMaxWidth = computed(() => {
  return timeCellMaxWidthMap?.[timeFormat.value]?.[parseProp(column.value.meta).is12hrFormat ? 12 : 24]
})

const cellValue = computed(
  () =>
    localState.value?.format(parseProp(column.value.meta).is12hrFormat ? timeFormatsObj[timeFormat.value] : timeFormat.value) ??
    '',
)

const currentDate = ($event) => {
  open.value = false
  emit('currentDate', $event)
}

onMounted(() => {
  if (isGrid.value && isCanvasInjected && !isExpandedForm.value && !isEditColumn.value && !isUnderLookup.value) {
    isDatePicker.value = true
    open.value = true
    forcedNextTick(() => {
      const key = canvasCellEventData.keyboardKey
      if (key && isSinglePrintableKey(key) && datePickerRef.value) {
        datePickerRef.value.value = key
      }
      isDatePicker.value = true
      open.value = true
    })
  }
  cellClickHook?.on(cellClickHandler)
})

const minimizeMaxWidth = computed(() => {
  return isExpandedForm.value || isForm.value || !isGrid.value || isEditColumn.value
})
</script>

<template>
  <div v-bind="$attrs" class="nc-cell-field relative flex items-center gap-2">
    <NcDropdown
      :visible="isOpen"
      :placement="isDatePicker ? 'bottomLeft' : 'bottomRight'"
      :auto-close="false"
      :trigger="['click']"
      class="nc-cell-picker-datetime"
      :class="[`nc-${randomClass}`, { 'nc-null': modelValue === null && showNull }]"
      :overlay-class-name="`${randomClass} nc-picker-datetime ${open ? 'active' : ''} !min-w-[0] overflow-hidden`"
    >
      <div
        :title="localState?.format(dateTimeFormat)"
        class="nc-date-picker ant-picker-input flex items-center relative gap-2 !truncate !w-auto"
        :class="{
          'max-w-[calc(100%_-_70px)]': minimizeMaxWidth,
        }"
      >
        <div
          class="flex rounded-md box-border w-[60%] max-w-[110px]"
          :class="{
            'py-0': isForm,
            'py-0.5': !isForm && !isColDisabled,
            'px-1': !isColDisabled,
          }"
        >
          <input
            v-if="!rawReadOnly"
            ref="datePickerRef"
            :value="localState?.format(dateFormat) ?? ''"
            :placeholder="typeof placeholder === 'string' ? placeholder : placeholder?.date"
            class="nc-date-input w-full !truncate border-transparent outline-none !text-current !bg-transparent !focus:(border-none ring-transparent)"
            :readonly="isColDisabled"
            @focus="onFocus(true)"
            @blur="onBlur($event, true)"
            @keydown="handleKeydown($event, isOpen, true)"
            @mouseup.stop
            @mousedown.stop
            @click.stop="clickHandler($event, true)"
            @input="handleUpdateValue($event, true)"
          />
          <template v-else>
            {{ localState?.format(dateFormat) ?? '' }}
          </template>
        </div>
        <div
          class="rounded-md box-border"
          :class="[
            `${timeCellMaxWidth}`,
            {
              'py-0': isForm,
              'py-0.5': !isForm && !isColDisabled,
              'px-1': !isColDisabled,
            },
          ]"
        >
          <input
            v-if="!rawReadOnly"
            ref="timePickerRef"
            :value="cellValue"
            :placeholder="typeof placeholder === 'string' ? placeholder : placeholder?.time"
            class="nc-time-input w-full !truncate border-transparent outline-none !text-current !bg-transparent !focus:(border-none ring-transparent)"
            :readonly="isColDisabled"
            @focus="onFocus(false)"
            @blur="onBlur($event, false)"
            @keydown="handleKeydown($event, open)"
            @mouseup.stop
            @mousedown.stop
            @click.stop="clickHandler($event, false)"
            @input="handleUpdateValue($event, false)"
          />
          <template v-else>
            {{ cellValue }}
          </template>
        </div>
      </div>

      <template #overlay>
        <div
          class="min-w-[120px]"
          :style="{
            width: isDatePicker ? '256px' : `${timePickerWidth + 8}px`,
          }"
        >
          <NcDatePicker
            v-if="isDatePicker"
            v-model:page-date="tempDate"
            :selected-date="localState"
            :is-open="isOpen"
            type="date"
            size="medium"
            :timezone="column?.meta?.timezone"
            :show-current-date-option="showCurrentDateOption"
            @update:selected-date="handleSelectDate"
            @current-date="currentDate"
          />

          <template v-else>
            <NcTimeSelector
              :selected-date="localState"
              :min-granularity="30"
              is-min-granularity-picker
              :is12hr-format="!!parseProp(column.meta).is12hrFormat"
              :is-open="isOpen"
              :show-current-date-option="showCurrentDateOption"
              :timezone="column?.meta?.timezone"
              @update:selected-date="handleSelectTime"
              @current-date="currentDate"
            />
          </template>
        </div>
      </template>
    </NcDropdown>

    <div
      v-if="timeZoneDisplay"
      class="nc-timezone-field text-nc-content-gray-muted whitespace-nowrap text-tiny transition-all duration-300 text-right flex-1"
      :class="{
        'nc-flex-1': minimizeMaxWidth,
      }"
    >
      {{ timeZoneDisplay }}
    </div>

    <GeneralIcon
      v-if="localState && minimizeMaxWidth && !readOnly"
      icon="closeCircle"
      class="nc-clear-date-time-icon nc-action-icon h-4 w-4 absolute right-0 top-[50%] transform -translate-y-1/2 invisible cursor-pointer"
      @click.stop="handleSelectDate()"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-cell-field {
  &:hover {
    .nc-clear-date-time-icon {
      @apply visible;
    }
    &:has(.nc-clear-date-time-icon) .nc-timezone-field {
      @apply pr-5;
    }
  }
}
</style>
