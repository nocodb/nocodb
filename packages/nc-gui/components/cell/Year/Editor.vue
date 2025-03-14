<script setup lang="ts">
import dayjs from 'dayjs'
import { isSystemColumn } from 'nocodb-sdk'

interface Props {
  modelValue?: number | string | null
  isPk?: boolean
}

const { modelValue, isPk = false } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const canvasSelectCell = inject(CanvasSelectCellInj, null)

const { showNull } = useGlobal()

const column = inject(ColumnInj, null)!

const readOnly = inject(ReadonlyInj, ref(false))

const rawReadOnly = inject(RawReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(true))

const editable = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isYearInvalid = ref(false)

const datePickerRef = ref<HTMLInputElement>()

const isClearedInputMode = ref<boolean>(false)

const { t } = useI18n()

const open = ref<boolean>(false)

const tempDate = ref<dayjs.Dayjs | undefined>()

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

  if (val?.isValid()) {
    const formattedValue = val.format('YYYY')

    if (savingValue.value === formattedValue) {
      return
    }

    savingValue.value = formattedValue

    emit('update:modelValue', val.format('YYYY'))
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
  const value = dayjs(targetValue, 'YYYY')

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

  if (value && dayjs(value, 'YYYY').isValid()) {
    handleUpdateValue(e, true, dayjs(dayjs(value).format('YYYY')))
  }

  if (
    (e?.relatedTarget as HTMLElement)?.closest(`.${randomClass}, .nc-${randomClass}`) ||
    (e?.target as HTMLElement)?.closest(`.${randomClass}, .nc-${randomClass}`)
  ) {
    return
  }

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
    ((isForm.value || isExpandedForm.value) && !isYearInvalid.value) ||
    (isGrid.value && !showNull.value && !isYearInvalid.value && !isSystemColumn(column.value) && active.value) ||
    isEditColumn.value
  ) {
    return 'YYYY'
  } else if (modelValue === null && showNull.value) {
    return t('general.null').toUpperCase()
  } else if (isYearInvalid.value) {
    return t('msg.invalidTime')
  } else {
    return ''
  }
})

const isOpen = computed(() => {
  return localState.value && isPk && !active.value && !editable.value ? false : open.value
})

const clickHandler = () => {
  if (open.value) return
  open.value = active.value || editable.value
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

    case 'Tab':
      open.value = false

      if (isGrid.value) {
        editable.value = false
        datePickerRef.value?.blur?.()
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
          datePickerRef.value?.blur?.()
        }
      } else {
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

useSelectedCellKeydownListener(
  active,
  (e) => {
    if (e.altKey || e.shiftKey) {
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
  },
  {
    immediate: true,
    isGridCell: true,
  },
)

function handleSelectDate(value?: dayjs.Dayjs) {
  tempDate.value = value
  localState.value = value
  open.value = false
}
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isUnderLookup = inject(IsUnderLookupInj, ref(false))
const canvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))
onMounted(() => {
  if (isGrid.value && isCanvasInjected && !isExpandedForm.value && !isEditColumn.value && !isUnderLookup.value) {
    open.value = true
    forcedNextTick(() => {
      open.value = true
      const key = canvasCellEventData.keyboardKey
      if (key && isSinglePrintableKey(key) && datePickerRef.value) {
        datePickerRef.value.value = key
      }
    })
  }
})
</script>

<template>
  <NcDropdown
    :visible="isOpen"
    :auto-close="false"
    :trigger="['click']"
    class="nc-cell-field"
    :class="[`nc-${randomClass}`, { 'nc-null': modelValue === null && showNull }]"
    :overlay-class-name="`${randomClass} nc-picker-year ${open ? 'active' : ''} !min-w-[260px]`"
  >
    <div
      v-bind="$attrs"
      :title="localState?.format('YYYY')"
      class="nc-year-picker flex items-center justify-between ant-picker-input relative"
    >
      <input
        v-if="!rawReadOnly"
        ref="datePickerRef"
        type="text"
        :value="localState?.format('YYYY') ?? ''"
        :placeholder="placeholder"
        class="nc-year-input border-none outline-none !text-current bg-transparent !focus:(border-none outline-none ring-transparent)"
        :readonly="readOnly"
        @blur="onBlur"
        @keydown="handleKeydown($event, open)"
        @mouseup.stop
        @mousedown.stop
        @click="clickHandler"
        @input="handleUpdateValue"
      />
      <span v-else>
        {{ localState?.format('YYYY') ?? '' }}
      </span>

      <GeneralIcon
        v-if="localState && !readOnly"
        icon="closeCircle"
        class="nc-clear-year-icon nc-action-icon absolute right-0 top-[50%] transform -translate-y-1/2 invisible cursor-pointer"
        @click.stop="handleSelectDate()"
      />
    </div>

    <template #overlay>
      <div class="w-[256px]">
        <NcMonthYearSelector
          v-model:page-date="tempDate"
          v-model:selected-date="localState"
          :is-open="isOpen"
          is-year-picker
          is-cell-input-field
          size="medium"
        />
      </div>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss">
.nc-cell-field {
  &:hover .nc-clear-year-icon {
    @apply visible;
  }
}
</style>
