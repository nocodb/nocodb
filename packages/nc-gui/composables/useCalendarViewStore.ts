import type { ComputedRef, Ref } from 'vue'
import {
  type Api,
  type CalendarRangeType,
  type CalendarType,
  type ColumnType,
  FormulaDataTypes,
  type PaginatedType,
  type TableType,
  UITypes,
  type ViewType,
  isSystemColumn,
  isVirtualCol,
} from 'nocodb-sdk'
import dayjs from 'dayjs'

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
    meta: Ref<TableType | undefined>,
    viewMeta:
      | Ref<(ViewType | CalendarType | undefined) & { id: string }>
      | ComputedRef<
          | (ViewType & {
              id: string
            })
          | undefined
        >,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const { isUIAllowed } = useRoles()

    const { isMobileMode } = useGlobal()

    const displayField = computed(() => meta.value?.columns?.find((c) => c.pv))

    const activeCalendarView = ref<'month' | 'year' | 'day' | 'week'>()

    // The range of columns that are used for the calendar view
    const calendarRange = ref<
      Array<{
        fk_from_col: ColumnType
        fk_to_col?: ColumnType | null
        id: string
        is_readonly: boolean
      }>
    >([])

    const calDataType = computed(() => {
      if (!calendarRange.value || !calendarRange.value[0]) return null
      return calendarRange.value[0]?.fk_from_col?.uidt
    })

    const timezone = computed(() => {
      if (!calendarRange.value || !calendarRange.value[0]) return dayjs.tz.guess()
      return calendarRange.value[0]?.fk_from_col?.meta?.timezone ?? dayjs.tz.guess()
    })

    const timezoneDayjs = reactive(workerWithTimezone(isEeUI, timezone?.value))

    const searchQuery = reactive({
      value: '',
      field: '',
    })

    const pageDate = ref<dayjs.Dayjs>(timezoneDayjs.dayjsTz())

    const selectedDate = ref<dayjs.Dayjs>(timezoneDayjs.dayjsTz())

    const selectedTime = ref<dayjs.Dayjs>(timezoneDayjs.dayjsTz())

    const selectedMonth = ref<dayjs.Dayjs>(timezoneDayjs.dayjsTz())

    const isCalendarDataLoading = ref<boolean>(false)

    const isCalendarMetaLoading = ref<boolean>(false)

    // show/hide side menu in calendar
    const showSideMenu = ref(!isMobileMode.value)

    // reactive ref for the selected date range - used in week view
    const selectedDateRange = ref<{
      start: dayjs.Dayjs
      end: dayjs.Dayjs
    }>({
      start: timezoneDayjs.dayjsTz(selectedDate.value)!.startOf('week'), // This will be the previous Monday
      end: timezoneDayjs.dayjsTz(selectedDate.value)!.startOf('week').add(6, 'day'), // This will be the following Sunday
    })

    const defaultPageSize = 25

    const formattedData = ref<Row[]>([])

    const formattedSideBarData = ref<Row[]>([])

    const isSidebarLoading = ref<boolean>(false)

    const activeDates = ref<dayjs.Dayjs[]>([])

    // The active filter in the sidebar
    const sideBarFilterOption = ref<string>(activeCalendarView.value ?? 'allRecords')

    const { api } = useApi()

    const { isMysql } = useBase()

    const { base } = storeToRefs(useBase())

    const { $api, $e } = useNuxtApp()

    const { t } = useI18n()

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const isPublic = ref(shared) || inject(IsPublicInj, ref(false))

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { sharedView, fetchSharedViewData, fetchSharedViewActiveDate, fetchSharedCalendarViewData } = useSharedView()

    const calendarMetaData = ref<CalendarType>({})

    const paginationData = ref<PaginatedType>({ page: 1, pageSize: defaultPageSize })

    const queryParams = computed(() => ({
      limit: paginationData.value.pageSize ?? defaultPageSize,
      where: where?.value ?? '',
    }))

    // In timezone is removed from the date string for mysql for reverse compatibility upto mysql5
    const updateFormat = computed(() => {
      return isMysql(meta.value?.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'
    })

    // The current view meta properties
    const viewMetaProperties = computed<{
      active_view: string
      hide_weekend: boolean
    }>(() => {
      let meta = calendarMetaData.value?.meta ?? {}

      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta)
        } catch (e) {}
      }

      return meta as {
        active_view: string
        hide_weekend: boolean
      }
    })

    // sideBarFilter - The sideBar filter is automatically generated based on the current calendar view
    // and the search query
    const sideBarFilter = computed(() => {
      let combinedFilters: any = []

      if (!calendarRange.value) return []
      if (sideBarFilterOption.value === 'allRecords') {
        // If the sideBarFilterOption is allRecords, then we don't need to apply any filters
        combinedFilters = []
      } else if (sideBarFilterOption.value === 'withoutDates') {
        // If the sideBarFilterOption is withoutDates, then we need to filter out records that don't have a date
        calendarRange.value.forEach((range) => {
          const fromCol = range.fk_from_col
          const toCol = range.fk_to_col
          if (!fromCol) return
          const filters = []

          if (fromCol) {
            filters.push({
              fk_column_id: fromCol.id,
              logical_op: 'or',
              comparison_op: 'blank',
            })
          }

          if (toCol) {
            filters.push({
              fk_column_id: toCol.id,
              logical_op: 'or',
              comparison_op: 'blank',
            })
          }
          // Combine the filters for this range with the overall filter array
          combinedFilters = [...combinedFilters, ...filters]
        })
        // Wrap the combined filters in a group
        combinedFilters = [
          {
            is_group: true,
            logical_op: 'or',
            children: combinedFilters,
          },
        ]
      } else if (
        sideBarFilterOption.value === 'week' ||
        sideBarFilterOption.value === 'month' ||
        sideBarFilterOption.value === 'day' ||
        sideBarFilterOption.value === 'year' ||
        sideBarFilterOption.value === 'selectedDate' ||
        sideBarFilterOption.value === 'selectedHours'
      ) {
        let prevDate: string | null | dayjs.Dayjs = null
        let fromDate: string | null | dayjs.Dayjs = null
        let toDate: string | null | dayjs.Dayjs = null
        let nextDate: string | null | dayjs.Dayjs = null

        switch (sideBarFilterOption.value) {
          case 'day':
          case 'selectedDate':
            fromDate = selectedDate.value.startOf('day')
            toDate = selectedDate.value.endOf('day')
            prevDate = selectedDate.value.subtract(1, 'day').endOf('day')
            nextDate = selectedDate.value.add(1, 'day').startOf('day')
            break
          case 'week':
            fromDate = selectedDateRange.value.start.startOf('week')
            toDate = selectedDateRange.value.end.endOf('week')
            prevDate = timezoneDayjs.timezonize(fromDate.subtract(1, 'day')).endOf('day')
            nextDate = timezoneDayjs.timezonize(toDate.add(1, 'day')).startOf('day')
            break
          case 'month': {
            const startOfMonth = timezoneDayjs.timezonize(selectedMonth.value.startOf('month'))
            const firstDayToDisplay = timezoneDayjs.timezonize(startOfMonth.startOf('week'))
            const endOfMonth = timezoneDayjs.timezonize(selectedMonth.value.endOf('month')).endOf('week')

            fromDate = firstDayToDisplay
            toDate = endOfMonth
            prevDate = fromDate.subtract(1, 'day').endOf('day')
            nextDate = toDate.add(1, 'day').startOf('day')
            break
          }
          case 'year':
            fromDate = selectedDate.value.startOf('year')
            toDate = selectedDate.value.endOf('year')
            prevDate = timezoneDayjs.timezonize(fromDate.subtract(1, 'day')).endOf('day')
            nextDate = toDate.add(1, 'day').startOf('day')
            break
          case 'selectedHours':
            fromDate = timezoneDayjs.timezonize((selectedTime.value ?? timezoneDayjs.dayjsTz()).startOf('hour'))
            toDate = timezoneDayjs.timezonize((selectedTime.value ?? timezoneDayjs.dayjsTz()).endOf('hour'))
            prevDate = timezoneDayjs.timezonize(fromDate?.subtract(1, 'hour').endOf('hour'))
            nextDate = timezoneDayjs.timezonize(toDate?.add(1, 'hour').startOf('hour'))

            break
        }
        fromDate = timezoneDayjs.dayjsTz(fromDate)!.format('YYYY-MM-DD HH:mm:ssZ')
        prevDate = timezoneDayjs.dayjsTz(prevDate!).format('YYYY-MM-DD HH:mm:ssZ')
        nextDate = timezoneDayjs.dayjsTz(nextDate)!.format('YYYY-MM-DD HH:mm:ssZ')
        toDate = timezoneDayjs.dayjsTz(toDate)!.format('YYYY-MM-DD HH:mm:ssZ')

        console.log({
          fromDate,
          toDate,
          prevDate,
          nextDate,
        })
        calendarRange.value.forEach((range) => {
          const fromCol = range.fk_from_col
          const toCol = range.fk_to_col
          let rangeFilter: any = []

          if (fromCol && toCol) {
            rangeFilter = [
              {
                is_group: true,
                logical_op: 'and',
                children: [
                  {
                    fk_column_id: fromCol.id,
                    comparison_op: 'lt',
                    comparison_sub_op: 'exactDate',
                    value: nextDate,
                  },
                  {
                    fk_column_id: toCol.id,
                    comparison_op: 'gt',
                    comparison_sub_op: 'exactDate',
                    value: prevDate,
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
                    value: fromDate as string,
                  },
                  {
                    fk_column_id: fromCol.id,
                    comparison_op: 'lte',
                    comparison_sub_op: 'exactDate',
                    value: toDate as string,
                  },
                ],
              },
            ]
            combinedFilters.push({
              is_group: true,
              logical_op: 'or',
              children: rangeFilter,
            })
          } else if (fromCol) {
            rangeFilter = [
              {
                fk_column_id: fromCol.id,
                comparison_op: 'lt',
                comparison_sub_op: 'exactDate',
                value: nextDate,
              },
              {
                fk_column_id: fromCol.id,
                comparison_op: 'gt',
                comparison_sub_op: 'exactDate',
                value: prevDate,
              },
            ]
            combinedFilters.push({
              is_group: true,
              logical_op: 'and',
              children: rangeFilter,
            })
          }
        })
      }

      if (displayField.value && searchQuery.value) {
        if (combinedFilters.length > 0) {
          combinedFilters = [
            {
              is_group: true,
              logical_op: 'and',
              children: [
                ...combinedFilters,
                {
                  fk_column_id: displayField.value.id,
                  comparison_op: 'like',
                  value: searchQuery.value,
                },
              ],
            },
          ]
        } else {
          combinedFilters.push({
            fk_column_id: displayField.value.id,
            comparison_op: 'like',
            value: searchQuery.value,
          })
        }
      }

      return combinedFilters
    })

    async function loadMoreSidebarData(params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
      if (((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) || !calendarRange.value?.length)
        return
      if (isSidebarLoading.value) return
      try {
        const response = !isPublic.value
          ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id, {
              ...params,
              offset: params.offset,
              ...{},
              ...{},
              ...(isUIAllowed('filterSync')
                ? { filterArrJson: JSON.stringify([...sideBarFilter.value]) }
                : { filterArrJson: JSON.stringify([nestedFilters.value, ...sideBarFilter.value]) }),
            })
          : await fetchSharedViewData({
              ...params,
              sortsArr: sorts.value,
              filtersArr: [...nestedFilters.value, ...sideBarFilter.value],
              offset: params.offset,
            })
        formattedSideBarData.value = [...formattedSideBarData.value, ...formatData(response!.list)]
      } catch (e) {
        console.log(e)
      }
    }

    // Fetch the dates which have records in the calendar
    const fetchActiveDates = async () => {
      if (activeCalendarView.value === 'month') {
        return
      }

      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id || !calendarRange.value?.length) return
      let prevDate: string | null | dayjs.Dayjs = null
      let fromDate: dayjs.Dayjs | null | string = null
      let toDate: dayjs.Dayjs | null | string = null
      let nextDate: string | null | dayjs.Dayjs = null

      if (activeCalendarView.value === 'week' || activeCalendarView.value === 'day') {
        const startOfMonth = timezoneDayjs.timezonize(pageDate.value.startOf('month'))
        fromDate = timezoneDayjs.timezonize(startOfMonth.startOf('week'))
        toDate = timezoneDayjs.timezonize(pageDate.value.endOf('month').endOf('week'))
        prevDate = fromDate.subtract(1, 'day').endOf('day')
        nextDate = toDate.startOf('day')
      } else if (activeCalendarView.value === 'year') {
        const startOfYear = timezoneDayjs.timezonize(selectedDate.value.startOf('year'))
        fromDate = timezoneDayjs.timezonize(startOfYear.startOf('week'))
        toDate = timezoneDayjs.timezonize(selectedDate.value.endOf('year')).endOf('week')
        prevDate = fromDate.subtract(1, 'day').endOf('day')
        nextDate = toDate.startOf('day')
      }

      prevDate = timezoneDayjs.dayjsTz(prevDate!).format('YYYY-MM-DD HH:mm:ssZ')
      nextDate = timezoneDayjs.dayjsTz(nextDate)!.format('YYYY-MM-DD HH:mm:ssZ')
      fromDate = timezoneDayjs.dayjsTz(fromDate)!.format('YYYY-MM-DD HH:mm:ssZ')
      toDate = timezoneDayjs.dayjsTz(toDate)!.format('YYYY-MM-DD HH:mm:ssZ')

      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) return

      try {
        const res = !isPublic.value
          ? await api.dbCalendarViewRowCount.dbCalendarViewRowCount('noco', base.value.id!, meta.value!.id!, viewMeta.value.id, {
              ...queryParams.value,
              from_date: fromDate,
              to_date: toDate,
              next_date: nextDate,
              prev_date: prevDate,
            })
          : await fetchSharedViewActiveDate({
              from_date: prevDate,
              to_date: nextDate,
              next_date: nextDate,
              prev_date: prevDate,
              sortsArr: sorts.value,
              filtersArr: nestedFilters.value,
            })
        activeDates.value = res.dates.map((dateObj: unknown) => timezoneDayjs.timezonize(dateObj as string))

        if (res.count > 3000 && activeCalendarView.value !== 'year') {
          message.warning(
            'This current date range has more than 3000 records. Some records may not be displayed. To get complete records, contact support',
          )
        }
      } catch (e) {
        activeDates.value = []
        message.error(
          `${t('msg.error.fetchingActiveDates')} ${await extractSdkResponseErrorMsg(
            e as Error & {
              response: { data: { message: string } }
            },
          )}`,
        )
        console.log(e)
      }
    }

    // Update the calendar view
    const changeCalendarView = async (view: 'month' | 'year' | 'day' | 'week') => {
      $e('c:calendar:change-calendar-view', view)

      try {
        activeCalendarView.value = view

        if (isUIAllowed('calendarViewUpdate')) {
          await updateCalendarMeta({
            meta: {
              ...(typeof calendarMetaData.value.meta === 'string'
                ? JSON.parse(calendarMetaData.value.meta)
                : calendarMetaData.value.meta),
              active_view: view,
            },
          })
        }

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
      isCalendarMetaLoading.value = true
      try {
        const res = isPublic.value ? (sharedView.value?.view as CalendarType) : await $api.dbView.calendarRead(viewMeta.value.id)
        calendarMetaData.value = res
        const calMeta = typeof res.meta === 'string' ? JSON.parse(res.meta) : res.meta
        activeCalendarView.value = calMeta?.active_view
        if (!activeCalendarView.value) activeCalendarView.value = 'month'
        calendarRange.value = res?.calendar_range
          ?.map(
            (
              range: CalendarRangeType & {
                id?: string
              },
            ) => {
              const fromCol = meta.value?.columns?.find((col) => col.id === range.fk_from_column_id)
              const toCol = range.fk_to_column_id ? meta.value?.columns?.find((col) => col.id === range.fk_to_column_id) : null

              if (fromCol?.uidt === UITypes.Formula || toCol?.uidt === UITypes.Formula) {
                // Check if fromCol Formula return type is Date
                const isFromColDate =
                  fromCol?.uidt === UITypes.Formula &&
                  (fromCol?.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.DATE
                // Check if toCol Formula return type is Date

                const isToColDate =
                  toCol?.uidt === UITypes.Formula && (toCol?.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.DATE

                if (!isFromColDate) {
                  message.error(`Please update the Formula column ${fromCol?.title} to return a date`)
                  return null
                }

                if (toCol && !isToColDate) {
                  message.error(`Please update the Formula column ${toCol?.title} to return a date`)
                  return null
                }
              }

              return {
                id: range?.id,
                fk_from_col: fromCol,
                fk_to_col: toCol,
                is_readonly: [fromCol, toCol].some((col) => isSystemColumn(col) || isVirtualCol(col)),
              }
            },
          )
          .filter(Boolean) as any
      } catch (e: unknown) {
        message.error(
          `Error loading calendar meta ${await extractSdkResponseErrorMsg(
            e as Error & {
              response: { data: { message: string } }
            },
          )}`,
        )
      } finally {
        isCalendarMetaLoading.value = false
      }
    }

    async function loadCalendarData(showLoading = true) {
      if (((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic?.value) || !calendarRange.value?.length)
        return

      if (activeCalendarView.value === 'year') {
        return
      }

      let prevDate: string | null | dayjs.Dayjs = null
      let fromDate: dayjs.Dayjs | null | string = null
      let toDate: dayjs.Dayjs | null | string = null
      let nextDate: string | null | dayjs.Dayjs = null

      switch (activeCalendarView.value) {
        case 'day':
          prevDate = selectedDate.value.subtract(1, 'day').endOf('day')
          nextDate = selectedDate.value.add(1, 'day').startOf('day')
          fromDate = selectedDate.value.startOf('day')
          toDate = selectedDate.value.endOf('day')
          break
        case 'week':
          fromDate = selectedDateRange.value.start.startOf('week')
          toDate = selectedDateRange.value.end.endOf('week')

          prevDate = timezoneDayjs.timezonize(fromDate.subtract(1, 'day')).endOf('day')
          nextDate = timezoneDayjs.timezonize(toDate.add(1, 'day')).startOf('day')

          // Hide weekends
          if (viewMetaProperties.value?.hide_weekend) {
            toDate = timezoneDayjs.timezonize(toDate.subtract(2, 'day')).endOf('day')
            nextDate = timezoneDayjs.timezonize(nextDate!.subtract(2, 'day')).startOf('day')
          }
          break
        case 'month': {
          const startOfMonth = timezoneDayjs.timezonize(selectedMonth.value.startOf('month'))
          const firstDayToDisplay = timezoneDayjs.timezonize(startOfMonth.startOf('week'))
          const endOfMonth = timezoneDayjs.timezonize(selectedMonth.value.endOf('month')).endOf('week')

          fromDate = firstDayToDisplay
          toDate = endOfMonth
          prevDate = fromDate.subtract(1, 'day').endOf('day')
          nextDate = toDate.add(1, 'day').startOf('day')
          break
        }
      }
      prevDate = timezoneDayjs.dayjsTz(prevDate!).format('YYYY-MM-DD HH:mm:ssZ')
      nextDate = timezoneDayjs.dayjsTz(nextDate)!.format('YYYY-MM-DD HH:mm:ssZ')
      fromDate = timezoneDayjs.dayjsTz(fromDate)!.format('YYYY-MM-DD HH:mm:ssZ')
      toDate = timezoneDayjs.dayjsTz(toDate)!.format('YYYY-MM-DD HH:mm:ssZ')

      try {
        if (showLoading) isCalendarDataLoading.value = true

        const res = !isPublic.value
          ? await api.dbCalendarViewRow.list(
              'noco',
              base.value.id!,
              meta.value!.id!,
              viewMeta.value!.id!,
              {
                prev_date: prevDate,
                next_date: nextDate,
                to_date: toDate,
                from_date: fromDate,
              },
              {
                ...queryParams.value,
                ...(isUIAllowed('filterSync') ? { filterArrJson: [] } : { filterArrJson: JSON.stringify([nestedFilters.value]) }),
                where: where?.value ?? '',
                filterArrJson: JSON.stringify([...nestedFilters.value]),
              },
            )
          : await fetchSharedCalendarViewData({
              sortsArr: sorts.value,
              prev_date: prevDate,
              next_date: nextDate,
              to_date: toDate,
              from_date: fromDate,
              filtersArr: nestedFilters.value,
            })
        formattedData.value = formatData(res!.list)
      } catch (e) {
        message.error(
          `${t('msg.error.fetchingCalendarData')} ${await extractSdkResponseErrorMsg(
            e as Error & {
              response: { data: { message: string } }
            },
          )}`,
        )
        console.log(e)
      } finally {
        isCalendarDataLoading.value = false
      }
    }

    async function updateCalendarMeta(updateObj: Partial<CalendarType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('viewCreateOrEdit', { skipSourceCheck: true }) || isPublic.value) return

      const updateValue = {
        ...(typeof calendarMetaData.value.meta === 'string'
          ? JSON.parse(calendarMetaData.value.meta)
          : calendarMetaData.value.meta),
        ...(typeof updateObj.meta === 'string' ? JSON.parse(updateObj.meta) : updateObj.meta),
      }

      try {
        await $api.dbView.calendarUpdate(viewMeta.value.id, {
          ...updateObj,
          meta: JSON.stringify(updateValue),
        })
        calendarMetaData.value = {
          ...calendarMetaData.value,
          ...updateObj,
          meta: updateValue,
        }
      } catch (e) {
        message.error('Error updating changes')
        console.log(e)
      }
    }

    function findRowInState(rowData: Record<string, any>) {
      const pk: Record<string, string> = rowPkData(rowData, meta?.value?.columns as ColumnType[])
      for (const row of formattedData.value) {
        if (Object.keys(pk).every((k) => pk[k] === row.row[k])) {
          return row
        }
      }
    }

    const paginateCalendarView = async (action: 'next' | 'prev') => {
      switch (activeCalendarView.value) {
        case 'month':
          selectedMonth.value = action === 'next' ? selectedMonth.value.add(1, 'month') : selectedMonth.value.subtract(1, 'month')
          pageDate.value = action === 'next' ? pageDate.value.add(1, 'month') : pageDate.value.subtract(1, 'month')
          // selectedDate.value = action === 'next' ? addMonths(selectedDate.value, 1) : addMonths(selectedDate.value, -1)
          if (pageDate.value.year() !== selectedDate.value.year()) {
            pageDate.value = selectedDate.value
          }
          break
        case 'year':
          selectedDate.value = action === 'next' ? selectedDate.value.add(1, 'year') : selectedDate.value.subtract(1, 'year')
          if (pageDate.value.year() !== selectedDate.value.year()) {
            pageDate.value = selectedDate.value
          }
          break
        case 'day':
          selectedDate.value = action === 'next' ? selectedDate.value.add(1, 'day') : selectedDate.value.subtract(1, 'day')
          selectedTime.value = selectedDate.value
          if (pageDate.value.year() !== selectedDate.value.year()) {
            pageDate.value = selectedDate.value
          } else if (pageDate.value.month() !== selectedDate.value.month()) {
            pageDate.value = selectedDate.value
          }
          break
        case 'week':
          selectedDateRange.value =
            action === 'next'
              ? {
                  start: selectedDateRange.value.start.add(7, 'day'),
                  end: selectedDateRange.value.end.add(7, 'day'),
                }
              : {
                  start: selectedDateRange.value.start.subtract(7, 'day'),
                  end: selectedDateRange.value.end.subtract(7, 'day'),
                }
          if (pageDate.value.month() !== selectedDateRange.value.end.month()) {
            pageDate.value = selectedDateRange.value.start
          }
          break
      }
    }

    const loadSidebarData = async (showLoading = true) => {
      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id || !calendarRange.value?.length) return
      try {
        if (showLoading) isSidebarLoading.value = true
        const res = !isPublic.value
          ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value.id, {
              ...queryParams.value,
              ...{},
              ...{},
              ...{ filterArrJson: JSON.stringify([...sideBarFilter.value]) },
            })
          : await fetchSharedViewData({
              sortsArr: sorts.value,
              filtersArr: [...nestedFilters.value, ...sideBarFilter.value],
            })

        formattedSideBarData.value = formatData(res!.list)
      } catch (e) {
        message.error(
          `${t('msg.error.fetchingCalendarData')} ${await extractSdkResponseErrorMsg(
            e as Error & {
              response: { data: { message: string } }
            },
          )}`,
        )
        console.log(e)
      } finally {
        isSidebarLoading.value = false
      }
    }

    async function updateRowProperty(toUpdate: Row, property: string[], undo = false) {
      try {
        const id = extractPkFromRow(toUpdate.row, meta?.value?.columns as ColumnType[])

        const updateObj = property.reduce(
          (
            acc: {
              [x: string]: string
            },
            curr,
          ) => {
            acc[curr] = toUpdate.row[curr]
            return acc
          },
          {},
        )

        const updatedRowData = await $api.dbViewRow.update(
          NOCO,
          base?.value.id as string,
          meta.value?.id as string,
          viewMeta?.value?.id as string,
          encodeURIComponent(id),
          updateObj,
          // todo:
          // {
          //   query: { ignoreWebhook: !saved }
          // }
        )

        if (!undo) {
          addUndo({
            redo: {
              fn: async (toUpdate: Row, property: string[]) => {
                const updatedRow = await updateRowProperty(toUpdate, property, true)
                const row = findRowInState(toUpdate.row)
                if (row) {
                  Object.assign(row.row, updatedRow)
                }
                Object.assign(row?.oldRow, updatedRow)
              },
              args: [clone(toUpdate), property],
            },
            undo: {
              fn: async (toUpdate: Row, property: string[]) => {
                const updatedData = await updateRowProperty(
                  { row: toUpdate.oldRow, oldRow: toUpdate.row, rowMeta: toUpdate.rowMeta },
                  property,
                  true,
                )
                const row = findRowInState(toUpdate.row)
                if (row) {
                  Object.assign(row.row, updatedData)
                }
                Object.assign(row!.oldRow, updatedData)
              },
              args: [clone(toUpdate), property],
            },
            scope: defineViewScope({ view: viewMeta.value as ViewType }),
          })
          Object.assign(toUpdate.row, updatedRowData)
          Object.assign(toUpdate.oldRow, updatedRowData)
        }

        const upPk = extractPkFromRow(updatedRowData, meta?.value?.columns as ColumnType[])

        formattedSideBarData.value = formattedSideBarData.value.map((row) => {
          if (extractPkFromRow(row.row, meta?.value?.columns as ColumnType[]) === upPk) {
            Object.assign(row.row, updatedRowData)
            Object.assign(row.oldRow, updatedRowData)
          }
          return row
        })

        await fetchActiveDates()
        return updatedRowData
      } catch (e: any) {
        message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    watch(selectedDate, async (value, oldValue) => {
      if (activeCalendarView.value === 'month' || activeCalendarView.value === 'week') {
        if (sideBarFilterOption.value === 'selectedDate' && showSideMenu.value) {
          await loadSidebarData()
        }
      } else if (activeCalendarView.value === 'year') {
        if (value.year() !== oldValue.year()) {
          await Promise.all([loadCalendarData(), loadSidebarData(), await fetchActiveDates()])
        } else if (sideBarFilterOption.value === 'selectedDate' && showSideMenu.value) {
          await loadSidebarData()
        }
      } else {
        if (showSideMenu.value) {
          await Promise.all([loadSidebarData(), loadCalendarData()])
        } else {
          await Promise.all([loadCalendarData()])
        }
      }

      if (activeCalendarView.value === 'year' && value.year() !== oldValue.year()) {
        await fetchActiveDates()
      }
    })

    watch(selectedTime, async () => {
      if (calDataType.value !== UITypes.Date && showSideMenu.value && sideBarFilterOption.value === 'selectedHours') {
        await loadSidebarData()
      }
    })

    watch(selectedMonth, async () => {
      if (activeCalendarView.value !== 'month') return
      await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
    })

    watch(selectedDateRange, async () => {
      if (activeCalendarView.value !== 'week') return
      await Promise.all([loadCalendarData(), loadSidebarData()])
    })

    watch(activeCalendarView, async (value, oldValue) => {
      if (oldValue === 'week') {
        pageDate.value = selectedDate.value
        selectedMonth.value = selectedDate.value ?? selectedDateRange.value.start
        selectedDate.value = selectedDate.value ?? selectedDateRange.value.start
        selectedTime.value = selectedDate.value ?? selectedDateRange.value.start
      } else if (oldValue === 'month') {
        pageDate.value = selectedDate.value
        selectedTime.value = selectedDate.value
        selectedDateRange.value = {
          start: selectedDate.value.startOf('week'),
          end: selectedDate.value.endOf('week'),
        }
      } else if (oldValue === 'day') {
        pageDate.value = selectedDate.value
        selectedTime.value = selectedDate.value
        selectedMonth.value = selectedDate.value
        selectedDateRange.value = {
          start: selectedDate.value.startOf('week'),
          end: selectedDate.value.endOf('week'),
        }
      } else if (oldValue === 'year') {
        selectedMonth.value = selectedDate.value
        selectedTime.value = selectedDate.value
        pageDate.value = selectedDate.value
        selectedDateRange.value = {
          start: selectedDate.value.startOf('week'),
          end: selectedDate.value.endOf('week'),
        }
      }
      sideBarFilterOption.value = activeCalendarView.value ?? 'allRecords'
      if (activeCalendarView.value === 'year') {
        await Promise.all([loadSidebarData(), fetchActiveDates()])
      } else {
        await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
      }
    })

    watch(showSideMenu, async (val) => {
      if (val) await loadSidebarData()
    })

    watch(sideBarFilterOption, async () => {
      $e('a:calendar:sidebar-filter', sideBarFilterOption.value)
      await loadSidebarData()
    })

    watch(searchQuery, async () => {
      await loadSidebarData()
    })

    watch(pageDate, async () => {
      if (activeCalendarView.value === 'year') return
      await fetchActiveDates()
    })

    watch(timezone, (newTimezone) => {
      const temp = workerWithTimezone(true, newTimezone)
      timezoneDayjs.dayjsTz = temp.dayjsTz
      timezoneDayjs.timezonize = temp.timezonize
      pageDate.value = timezoneDayjs.timezonize(pageDate.value)!
      selectedDate.value = timezoneDayjs.timezonize(selectedDate.value)!
      selectedTime.value = timezoneDayjs.timezonize(selectedTime.value)!
      selectedMonth.value = timezoneDayjs.timezonize(selectedMonth.value)!
      selectedDateRange.value = {
        start: selectedDate.value.startOf('week'),
        end: selectedDate.value.endOf('week'),
      }
    })

    watch(
      () => viewMetaProperties.value.hide_weekend,
      async () => {
        if (activeCalendarView.value === 'week') {
          await loadCalendarData()
        }
      },
    )

    return {
      fetchActiveDates,
      formattedSideBarData,
      loadMoreSidebarData,
      updateCalendarMeta,
      loadSidebarData,
      displayField,
      sideBarFilterOption,
      searchQuery,
      activeDates,
      isCalendarDataLoading,
      isCalendarMetaLoading,
      changeCalendarView,
      calDataType,
      loadCalendarMeta,
      calendarRange,
      loadCalendarData,
      formattedData,
      isSidebarLoading,
      showSideMenu,
      selectedTime,
      calendarMetaData,
      updateRowProperty,
      activeCalendarView,
      pageDate,
      paginationData,
      selectedDate,
      selectedMonth,
      selectedDateRange,
      paginateCalendarView,
      viewMetaProperties,
      updateFormat,
      timezoneDayjs,
      timezone,
    }
  },
)

export { useProvideCalendarViewStore }

export function useCalendarViewStoreOrThrow() {
  const calendarViewStore = useCalendarViewStore()

  if (calendarViewStore == null) throw new Error('Please call `useProvideCalendarViewStore` on the appropriate parent component')

  return calendarViewStore
}
