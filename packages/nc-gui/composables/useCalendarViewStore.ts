import type { ComputedRef, Ref } from 'vue'
import type { CalendarType, PaginatedType, UITypes, ViewType } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { addDays, addMonths, addYears } from '~/utils'
import { IsPublicInj, type Row, ref, storeToRefs, useBase, useInjectionState } from '#imports'

const formatData = (list: Record<string, any>[]) =>
  list.map(
    (row) =>
      ({
        row: { ...row },
        oldRow: { ...row },
        rowMeta: {},
      } as Row),
  )

const [useProvideCalendarViewStore, useCalendarViewStore] = useInjectionState(
  (
    meta: Ref<(CalendarType & { id: string }) | undefined>,
    viewMeta: Ref<(ViewType | CalendarType | undefined) & { id: string }> | ComputedRef<(ViewType & { id: string }) | undefined>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const pageDate = ref<Date>(new Date())

    const activeCalendarView = ref<'month' | 'year' | 'day' | 'week'>()

    const calDataType = ref<UITypes.Date | UITypes.DateTime>()

    const selectedDate = ref<Date>(new Date())

    const isCalendarDataLoading = ref<boolean>(false)

    const selectedDateRange = ref<{
      start: Date | null
      end: Date | null
    }>({
      start: dayjs(selectedDate.value).startOf('week').toDate(), // This will be the previous Sunday
      end: dayjs(selectedDate.value).startOf('week').add(6, 'day').toDate(), // This will be the following Saturday
    })

    const defaultPageSize = 1000

    const formattedData = ref<Row[]>([])

    const { api } = useApi()

    const { base } = storeToRefs(useBase())

    const { $api } = useNuxtApp()

    const { isUIAllowed } = useRoles()

    const isPublic = ref(shared) || inject(IsPublicInj, ref(false))

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { sharedView, fetchSharedViewData } = useSharedView()

    const calendarMetaData = ref<CalendarType>({})

    const paginationData = ref<PaginatedType>({ page: 1, pageSize: defaultPageSize })

    const queryParams = computed(() => ({
      limit: paginationData.value.pageSize ?? defaultPageSize,
      where: where?.value ?? '',
    }))

    const calendarRange = computed(() => {
      if (!meta.value || !meta.value.columns || !calendarMetaData.value || !calendarMetaData.value.calendar_range) return []
      return calendarMetaData.value.calendar_range.map((range) => {
        // Get the column data for the calendar range
        return {
          fk_from_col: meta.value!.columns!.find((col) => col.id === range.fk_from_column_id),
          fk_to_col: meta.value!.columns!.find((col) => col.id === range.fk_to_column_id),
        }
      })
    })

    const xWhere = computed(() => {
      if (!meta.value || !meta.value.columns || !calendarMetaData.value || !calendarMetaData.value.calendar_range) return ''
      // If CalendarView, then we need to add the date filter to the where clause
      let whereClause = where?.value ?? ''
      if (whereClause.length > 0) {
        whereClause += '~and('
      }
      if (activeCalendarView.value === 'week') {
        whereClause += `(${calendarRange.value[0].fk_from_col.title},gte,exactDate,${dayjs(selectedDateRange.value.start).format(
          'YYYY-MM-DD',
        )})`
        whereClause += `~and(${calendarRange.value[0].fk_from_col.title},lte,exactDate,${dayjs(
          selectedDateRange.value.end,
        ).format('YYYY-MM-DD')})`
        return whereClause
      } else if (activeCalendarView.value === 'day') {
        return `(${calendarRange.value[0].fk_from_col.title},eq,exactDate,${dayjs(selectedDate.value).format('YYYY-MM-DD')})`
      } else if (activeCalendarView.value === 'month') {
        return `(${calendarRange.value[0].fk_from_col.title},gte,exactDate,${dayjs(selectedDate.value)
          .startOf('month')
          .format('YYYY-MM-DD')})~and(${calendarRange.value[0].fk_from_col.title},lte,exactDate,${dayjs(selectedDate.value)
          .endOf('month')
          .format('YYYY-MM-DD')})`
      } else if (activeCalendarView.value === 'year') {
        return `(${calendarRange.value[0].fk_from_col.title},gte,exactDate,${dayjs(selectedDate.value)
          .startOf('year')
          .format('YYYY-MM-DD')})~and(${calendarRange.value[0].fk_from_col.title},lte,exactDate,${dayjs(selectedDate.value)
          .endOf('year')
          .format('YYYY-MM-DD')})`
      }
    })

    // Set of Dates that have data
    const activeDates = computed(() => {
      const dates = new Set<Date>()
      formattedData.value.forEach((row) => {
        const start = row.row[calendarRange.value[0].fk_from_col.title]
        let end
        if (calendarRange.value[0].fk_to_col) {
          end = row.row[calendarRange.value[0].fk_to_col.title]
        }
        if (start && end) {
          const startDate = dayjs(start)
          const endDate = dayjs(end)
          let currentDate = startDate
          while (currentDate.isSameOrBefore(endDate)) {
            dates.add(currentDate.toDate())
            currentDate = currentDate.add(1, 'day')
          }
        } else if (start) {
          dates.add(new Date(start))
        }
      })
      return Array.from(dates)
    })

    const changeCalendarView = async (view: 'month' | 'year' | 'day' | 'week') => {
      try {
        activeCalendarView.value = view
        await updateCalendarMeta({
          meta: {
            ...JSON.parse(calendarMetaData.value?.meta ?? '{}'),
            active_view: view,
          },
        })
      } catch (e) {
        message.error('Error changing calendar view')
        console.log(e)
      }
    }

    async function loadCalendarMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      // TODO: Fetch Calendar Meta
      calendarMetaData.value = isPublic.value
        ? (sharedView.value?.view as CalendarType)
        : await $api.dbView.calendarRead(viewMeta.value.id)
      activeCalendarView.value = JSON.parse(calendarMetaData.value?.meta ?? '{}')?.active_view ?? 'month'
      calDataType.value = calendarRange.value[0].fk_from_col.uidt
    }

    async function loadCalendarData() {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic?.value) return
      isCalendarDataLoading.value = true
      const res = !isPublic.value
        ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
            ...queryParams.value,
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
            where: xWhere?.value,
          })
        : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value })
      formattedData.value = formatData(res!.list)
      isCalendarDataLoading.value = false
    }

    const filteredData = computed(() => {
      if (!formattedData.value) return []
      if (activeCalendarView === 'week') {
        return formattedData.value.filter((row) => {
          const startDate = dayjs(row.row[calendarRange.value[0].fk_from_col.title])
          const endDate = dayjs(row.row[calendarRange.value[0].fk_to_col.title])
          return startDate.isSameOrBefore(selectedDateRange.value.end) && endDate.isSameOrAfter(selectedDateRange.value.start)
        })
      } else if (activeCalendarView === 'day') {
        return formattedData.value.filter((row) => {
          const startDate = dayjs(row.row[calendarRange.value[0].fk_from_col.title])
          return startDate.isSame(selectedDate.value)
        })
      } else if (activeCalendarView === 'month') {
        return formattedData.value.filter((row) => {
          const startDate = dayjs(row.row[calendarRange.value[0].fk_from_col.title])
          const endDate = dayjs(row.row[calendarRange.value[0].fk_to_col.title])
          return startDate.isSameOrBefore(selectedDate.value) && endDate.isSameOrAfter(selectedDate.value)
        })
      }
    })

    async function updateCalendarMeta(updateObj: Partial<CalendarType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit')) return
      await $api.dbView.calendarUpdate(viewMeta.value.id, updateObj)
    }

    const paginateCalendarView = async (action: 'next' | 'prev') => {
      switch (activeCalendarView.value) {
        case 'month':
          selectedDate.value = action === 'next' ? addMonths(selectedDate.value, 1) : addMonths(selectedDate.value, -1)
          if (pageDate.value.getFullYear() !== selectedDate.value.getFullYear()) {
            pageDate.value = selectedDate.value
          }
          break
        case 'year':
          selectedDate.value = action === 'next' ? addYears(selectedDate.value, 1) : addYears(selectedDate.value, -1)
          if (pageDate.value.getFullYear() !== selectedDate.value.getFullYear()) {
            pageDate.value = selectedDate.value
          }
          break
        case 'day':
          selectedDate.value = action === 'next' ? addDays(selectedDate.value, 1) : addDays(selectedDate.value, -1)
          if (pageDate.value.getFullYear() !== selectedDate.value.getFullYear()) {
            pageDate.value = selectedDate.value
          } else if (pageDate.value.getMonth() !== selectedDate.value.getMonth()) {
            pageDate.value = selectedDate.value
          }
          break
        case 'week':
          selectedDateRange.value =
            action === 'next'
              ? {
                  start: addDays(selectedDateRange.value.start!, 7),
                  end: addDays(selectedDateRange.value.end!, 7),
                }
              : {
                  start: addDays(selectedDateRange.value.start!, -7),
                  end: addDays(selectedDateRange.value.end!, -7),
                }
          if (pageDate.value.getMonth() !== selectedDateRange.value.end?.getMonth()) {
            pageDate.value = selectedDateRange.value.start!
          }
          break
      }
    }

    watch(selectedDate, async () => {
      if (activeCalendarView.value === 'year') return
      await loadCalendarData()
    })

    watch(selectedDateRange, async () => {
      if (activeCalendarView.value !== 'week') return
      await loadCalendarData()
    })

    watch(activeCalendarView, async () => {
      await loadCalendarData()
    })

    return {
      filteredData,
      activeDates,
      isCalendarDataLoading,
      changeCalendarView,
      calDataType,
      loadCalendarMeta,
      calendarRange,
      loadCalendarData,
      updateCalendarMeta,
      calendarMetaData,
      activeCalendarView,
      pageDate,
      paginationData,
      selectedDate,
      selectedDateRange,
      paginateCalendarView,
    }
  },
)

export { useProvideCalendarViewStore }

export function useCalendarViewStoreOrThrow() {
  const calendarViewStore = useCalendarViewStore()

  if (calendarViewStore == null) throw new Error('Please call `useProvideCalendarViewStore` on the appropriate parent component')

  return calendarViewStore
}
