import type { ComputedRef, Ref } from 'vue'
import { isClient } from '@vueuse/core'
import { EventType, FormulaDataTypes, UITypes, ViewTypes, isSystemColumn, isVirtualCol, workerWithTimezone } from 'nocodb-sdk'
import type {
  Api,
  CalendarRangeType,
  CalendarType,
  ColumnType,
  DataPayload,
  PaginatedType,
  TableType,
  ViewType,
} from 'nocodb-sdk'
import type dayjs from 'dayjs'
import { validateRowFilters } from '~/utils/dataUtils'

const formatData = (
  list: Record<string, any>[],
  evaluateRowMetaRowColorInfoCallback?: (row: Record<string, any>) => RowMetaRowColorInfo,
) =>
  list.map(
    (row) =>
      ({
        row: { ...row },
        oldRow: { ...row },
        rowMeta: {
          ...(evaluateRowMetaRowColorInfoCallback?.(row) ?? {}),
        },
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

    const { isMobileMode, user } = useGlobal()

    const { getValidSearchQueryForColumn } = useFieldQuery()

    const { sharedView, fetchSharedViewData, fetchSharedViewActiveDate, fetchSharedCalendarViewData } = useSharedView()

    const displayField = computed(() => meta.value?.columns?.find((c) => c.pv))

    /**
     * In shared view mode, `isPublic` will still be false because both
     * `useProvideCalendarViewStore` and `provide(IsPublicInj)` are called at the same
     * component level, so the inject doesn't see the provided value.
     */
    const isPublic = shared ? ref(shared) : inject(IsPublicInj, ref(false))

    const calendarMetaData = computed<CalendarType>(() => {
      return isPublic.value ? (sharedView.value?.view as CalendarType) : (viewMeta.value?.view as CalendarType)
    })

    // The current view meta properties
    const viewMetaProperties = computed<{
      active_view: string
      hide_weekend: boolean
    }>(() => {
      let meta = calendarMetaData.value?.meta ?? {}

      if (typeof meta === 'string') {
        meta = parseProp(meta)
      }

      return meta as {
        active_view: string
        hide_weekend: boolean
      }
    })

    // The range of columns that are used for the calendar view
    const calendarRange = computed<
      Array<{
        fk_from_col: ColumnType
        fk_to_col?: ColumnType | null
        id: string
        is_readonly: boolean
      }>
    >(() => {
      return calendarMetaData.value?.calendar_range
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
                fromCol?.uidt === UITypes.Formula && (fromCol?.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.DATE
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
    })

    const calDataType = computed(() => {
      if (!calendarRange.value || !calendarRange.value[0]) return null
      return calendarRange.value[0]?.fk_from_col?.uidt
    })

    const timezone = computed(() => {
      return getTimeZoneFromName(calendarRange.value?.[0]?.fk_from_col?.meta?.timezone)?.name
    })

    const timezoneDayjs = reactive(workerWithTimezone(calDataType.value === UITypes.Date ? false : isEeUI, timezone?.value))

    const searchQuery = reactive({
      value: '',
      field: '',
      isValidFieldQuery: true,
    })

    const validSearchQueryForDisplayField = computed(() => {
      if (!displayField.value || !searchQuery.value?.trim()) {
        searchQuery.isValidFieldQuery = true
        return
      }

      const validSearchQuery = getValidSearchQueryForColumn(
        displayField.value,
        searchQuery.value.trim(),
        meta.value as TableType,
        { getWhereQueryAs: 'object' },
      )

      if (!validSearchQuery) {
        searchQuery.isValidFieldQuery = false
        return
      }

      return validSearchQuery as ValidSearchQueryForColumnReturnType
    })

    const pageDate = ref<dayjs.Dayjs>(timezoneDayjs.dayjsTz())

    const selectedDate = ref<dayjs.Dayjs>(timezoneDayjs.dayjsTz())

    const selectedTime = ref<dayjs.Dayjs>(timezoneDayjs.dayjsTz())

    const selectedMonth = ref<dayjs.Dayjs>(timezoneDayjs.dayjsTz())

    const isCalendarDataLoading = ref<boolean>(false)

    // show/hide side menu in calendar
    const showSideMenu = ref(!isMobileMode.value)

    // reactive ref for the selected date range - used in week / 2week / 6week views.
    //
    // `start` is always the Monday of the active week. `end` is only meaningful
    // for the 1-week layout (Sunday after `start`) and is intentionally NOT
    // resized when 2week/6week is active — the WeekView renderer relies on the
    // `start + 6 days` semantics, and the multi-week consumers derive their
    // true end as `start + weeksInRange*7 - 1` on demand.
    //
    // `startOf('week')` returns Monday because `dayjs.updateLocale('en', {
    // weekStart: 1 })` is set globally in plugins/a.dayjs.ts.
    const selectedDateRange = ref<{
      start: dayjs.Dayjs
      end: dayjs.Dayjs
    }>({
      start: timezoneDayjs.dayjsTz(selectedDate.value)!.startOf('week'),
      end: timezoneDayjs.dayjsTz(selectedDate.value)!.startOf('week').add(6, 'day'),
    })

    const defaultPageSize = 25

    const formattedData = ref<Row[]>([])

    const formattedSideBarData = ref<Row[]>([])

    const isSidebarLoading = ref<boolean>(false)

    const activeDates = ref<dayjs.Dayjs[]>([])

    // Per-view, per-user override for the active mode — kept in localStorage so a
    // reload or new tab restores the user's last choice without overwriting the
    // view creator's default (`viewMetaProperties.active_view`).
    const CALENDAR_MODE_STORAGE_PREFIX = 'nc-calendar-mode:'
    const validCalendarModes = ['day', '3day', 'week', '2week', 'month', '6week', 'year'] as const
    type CalendarMode = (typeof validCalendarModes)[number]

    const calendarModeStorageKey = () => (viewMeta.value?.id ? `${CALENDAR_MODE_STORAGE_PREFIX}${viewMeta.value.id}` : null)

    const readStoredCalendarMode = (): CalendarMode | null => {
      if (!isClient) return null
      const key = calendarModeStorageKey()
      if (!key) return null
      try {
        const stored = localStorage.getItem(key)
        if (stored && (validCalendarModes as readonly string[]).includes(stored)) {
          return stored as CalendarMode
        }
      } catch {
        // localStorage can throw in private mode / when quota exceeded — silent fallback.
      }
      return null
    }

    const writeStoredCalendarMode = (mode: CalendarMode) => {
      if (!isClient) return
      const key = calendarModeStorageKey()
      if (!key) return
      try {
        localStorage.setItem(key, mode)
      } catch {
        // ignore
      }
    }

    const activeCalendarView = ref<CalendarMode>(
      readStoredCalendarMode() ?? (viewMetaProperties.value?.active_view as CalendarMode | undefined) ?? 'month',
    )

    // On a cold page load `viewMeta.value` (and therefore its `id`) is often
    // undefined when the ref above is initialised, so the localStorage lookup
    // is skipped. Restore once the view id becomes available.
    //
    // Keyed by id (not a boolean) so that if the same store instance is reused
    // across view switches (eg. <keep-alive>, route param change), the new
    // view's stored mode is re-applied instead of leaking the previous view's.
    let restoredForCalendarId: string | null = viewMeta.value?.id ?? null
    if (restoredForCalendarId && readStoredCalendarMode() === null) {
      // viewMeta was ready at construction but storage was empty — nothing to
      // restore, mark as handled so the immediate watcher doesn't re-do it.
    } else {
      restoredForCalendarId = null
    }
    watch(
      () => viewMeta.value?.id,
      (id) => {
        if (!id || id === restoredForCalendarId) return
        const stored = readStoredCalendarMode()
        if (stored) {
          activeCalendarView.value = stored
        } else {
          const fromMeta = viewMetaProperties.value?.active_view as CalendarMode | undefined
          if (fromMeta && fromMeta !== activeCalendarView.value) {
            activeCalendarView.value = fromMeta
          }
        }
        restoredForCalendarId = id
      },
      { immediate: true },
    )

    watch(activeCalendarView, (value) => {
      writeStoredCalendarMode(value)
    })

    // 3-day mode anchors on the selected day (not week-aligned). The
    // activeCalendarView watcher only fires on later changes, so when the
    // persisted mode is already '3day' on a cold load we seed the range here.
    if (activeCalendarView.value === '3day') {
      selectedDateRange.value = {
        start: selectedDate.value.startOf('day'),
        end: selectedDate.value.add(2, 'day').endOf('day'),
      }
    }

    // Number of consecutive weeks rendered by the multi-week grid (week / 2week / 6week).
    const weeksInRange = computed(() => {
      if (activeCalendarView.value === '2week') return 2
      if (activeCalendarView.value === '6week') return 6
      return 1
    })

    const isMultiWeekRange = computed(() => activeCalendarView.value === '2week' || activeCalendarView.value === '6week')

    // The active filter in the sidebar
    const sideBarFilterOption = ref<string>(activeCalendarView.value ?? 'allRecords')

    const { api } = useApi()

    const { isMysql } = useBase()

    const { t } = useI18n()

    const baseStore = useBase()

    const { base } = storeToRefs(baseStore)

    const { getBaseType } = baseStore

    const { $e, $api, $ncSocket } = useNuxtApp()

    const { sorts, nestedFilters, eventBus, isSyncedTable, allFilters, validFiltersFromUrlParams } = useSmartsheetStoreOrThrow()

    const { metas } = useMetas()

    const { getEvaluatedRowMetaRowColorInfo } = useViewRowColorRender()

    const viewStore = useViewsStore()

    const { updateViewMeta } = viewStore

    const paginationData = ref<PaginatedType>({ page: 1, pageSize: defaultPageSize })

    const queryParams = computed(() => ({
      limit: paginationData.value.pageSize ?? defaultPageSize,
      where: where?.value ?? '',
    }))

    // Date columns should only store the date part (no time/timezone) to avoid
    // timezone conversion shifting the date by ±1 day.
    // For DateTime, timezone is removed from the date string for mysql for reverse compatibility upto mysql5
    const updateFormat = computed(() => {
      if (calDataType.value === UITypes.Date) {
        return 'YYYY-MM-DD'
      }
      return isMysql(meta.value?.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'
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
        sideBarFilterOption.value === '3day' ||
        sideBarFilterOption.value === '2week' ||
        sideBarFilterOption.value === '6week' ||
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
          case '3day':
            fromDate = selectedDateRange.value.start.startOf('day')
            toDate = selectedDateRange.value.start.add(2, 'day').endOf('day')
            prevDate = timezoneDayjs.timezonize(fromDate.subtract(1, 'day')).endOf('day')
            nextDate = timezoneDayjs.timezonize(toDate.add(1, 'day')).startOf('day')
            break
          case 'week':
          case '2week':
          case '6week': {
            const weeks = sideBarFilterOption.value === '2week' ? 2 : sideBarFilterOption.value === '6week' ? 6 : 1
            fromDate = selectedDateRange.value.start.startOf('week')
            toDate = fromDate
              .clone()
              .add(weeks * 7 - 1, 'day')
              .endOf('day')
            prevDate = timezoneDayjs.timezonize(fromDate.subtract(1, 'day')).endOf('day')
            nextDate = timezoneDayjs.timezonize(toDate.add(1, 'day')).startOf('day')
            break
          }
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

        if (calDataType.value === UITypes.Date) {
          const regex = /^\d{4}-\d{2}-\d{2}/
          fromDate = fromDate.match(regex)[0]
          toDate = toDate.match(regex)[0]
          nextDate = nextDate.match(regex)[0]
          prevDate = prevDate.match(regex)[0]
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
              // Include records where start date is in range but end date is missing
              // (treat as single-day events)
              {
                is_group: true,
                logical_op: 'or',
                children: [
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
                  {
                    fk_column_id: toCol.id,
                    comparison_op: 'blank',
                  },
                ],
              },
              // Include records where end date is in range but start date is missing
              // (treat as single-day milestone events)
              {
                is_group: true,
                logical_op: 'or',
                children: [
                  {
                    fk_column_id: toCol.id,
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
                  {
                    fk_column_id: fromCol.id,
                    comparison_op: 'blank',
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

      if (displayField.value && ncIsObject(validSearchQueryForDisplayField.value)) {
        if (combinedFilters.length > 0) {
          combinedFilters = [
            {
              is_group: true,
              logical_op: 'and',
              children: [...combinedFilters, validSearchQueryForDisplayField.value],
            },
          ]
        } else {
          combinedFilters.push(validSearchQueryForDisplayField.value)
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
              where: queryParams.value.where,
              whereTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
              ...(isUIAllowed('filterSync')
                ? { filterArrJson: stringifyFilterOrSortArr([...sideBarFilter.value]) }
                : { filterArrJson: stringifyFilterOrSortArr([...nestedFilters.value, ...sideBarFilter.value]) }),
            })
          : await fetchSharedViewData({
              ...params,
              where: queryParams.value.where,
              sortsArr: sorts.value,
              filtersArr: [...nestedFilters.value, ...sideBarFilter.value],
              whereTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
              offset: params.offset,
            })
        formattedSideBarData.value = [
          ...formattedSideBarData.value,
          ...formatData(response!.list, getEvaluatedRowMetaRowColorInfo),
        ]
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

      if (
        activeCalendarView.value === 'week' ||
        activeCalendarView.value === 'day' ||
        activeCalendarView.value === '3day' ||
        activeCalendarView.value === '2week' ||
        activeCalendarView.value === '6week'
      ) {
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
              where: queryParams.value.where,
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
    const changeCalendarView = async (view: 'month' | 'year' | 'day' | '3day' | 'week' | '2week' | '6week') => {
      $e('c:calendar:change-calendar-view', view)

      try {
        activeCalendarView.value = view

        if (isUIAllowed('calendarViewUpdate')) {
          await updateViewMeta(viewMeta.value.id, ViewTypes.CALENDAR, {
            meta: {
              ...viewMetaProperties.value,
              active_view: view,
            },
          })
        }

        if (
          activeCalendarView.value === 'week' ||
          activeCalendarView.value === '3day' ||
          activeCalendarView.value === '2week' ||
          activeCalendarView.value === '6week'
        ) {
          selectedTime.value = null
        }
      } catch (e) {
        message.error('Error changing calendar view')
        console.log(e)
      }
    }

    const isSyncedFromColumn = computed(() => {
      return (
        isSyncedTable.value &&
        calendarRange.value.some((range) => {
          return !!range.fk_from_col?.readonly
        })
      )
    })

    // Order records by their start (scheduled) time ascending so that records falling on the
    // same day read in chronological order across every calendar view. JS sort is stable, so
    // records sharing a start time — and records without one (pushed to the end) — keep their
    // original relative order.
    function sortRecordsByStartTime(rows: Row[]): Row[] {
      const startCol = calendarRange.value?.[0]?.fk_from_col
      if (!startCol?.title) return rows

      const title = startCol.title

      return [...rows].sort((a, b) => {
        const aVal = a.row[title]
        const bVal = b.row[title]

        if (!aVal && !bVal) return 0
        if (!aVal) return 1
        if (!bVal) return -1

        return timezoneDayjs.timezonize(aVal).valueOf() - timezoneDayjs.timezonize(bVal).valueOf()
      })
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
        case '3day': {
          // Day-anchored 3-column window — selectedDateRange.start is the first
          // visible day (not week-aligned like the week/2week/6week modes).
          fromDate = selectedDateRange.value.start.startOf('day')
          toDate = selectedDateRange.value.start.add(2, 'day').endOf('day')
          prevDate = timezoneDayjs.timezonize(fromDate.subtract(1, 'day')).endOf('day')
          nextDate = timezoneDayjs.timezonize(toDate.add(1, 'day')).startOf('day')
          break
        }
        case 'week':
        case '2week':
        case '6week': {
          fromDate = selectedDateRange.value.start.startOf('week')
          toDate = fromDate
            .clone()
            .add(weeksInRange.value * 7 - 1, 'day')
            .endOf('day')

          prevDate = timezoneDayjs.timezonize(fromDate.subtract(1, 'day')).endOf('day')
          nextDate = timezoneDayjs.timezonize(toDate.add(1, 'day')).startOf('day')

          // Hide weekends (only valid for the single-week layout)
          if (activeCalendarView.value === 'week' && viewMetaProperties.value?.hide_weekend) {
            toDate = timezoneDayjs.timezonize(toDate.subtract(2, 'day')).endOf('day')
            nextDate = timezoneDayjs.timezonize(nextDate!.subtract(2, 'day')).startOf('day')
          }
          break
        }
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
          ? await api.dbCalendarViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
              prev_date: prevDate,
              next_date: nextDate,
              to_date: toDate,
              from_date: fromDate,
              include_row_color: true,
              ...queryParams.value,
              ...(isUIAllowed('filterSync') ? {} : { filterArrJson: stringifyFilterOrSortArr([...nestedFilters.value]) }),
              whereTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
          : await fetchSharedCalendarViewData({
              sortsArr: sorts.value,
              prev_date: prevDate,
              next_date: nextDate,
              to_date: toDate,
              from_date: fromDate,
              filtersArr: nestedFilters.value,
              where: queryParams.value.where,
              whereTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
        formattedData.value = sortRecordsByStartTime(formatData(res!.list, getEvaluatedRowMetaRowColorInfo))
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

    const paginateCalendarView = async (action: 'next' | 'prev', step?: 'week') => {
      // Allow callers to override the natural step (e.g. Shift+Click in Month view
      // to step by 1 week instead of 1 month).
      if (step === 'week') {
        const dayShift = action === 'next' ? 7 : -7
        if (activeCalendarView.value === 'month') {
          selectedMonth.value = selectedMonth.value.add(dayShift, 'day')
          selectedDate.value = selectedDate.value.add(dayShift, 'day')
          if (pageDate.value.month() !== selectedMonth.value.month()) {
            pageDate.value = selectedMonth.value
          }
          return
        }
        if (activeCalendarView.value === 'day') {
          selectedDate.value = selectedDate.value.add(dayShift, 'day')
          selectedTime.value = selectedDate.value
          if (pageDate.value.month() !== selectedDate.value.month()) {
            pageDate.value = selectedDate.value
          }
          return
        }
        if (activeCalendarView.value === '2week' || activeCalendarView.value === '6week') {
          // Shift the multi-week window by exactly 1 week instead of the
          // natural 2/6-week step — useful when nudging a 6-week planning grid.
          selectedDateRange.value = {
            start: selectedDateRange.value.start.add(dayShift, 'day'),
            end: selectedDateRange.value.end.add(dayShift, 'day'),
          }
          return
        }
      }

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
        case '3day': {
          // Step the 3-day window by its full span.
          const dayShift = action === 'next' ? 3 : -3
          const newStart = selectedDateRange.value.start.add(dayShift, 'day')
          selectedDateRange.value = {
            start: newStart.startOf('day'),
            end: newStart.add(2, 'day').endOf('day'),
          }
          if (pageDate.value.month() !== newStart.month()) {
            pageDate.value = newStart
          }
          break
        }
        case 'week':
        case '2week':
        case '6week': {
          const dayShift = (action === 'next' ? 1 : -1) * weeksInRange.value * 7
          selectedDateRange.value = {
            start: selectedDateRange.value.start.add(dayShift, 'day'),
            // .end is kept as start + 6 days for back-compat with the WeekView
            // renderer; multi-week ranges derive their real end from
            // `start + weeksInRange*7 - 1` (see visibleRangeEnd below).
            end: selectedDateRange.value.end.add(dayShift, 'day'),
          }
          // Re-sync pageDate against the LAST visible day of the new window — not
          // selectedDateRange.end, which only covers the first week for 2/6-week
          // modes and would let pageDate drift up to 5 weeks behind the grid.
          const visibleRangeEnd = selectedDateRange.value.start.add(weeksInRange.value * 7 - 1, 'day')
          if (pageDate.value.month() !== visibleRangeEnd.month()) {
            pageDate.value = selectedDateRange.value.start
          }
          break
        }
      }
    }

    const loadSidebarData = async (showLoading = true) => {
      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id || !calendarRange.value?.length) return

      try {
        if (showLoading) isSidebarLoading.value = true
        const res = !isPublic.value
          ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value.id, {
              ...queryParams.value,
              ...{ filterArrJson: stringifyFilterOrSortArr([...sideBarFilter.value]) },
              whereTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
              include_row_color: true,
            })
          : await fetchSharedViewData({
              sortsArr: sorts.value,
              filtersArr: [...nestedFilters.value, ...sideBarFilter.value],
              whereTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
              where: queryParams.value.where,
            })

        formattedSideBarData.value = formatData(res!.list, getEvaluatedRowMetaRowColorInfo)
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

    async function updateRowProperty(toUpdate: Row, property: string[], isDelete = false) {
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

        // Skip local row mutation when the row is being deleted —
        // the row is about to be removed from the view, no point updating it.
        if (!isDelete) {
          Object.assign(toUpdate.row, updatedRowData)
          Object.assign(toUpdate.oldRow, updatedRowData)
        }

        const upPk = extractPkFromRow(updatedRowData, meta?.value?.columns as ColumnType[])

        formattedSideBarData.value = formattedSideBarData.value.map((row) => {
          if (extractPkFromRow(row.row, meta?.value?.columns as ColumnType[]) === upPk) {
            Object.assign(row.row, updatedRowData)
            Object.assign(row.oldRow, updatedRowData)
          }
          Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(row.row))
          return row
        })

        await fetchActiveDates()
        return updatedRowData
      } catch (e: any) {
        message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    watch(selectedDate, async (value, oldValue) => {
      if (
        activeCalendarView.value === 'month' ||
        activeCalendarView.value === 'week' ||
        activeCalendarView.value === '3day' ||
        activeCalendarView.value === '2week' ||
        activeCalendarView.value === '6week'
      ) {
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
      if (
        activeCalendarView.value !== 'week' &&
        activeCalendarView.value !== '3day' &&
        activeCalendarView.value !== '2week' &&
        activeCalendarView.value !== '6week'
      ) {
        return
      }
      await Promise.all([loadCalendarData(), loadSidebarData()])
    })

    watch(activeCalendarView, async (value, oldValue) => {
      if (oldValue === '3day') {
        // Leaving 3-day: anchor every cursor on the first visible day of the window.
        const anchor = selectedDateRange.value.start
        pageDate.value = anchor
        selectedMonth.value = anchor
        selectedDate.value = anchor
        selectedTime.value = anchor
      } else if (oldValue === 'week' || oldValue === '2week' || oldValue === '6week') {
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
      // Entering 3-day: anchor the day-window on the currently selected day.
      if (value === '3day') {
        selectedDateRange.value = {
          start: selectedDate.value.startOf('day'),
          end: selectedDate.value.add(2, 'day').endOf('day'),
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

    // Load Sidebar Data when search query or field changes, `isValidFieldQuery` is used only in the frontend to show error tooltip
    watch([() => searchQuery.value, () => displayField.value?.id], async () => {
      await loadSidebarData()
    })

    watch(pageDate, async () => {
      if (activeCalendarView.value === 'year') return
      await fetchActiveDates()
    })

    watch([timezone, calDataType], ([newTimezone, calDataType]) => {
      const temp = workerWithTimezone(
        calDataType === UITypes.Date ? false : isEeUI,
        calDataType === UITypes.Date ? null : newTimezone,
      )
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
      () => viewMetaProperties.value?.hide_weekend,
      async () => {
        if (activeCalendarView.value === 'week') {
          await loadCalendarData()
        }
      },
    )

    /**
     * This is used to update the rowMeta color info when the row colour info is updated
     */
    const smartsheetEventHandler = (event) => {
      if (![SmartsheetStoreEvents.TRIGGER_RE_RENDER, SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE].includes(event)) {
        return
      }

      formattedData.value = formattedData.value.map((row) => {
        Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(row.row))
        return row
      })

      formattedSideBarData.value = formattedSideBarData.value.map((row) => {
        Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(row.row))
        return row
      })
    }

    eventBus.on(smartsheetEventHandler)

    const updateActiveDatesForNewRecord = (rowData: Record<string, any>): void => {
      if (!calendarRange.value?.length) return

      for (const range of calendarRange.value) {
        const fromCol = range.fk_from_col
        const toCol = range.fk_to_col

        const fromDate = fromCol ? rowData[fromCol.title!] : null
        const toDate = toCol ? rowData[toCol.title!] : null

        if (fromDate) {
          const date = timezoneDayjs.timezonize(fromDate)
          if (!activeDates.value.some((activeDate) => activeDate.isSame(date, 'day'))) {
            activeDates.value.push(date)
          }
        }

        if (toDate && toDate !== fromDate) {
          const date = timezoneDayjs.timezonize(toDate)
          if (!activeDates.value.some((activeDate) => activeDate.isSame(date, 'day'))) {
            activeDates.value.push(date)
          }
        }
      }

      // Sort active dates
      activeDates.value.sort((a, b) => a.valueOf() - b.valueOf())
    }

    const activeDataListener = ref<string | null>(null)

    const handleDataEvent = (data: DataPayload) => {
      const { id, action, payload } = data

      if (action === 'add') {
        try {
          const isValidationFailed = !validateRowFilters(
            [...allFilters.value, ...validFiltersFromUrlParams.value],
            payload,
            meta.value?.columns as ColumnType[],
            getBaseType(viewMeta.value?.view?.source_id),
            metas.value,
            meta.value?.base_id,
            {
              currentUser: user.value,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          )

          if (isValidationFailed) {
            return
          }

          // For 'add', the row definitely doesn't exist yet, so we only need to check if it should be added
          // Check if new row should be in calendar view
          const shouldBeInCalendar = isRowInCurrentDateRange(
            payload,
            calendarRange.value,
            activeCalendarView.value!,
            selectedDate.value,
            selectedDateRange.value,
            selectedMonth.value,
            timezoneDayjs,
          )

          // Check if new row should be in sidebar
          const shouldBeInSidebar = isRowMatchingSidebarFilter(
            payload,
            sideBarFilterOption.value,
            calendarRange.value,
            selectedDate.value,
            selectedDateRange.value,
            selectedMonth.value,
            selectedTime.value,
            timezoneDayjs,
          )

          const newRowData = {
            row: payload,
            oldRow: { ...payload },
            rowMeta: {
              new: false,
              ...getEvaluatedRowMetaRowColorInfo(payload),
            },
          }

          // Add to calendar if it should be there
          if (shouldBeInCalendar) {
            formattedData.value.push({ ...newRowData })
          }

          // Add to sidebar if it should be there
          if (shouldBeInSidebar) {
            formattedSideBarData.value.unshift({ ...newRowData })
          }

          // Update active dates if any row was added
          if (shouldBeInCalendar || shouldBeInSidebar) {
            updateActiveDatesForNewRecord(payload)
          }
        } catch (e) {
          console.error('Failed to add calendar row on socket event', e)
        }
      } else if (action === 'update') {
        try {
          // Check if row currently exists in calendar view
          const calendarRowIndex = formattedData.value.findIndex((row) => {
            const pk = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            return pk && `${pk}` === `${id}`
          })

          // Check if row currently exists in sidebar
          const sidebarRowIndex = formattedSideBarData.value.findIndex((row) => {
            const pk = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            return pk && `${pk}` === `${id}`
          })

          const isValidationFailed = !validateRowFilters(
            [...allFilters.value, ...validFiltersFromUrlParams.value],
            payload,
            meta.value?.columns as ColumnType[],
            getBaseType(viewMeta.value?.view?.source_id),
            metas.value,
            meta.value?.base_id,
            {
              currentUser: user.value,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          )

          // If validation fails and row exists in either view, delete it
          if (isValidationFailed && (calendarRowIndex !== -1 || sidebarRowIndex !== -1)) {
            handleDataEvent({ ...data, action: 'delete' })
            return
          }

          // If validation pass but row doesn't exist in either view, add it
          if (!isValidationFailed && calendarRowIndex === -1 && sidebarRowIndex === -1) {
            handleDataEvent({ ...data, action: 'add' })
            return
          }

          // Check if updated row should be in current calendar view
          const shouldBeInCalendar = isRowInCurrentDateRange(
            payload,
            calendarRange.value,
            activeCalendarView.value!,
            selectedDate.value,
            selectedDateRange.value,
            selectedMonth.value,
            timezoneDayjs,
          )

          // Check if updated row should be in sidebar
          const shouldBeInSidebar = isRowMatchingSidebarFilter(
            payload,
            sideBarFilterOption.value,
            calendarRange.value,
            selectedDate.value,
            selectedDateRange.value,
            selectedMonth.value,
            selectedTime.value,
            timezoneDayjs,
          )

          // Handle calendar view updates
          if (calendarRowIndex !== -1 && shouldBeInCalendar) {
            // Case 1: Row exists in calendar AND should stay → Update in place
            const existingRow = formattedData.value[calendarRowIndex]
            Object.assign(existingRow.row, payload)
            Object.assign(existingRow.oldRow, payload)
            Object.assign(existingRow.rowMeta, getEvaluatedRowMetaRowColorInfo(existingRow.row))
            existingRow.rowMeta.changed = false
          } else if (calendarRowIndex !== -1 && !shouldBeInCalendar) {
            // Case 2: Row exists in calendar BUT should be removed → Remove from calendar
            formattedData.value.splice(calendarRowIndex, 1)
          } else if (calendarRowIndex === -1 && shouldBeInCalendar) {
            // Case 3: Row doesn't exist in calendar BUT should be added → Add to calendar
            const newCalendarRow = {
              row: payload,
              oldRow: { ...payload },
              rowMeta: {
                new: false,
                changed: false,
                ...getEvaluatedRowMetaRowColorInfo(payload),
              },
            }
            formattedData.value.push(newCalendarRow)
          } else {
            // Case 4: Row doesn't exist in calendar AND shouldn't be added → No action
          }

          // Handle sidebar updates
          if (sidebarRowIndex !== -1 && shouldBeInSidebar) {
            // Case 5: Row exists in sidebar AND should stay → Update in place
            const existingSidebarRow = formattedSideBarData.value[sidebarRowIndex]
            Object.assign(existingSidebarRow.row, payload)
            Object.assign(existingSidebarRow.oldRow, payload)
            Object.assign(existingSidebarRow.rowMeta, getEvaluatedRowMetaRowColorInfo(existingSidebarRow.row))
            existingSidebarRow.rowMeta.changed = false
          } else if (sidebarRowIndex !== -1 && !shouldBeInSidebar) {
            // Case 6: Row exists in sidebar BUT should be removed → Remove from sidebar
            formattedSideBarData.value.splice(sidebarRowIndex, 1)
          } else if (sidebarRowIndex === -1 && shouldBeInSidebar) {
            // Case 7: Row doesn't exist in sidebar BUT should be added → Add to sidebar
            const newSidebarRow = {
              row: payload,
              oldRow: { ...payload },
              rowMeta: {
                new: false,
                changed: false,
                ...getEvaluatedRowMetaRowColorInfo(payload),
              },
            }
            formattedSideBarData.value.unshift(newSidebarRow)
          } else {
            // Case 8: Row doesn't exist in sidebar AND shouldn't be added → No action
          }

          // Update active dates after any changes
          fetchActiveDates()
        } catch (e) {
          console.error('Failed to update calendar row on socket event', e)
        }
      } else if (action === 'delete') {
        try {
          // For delete, we need to remove the row from wherever it exists
          // We don't need to check filters since we're removing it entirely

          let removedFromCalendar = false
          let removedFromSidebar = false

          // Remove from calendar view if it exists there
          const calendarRowIndex = formattedData.value.findIndex((row) => {
            const pk = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            return pk && `${pk}` === `${id}`
          })

          if (calendarRowIndex !== -1) {
            formattedData.value.splice(calendarRowIndex, 1)
            removedFromCalendar = true
          }

          // Remove from sidebar if it exists there
          const sidebarRowIndex = formattedSideBarData.value.findIndex((row) => {
            const pk = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            return pk && `${pk}` === `${id}`
          })

          if (sidebarRowIndex !== -1) {
            formattedSideBarData.value.splice(sidebarRowIndex, 1)
            removedFromSidebar = true
          }
          // Update active dates if anything was removed
          if (removedFromCalendar || removedFromSidebar) {
            fetchActiveDates()
          }
        } catch (e) {
          console.error('Failed to delete calendar row on socket event', e)
        }
      }
    }

    watch(
      meta,
      (newMeta: any, oldMeta: any) => {
        if (newMeta?.fk_workspace_id && newMeta?.base_id && newMeta?.id) {
          if (oldMeta?.id && oldMeta.id === newMeta.id) return

          if (activeDataListener.value) {
            $ncSocket.offMessage(activeDataListener.value)
          }
          activeDataListener.value = $ncSocket.onMessage(
            `${EventType.DATA_EVENT}:${newMeta.fk_workspace_id}:${newMeta.base_id}:${newMeta.id}`,
            handleDataEvent,
          )
        }
      },
      { immediate: true },
    )

    onBeforeUnmount(() => {
      if (activeDataListener.value) {
        $ncSocket.offMessage(activeDataListener.value)
      }

      eventBus.off(smartsheetEventHandler)
    })

    return {
      fetchActiveDates,
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
      isSyncedFromColumn,
      weeksInRange,
      isMultiWeekRange,
    }
  },
)

export { useProvideCalendarViewStore }

export function useCalendarViewStoreOrThrow() {
  const calendarViewStore = useCalendarViewStore()

  if (calendarViewStore == null) throw new Error('Please call `useProvideCalendarViewStore` on the appropriate parent component')

  return calendarViewStore
}
