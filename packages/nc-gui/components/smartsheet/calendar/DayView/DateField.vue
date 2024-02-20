<script lang="ts" setup>
import dayjs from 'dayjs'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { type Row, computed, ref } from '#imports'
import { isRowEmpty } from '~/utils'

const emit = defineEmits(['expand-record', 'new-record'])
const meta = inject(MetaInj, ref())

const container = ref()

const { isUIAllowed } = useRoles()

const { selectedDate, formattedData, formattedSideBarData, calendarRange, updateRowProperty, displayField } =
  useCalendarViewStoreOrThrow()

const recordsAcrossAllRange = computed<Row[]>(() => {
  let dayRecordCount = 0
  const perRecordHeight = 40

  if (!calendarRange.value) return []

  const recordsByRange: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const endCol = range.fk_to_col
    if (fromCol && endCol) {
      for (const record of formattedData.value) {
        const startDate = dayjs(record.row[fromCol.title!])
        const endDate = dayjs(record.row[endCol.title!])

        dayRecordCount++

        const style: Partial<CSSStyleDeclaration> = {
          top: `${(dayRecordCount - 1) * perRecordHeight}px`,
          width: '100%',
        }

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
            style,
            range: range as any,
          },
        })
      }
    } else if (fromCol) {
      for (const record of formattedData.value) {
        dayRecordCount++
        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range: range as any,
            style: {
              width: '100%',
              left: '0',
              top: `${(dayRecordCount - 1) * perRecordHeight}px`,
            },
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

    if (dragElement.value) {
      formattedData.value = formattedData.value.map((r) => {
        const pk = extractPkFromRow(r.row, meta.value!.columns!)

        if (pk === extractPkFromRow(newRow.row, meta.value!.columns!)) {
          return newRow
        }
        return r
      })
    } else {
      formattedData.value = [...formattedData.value, newRow]
      formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
        const pk = extractPkFromRow(r.row, meta.value!.columns!)

        return pk !== extractPkFromRow(newRow.row, meta.value!.columns!)
      })
    }

    if (dragElement.value) {
      dragElement.value.style.boxShadow = 'none'
      dragElement.value.classList.remove('hide')

      dragElement.value = null
    }
    updateRowProperty(newRow, updateProperty, false)
  }
}
</script>

<template>
  <div
    v-if="recordsAcrossAllRange.length"
    ref="container"
    class="w-full relative h-[calc(100vh-10.8rem)] overflow-y-auto nc-scrollbar-md"
    @drop="dropEvent"
  >
    <div
      v-for="(record, rowIndex) in recordsAcrossAllRange"
      :key="rowIndex"
      :data-testid="`nc-calendar-day-record-${record.row[displayField!.title!]}`"
      :style="record.rowMeta.style"
      class="absolute mt-2"
      @mouseleave="hoverRecord = null"
      @mouseover="hoverRecord = record.rowMeta.id"
    >
      <LazySmartsheetRow :row="record">
        <LazySmartsheetCalendarRecordCard
          :position="record.rowMeta.position"
          :record="record"
          :resize="false"
          color="blue"
          size="small"
          @click="emit('expand-record', record)"
        >
          <template v-if="!isRowEmpty(record, displayField)">
            <div
              :class="{
                '!mt-1.5 ml-1': displayField.uidt === UITypes.SingleLineText,
                '!mt-1': displayField.uidt === UITypes.MultiSelect || displayField.uidt === UITypes.SingleSelect,
              }"
            >
              <LazySmartsheetVirtualCell
                v-if="isVirtualCol(displayField!)"
                v-model="record.row[displayField!.title!]"
                :column="displayField"
                :row="record"
              />

              <LazySmartsheetCell
                v-else
                v-model="record.row[displayField!.title!]"
                :column="displayField"
                :edit-enabled="false"
                :read-only="true"
              />
            </div>
          </template>
        </LazySmartsheetCalendarRecordCard>
      </LazySmartsheetRow>
    </div>
  </div>

  <div
    v-else
    ref="container"
    class="w-full h-full flex text-md font-bold text-gray-500 items-center justify-center"
    @drop="dropEvent"
  >
    No records in this day
  </div>
</template>

<style lang="scss" scoped></style>
