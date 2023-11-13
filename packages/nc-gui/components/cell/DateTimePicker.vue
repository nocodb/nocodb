<script setup lang="ts">
import dayjs from 'dayjs'
import { isSystemColumn } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellClickHookInj,
  ColumnInj,
  EditColumnInj,
  ReadonlyInj,
  dateFormats,
  inject,
  isDrawerOrModalExist,
  parseProp,
  ref,
  timeFormats,
  useBase,
  useSelectedCellKeyupListener,
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

const { showNull } = useGlobal()

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isLockedMode = inject(IsLockedInj, ref(false))

const { t } = useI18n()

const isEditColumn = inject(EditColumnInj, ref(false))

const column = inject(ColumnInj)!

const isDateInvalid = ref(false)

const dateTimeFormat = computed(() => {
  const dateFormat = parseProp(column?.value?.meta)?.date_format ?? dateFormats[0]
  const timeFormat = parseProp(column?.value?.meta)?.time_format ?? timeFormats[0]
  return `${dateFormat} ${timeFormat}`
})

let localModelValue = modelValue ? dayjs(modelValue).utc().local() : undefined

const localState = computed({
  get() {
    if (!modelValue) {
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

const open = ref(false)

const isOpen = computed(() => {
  if (readOnly.value) return false

  return readOnly.value || (localState.value && isPk) || isLockedMode.value
    ? false
    : open.value && (active.value || editable.value)
})

const randomClass = `picker_${Math.floor(Math.random() * 99999)}`
watch(
  open,
  (next) => {
    if (next) {
      onClickOutside(document.querySelector(`.${randomClass}`)! as HTMLDivElement, () => (open.value = false))
    } else {
      editable.value = false
    }
  },
  { flush: 'post' },
)

const placeholder = computed(() => {
  if (isEditColumn.value && (modelValue === '' || modelValue === null)) {
    return t('labels.optional')
  } else if (modelValue === null && showNull.value) {
    return t('general.null')
  } else if (isDateInvalid.value) {
    return t('msg.invalidDate')
  } else {
    return ''
  }
})

useSelectedCellKeyupListener(active, (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      e.stopPropagation()
      // skip if drawer / modal is active
      if (isDrawerOrModalExist()) {
        return
      }
      if (!open.value) {
        // open date picker
        open.value = true
      } else {
        // click Ok button to save the currently selected date
        ;(document.querySelector('.nc-picker-datetime.active .ant-picker-ok button') as HTMLButtonElement)?.click()
      }
      break
    case 'Escape':
      // skip if drawer / modal is active
      if (isDrawerOrModalExist()) {
        return
      }
      if (open.value) {
        e.stopPropagation()
        open.value = false
      }
      break
    case 'ArrowLeft':
      if (!localState.value) {
        ;(document.querySelector('.nc-picker-datetime.active .ant-picker-header-prev-btn') as HTMLButtonElement)?.click()
      } else {
        const prevEl = document.querySelector('.nc-picker-datetime.active .ant-picker-cell-selected')
          ?.previousElementSibling as HTMLButtonElement
        if (prevEl) {
          prevEl.click()
        } else {
          // get the last td from previous tr
          const prevRowLastEl = document
            .querySelector('.nc-picker-datetime.active .ant-picker-cell-selected')
            ?.closest('tr')
            ?.previousElementSibling?.querySelector('td:last-child') as HTMLButtonElement
          if (prevRowLastEl) {
            prevRowLastEl.click()
          } else {
            // go to the previous month
            ;(document.querySelector('.nc-picker-datetime.active .ant-picker-header-prev-btn') as HTMLButtonElement)?.click()
          }
        }
      }
      break
    case 'ArrowRight':
      if (!localState.value) {
        ;(document.querySelector('.nc-picker-datetime.active .ant-picker-header-next-btn') as HTMLButtonElement)?.click()
      } else {
        const nextEl = document.querySelector('.nc-picker-datetime.active .ant-picker-cell-selected')
          ?.nextElementSibling as HTMLButtonElement
        if (nextEl) {
          nextEl.click()
        } else {
          // get the last td from previous tr
          const nextRowFirstEl = document
            .querySelector('.nc-picker-datetime.active .ant-picker-cell-selected')
            ?.closest('tr')
            ?.nextElementSibling?.querySelector('td:first-child') as HTMLButtonElement
          if (nextRowFirstEl) {
            nextRowFirstEl.click()
          } else {
            // go to the next month
            ;(document.querySelector('.nc-picker-datetime.active .ant-picker-header-next-btn') as HTMLButtonElement)?.click()
          }
        }
      }
      break
    case 'ArrowUp':
      if (!localState.value)
        (document.querySelector('.nc-picker-datetime.active .ant-picker-header-super-prev-btn') as HTMLButtonElement)?.click()
      break
    case 'ArrowDown':
      if (!localState.value)
        (document.querySelector('.nc-picker-datetime.active .ant-picker-header-super-next-btn') as HTMLButtonElement)?.click()
      break
    case ';':
      localState.value = dayjs(new Date())
      break
  }
})

const cellClickHook = inject(CellClickHookInj, null)
const cellClickHandler = () => {
  open.value = (active.value || editable.value) && !open.value
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

const isColDisabled = computed(() => {
  return isSystemColumn(column.value) || readOnly.value || (localState.value && isPk)
})
</script>

<template>
  <a-date-picker
    v-model:value="localState"
    :disabled="isColDisabled"
    :show-time="true"
    :bordered="false"
    class="!w-full !px-0 !py-1 !border-none"
    :class="{ 'nc-null': modelValue === null && showNull }"
    :format="dateTimeFormat"
    :placeholder="placeholder"
    :allow-clear="!readOnly && !localState && !isPk"
    :input-read-only="true"
    :dropdown-class-name="`${randomClass} nc-picker-datetime ${open ? 'active' : ''}`"
    :open="isOpen"
    @click="clickHandler"
    @ok="open = !open"
  >
    <template #suffixIcon></template>
  </a-date-picker>
</template>

<style scoped>
:deep(.ant-picker-input > input[disabled]) {
  @apply !text-current;
}
</style>
