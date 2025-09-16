<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  row?: Record<string, any>
  color?: string
  showDate?: boolean
  calDataType?: string // UITypes.Date or other
}

const props = withDefaults(defineProps<Props>(), {
  color: 'gray',
  showDate: true,
})

const rowColorInfo = computed(() => {
  return extractRowBackgroundColorStyle(props.row as Row)
})

const { timezoneDayjs } = useCalendarViewStoreOrThrow()

// Extract range configuration
const range = computed(() => props.row?.rowMeta?.range)
const fromCol = computed(() => range.value?.fk_from_col)
const toCol = computed(() => range.value?.fk_to_col)

// Extract raw date values
const fromDateRaw = computed(() => (fromCol.value ? props.row?.row?.[fromCol.value.title!] : null))
const toDateRaw = computed(() => (toCol.value ? props.row?.row?.[toCol.value.title!] : null))

// Format dates for display
const fromDate = computed(() => {
  if (!fromDateRaw.value || !fromCol.value) return null

  const format = props.calDataType === 'Date' ? 'D MMM' : 'D MMM • h:mm A'
  return timezoneDayjs.timezonize(fromDateRaw.value).format(format)
})

const toDate = computed(() => {
  if (!toDateRaw.value || !toCol.value || !dayjs(toDateRaw.value)?.isValid()) return null

  const format = props.calDataType === 'Date' ? 'DD MMM' : 'DD MMM • HH:mm A'
  return timezoneDayjs.timezonize(toDateRaw.value).format(format)
})

// Validation logic
const missingFromDate = computed(() => fromCol.value && !fromDateRaw.value)
const missingToDate = computed(() => toCol.value && !toDateRaw.value)
const dateOrderError = computed(() => {
  if (!fromCol.value || !toCol.value || !fromDateRaw.value || !toDateRaw.value) return false
  return timezoneDayjs.timezonize(fromDateRaw.value).isAfter(timezoneDayjs.timezonize(toDateRaw.value))
})

const invalid = computed(() => missingFromDate.value || missingToDate.value || dateOrderError.value)

const errorInfo = computed(() => {
  const missingFromDate = fromCol.value && !fromDateRaw.value

  const missingToDate = toCol.value && !toDateRaw.value

  const dateOrderError =
    fromCol.value &&
    toCol.value &&
    fromDateRaw.value &&
    toDateRaw.value &&
    timezoneDayjs.timezonize(fromDateRaw.value).isAfter(timezoneDayjs.timezonize(toDateRaw.value))

  if (dateOrderError) {
    return {
      message: 'Date Error',
      tooltip:
        "Record with end date before the start date won't be displayed in the calendar. Update the end date to display the record.",
    }
  }

  if (missingFromDate && missingToDate) {
    return {
      message: 'Missing Dates',
      tooltip: 'Both start date and end date are required for this record to be displayed in the calendar.',
    }
  }

  if (missingFromDate) {
    return {
      message: 'Missing Start Date',
      tooltip: 'Start date is required for this record to be displayed in the calendar.',
    }
  }

  if (missingToDate) {
    return {
      message: 'Missing End Date',
      tooltip: 'End date is required for this record to be displayed properly in the calendar.',
    }
  }

  return {
    message: 'Invalid Record',
    tooltip: 'This record has errors and may not display correctly in the calendar.',
  }
})
</script>

<template>
  <div
    class="border-1 cursor-pointer h-12.5 flex-none border-nc-border-gray-medium flex gap-2 flex-col rounded-lg overflow-hidden"
    :style="rowColorInfo.rowBgColor"
  >
    <div class="flex relative items-center gap-2">
      <span
        :class="{
          'bg-nc-maroon-500': props.color === 'maroon',
          'bg-nc-blue-500': props.color === 'blue',
          'bg-nc-green-500': props.color === 'green',
          'bg-nc-yellow-500': props.color === 'yellow',
          'bg-nc-pink-500': props.color === 'pink',
          'bg-nc-purple-500': props.color === 'purple',
          'bg-nc-gray-900': props.color === 'gray',
        }"
        class="block h-12 w-1"
        :style="rowColorInfo.rowLeftBorderColor"
      ></span>
      <slot name="image" />
      <div class="flex gap-1 py-1 flex-col">
        <span
          :class="{
            '!max-w-35': invalid,
          }"
          class="text-[13px] leading-4 max-w-56 font-medium truncate text-nc-content-gray"
        >
          <slot />
        </span>
        <NcTooltip v-if="invalid" placement="left" class="top-1 absolute right-1">
          <NcBadge color="red" :border="false" class="!h-5">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="warning" class="text-nc-content-red-medium !h-4 !w-4" />
              <span class="font-normal text-xs">{{ errorInfo.message }}</span>
            </div>
          </NcBadge>
          <template #title>
            {{ errorInfo.tooltip }}
          </template>
        </NcTooltip>
        <NcTooltip
          v-if="showDate"
          show-on-truncate-only
          class="text-xs font-medium truncate max-w-58 leading-4 text-nc-content-gray-subtle2"
        >
          {{ fromDate }} {{ toDate ? ` - ${toDate}` : '' }}
          <template #title> {{ fromDate }} {{ toDate ? ` - ${toDate}` : '' }} </template>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
