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
import { addDays, addMonths, addYears, extractPkFromRow, extractSdkResponseErrorMsg } from '~/utils'
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

    const pageDate = ref<Date>(new Date())

    const displayField = ref<ColumnType>()

    const activeCalendarView = ref<'month' | 'year' | 'day' | 'week'>()

    const searchQuery = reactive({
      value: '',
      field: '',
    })

    const selectedDate = ref<Date>(new Date())

    const selectedTime = ref<Date | null>(null)

    const selectedMonth = ref<Date>(new Date())

    const isCalendarDataLoading = ref<boolean>(false)

    const selectedDateRange = ref<{
      start: Date | null
      end: Date | null
    }>({
      start: dayjs(selectedDate.value).startOf('week').toDate(), // This will be the previous Monday
      end: dayjs(selectedDate.value).startOf('week').add(6, 'day').toDate(), // This will be the following Sunday
    })

    const defaultPageSize = 25

    const formattedData = ref<Row[]>([])

    const formattedSideBarData = ref<Row[]>([])

    const isSidebarLoading = ref<boolean>(false)

    const sideBarFilterOption = ref<string>(activeCalendarView.value ?? 'allRecords')

    const { api } = useApi()

    const { base } = storeToRefs(useBase())

    const { $api } = useNuxtApp()

    const { t } = useI18n()

    const { addUndo, clone, defineViewScope } = useUndoRedo()

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

    const calendarRange = ref<
      Array<{
        fk_from_col: ColumnType | null
        fk_to_col: ColumnType | null
      }>
    >([])

    const calDataType = computed(() => {
      if (!calendarRange.value || !calendarRange.value[0]) return null
      return calendarRange.value[0]!.fk_from_col.uidt
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
        sideBarFilterOption.value === 'selectedDate'
      ) {
        let fromDate: string | null | dayjs.Dayjs = null
        let toDate: string | null | dayjs.Dayjs = null

        switch (sideBarFilterOption.value) {
          case 'day':
            fromDate = dayjs(selectedDate.value)
            toDate = dayjs(selectedDate.value)
            break
          case 'week':
            fromDate = dayjs(selectedDateRange.value.start).startOf('day')
            toDate = dayjs(selectedDateRange.value.end).endOf('day')
            break
          case 'month':
            fromDate = dayjs(selectedMonth.value).startOf('month')
            toDate = dayjs(selectedMonth.value).endOf('month')

            break
          case 'year':
            fromDate = dayjs(selectedDate.value).startOf('year')
            toDate = dayjs(selectedDate.value).endOf('year')
            break
          case 'selectedDate':
            fromDate = dayjs(selectedDate.value).startOf('day')
            toDate = dayjs(selectedDate.value).endOf('day')
            break
        }

        if (calDataType.value === UITypes.Date) {
          fromDate = dayjs(fromDate).format('YYYY-MM-DD')
          toDate = dayjs(toDate).format('YYYY-MM-DD')
        } else if (calDataType.value === UITypes.DateTime) {
          fromDate = dayjs(fromDate).format('YYYY-MM-DD HH:mm:ss')
          toDate = dayjs(toDate).format('YYYY-MM-DD HH:mm:ss')
        }

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
                    is_group: true,
                    logical_op: 'or',
                    children: [
                      {
                        is_group: true,
                        logical_op: 'and',
                        children: [
                          {
                            fk_column_id: fromCol.id,
                            comparison_op: 'lte',
                            comparison_sub_op: 'exactDate',
                            value: toDate,
                          },
                          {
                            fk_column_id: toCol.id,
                            comparison_op: 'gte',
                            comparison_sub_op: 'exactDate',
                            value: fromDate,
                          },
                        ],
                      },
                      {
                        // Exact match check
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
                    ],
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
              filtersArr: [nestedFilters.value, ...sideBarFilter.value],
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

      let fromDate: dayjs.Dayjs | null | string = null
      let toDate: dayjs.Dayjs | null | string = null

      switch (activeCalendarView.value) {
        case 'week':
          fromDate = dayjs(selectedDateRange.value.start).startOf('day')
          toDate = dayjs(selectedDateRange.value.end).endOf('day')
          break
        case 'month':
          fromDate = dayjs(selectedMonth.value).startOf('month')
          toDate = dayjs(selectedMonth.value).endOf('month')
          break
        case 'year':
          fromDate = dayjs(selectedDate.value).startOf('year')
          toDate = dayjs(selectedDate.value).endOf('year')
          break
        case 'day':
          fromDate = dayjs(selectedDate.value).startOf('day')
          toDate = dayjs(selectedDate.value).endOf('day')
          break
      }

      if (calDataType.value === UITypes.Date) {
        fromDate = dayjs(fromDate).format('YYYY-MM-DD')
        toDate = dayjs(toDate).format('YYYY-MM-DD')
      } else if (calDataType.value === UITypes.DateTime) {
        fromDate = dayjs(fromDate).format('YYYY-MM-DD HH:mm:ss')
        toDate = dayjs(toDate).format('YYYY-MM-DD HH:mm:ss')
      }

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
                  is_group: true,
                  logical_op: 'or',
                  children: [
                    {
                      is_group: true,
                      logical_op: 'and',
                      children: [
                        {
                          fk_column_id: fromCol.id,
                          comparison_op: 'lte',
                          comparison_sub_op: 'exactDate',
                          value: toDate,
                        },
                        {
                          fk_column_id: toCol.id,
                          comparison_op: 'gte',
                          comparison_sub_op: 'exactDate',
                          value: fromDate,
                        },
                      ],
                    },
                    {
                      // Exact match check
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
                  ],
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

      return combinedFilters.children.length > 0 ? [combinedFilters] : []
    })

    // Set of Dates that have data
    const activeDates = computed(() => {
      if (!formattedData.value || !calendarRange.value) return []
      const dates = new Set<Date>()

      calendarRange.value.forEach((range) => {
        formattedData.value.forEach((row) => {
          const start = row.row[range.fk_from_col?.title ?? '']
          let end
          if (range.fk_to_col) {
            end = row.row[range.fk_to_col.title ?? '']
          }
          if (start && end) {
            const startDate = dayjs(start)
            let endDate = dayjs(end)
            let currentDate = startDate
            // We have to check whether the start is after the end date, if so, loop through the end date
            if (startDate.isAfter(endDate)) {
              endDate = startDate
              currentDate = endDate
            }
            while (currentDate.isSameOrBefore(endDate)) {
              dates.add(currentDate.toDate())
              currentDate = currentDate.add(1, 'day')
            }
          } else if (start) {
            dates.add(new Date(start))
          }
        })
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
        : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: [nestedFilters.value, ...filterJSON.value] })
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
          selectedMonth.value = action === 'next' ? addMonths(selectedMonth.value, 1) : addMonths(selectedMonth.value, -1)
          // selectedDate.value = action === 'next' ? addMonths(selectedDate.value, 1) : addMonths(selectedDate.value, -1)
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
      const res = await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value.id, {
        ...queryParams.value,
        ...{},
        ...{},
        ...{ filterArrJson: JSON.stringify([...sideBarFilter.value]) },
      })

      formattedSideBarData.value = formatData(res!.list)
      isSidebarLoading.value = false
    }

    async function updateRowProperty(toUpdate: Row, property: [], undo = false) {
      try {
        const id = extractPkFromRow(toUpdate.row, meta?.value?.columns as ColumnType[])

        const updateObj = property.reduce((acc, curr) => {
          acc[curr] = toUpdate.row[curr]
          return acc
        }, {})

        return await $api.dbViewRow.update(
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
      } catch (e: any) {
        message.error(`${t('msg.error.rowUpdateFailed')} ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    watch(selectedDate, async () => {
      if (activeCalendarView.value === 'month' || activeCalendarView.value === 'week') {
        await loadSidebarData()
      } else {
        await Promise.all([loadCalendarData(), loadSidebarData()])
      }
    })

    watch(selectedMonth, async () => {
      if (activeCalendarView.value !== 'month') return
      await Promise.all([loadCalendarData(), loadSidebarData()])
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
