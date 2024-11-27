<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import { UseVirtualList } from '@vueuse/components'

const emit = defineEmits(['expandRecord', 'newRecord'])

const meta = inject(MetaInj, ref())

const container = ref()

const { isUIAllowed } = useRoles()

const { selectedDate, formattedData, formattedSideBarData, calendarRange, updateRowProperty } = useCalendarViewStoreOrThrow()

const fields = inject(FieldsInj, ref())

const { fields: _fields } = useViewColumnsOrThrow()

const fieldStyles = computed(() => {
  if (!_fields.value) return new Map()
  return new Map(
    _fields.value.map((field) => [
      field.fk_column_id,
      {
        underline: field.underline,
        bold: field.bold,
        italic: field.italic,
      },
    ]),
  )
})

const getFieldStyle = (field: ColumnType) => {
  return fieldStyles.value.get(field.id)
}
// We loop through all the records and calculate the position of each record based on the range
// We only need to calculate the top, of the record since there is no overlap in the day view of date Field
const recordsAcrossAllRange = computed<Row[]>(() => {
  if (!calendarRange.value) return []

  const recordsByRange: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const endCol = range.fk_to_col
    if (fromCol && endCol) {
      const filteredData = formattedData.value.filter((record) => {
        const startDate = dayjs(record.row[fromCol.title!])
        const endDate = dayjs(record.row[endCol.title!])

        return startDate.isSameOrBefore(endDate, 'day')
      })

      for (const record of filteredData) {
        const startDate = dayjs(record.row[fromCol.title!])
        const endDate = dayjs(record.row[endCol.title!])

        const id = record.rowMeta.id ?? generateRandomNumber()

        // This property is used to determine which side the record should be rounded. It can be left, right, both or none
        let position = 'none'
        const isSelectedDay = (date: dayjs.Dayjs) => date.isSame(selectedDate.value, 'day')
        const isBeforeSelectedDay = (date: dayjs.Dayjs) => date.isBefore(selectedDate.value, 'day')
        const isAfterSelectedDay = (date: dayjs.Dayjs) => date.isAfter(selectedDate.value, 'day')

        if (isSelectedDay(startDate) && isSelectedDay(endDate)) {
          position = 'rounded'
        } else if (isBeforeSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
          position = 'none'
        } else if (isSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
          position = 'leftRounded'
        } else if (isBeforeSelectedDay(startDate) && isSelectedDay(endDate)) {
          position = 'rightRounded'
        } else {
          position = 'none'
        }

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            position,
            id,
            range: range as any,
          },
        })
      }
    } else if (fromCol) {
      for (const record of formattedData.value) {
        const id = record.rowMeta.id ?? generateRandomNumber()

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            id,
            range: range as any,
            position: 'rounded',
          },
        })
      }
    }
  })
  return recordsByRange
})

const dragElement = ref<HTMLElement | null>(null)

const hoverRecord = ref<string | null>(null)

// We support drag and drop from the sidebar to the day view of the date field
const dropEvent = (event: DragEvent) => {
  if (!isUIAllowed('dataEdit')) return
  event.preventDefault()
  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
    }: {
      record: Row
      initialClickOffsetY: number
      initialClickOffsetX: number
    } = JSON.parse(data)

    const fromCol = record.rowMeta.range?.fk_from_col
    const toCol = record.rowMeta.range?.fk_to_col

    if (!fromCol) return

    const newStartDate = dayjs(selectedDate.value).startOf('day')

    let endDate

    const newRow = {
      ...record,
      row: {
        ...record.row,
        [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
      },
    }

    const updateProperty = [fromCol.title!]

    if (toCol) {
      const fromDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
      const toDate = record.row[toCol.title!] ? dayjs(record.row[toCol.title!]) : null

      if (fromDate && toDate) {
        endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
      } else if (fromDate && !toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else if (!fromDate && toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else {
        endDate = newStartDate.clone()
      }
      newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD HH:mm:ssZ')
      updateProperty.push(toCol.title!)
    }

    if (!newRow) return

    const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)

    if (dragElement.value) {
      formattedData.value = formattedData.value.map((r) => {
        const pk = extractPkFromRow(r.row, meta.value!.columns!)
        return pk === newPk ? newRow : r
      })
    } else {
      formattedData.value = [...formattedData.value, newRow]
      formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
        return extractPkFromRow(r.row, meta.value!.columns!) !== newPk
      })
    }

    if (dragElement.value) {
      dragElement.value.style.boxShadow = 'none'
      dragElement.value = null
    }
    updateRowProperty(newRow, updateProperty, false)
    $e('c:calendar:day:drag-record')
  }
}

// TODO: Add Support for multiple ranges when multiple ranges are supported
const newRecord = () => {
  if (!isUIAllowed('dataEdit') || !calendarRange.value?.length) return
  const record = {
    row: {
      [calendarRange.value[0].fk_from_col!.title!]: selectedDate.value.format('YYYY-MM-DD HH:mm:ssZ'),
    },
  }
  emit('newRecord', record)
}
</script>

<template>
  <div
    v-if="recordsAcrossAllRange.length"
    ref="container"
    class="w-full cursor-pointer relative overflow-y-auto nc-scrollbar-md"
    data-testid="nc-calendar-day-view"
    @dblclick="newRecord"
    @drop="dropEvent"
  >
    <UseVirtualList height="calc(100vh - 5rem)" :list="recordsAcrossAllRange" :options="{ itemHeight: 36 }">
      <template #default="{ data: record }">
        <div
          :key="record.rowMeta.id"
          class="mt-2"
          style="line-height: 18px"
          data-testid="nc-calendar-day-record-card"
          @mouseleave="hoverRecord = null"
          @click.prevent="emit('expandRecord', record)"
          @mouseover="hoverRecord = record.rowMeta.id as string"
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarRecordCard
              :record="record"
              :hover="hoverRecord === record.rowMeta.id"
              :resize="false"
              :position="record.rowMeta.position"
              size="small"
              @click.prevent="emit('expandRecord', record)"
            >
              <template v-for="(field, id) in fields" :key="id">
                <LazySmartsheetPlainCell
                  v-if="!isRowEmpty(record, field!)"
                  v-model="record.row[field!.title!]"
                  class="text-xs"
                  :bold="getFieldStyle(field).bold"
                  :column="field"
                  :italic="getFieldStyle(field).italic"
                  :underline="getFieldStyle(field).underline"
                />
              </template>
            </LazySmartsheetCalendarRecordCard>
          </LazySmartsheetRow>
        </div>
      </template>
    </UseVirtualList>
  </div>

  <div
    v-else
    ref="container"
    class="w-full h-full cursor-pointer flex text-md font-bold text-gray-500 items-center justify-center"
    @drop="dropEvent"
    @dblclick="newRecord"
  >
    No records in this day
  </div>
</template>

<style lang="scss" scoped></style>
