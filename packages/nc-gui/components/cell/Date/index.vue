<script setup lang="ts">
import dayjs from 'dayjs'
import { isDateMonthFormat, isSystemColumn } from 'nocodb-sdk'

interface Props {
  modelValue?: string | null
  isPk?: boolean
  showCurrentDateOption?: boolean | 'disabled'
}

const { modelValue, isPk } = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'currentDate'])

const { t } = useI18n()

const { showNull } = useGlobal()

const columnMeta = inject(ColumnInj, null)!

const readOnly = inject(ReadonlyInj, ref(false))

const rawReadOnly = inject(RawReadonlyInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isDateInvalid = ref(false)

const datePickerRef = ref<HTMLInputElement>()

const dateFormat = computed(() => parseProp(columnMeta?.value?.meta)?.date_format ?? 'YYYY-MM-DD')

const picker = computed(() => (isDateMonthFormat(dateFormat.value) ? 'month' : ''))

const isClearedInputMode = ref<boolean>(false)

const open = ref<boolean>(false)

const tempDate = ref<dayjs.Dayjs | undefined>()

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

    const value = dayjs(/^\d+$/.test(modelValue) ? +modelValue : modelValue, format)

    return value
  },
  set(val?: dayjs.Dayjs) {
    isClearedInputMode.value = false

    saveChanges(val)

    open.value = false
  },
})

const savingValue = ref()

function saveChanges(val?: dayjs.Dayjs) {
  if (!val) {
    if (savingValue.value === val) {
      return
    }

    savingValue.value = null
    emit('update:modelValue', null)
    return
  }

  if (picker.value === 'month') {
    // reset day to 1st
    val = dayjs(val).date(1)
  }

  if (val.isValid()) {
    const formattedValue = val?.format('YYYY-MM-DD')

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

const handleUpdateValue = (e: Event, save = false, valueToSave?: dayjs.Dayjs) => {
  const targetValue = valueToSave || (e.target as HTMLInputElement).value
  if (!targetValue) {
    tempDate.value = undefined
    return
  }
  const value = dayjs(targetValue, dateFormat.value)

  if (value.isValid()) {
    tempDate.value = value

    if (save) {
      saveChanges(value)
    }
  }
}

const randomClass = `picker_${Math.floor(Math.random() * 99999)}`

onClickOutside(datePickerRef, (e) => {
  if ((e.target as HTMLElement)?.closest(`.${randomClass}, .nc-${randomClass}`)) return

  datePickerRef.value?.blur?.()
  open.value = false
})

const onBlur = (e) => {
  const value = (e?.target as HTMLInputElement)?.value

  if (value && dayjs(value).isValid()) {
    handleUpdateValue(e, true, dayjs(dayjs(value).format(dateFormat.value)))
  }

  if (
    (e?.relatedTarget as HTMLElement)?.closest(`.${randomClass}, .nc-${randomClass}`) ||
    (e?.target as HTMLElement)?.closest(`.${randomClass}, .nc-${randomClass}`)
  ) {
    return
  }

  open.value = false
}

const onFocus = () => {
  open.value = true
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
    (isGrid.value && !showNull.value && !isDateInvalid.value && !isSystemColumn(columnMeta.value) && active.value) ||
    isEditColumn.value
  ) {
    return dateFormat.value
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
  cellClickHook?.off(cellClickHandler)
})

const clickHandler = () => {
  if (cellClickHook) {
    return
  }
  cellClickHandler()
}

const handleKeydown = (e: KeyboardEvent, _open?: boolean) => {
  if (e.key !== 'Enter' && e.key !== 'Tab') {
    e.stopPropagation()
  }

  switch (e.key) {
    case 'Enter':
      e.preventDefault()
      if (isSurveyForm.value) {
        e.stopPropagation()
      }
      localState.value = tempDate.value
      open.value = !_open

      if (!open.value) {
        editable.value = false
        if (isGrid.value && !isExpandedForm.value && !isEditColumn.value) {
          datePickerRef.value?.blur?.()
        }
      }
      return
    case 'Escape':
      if (_open) {
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
        datePickerRef.value?.blur?.()
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

  if (e.altKey || e.shiftKey || !isGrid.value || isExpandedForm.value || isEditColumn.value || isExpandedFormOpenExist()) {
    return
  }

  if (e.metaKey || e.ctrlKey) {
    if (e.key === ';') {
      if (isGrid.value && !isExpandedForm.value && !isEditColumn.value) {
        localState.value = dayjs(new Date())
        e.preventDefault()
      }
    } else return
  }

  if (!isOpen.value && datePickerRef.value && /^[0-9a-z]$/i.test(e.key)) {
    isClearedInputMode.value = true
    datePickerRef.value.focus()
    editable.value = true
    open.value = true
  }
})

function handleSelectDate(value?: dayjs.Dayjs) {
  tempDate.value = value
  localState.value = value
  open.value = false
}

const currentDate = ($event) => {
  emit('currentDate', $event)
  open.value = false
}
</script>

<template>
  <NcDropdown
    :visible="isOpen"
    :auto-close="false"
    :trigger="['click']"
    class="nc-cell-field"
    :class="[`nc-${randomClass}`, { 'nc-null': modelValue === null && showNull }]"
    :overlay-class-name="`${randomClass} nc-picker-date ${open ? 'active' : ''} !min-w-[260px]`"
  >
    <div
      v-bind="$attrs"
      :title="localState?.format(dateFormat)"
      class="nc-date-picker h-full flex items-center justify-between ant-picker-input relative"
    >
      <input
        v-if="!rawReadOnly"
        ref="datePickerRef"
        type="text"
        :value="localState?.format(dateFormat) ?? ''"
        :placeholder="placeholder"
        class="nc-date-input border-none outline-none !text-current bg-transparent !focus:(border-none outline-none ring-transparent)"
        :readonly="readOnly"
        @blur="onBlur"
        @focus="onFocus"
        @keydown="handleKeydown($event, open)"
        @mouseup.stop
        @mousedown.stop
        @click="clickHandler"
        @input="handleUpdateValue"
      />
      <span v-else>
        {{ localState?.format(dateFormat) ?? '' }}
      </span>

      <GeneralIcon
        v-if="localState && !readOnly"
        icon="closeCircle"
        class="nc-clear-date-icon nc-action-icon absolute right-0 top-[50%] transform -translate-y-1/2 invisible cursor-pointer"
        @click.stop="handleSelectDate()"
      />
    </div>

    <template #overlay>
      <div class="w-[256px]">
        <NcDatePicker
          v-if="picker === 'month'"
          v-model:page-date="tempDate"
          v-model:selected-date="localState"
          :is-open="isOpen"
          type="month"
          size="medium"
          :show-current-date-option="showCurrentDateOption"
          @current-date="currentDate"
        />
        <NcDatePicker
          v-else
          v-model:page-date="tempDate"
          :is-open="isOpen"
          :selected-date="localState"
          type="date"
          size="medium"
          :show-current-date-option="showCurrentDateOption"
          @update:selected-date="handleSelectDate"
          @current-date="currentDate"
        />
      </div>
    </template>
  </NcDropdown>
  <div v-if="!active && isGrid" class="absolute inset-0 z-90 cursor-pointer"></div>
</template>

<style scoped lang="scss">
.nc-cell-field {
  &:hover .nc-clear-date-icon {
    @apply visible;
  }
}
</style>
