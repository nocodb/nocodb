<script setup lang="ts">
import { dateFormats, timeFormats } from 'nocodb-sdk'
import dayjs from 'dayjs'

interface Props {
  modelValue?: string | null
}

const { modelValue } = defineProps<Props>()

const column = inject(ColumnInj)!

const timeFormatsObj = {
  [timeFormats[0]]: 'hh:mm A',
  [timeFormats[1]]: 'hh:mm:ss A',
  [timeFormats[2]]: 'hh:mm:ss.SSS A',
}

const { isXcdbBase } = useBase()

const dateFormat = computed(() => parseProp(column?.value?.meta)?.date_format ?? dateFormats[0])
const timeFormat = computed(() => parseProp(column?.value?.meta)?.time_format ?? timeFormats[0])

const localState = computed(() => {
  if (!modelValue) {
    return undefined
  }

  if (!dayjs(modelValue).isValid()) {
    return undefined
  }

  const isXcDB = isXcdbBase(column.value.source_id)

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
  return {
    [timeFormats[0]]: {
      12: 'max-w-[85px]',
      24: 'max-w-[65px]',
    },
    [timeFormats[1]]: {
      12: 'max-w-[100px]',
      24: 'max-w-[80px]',
    },
    [timeFormats[2]]: {
      12: 'max-w-[130px]',
      24: 'max-w-[110px]',
    },
  }[timeFormat.value][parseProp(column.value.meta).is12hrFormat ? 12 : 24]
})
</script>

<template>
  <div class="w-full flex nc-cell-field relative gap-2 nc-cell-picker-datetime tracking-tight">
    <div class="flex-none rounded-md box-border w-[60%] max-w-[110px] py-0.5 px-1 truncate">
      {{ localState?.format(dateFormat) ?? '' }}
    </div>

    <div :class="timeCellMaxWidth" class="flex-1 flex-none rounded-md box-border py-0.5 px-1 truncate">
      {{ cellValue }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-cell-picker-datetime {
  @apply text-[13px] leading-4;
  font-weight: 500;
}
</style>
