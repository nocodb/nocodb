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

const { t } = useI18n()

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

  const timeFormat = is12hrTimeColumn(fromCol.value) ? 'h:mm A' : 'HH:mm'
  const format = props.calDataType === 'Date' ? 'D MMM' : `D MMM • ${timeFormat}`
  return timezoneDayjs.timezonize(fromDateRaw.value).format(format)
})

const toDate = computed(() => {
  if (!toDateRaw.value || !toCol.value || !dayjs(toDateRaw.value)?.isValid()) return null

  const timeFormat = is12hrTimeColumn(toCol.value) ? 'h:mm A' : 'HH:mm'
  const format = props.calDataType === 'Date' ? 'DD MMM' : `DD MMM • ${timeFormat}`
  return timezoneDayjs.timezonize(toDateRaw.value).format(format)
})

// Validation logic
const missingFromDate = computed(() => fromCol.value && !fromDateRaw.value)
const missingToDate = computed(() => toCol.value && !toDateRaw.value)
const missingBothDates = computed(() => missingFromDate.value && missingToDate.value)
const dateOrderError = computed(() => {
  if (!fromCol.value || !toCol.value || !fromDateRaw.value || !toDateRaw.value) return false
  return timezoneDayjs.timezonize(fromDateRaw.value).isAfter(timezoneDayjs.timezonize(toDateRaw.value))
})

// Only invalid if both dates are missing or dates are in wrong order
// Having only one date (start or end) is valid — treated as single-day event
const invalid = computed(() => missingBothDates.value || dateOrderError.value)

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
      message: t('msg.error.dateError'),
      tooltip: t('msg.error.dateOrderErrorTooltip'),
    }
  }

  if (missingFromDate && missingToDate) {
    return {
      message: t('msg.error.missingDates'),
      tooltip: t('msg.error.missingDatesTooltip'),
    }
  }

  return {
    message: t('msg.error.invalidRecord'),
    tooltip: t('msg.error.invalidRecordTooltip'),
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
        <NcTooltip
          wrap-child="span"
          :disabled="!$slots.tooltip"
          overlay-class-name="nc-record-fields-tooltip"
          :class="{
            '!max-w-35': invalid,
          }"
          class="text-[13px] leading-4 max-w-56 font-medium truncate text-nc-content-gray"
        >
          <template #title>
            <slot name="tooltip" />
          </template>
          <slot />
        </NcTooltip>
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
          {{
            fromDate && toDate
              ? `${fromDate} - ${toDate}`
              : fromDate && toCol
              ? `${fromDate} -`
              : toDate && fromCol
              ? `- ${toDate}`
              : fromDate || toDate || ''
          }}
          <template #title>
            {{
              fromDate && toDate
                ? `${fromDate} - ${toDate}`
                : fromDate && toCol
                ? `${fromDate} -`
                : toDate && fromCol
                ? `- ${toDate}`
                : fromDate || toDate || ''
            }}
          </template>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
