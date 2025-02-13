<script setup lang="ts">
import { dateFormats, timeFormats } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { timeCellMaxWidthMap, timeFormatsObj } from './utils'

interface Props {
  modelValue?: string | null
  isUpdatedFromCopyNPaste?: Record<string, boolean>
}

const { modelValue, isUpdatedFromCopyNPaste } = defineProps<Props>()

const column = inject(ColumnInj)!

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const { isXcdbBase } = useBase()

const dateFormat = computed(() => parseProp(column?.value?.meta)?.date_format ?? dateFormats[0])
const timeFormat = computed(() => parseProp(column?.value?.meta)?.time_format ?? timeFormats[0])

const dateTimeFormat = computed(() => {
  return `${dateFormat.value} ${timeFormat.value}`
})

const localState = computed(() => {
  if (!modelValue) {
    return undefined
  }

  if (!dayjs(modelValue).isValid()) {
    return undefined
  }

  const isXcDB = isXcdbBase(column.value.source_id)

  // cater copy and paste
  // when copying a datetime cell, the copied value would be local time
  // when pasting a datetime cell, UTC (xcdb) will be saved in DB
  // we convert back to local time
  if (column.value.title! in (isUpdatedFromCopyNPaste ?? {})) {
    return dayjs(modelValue).utc().local()
  }

  // ext db
  if (!isXcDB) {
    return /^\d+$/.test(modelValue) ? dayjs(+modelValue) : dayjs(modelValue)
  }

  return dayjs(modelValue).utc().local()
})

const cellValue = computed(
  () =>
    localState.value?.format(parseProp(column.value.meta).is12hrFormat ? timeFormatsObj[timeFormat.value] : timeFormat.value) ??
    '',
)

const timeCellMaxWidth = computed(() => {
  return timeCellMaxWidthMap?.[timeFormat.value]?.[parseProp(column.value.meta).is12hrFormat ? 12 : 24]
})
</script>

<template>
  <div
    :title="localState?.format(dateTimeFormat)"
    class="nc-date-picker w-full flex nc-cell-field relative gap-2 nc-cell-picker-datetime tracking-tight"
  >
    <div
      class="flex-none rounded-md box-border py-0.5 px-1 truncate"
      :class="{
        'w-[fit-content]': isUnderLookup,
        'w-[60%] max-w-[110px]': !isUnderLookup,
      }"
    >
      {{ localState?.format(dateFormat) ?? '' }}
    </div>

    <div :class="timeCellMaxWidth" class="flex-1 rounded-md box-border py-0.5 px-1 truncate">
      {{ cellValue }}
    </div>
  </div>
</template>
