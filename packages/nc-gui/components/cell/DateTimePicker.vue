<script setup lang="ts">
import dayjs from 'dayjs'
import type { VNodeRef } from '@vue/runtime-core'

import { dateFormats, isSystemColumn, timeFormats } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellClickHookInj,
  ColumnInj,
  EditColumnInj,
  IsFormInj,
  IsSurveyFormInj,
  ReadonlyInj,
  inject,
  isDrawerOrModalExist,
  parseProp,
  ref,
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

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const { t } = useI18n()

const isEditColumn = inject(EditColumnInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const column = inject(ColumnInj)!

const isDateInvalid = ref(false)

const focus: VNodeRef = (el) => !isEditColumn.value && !isForm.value && editable.value && (el as HTMLInputElement)?.focus()

const dateTimeFormat = computed(() => {
  const dateFormat = parseProp(column?.value?.meta)?.date_format ?? dateFormats[0]
  const timeFormat = parseProp(column?.value?.meta)?.time_format ?? timeFormats[0]
  return `${dateFormat} ${timeFormat}`
})

let localModelValue = modelValue ? dayjs(modelValue).utc().local() : undefined

const tempLocalValue = ref<dayjs.Dayjs>()

const localState = computed({
  get() {
    if (!modelValue && tempLocalValue.value) {
      return tempLocalValue.value
    }
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

  return readOnly.value || (localState.value && isPk) ? false : (open.value && (active.value || editable.value)) || editable.value
})

const randomClass = `picker_${Math.floor(Math.random() * 99999)}`

watch(
  open,
  (next) => {
    if (next) {
      editable.value = true
      console.log('reset')
      // onClickOutside(document.querySelector(`.${randomClass}`)! as HTMLDivElement, () => (open.value = false))

      if (!modelValue) {
        tempLocalValue.value = dayjs(new Date()).utc().local()
      } else {
        // tempLocalValue.value = undefined
      }
    } else {
      editable.value = false
      // tempLocalValue.value = undefined
    }
    console.log('tempLocalValue', tempLocalValue.value)
  },
  { flush: 'post' },
)

const placeholder = computed(() => {
  console.log('editable.value', editable.value)
  if (
    (isForm.value && !isDateInvalid.value) ||
    (!isForm.value && !showNull.value && !isDateInvalid.value && !isSystemColumn(column.value) && active.value)
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
  if (readOnly.value) return
  open.value = (active.value || editable.value) && true
}

function okHandler(val: dayjs.Dayjs | string) {
  if (!val) {
    emit('update:modelValue', null)
    return
  }

  if (dayjs(val).isValid()) {
    // setting localModelValue to cater NOW function in date picker
    localModelValue = dayjs(val)
    // send the payload in UTC format
    emit('update:modelValue', dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ'))
  }

  open.value = !open.value
}
onMounted(() => {
  cellClickHook?.on(cellClickHandler)
})
onUnmounted(() => {
  cellClickHook?.on(cellClickHandler)
})

const clickHandler = () => {
  console.log('click')
  if (cellClickHook) {
    return
  }
  cellClickHandler()
}

const isColDisabled = computed(() => {
  return isSystemColumn(column.value) || readOnly.value || (localState.value && isPk)
})

const handleKeydown = (e: KeyboardEvent) => {
  e.stopPropagation()
  console.log(
    '!readOnly && !localState && !isPk',
    !readOnly.value && localState.value && !isPk,
    !readOnly.value,
    !localState.value,
    !isPk,
  )
  switch (e.key) {
    case ' ':
      if (isSurveyForm.value) {
        open.value = !open.value
      }
      break

    case 'Enter':
      console.log('enter', localState.value, (e.target as HTMLInputElement).value)

      if (open.value) {
        okHandler((e.target as HTMLInputElement).value)
        break
      }
      if (!isSurveyForm.value) {
        open.value = !open.value
      }
      break
    case 'Escape':
      console.log('on escape')
      if (open.value) {
        open.value = false
        if (isGrid.value) {
          editable.value = false
        }
      }
      break

    case 'Delete':
    case 'Backspace':
      e.stopPropagation()
      break
    default:
      e.stopPropagation()
  }
}
</script>

<template>
  <a-date-picker
    :ref="focus"
    :value="localState"
    :disabled="isColDisabled"
    :show-time="true"
    :bordered="false"
    class="nc-cell-field !w-full !py-1 !border-none !text-current"
    :class="{ 'nc-null': modelValue === null && showNull }"
    :format="dateTimeFormat"
    :placeholder="placeholder"
    :allow-clear="isForm || (!readOnly && localState && !isPk)"
    :input-read-only="false"
    :dropdown-class-name="`${randomClass} nc-picker-datetime children:border-1 children:border-gray-200 ${open ? 'active' : ''}`"
    :open="isOpen"
    @click="clickHandler"
    @ok="okHandler"
    @keydown="handleKeydown"
  >
    <template #suffixIcon></template>
  </a-date-picker>
  <div v-if="!editable" class="absolute inset-0 z-90 cursor-pointer"></div>
</template>

<style scoped>
:deep(.ant-picker-input > input) {
  @apply !text-current;
}
</style>
