<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const { $e } = useNuxtApp()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const reloadViewMetaHook = inject(ReloadViewMetaHookInj)

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const isPublic = inject(IsPublicInj, ref(false))

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(false))

provide(IsCalendarInj, ref(true))

const {
  activeCalendarView,
  calendarRange,
  calDataType,
  loadCalendarMeta,
  loadCalendarData,
  loadSidebarData,
  isCalendarDataLoading,
  isCalendarMetaLoading,
  fetchActiveDates,
  showSideMenu,
} = useCalendarViewStoreOrThrow()

const router = useRouter()

const route = useRoute()

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.query.rowId
  },
  set(value) {
    if (!value) {
      router.push({
        query: {
          ...route.query,
          rowId: undefined,
        },
      })
    }
  },
})

const expandedFormDlg = ref(false)

const expandedFormRow = ref<RowType>()

const expandedFormRowState = ref<Record<string, any>>()

const expandRecord = (row: RowType, state?: Record<string, any>) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  expandedFormRow.value = row
  expandedFormRowState.value = state

  if (rowId && !isPublic.value) {
    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormDlg.value = true
  }
}

const newRecord = (row: RowType) => {
  if (isPublic.value) return
  $e('c:calendar:new-record', activeCalendarView.value)
  expandRecord({
    row: {
      ...rowDefaultData(meta.value?.columns),
      ...row.row,
    },
    oldRow: {},
    rowMeta: {
      new: true,
    },
  })
}

onMounted(async () => {
  await loadCalendarMeta()
  await loadCalendarData()
  if (!activeCalendarView.value) {
    activeCalendarView.value = 'month'
  }
})

reloadViewMetaHook?.on(async () => {
  await loadCalendarMeta()
})

reloadViewDataHook?.on(async (params: void | { shouldShowLoading?: boolean }) => {
  await Promise.all([
    loadCalendarData(params?.shouldShowLoading ?? false),
    loadSidebarData(params?.shouldShowLoading ?? false),
    fetchActiveDates(),
  ])
})
</script>

<template>
  <div class="flex h-full relative flex-row" data-testid="nc-calendar-wrapper">
    <div class="flex flex-col w-full">
      <template v-if="calendarRange?.length && !isCalendarMetaLoading">
        <LazySmartsheetCalendarYearView v-if="activeCalendarView === 'year'" />
        <template v-if="!isCalendarDataLoading">
          <LazySmartsheetCalendarMonthView
            v-if="activeCalendarView === 'month'"
            @expand-record="expandRecord"
            @new-record="newRecord"
          />
          <LazySmartsheetCalendarWeekViewDateField
            v-else-if="activeCalendarView === 'week' && calDataType === UITypes.Date"
            @expand-record="expandRecord"
            @new-record="newRecord"
          />
          <LazySmartsheetCalendarWeekViewDateTimeField
            v-else-if="activeCalendarView === 'week' && calDataType === UITypes.DateTime"
            @expand-record="expandRecord"
            @new-record="newRecord"
          />
          <LazySmartsheetCalendarDayViewDateField
            v-else-if="activeCalendarView === 'day' && calDataType === UITypes.Date"
            @expand-record="expandRecord"
            @new-record="newRecord"
          />
          <LazySmartsheetCalendarDayViewDateTimeField
            v-else-if="activeCalendarView === 'day' && calDataType === UITypes.DateTime"
            @expand-record="expandRecord"
            @new-record="newRecord"
          />
        </template>

        <div v-if="isCalendarDataLoading && activeCalendarView !== 'year'" class="flex w-full items-center h-full justify-center">
          <GeneralLoader size="xlarge" />
        </div>
      </template>
      <template v-else-if="isCalendarMetaLoading">
        <div class="flex w-full items-center h-full justify-center">
          <GeneralLoader size="xlarge" />
        </div>
      </template>
      <template v-else>
        <div class="flex w-full items-center h-full justify-center">
          {{ $t('activity.noRange') }}
        </div>
      </template>
    </div>
    <LazySmartsheetCalendarSideMenu :visible="showSideMenu" @expand-record="expandRecord" @new-record="newRecord" />
  </div>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :load-row="!isPublic"
      :state="expandedFormRowState"
      :meta="meta"
      :view="view"
    />
  </Suspense>

  <LazySmartsheetExpandedForm
    v-if="expandedFormOnRowIdDlg && meta?.id"
    v-model="expandedFormOnRowIdDlg"
    close-after-save
    :load-row="!isPublic"
    :meta="meta"
    :state="expandedFormRowState"
    :row="
      expandedFormRow ?? {
        row: {},
        oldRow: {},
        rowMeta: {},
      }
    "
    :row-id="route.query.rowId"
    :view="view"
  />
</template>
