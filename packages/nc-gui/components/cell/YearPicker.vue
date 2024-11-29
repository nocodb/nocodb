<script setup lang="ts">
import dayjs from 'dayjs'
import { isSystemColumn } from 'nocodb-sdk'

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

watchEffect(() => {
  if (localState.value) {
    tempDate.value = localState.value
  }
})

const randomClass = `picker_${Math.floor(Math.random() * 99999)}`

onClickOutside(datePickerRef, (e) => {
  if ((e.target as HTMLElement)?.closest(`.${randomClass}, .nc-${randomClass}`)) return
  datePickerRef.value?.blur?.()
  open.value = false
})

const onBlur = (e) => {
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

watch(editable, (nextValue) => {
  if (isGrid.value && nextValue && !open.value) {
    open.value = true
  }
})

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
  if (readOnly.value) return false
  return (readOnly.value || (localState.value && isPk)) && !active.value && !editable.value ? false : open.value
})

const clickHandler = () => {
  if (readOnly.value || open.value) return
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

const handleUpdateValue = (e: Event) => {
  const targetValue = (e.target as HTMLInputElement).value
  if (!targetValue) {
    tempDate.value = undefined
    return
  }
  const value = dayjs(targetValue, 'YYYY')

  if (value.isValid()) {
    tempDate.value = value
  }
}

function handleSelectDate(value?: dayjs.Dayjs) {
  tempDate.value = value
  localState.value = value
  open.value = false
}
</script>

<template>
  <NcDropdown
    :visible="isOpen"
    :auto-close="false"
    :trigger="['click']"
    :disabled="readOnly"
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
        ref="datePickerRef"
        type="text"
        :value="localState?.format('YYYY') ?? ''"
        :placeholder="placeholder"
        class="nc-year-input border-none outline-none !text-current bg-transparent !focus:(border-none outline-none ring-transparent)"
        :readonly="readOnly || !!isMobileMode"
        @blur="onBlur"
        @keydown="handleKeydown($event, open)"
        @mouseup.stop
        @mousedown.stop
        @click="clickHandler"
        @input="handleUpdateValue"
      />

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
  <div v-if="!editable && isGrid" class="absolute inset-0 z-90 cursor-pointer"></div>
</template>

<style scoped>
.nc-cell-field {
  &:hover .nc-clear-year-icon {
    @apply visible;
  }
}
</style>
