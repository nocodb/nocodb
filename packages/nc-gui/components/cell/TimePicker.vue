<script setup lang="ts">
import dayjs from 'dayjs'
import { isSystemColumn } from 'nocodb-sdk'
import { ActiveCellInj, EditColumnInj, IsFormInj, ReadonlyInj, inject, onClickOutside, useBase, watch } from '#imports'

interface Props {
  modelValue?: string | null | undefined
  isPk?: boolean
}

const { modelValue, isPk } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useBase()

const { showNull, isMobileMode } = useGlobal()

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const column = inject(ColumnInj)!

const dateFormat = isMysql(column.value.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

const isTimeInvalid = ref(false)

const datePickerRef = ref<HTMLInputElement>()

const isClearedInputMode = ref<boolean>(false)

const { t } = useI18n()

const open = ref(false)

const localState = computed({
  get() {
    if (!modelValue || isClearedInputMode.value) {
      return undefined
    }
    let dateTime = dayjs(modelValue)

    if (!dateTime.isValid()) {
      dateTime = dayjs(modelValue, 'HH:mm:ss')
    }
    if (!dateTime.isValid()) {
      dateTime = dayjs(`1999-01-01 ${modelValue}`)
    }
    if (!dateTime.isValid()) {
      isTimeInvalid.value = true
      return undefined
    }

    return dateTime
  },
  set(val?: dayjs.Dayjs) {
    isClearedInputMode.value = false
    if (!val) {
      emit('update:modelValue', null)
      return
    }

    if (val.isValid()) {
      const time = val.format('HH:mm')
      const date = dayjs(`1999-01-01 ${time}:00`)
      emit('update:modelValue', date.format(dateFormat))
    }
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
    ((isForm.value || isExpandedForm.value) && !isTimeInvalid.value) ||
    (isGrid.value && !showNull.value && !isTimeInvalid.value && !isSystemColumn(column.value) && active.value)
  ) {
    return 'HH:mm'
  } else if (isEditColumn.value && (modelValue === '' || modelValue === null)) {
    return t('labels.optional')
  } else if (modelValue === null && showNull.value) {
    return t('general.null').toUpperCase()
  } else if (isTimeInvalid.value) {
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
  <a-time-picker
    ref="datePickerRef"
    v-model:value="localState"
    :tabindex="0"
    :disabled="readOnly"
    :show-time="true"
    :bordered="false"
    use12-hours
    format="HH:mm"
    class="nc-cell-field !w-full !py-1 !border-none !text-current"
    :class="[`nc-${randomClass}`, { 'nc-null': modelValue === null && showNull }]"
    :placeholder="placeholder"
    :allow-clear="!readOnly && !isPk && !isEditColumn"
    :input-read-only="!!isMobileMode"
    :open="isOpen"
    :popup-class-name="`${randomClass} nc-picker-time children:border-1 children:border-gray-200 ${open ? 'active' : ''}`"
    @blur="onBlur"
    @keydown="handleKeydown"
    @click="clickHandler"
    @ok="open = !open"
    @mouseup.stop
    @mousedown.stop
  >
    <template #suffixIcon></template>
  </a-time-picker>
  <div v-if="!editable && isGrid" class="absolute inset-0 z-90 cursor-pointer"></div>
</template>

<style scoped>
:deep(.ant-picker-input > input) {
  @apply !text-current;
}
</style>
