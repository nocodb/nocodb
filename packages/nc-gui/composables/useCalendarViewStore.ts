import type { ComputedRef, Ref } from 'vue'
import type { Api, CalendarType, ColumnType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
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
    meta: Ref<((CalendarType & { id: string }) | TableType) | undefined>,
    viewMeta: Ref<(ViewType | CalendarType | undefined) & { id: string }> | ComputedRef<(ViewType & { id: string }) | undefined>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const pageDate = ref<Date>(new Date())

    const displayField = ref<ColumnType>()

    const activeCalendarView = ref<'month' | 'year' | 'day' | 'week'>()

    const searchQuery = reactive({
      value: '',
      field: '',
    })

    const selectedDate = ref<Date>(new Date())

    const selectedTime = ref<Date>()

    const isCalendarDataLoading = ref<boolean>(false)

    const selectedDateRange = ref<{
      start: Date | null
      end: Date | null
    }>({
      start: dayjs(selectedDate.value).startOf('week').toDate(), // This will be the previous Sunday
      end: dayjs(selectedDate.value).startOf('week').add(6, 'day').toDate(), // This will be the following Saturday
    })

    const defaultPageSize = 25

    const formattedData = ref<Row[]>([])

    const formattedSideBarData = ref<Row[]>([])

    const isSidebarLoading = ref<boolean>(false)

    const sideBarFilterOption = ref<string>(activeCalendarView.value)

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
          fk_to_col: meta.value!.columns!.find((col) => col.id === range.fk_to_column_id) ?? null,
        }
      })
    })

    const calDataType = computed(() => {
      if (!calendarRange.value || !calendarRange.value[0]) return null
      return calendarRange.value[0].fk_from_col.uidt
    })

    const sideBarxWhere = computed(() => {
      if (!calendarRange.value || !calendarRange.value[0] || !calendarRange.value[0]) return ''
      const fromCol = calendarRange.value[0].fk_from_col
      if (!fromCol) return ''

      let whereClause = ''
      if (activeCalendarView.value === 'day') {
        switch (sideBarFilterOption.value) {
          case 'day':
            whereClause = `(${fromCol.title},eq,exactDate,${dayjs(selectedDate.value).format('YYYY-MM-DD')})`
            break
          case 'withoutDates':
            whereClause = `(${fromCol.title},is,blank)`
            break
          case 'allRecords':
            whereClause = ''
            break
        }
      } else if (activeCalendarView.value === 'week') {
        switch (sideBarFilterOption.value) {
          case 'week':
            whereClause = `(${fromCol.title},gte,exactDate,${dayjs(selectedDateRange.value.start).format('YYYY-MM-DD')})~and(${
              fromCol.title
            },lte,exactDate,${dayjs(selectedDateRange.value.end).format('YYYY-MM-DD')})`
            break
          case 'withoutDates':
            whereClause = `(${fromCol.title},is,blank)`
            break
          case 'allRecords':
            whereClause = ''
            break
          case 'selectedDate':
            whereClause = `(${fromCol.title},gte,exactDate,${dayjs(selectedDate.value).format('YYYY-MM-DD')})~and(${
              fromCol.title
            },lte,exactDate,${dayjs(selectedDate.value).format('YYYY-MM-DD')})`
            break
        }
      } else if (activeCalendarView.value === 'month') {
        switch (sideBarFilterOption.value) {
          case 'month':
            whereClause = `(${fromCol.title},gte,exactDate,${dayjs(selectedDate.value)
              .startOf('month')
              .format('YYYY-MM-DD')})~and(${fromCol.title},lte,exactDate,${dayjs(selectedDate.value)
              .endOf('month')
              .format('YYYY-MM-DD')})`
            break
          case 'withoutDates':
            whereClause = `(${fromCol.title},is,blank)`
            break
          case 'allRecords':
            whereClause = ''
            break
          case 'selectedDate':
            whereClause = `(${fromCol.title},gte,exactDate,${dayjs(selectedDate.value).format('YYYY-MM-DD')})~and(${
              fromCol.title
            },lte,exactDate,${dayjs(selectedDate.value).format('YYYY-MM-DD')})`
            break
        }
      } else if (activeCalendarView.value === 'year') {
        switch (sideBarFilterOption.value) {
          case 'year':
            whereClause = `(${fromCol.title},gte,exactDate,${dayjs(selectedDate.value)
              .startOf('year')
              .format('YYYY-MM-DD')})~and(${fromCol.title},lte,exactDate,${dayjs(selectedDate.value)
              .endOf('year')
              .format('YYYY-MM-DD')})`
            break
          case 'withoutDates':
            whereClause = `(${fromCol},is,blank)`
            break
          case 'allRecords':
            whereClause = ''
            break
          case 'selectedDate':
            whereClause = `(${fromCol.title},gte,exactDate,${dayjs(selectedDate.value).format('YYYY-MM-DD')})~and(${
              fromCol.title
            },lte,exactDate,${dayjs(selectedDate.value).format('YYYY-MM-DD')})`
            break
        }
      }

      if (displayField.value && searchQuery.value) {
        if (whereClause.length > 0) {
          whereClause += '~and'
        }
        whereClause += `(${displayField.value.title},like,${searchQuery.value})`
      }
      return whereClause
    })

    async function loadMoreSidebarData(params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) return

      const response = !isPublic.value
        ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
            ...params,
            ...{},
            ...{},
            where: sideBarxWhere.value,
          })
        : await fetchSharedViewData({
            ...params,
            sortsArr: sorts.value,
            filtersArr: nestedFilters.value,
            offset: params.offset,
            where: sideBarxWhere.value,
          })

      formattedSideBarData.value = [...formattedSideBarData.value, ...formatData(response!.list)]
    }

    const filterJSON = computed(() => {
      const combinedFilters = {
        is_group: true,
        logical_op: 'and',
        children: [],
      }

      let fromDate
      let toDate

      if (activeCalendarView.value === 'week') {
        fromDate = dayjs(selectedDateRange.value.start).format('YYYY-MM-DD')
        toDate = dayjs(selectedDateRange.value.end).format('YYYY-MM-DD')
      } else if (activeCalendarView.value === 'day') {
        fromDate = dayjs(selectedDate.value).format('YYYY-MM-DD')
        toDate = dayjs(selectedDate.value).format('YYYY-MM-DD')
      } else if (activeCalendarView.value === 'month') {
        fromDate = dayjs(selectedDate.value).startOf('month').format('YYYY-MM-DD')
        toDate = dayjs(selectedDate.value).endOf('month').format('YYYY-MM-DD')
      } else if (activeCalendarView.value === 'year') {
        fromDate = dayjs(selectedDate.value).startOf('year').format('YYYY-MM-DD')
        toDate = dayjs(selectedDate.value).endOf('year').format('YYYY-MM-DD')
      }

      calendarRange.value.forEach((range) => {
        const fromCol = range.fk_from_col
        const toCol = range.fk_to_col
        let rangeFilter = []

        if (fromCol && toCol) {
          rangeFilter = [
            {
              is_group: true,
              logical_op: 'and',
              children: [
                {
                  is_group: true,
                  logical_op: 'or',
                  children: [
                    {
                      fk_column_id: fromCol.id,
                      comparison_op: 'btw',
                      comparison_sub_op: 'exactDate',
                      value: `${fromDate},${toDate}`,
                    },
                    {
                      fk_column_id: toCol.id,
                      comparison_op: 'btw',
                      comparison_sub_op: 'exactDate',
                      value: `${fromDate},${toDate}`,
                    },
                  ],
                },
                {
                  is_group: true,
                  logical_op: 'or',
                  children: [
                    {
                      fk_column_id: fromCol.id,
                      comparison_op: 'lte',
                      comparison_sub_op: 'exactDate',
                      value: fromDate,
                    },
                    {
                      fk_column_id: toCol.id,
                      comparison_op: 'gte',
                      comparison_sub_op: 'exactDate',
                      value: toDate,
                    },
                  ],
                },
                {
                  is_group: true,
                  logical_op: 'or',
                  children: [
                    {
                      fk_column_id: fromCol.id,
                      comparison_op: 'gte',
                      comparison_sub_op: 'exactDate',
                      value: fromDate,
                    },
                    {
                      fk_column_id: toCol.id,
                      comparison_op: 'lte',
                      comparison_sub_op: 'exactDate',
                      value: toDate,
                    },
                  ],
                },
              ],
            },
            {
              is_group: true,
              logical_op: 'or',
              children: [
                {
                  fk_column_id: fromCol.id,
                  comparison_op: 'eq',
                  logical_op: 'or',
                  comparison_sub_op: 'exactDate',
                  value: fromDate,
                },
                {
                  fk_column_id: toCol.id,
                  comparison_op: 'eq',
                  logical_op: 'or',
                  comparison_sub_op: 'exactDate',
                  value: toDate,
                },
              ],
            },
          ]
        } else if (fromCol) {
          rangeFilter = [
            {
              fk_column_id: fromCol.id,
              comparison_op: 'btw',
              comparison_sub_op: 'exactDate',
              value: `${fromDate},${toDate}`,
            },
          ]
        }
        if (rangeFilter.length > 0) {
          combinedFilters.children.push({
            is_group: true,
            logical_op: 'or',
            children: rangeFilter,
          })
        }
      })

      console.log('combinedFilters', combinedFilters)

      return combinedFilters.children.length > 0 ? [combinedFilters] : []
    })

    // Set of Dates that have data
    const activeDates = computed(() => {
      if (!formattedData.value || !calendarRange.value || !calendarRange.value[0]) return []
      const dates = new Set<Date>()

      formattedData.value.forEach((row) => {
        const start = row.row[calendarRange.value[0].fk_from_col?.title ?? '']
        let end
        if (calendarRange.value[0].fk_to_col) {
          end = row.row[calendarRange.value[0].fk_to_col.title ?? '']
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
            ...(typeof calendarMetaData.value.meta === 'string'
              ? JSON.parse(calendarMetaData.value.meta)
              : calendarMetaData.value.meta),
            active_view: view,
          },
        })
        if (activeCalendarView.value === 'week') {
          selectedTime.value = null
        }
      } catch (e) {
        message.error('Error changing calendar view')
        console.log(e)
      }
    }

    async function loadCalendarMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      // TODO: Fetch Calendar Meta
      const res = isPublic.value ? (sharedView.value?.view as CalendarType) : await $api.dbView.calendarRead(viewMeta.value.id)
      calendarMetaData.value = res
      activeCalendarView.value = typeof res.meta === 'string' ? JSON.parse(res.meta)?.active_view : res.meta?.active_view
      if (!activeCalendarView.value) activeCalendarView.value = 'month'
      displayField.value = meta.value.columns.find((col) => col.pv)
    }

    async function loadCalendarData() {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id || !filterJSON.value) && !isPublic?.value) return
      isCalendarDataLoading.value = true
      const res = !isPublic.value
        ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
            ...queryParams.value,
            ...(isUIAllowed('filterSync')
              ? { filterArrJson: JSON.stringify([...filterJSON.value]) }
              : { filterArrJson: JSON.stringify([nestedFilters.value, ...filterJSON.value]) }),
            where: where?.value ?? '',
          })
        : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value })
      formattedData.value = formatData(res!.list)
      isCalendarDataLoading.value = false
    }

    async function updateCalendarMeta(updateObj: Partial<CalendarType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit')) return
      await $api.dbView.calendarUpdate(viewMeta.value.id, updateObj)
    }

    const paginateCalendarView = async (action: 'next' | 'prev') => {
      switch (activeCalendarView.value) {
        case 'month':
          selectedDate.value = action === 'next' ? addMonths(selectedDate.value, 1) : addMonths(selectedDate.value, -1)
          pageDate.value = action === 'next' ? addMonths(pageDate.value, 1) : addMonths(pageDate.value, -1)
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

    const loadSidebarData = async () => {
      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) return
      isSidebarLoading.value = true
      const res = await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
        ...queryParams.value,
        ...{},
        where: sideBarxWhere?.value,
        ignoreViewFilters: true,
      })

      formattedSideBarData.value = formatData(res!.list)
      isSidebarLoading.value = false
    }

    watch(selectedDate, async () => {
      if (activeCalendarView.value === 'month' || activeCalendarView.value === 'week') {
        await loadSidebarData()
      } else {
        await Promise.all([loadCalendarData(), loadSidebarData()])
      }
    })

    watch(selectedDateRange, async () => {
      if (activeCalendarView.value !== 'week') return
      await Promise.all([loadCalendarData(), loadSidebarData()])
    })

    watch(activeCalendarView, async () => {
      sideBarFilterOption.value = activeCalendarView.value ?? 'allRecords'
      await Promise.all([loadCalendarData(), loadSidebarData()])
    })

    watch(sideBarFilterOption, async () => {
      await loadSidebarData()
    })

    watch(searchQuery, async () => {
      await loadSidebarData()
    })

    return {
      formattedSideBarData,
      loadMoreSidebarData,
      loadSidebarData,
      displayField,
      sideBarFilterOption,
      searchQuery,
      activeDates,
      isCalendarDataLoading,
      changeCalendarView,
      calDataType,
      loadCalendarMeta,
      calendarRange,
      loadCalendarData,
      formattedData,
      isSidebarLoading,
      selectedTime,
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
