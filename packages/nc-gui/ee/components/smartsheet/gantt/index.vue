<script setup lang="ts">
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'

const { $api } = useNuxtApp()

const meta = inject(MetaInj, ref())
const activeView = inject(ActiveViewInj, ref())

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const records = ref<any[]>([])
const isLoading = ref(false)

const ganttRange = computed<any>(() => {
  const range = (activeView.value as any)?.view?.gantt_range?.[0]
  return range || {}
})

const dateColumns = computed<ColumnType[]>(() => {
  return (meta.value?.columns || []).filter((c) =>
    [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(c.uidt as UITypes),
  )
})

// Fallback to first date col if range not configured yet
const startColumn = computed<ColumnType | undefined>(() => {
  const fromRange = meta.value?.columns?.find((c) => c.id === ganttRange.value.fk_start_col_id)
  return fromRange || dateColumns.value[0]
})

const endColumn = computed<ColumnType | undefined>(() => {
  const fromRange = meta.value?.columns?.find((c) => c.id === ganttRange.value.fk_end_col_id)
  return fromRange || dateColumns.value[1] || dateColumns.value[0]
})

async function loadRecords() {
  if (!activeView.value?.id || !meta.value?.id || !base.value?.id) return
  isLoading.value = true
  try {
    const res: any = await $api.dbViewRow.list(
      'noco',
      base.value.id,
      meta.value.id,
      activeView.value.id as string,
      { limit: 500, offset: 0 },
    )
    records.value = res?.list || []
  } catch (e) {
    console.error('Gantt: failed to load records', e)
  } finally {
    isLoading.value = false
  }
}

watch(
  [() => activeView.value?.id, () => meta.value?.id, () => base.value?.id],
  () => {
    loadRecords()
  },
  { immediate: true },
)

const primaryColumn = computed(() => meta.value?.columns?.find((c) => c.pv))

const rowsWithDates = computed(() => {
  if (!startColumn.value) return []
  return records.value
    .map((r) => {
      const startVal = r[startColumn.value!.title!]
      const endVal = endColumn.value ? r[endColumn.value.title!] : startVal
      if (!startVal) return null
      const start = dayjs(startVal)
      const end = dayjs(endVal || startVal)
      if (!start.isValid()) return null
      return {
        row: r,
        title: primaryColumn.value ? r[primaryColumn.value.title!] ?? '(untitled)' : '(untitled)',
        start,
        end: end.isValid() && end.isAfter(start) ? end : start,
      }
    })
    .filter((x): x is Exclude<typeof x, null> => x !== null)
})

const axisRange = computed(() => {
  if (!rowsWithDates.value.length) {
    return { min: dayjs().startOf('month'), max: dayjs().endOf('month').add(1, 'month') }
  }
  let min = rowsWithDates.value[0].start
  let max = rowsWithDates.value[0].end
  for (const r of rowsWithDates.value) {
    if (r.start.isBefore(min)) min = r.start
    if (r.end.isAfter(max)) max = r.end
  }
  return { min: min.startOf('week'), max: max.endOf('week').add(1, 'day') }
})

const totalDays = computed(() => Math.max(1, axisRange.value.max.diff(axisRange.value.min, 'day')))

const dayColWidth = 24

const headerMonths = computed(() => {
  const months: { label: string; widthDays: number }[] = []
  let cursor = axisRange.value.min.startOf('month')
  while (cursor.isBefore(axisRange.value.max)) {
    const next = cursor.add(1, 'month').startOf('month')
    const windowStart = cursor.isBefore(axisRange.value.min) ? axisRange.value.min : cursor
    const windowEnd = next.isAfter(axisRange.value.max) ? axisRange.value.max : next
    months.push({
      label: cursor.format('MMM YYYY'),
      widthDays: windowEnd.diff(windowStart, 'day'),
    })
    cursor = next
  }
  return months
})

function barStyle(r: { start: dayjs.Dayjs; end: dayjs.Dayjs }) {
  const left = Math.max(0, r.start.diff(axisRange.value.min, 'day')) * dayColWidth
  const durationDays = Math.max(1, r.end.diff(r.start, 'day'))
  const width = durationDays * dayColWidth
  return { left: `${left}px`, width: `${width}px` }
}

const timelineWidth = computed(() => totalDays.value * dayColWidth)

function goToToday() {
  const el = document.querySelector('.nc-gantt-scroll') as HTMLElement | null
  if (!el) return
  const todayOffset = dayjs().diff(axisRange.value.min, 'day') * dayColWidth
  el.scrollTo({ left: Math.max(0, todayOffset - el.clientWidth / 2), behavior: 'smooth' })
}

const todayLeft = computed(() => {
  const today = dayjs()
  if (today.isBefore(axisRange.value.min) || today.isAfter(axisRange.value.max)) return null
  return today.diff(axisRange.value.min, 'day') * dayColWidth
})

const statusMsg = computed(() => {
  if (isLoading.value) return ''
  if (!dateColumns.value.length) return 'Add a Date field to this table to see Gantt bars.'
  if (!records.value.length) return 'No records yet.'
  if (!rowsWithDates.value.length) {
    const name = startColumn.value?.title || 'start date'
    return `No records have a ${name}.`
  }
  return ''
})
</script>

<template>
  <div class="nc-gantt-view flex h-full flex-col bg-white">
    <div class="nc-gantt-toolbar flex items-center gap-3 px-3 py-2 border-b border-nc-border-gray-medium text-sm">
      <div class="text-nc-content-gray-subtle">
        {{ rowsWithDates.length }} task{{ rowsWithDates.length === 1 ? '' : 's' }}
      </div>
      <div v-if="statusMsg" class="text-nc-content-orange">{{ statusMsg }}</div>
      <NcButton size="xsmall" type="secondary" class="ml-auto" @click="goToToday">Today</NcButton>
    </div>

    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <GeneralLoader />
    </div>

    <div v-else class="nc-gantt-body flex-1 flex overflow-hidden">
      <div class="nc-gantt-record-list border-r border-nc-border-gray-medium shrink-0 w-64 overflow-y-auto">
        <div class="h-14 border-b border-nc-border-gray-medium bg-nc-bg-gray-light px-3 flex items-center text-xs font-medium text-nc-content-gray-subtle">
          Name
        </div>
        <div
          v-for="(r, i) in rowsWithDates"
          :key="i"
          class="h-9 px-3 flex items-center text-sm border-b border-nc-border-gray-extralight truncate"
        >
          {{ r.title }}
        </div>
      </div>

      <div class="nc-gantt-scroll flex-1 overflow-auto">
        <div :style="{ width: `${timelineWidth}px`, position: 'relative' }">
          <div class="h-14 border-b border-nc-border-gray-medium bg-nc-bg-gray-light flex sticky top-0 z-10">
            <div
              v-for="(m, i) in headerMonths"
              :key="i"
              class="text-xs font-medium px-2 py-1 border-r border-nc-border-gray-extralight flex items-center"
              :style="{ width: `${m.widthDays * dayColWidth}px` }"
            >
              {{ m.label }}
            </div>
          </div>

          <div v-if="todayLeft !== null" class="absolute top-14 bottom-0 w-px bg-nc-fill-red-dark z-5 pointer-events-none" :style="{ left: `${todayLeft}px` }" />

          <div v-for="(r, i) in rowsWithDates" :key="i" class="h-9 border-b border-nc-border-gray-extralight relative">
            <div
              class="absolute top-1 bottom-1 bg-nc-fill-primary text-white text-xs rounded px-2 flex items-center truncate shadow-sm"
              :style="barStyle(r)"
              :title="`${r.title} • ${r.start.format('YYYY-MM-DD')} → ${r.end.format('YYYY-MM-DD')}`"
            >
              {{ r.title }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-gantt-record-list {
  background: white;
}
</style>
