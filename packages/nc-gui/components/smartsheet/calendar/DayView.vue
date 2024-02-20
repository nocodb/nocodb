<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { type Row, computed, ref } from '#imports'

interface Props {
  isEmbed?: boolean
  data?: Row[] | null
}

const props = withDefaults(defineProps<Props>(), {
  isEmbed: false,
  data: null,
})

const emit = defineEmits(['expand-record'])
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))

const data = toRefs(props).data

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const { pageDate, selectedDate, calDataType, formattedData, calendarRange } = useCalendarViewStoreOrThrow()

const getRecordPosition = (record: Row) => {
  if (!calendarRange.value || !calendarRange.value[0]) return ''
  const startCol = calendarRange.value[0].fk_from_col
  const endCol = calendarRange.value[0].fk_to_col

  if (!endCol && startCol) {
    const startDate = dayjs(record.row[startCol.title])
    return startDate.isSame(selectedDate.value, 'day') ? 'rounded' : ''
  } else if (endCol && startCol) {
    const startDate = dayjs(record.row[startCol.title])
    const endDate = dayjs(record.row[endCol.title])
    if (startDate.isSame(selectedDate.value, 'day') || endDate.isSame(selectedDate.value, 'day')) {
      return 'rounded'
    } else if (startDate.isBefore(selectedDate.value, 'day') && endDate.isAfter(selectedDate.value, 'day')) {
      return 'none'
    } else if (startDate.isSame(selectedDate.value, 'day') && endDate.isAfter(selectedDate.value, 'day')) {
      return 'leftRounded'
    } else if (startDate.isBefore(selectedDate.value, 'day') && endDate.isSame(selectedDate.value, 'day')) {
      return 'rightRounded'
    }
  }
}

const hours = computed(() => {
  const hours = []
  for (let i = 0; i < 24; i++) {
    hours.push(i)
  }
  return hours
})

const renderData = computed(() => {
  if (data.value) {
    return data.value
  }
  return formattedData.value
})
</script>

<template>
  <template v-if="renderData && renderData.length && displayField.title && calendarRange[0].fk_from_col">
    <div
      v-if="calDataType === UITypes.Date"
      :class="{
        'h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md': !props.isEmbed,
        'border-r-1 h-full border-gray-200 hover:bg-gray-50 ': props.isEmbed,
      }"
      class="flex flex-col pt-3 gap-2 h-full w-full"
    >
      <LazySmartsheetRow v-for="(record, rowIndex) in renderData" :key="rowIndex" :row="record">
        <LazySmartsheetCalendarRecordCard
          :key="rowIndex"
          :date="record.row[calendarRange[0].fk_from_col.title]"
          :name="record.row[displayField.title]"
          :position="getRecordPosition(record)"
          color="blue"
          size="small"
          @click="emit('expand-record', record)"
        />
      </LazySmartsheetRow>
    </div>
    <div
      v-else-if="calDataType === UITypes.DateTime"
      :class="{
        'h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md': !props.isEmbed,
        'border-r-1 h-full border-gray-200 ': props.isEmbed,
      }"
      class="flex flex-col mt-3 gap-2 w-full px-1"
    ></div>
  </template>
  <div v-else-if="!data" class="w-full h-full flex text-md font-bold text-gray-500 items-center justify-center">
    No Records in this day
  </div>
</template>

<style lang="scss" scoped></style>
