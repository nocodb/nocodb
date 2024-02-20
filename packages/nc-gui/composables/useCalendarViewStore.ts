import type { ComputedRef, Ref } from 'vue'
import {
  type Api,
  type CalendarType,
  type ColumnType,
  type PaginatedType,
  type TableType,
  UITypes,
  type ViewType,
} from 'nocodb-sdk'
import dayjs from 'dayjs'
import { extractPkFromRow, extractSdkResponseErrorMsg, rowPkData } from '~/utils'
import { IsPublicInj, type Row, ref, storeToRefs, useBase, useInjectionState, useUndoRedo } from '#imports'

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

    const pageDate = ref<dayjs.Dayjs>(dayjs())

    const { isUIAllowed } = useRoles()

    const displayField = computed(() => meta.value?.columns?.find((c) => c.pv))

    const activeCalendarView = ref<'month' | 'year' | 'day' | 'week'>()

    const searchQuery = reactive({
      value: '',
      field: '',
    })

    const selectedDate = ref<dayjs.Dayjs>(dayjs())

    const selectedTime = ref<dayjs.Dayjs>(dayjs())

    const selectedMonth = ref<dayjs.Dayjs>(dayjs())

    const isCalendarDataLoading = ref<boolean>(false)

    const showSideMenu = ref(true)

    const selectedDateRange = ref<{
      start: dayjs.Dayjs
      end: dayjs.Dayjs
    }>({
      start: dayjs(selectedDate.value).startOf('week'), // This will be the previous Monday
      end: dayjs(selectedDate.value).startOf('week').add(6, 'day'), // This will be the following Sunday
    })

    const defaultPageSize = 25

    const formattedData = ref<Row[]>([])

    const formattedSideBarData = ref<Row[]>([])

    const isSidebarLoading = ref<boolean>(false)

    const activeDates = ref<dayjs.Dayjs[]>([])

    const sideBarFilterOption = ref<string>(activeCalendarView.value ?? 'allRecords')

    const { api } = useApi()

    const { base } = storeToRefs(useBase())

    const { $api } = useNuxtApp()

    const { t } = useI18n()

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const isPublic = ref(shared) || inject(IsPublicInj, ref(false))

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { sharedView, fetchSharedViewData, fetchSharedViewActiveDate } = useSharedView()

    const calendarMetaData = ref<CalendarType>({})

    const paginationData = ref<PaginatedType>({ page: 1, pageSize: defaultPageSize })

    const queryParams = computed(() => ({
      limit: paginationData.value.pageSize ?? defaultPageSize,
      where: where?.value ?? '',
    }))

    const calendarRange = ref<
      Array<{
        fk_from_col: ColumnType | null
        fk_to_col: ColumnType | null
      }>
    >([])

    const calDataType = computed(() => {
      if (!calendarRange.value || !calendarRange.value[0]) return null
      return calendarRange.value[0]!.fk_from_col!.uidt
    })

    const sideBarFilter = computed(() => {
      let combinedFilters: any = []

      if (sideBarFilterOption.value === 'allRecords') {
        combinedFilters = []
      } else if (sideBarFilterOption.value === 'withoutDates') {
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
            fromDate = selectedDate.value.startOf('day')
            toDate = selectedDate.value.endOf('day')
            prevDate = selectedDate.value.subtract(1, 'day').endOf('day')
            nextDate = selectedDate.value.add(1, 'day').startOf('day')
            break
          case 'week':
            fromDate = selectedDateRange.value.start.startOf('day')
            toDate = selectedDateRange.value.end.endOf('day')
            prevDate = selectedDateRange.value.start.subtract(1, 'day').endOf('day')
            nextDate = selectedDateRange.value.end.add(1, 'day').startOf('day')
            break
          case 'month': {
            const startOfMonth = selectedMonth.value.startOf('month')
            const endOfMonth = selectedMonth.value.endOf('month')

            const daysToDisplay = Math.max(endOfMonth.diff(startOfMonth, 'day') + 1, 35)
            fromDate = startOfMonth.subtract((startOfMonth.day() + 7) % 7, 'day').add(1, 'day')
            toDate = fromDate.add(daysToDisplay, 'day').endOf('day')

            prevDate = fromDate.subtract(1, 'day').endOf('day')
            nextDate = toDate.add(1, 'day').startOf('day')
            break
          }
          case 'year':
            fromDate = selectedDate.value.startOf('year')
            toDate = selectedDate.value.endOf('year')
            prevDate = fromDate.subtract(1, 'day').endOf('day')
            nextDate = toDate.add(1, 'day').startOf('day')
            break
          case 'selectedDate':
            fromDate = selectedDate.value.startOf('day')
            toDate = selectedDate.value.endOf('day')
            prevDate = selectedDate.value.subtract(1, 'day').endOf('day')
            nextDate = selectedDate.value.add(1, 'day').startOf('day')
            break
          case 'selectedHours':
            fromDate = selectedTime.value?.startOf('hour')
            toDate = selectedTime.value?.endOf('hour')
            prevDate = fromDate?.subtract(1, 'hour').endOf('hour')
            nextDate = toDate?.add(1, 'hour').startOf('hour')
            break
        }

        fromDate = fromDate!.format('YYYY-MM-DD HH:mm:ssZ')
        toDate = toDate!.format('YYYY-MM-DD HH:mm:ssZ')
        prevDate = prevDate!.format('YYYY-MM-DD HH:mm:ssZ')
        nextDate = nextDate!.format('YYYY-MM-DD HH:mm:ssZ')

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
                fk_column_id: fromCol.id,
                comparison_op: 'eq',
                logical_op: 'or',
                comparison_sub_op: 'exactDate',
                value: fromDate,
              },
            ]
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
          }
          if (rangeFilter.length > 0) {
            combinedFilters.push({
              is_group: true,
              logical_op: 'or',
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
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) return
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
              filtersArr: sideBarFilter.value,
              offset: params.offset,
              where: where?.value ?? '',
            })
        formattedSideBarData.value = [...formattedSideBarData.value, ...formatData(response!.list)]
      } catch (e) {
        console.log(e)
      }
    }

    const filterJSON = computed(() => {
      const combinedFilters: any = {
        is_group: true,
        logical_op: 'and',
        children: [],
      }

      let prevDate: string | null | dayjs.Dayjs = null
      let fromDate: dayjs.Dayjs | null | string = null
      let toDate: dayjs.Dayjs | null | string = null
      let nextDate: string | null | dayjs.Dayjs = null

      switch (activeCalendarView.value) {
        case 'week':
          fromDate = selectedDateRange.value.start.startOf('day')
          toDate = selectedDateRange.value.end.endOf('day')
          prevDate = selectedDateRange.value.start.subtract(1, 'day').endOf('day')
          nextDate = selectedDateRange.value.end.add(1, 'day').startOf('day')
          break
        case 'month': {
          const startOfMonth = selectedMonth.value.startOf('month')
          const endOfMonth = selectedMonth.value.endOf('month')

          const daysToDisplay = Math.max(endOfMonth.diff(startOfMonth, 'day') + 1, 35)
          fromDate = startOfMonth.subtract((startOfMonth.day() + 7) % 7, 'day')
          toDate = fromDate.add(daysToDisplay, 'day')
          prevDate = fromDate.subtract(1, 'day').endOf('day')
          nextDate = toDate.add(1, 'day').startOf('day')
          break
        }
        case 'year':
          fromDate = selectedDate.value.startOf('year')
          toDate = selectedDate.value.endOf('year')
          prevDate = fromDate.subtract(1, 'day').endOf('day')
          nextDate = toDate.add(1, 'day').startOf('day')
          break
        case 'day':
          fromDate = selectedDate.value.startOf('day')
          toDate = selectedDate.value.endOf('day')
          prevDate = selectedDate.value.subtract(1, 'day').endOf('day')
          nextDate = selectedDate.value.add(1, 'day').startOf('day')
          break
      }

      fromDate = fromDate!.format('YYYY-MM-DD HH:mm:ssZ')
      toDate = toDate!.format('YYYY-MM-DD HH:mm:ssZ')
      prevDate = prevDate!.format('YYYY-MM-DD HH:mm:ssZ')
      nextDate = nextDate!.format('YYYY-MM-DD HH:mm:ssZ')

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
              fk_column_id: fromCol.id,
              comparison_op: 'eq',
              logical_op: 'or',
              comparison_sub_op: 'exactDate',
              value: fromDate,
            },
          ]
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
        }
        if (rangeFilter.length > 0) {
          combinedFilters.children.push(rangeFilter)
        }
      })
      return combinedFilters.children.length > 0 ? [combinedFilters] : []
    })

    const fetchActiveDates = async () => {
      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id || !calendarRange.value) return
      let prevDate: dayjs.Dayjs | string | null = null
      let nextDate: dayjs.Dayjs | string | null = null
      let fromDate: dayjs.Dayjs | string | null = null

      if (activeCalendarView.value === 'week' || activeCalendarView.value === 'day' || activeCalendarView.value === 'month') {
        prevDate = pageDate.value.startOf('month').subtract(1, 'day').endOf('day')
        fromDate = pageDate.value.startOf('month')

        nextDate = pageDate.value.endOf('month').add(1, 'day').startOf('day')
      } else if (activeCalendarView.value === 'year') {
        fromDate = selectedDate.value.startOf('year')
        prevDate = selectedDate.value.startOf('year').subtract(1, 'day').endOf('day')
        nextDate = selectedDate.value.endOf('year').add(1, 'day').startOf('day')
      }

      prevDate = prevDate!.format('YYYY-MM-DD HH:mm:ssZ')
      nextDate = nextDate!.format('YYYY-MM-DD HH:mm:ssZ')
      fromDate = fromDate!.format('YYYY-MM-DD HH:mm:ssZ')

      const activeDateFilter: Array<any> = []

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
              fk_column_id: fromCol.id,
              comparison_op: 'eq',
              logical_op: 'or',
              comparison_sub_op: 'exactDate',
              value: fromDate,
            },
          ]
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
        }

        activeDateFilter.push(rangeFilter)
      })

      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) return
      const res = !isPublic.value
        ? await api.dbViewRow.calendarCount('noco', base.value.id!, meta.value!.id!, viewMeta.value.id, {
            ...queryParams.value,
            ...{},
            ...{},
            ...{ filterArrJson: JSON.stringify([...activeDateFilter]) },
          })
        : await fetchSharedViewActiveDate({
            sortsArr: sorts.value,
            filtersArr: activeDateFilter,
          })
      if (res) {
        activeDates.value = res.map((dateObj: unknown) => dayjs(dateObj))
      } else {
        activeDates.value = []
      }
    }

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
      const res = isPublic.value ? (sharedView.value?.view as CalendarType) : await $api.dbView.calendarRead(viewMeta.value.id)
      calendarMetaData.value = res
      const calMeta = typeof res.meta === 'string' ? JSON.parse(res.meta) : res.meta
      activeCalendarView.value = calMeta?.active_view
      if (!activeCalendarView.value) activeCalendarView.value = 'month'
      calendarRange.value = res?.calendar_range!.map((range: any) => {
        return {
          fk_from_col: meta.value?.columns!.find((col) => col.id === range.fk_from_column_id),
          fk_to_col: range.fk_to_column_id ? meta.value?.columns!.find((col) => col.id === range.fk_to_column_id) : null,
        }
      }) as any
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
        : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: filterJSON.value })
      formattedData.value = formatData(res!.list)
      isCalendarDataLoading.value = false
    }

    async function updateCalendarMeta(updateObj: Partial<CalendarType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit') || isPublic.value) return
      try {
        await $api.dbView.calendarUpdate(viewMeta.value.id, updateObj)
        calendarMetaData.value = {
          ...calendarMetaData.value,
          ...updateObj,
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

    const loadSidebarData = async () => {
      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) return
      isSidebarLoading.value = true
      const res = !isPublic.value
        ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value.id, {
            ...queryParams.value,
            ...{},
            ...{},
            ...{ filterArrJson: JSON.stringify([...sideBarFilter.value]) },
          })
        : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: filterJSON.value })

      formattedSideBarData.value = formatData(res!.list)
      isSidebarLoading.value = false
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
          id,
          updateObj,
          {
            query: { ignoreWebhook: !undo },
          },
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

        await fetchActiveDates()
        return updatedRowData
      } catch (e: any) {
        message.error(`${t('msg.error.rowUpdateFailed')} ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    watch(selectedDate, async (value, oldValue) => {
      if (activeCalendarView.value === 'month' || activeCalendarView.value === 'week') {
        if (sideBarFilterOption.value === 'selectedDate') {
          await loadSidebarData()
        }
      } else if (activeCalendarView.value === 'year') {
        if (value.year() !== oldValue.year()) {
          await Promise.all([loadCalendarData(), loadSidebarData(), await fetchActiveDates()])
        } else if (sideBarFilterOption.value === 'selectedDate') {
          await loadSidebarData()
        }
      } else {
        await Promise.all([loadSidebarData(), loadCalendarData()])
      }

      if (activeCalendarView.value === 'year' && value.year() !== oldValue.year()) {
        await fetchActiveDates()
      }
    })

    watch(selectedTime, async () => {
      if (calDataType.value !== UITypes.Date) {
        await loadSidebarData()
      }
    })

    watch(selectedMonth, async (value, oldValue) => {
      if (activeCalendarView.value !== 'month') return
      if (value.month() !== oldValue.month()) {
        await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
      }
    })

    watch(selectedDateRange, async () => {
      if (activeCalendarView.value !== 'week') return
      await Promise.all([loadCalendarData(), loadSidebarData()])
    })

    watch(activeCalendarView, async (value, oldValue) => {
      if (oldValue === 'week') {
        pageDate.value = selectedDate.value
        selectedDate.value = selectedDateRange.value.start
        selectedMonth.value = selectedDateRange.value.start
      } else if (oldValue === 'month') {
        selectedDate.value = selectedMonth.value
        pageDate.value = selectedDate.value
        selectedDateRange.value = {
          start: selectedDate.value.startOf('week'),
          end: selectedDate.value.endOf('week'),
        }
      } else if (oldValue === 'day') {
        pageDate.value = selectedDate.value

        selectedMonth.value = selectedDate.value
        selectedDateRange.value = {
          start: selectedDate.value.startOf('week'),
          end: selectedDate.value.endOf('week'),
        }
      } else if (oldValue === 'year') {
        selectedMonth.value = selectedDate.value
        pageDate.value = selectedDate.value
        selectedDateRange.value = {
          start: selectedDate.value.startOf('week'),
          end: selectedDate.value.endOf('week'),
        }
      }
      sideBarFilterOption.value = activeCalendarView.value ?? 'allRecords'
      await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
    })

    watch(sideBarFilterOption, async () => {
      await loadSidebarData()
    })

    watch(searchQuery, async () => {
      await loadSidebarData()
    })

    watch(pageDate, async () => {
      if (activeCalendarView.value === 'year') return
      console.log('pageDate changed')
      await fetchActiveDates()
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
      showSideMenu,
      selectedTime,
      updateCalendarMeta,
      calendarMetaData,
      updateRowProperty,
      activeCalendarView,
      pageDate,
      paginationData,
      selectedDate,
      selectedMonth,
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
