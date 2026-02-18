import dayjs from 'dayjs'
import type { ColumnType, TableType, TimelineType, ViewType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Row } from '~/lib/types'
import { NOCO } from '~/lib/constants'

// Module-level cache to persist timeline navigation state across view switches.
// Keyed by view ID so each timeline view remembers its own position.
const _viewStateCache = new Map<string, { currentDate: string; zoomLevel: 'day' | 'week' | 'month' }>()

// Track which views have already had their initial navigation performed,
// so we don't re-navigate on every data reload.
const _initializedViews = new Set<string>()

const [useProvideTimelineViewStore, useTimelineViewStore] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    viewMeta: Ref<(ViewType | TimelineType | undefined) & { id: string }>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    const { isUIAllowed } = useRoles()

    const { t } = useI18n()

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const { $api } = useNuxtApp()

    const baseStore = useBase()
    const { isMysql } = baseStore
    const { base } = storeToRefs(baseStore)

    const { sharedView, fetchSharedViewData } = useSharedView()

    const { sorts, nestedFilters, eventBus } = useSmartsheetStoreOrThrow()

    const { getEvaluatedRowMetaRowColorInfo } = useViewRowColorRender()

    const isPublic = shared ? ref(shared) : inject(IsPublicInj, ref(false))

    // Timeline state
    // #20: Support day zoom level alongside week and month
    const zoomLevel = ref<'day' | 'week' | 'month'>('month')

    const currentDate = ref<dayjs.Dayjs>(dayjs())

    const selectedDate = ref<dayjs.Dayjs>(dayjs())

    // Track the last timeline view ID we cached state for, so we can
    // detect when the active view switches back to a timeline and restore.
    let _lastCachedViewId: string | undefined

    // Persist navigation state whenever currentDate or zoomLevel changes
    watch([currentDate, zoomLevel], () => {
      const viewId = viewMeta.value?.id
      if (viewId) {
        _viewStateCache.set(viewId, {
          currentDate: currentDate.value.toISOString(),
          zoomLevel: zoomLevel.value,
        })
        _lastCachedViewId = viewId
      }
    })

    // When the active view changes (e.g., user switches back to timeline from grid),
    // restore the cached navigation state for that view.
    watch(
      () => viewMeta.value?.id,
      (newViewId) => {
        if (!newViewId || newViewId === _lastCachedViewId) return
        const cached = _viewStateCache.get(newViewId)
        if (cached) {
          currentDate.value = dayjs(cached.currentDate)
          selectedDate.value = currentDate.value
          zoomLevel.value = cached.zoomLevel
          _lastCachedViewId = newViewId
        }
      },
      { immediate: true },
    )

    const formattedData = ref<Row[]>([])

    const isTimelineDataLoading = ref<boolean>(false)

    const searchQuery = reactive({
      value: '',
      field: '',
    })

    // Timeline meta data
    const timelineMetaData = computed<TimelineType>(() => {
      return isPublic.value ? (sharedView.value?.view as TimelineType) : (viewMeta.value?.view as TimelineType)
    })

    const viewMetaProperties = computed(() => {
      const metaObj = timelineMetaData.value?.meta
      if (typeof metaObj === 'string') {
        try {
          return JSON.parse(metaObj)
        } catch {
          return {}
        }
      }
      return metaObj ?? {}
    })

    // Timeline range - maps to start/end date columns
    const timelineRange = computed<
      Array<{
        fk_from_col: ColumnType
        fk_to_col?: ColumnType | null
        id: string
        is_readonly: boolean
      }>
    >(() => {
      if (!timelineMetaData.value?.timeline_range?.length) return []

      return timelineMetaData.value.timeline_range
        .map((range: any) => {
          // Get the from column
          const fromCol = (meta.value?.columns ?? []).find(
            (col) => col.id === range.fk_from_column_id,
          )
          // Get the to column (optional)
          const toCol = range.fk_to_column_id
            ? (meta.value?.columns ?? []).find(
                (col) => col.id === range.fk_to_column_id,
              )
            : null

          if (!fromCol) return null

          return {
            fk_from_col: fromCol,
            fk_to_col: toCol,
            id: `${range.fk_from_column_id}_${range.fk_to_column_id}`,
            is_readonly: ![UITypes.Date, UITypes.DateTime].includes(fromCol.uidt as UITypes),
          }
        })
        .filter(Boolean)
    })

    // Compute visible dates based on zoom level
    const visibleDates = computed<dayjs.Dayjs[]>(() => {
      const dates: dayjs.Dayjs[] = []
      if (zoomLevel.value === 'month') {
        const startOfMonth = currentDate.value.startOf('month')
        const daysInMonth = currentDate.value.daysInMonth()
        for (let i = 0; i < daysInMonth; i++) {
          dates.push(startOfMonth.add(i, 'day'))
        }
      } else if (zoomLevel.value === 'day') {
        dates.push(currentDate.value.startOf('day'))
      } else {
        // week view
        const startOfWeek = currentDate.value.startOf('week')
        for (let i = 0; i < 7; i++) {
          dates.push(startOfWeek.add(i, 'day'))
        }
      }

      return dates
    })

    const dateRangeLabel = computed(() => {
      if (zoomLevel.value === 'month') {
        return currentDate.value.format('MMMM YYYY')
      } else if (zoomLevel.value === 'day') {
        return currentDate.value.format('ddd, MMM D, YYYY')
      } else {
        const start = currentDate.value.startOf('week')
        const end = currentDate.value.endOf('week')
        if (start.month() === end.month()) {
          return `${start.format('D')} - ${end.format('D MMM YYYY')}`
        }
        return `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`
      }
    })

    // #3 + #15: Record statistics for the info badge
    const totalRecordCount = computed(() => formattedData.value.length)

    const recordsWithoutDates = computed(() => {
      if (!timelineRange.value?.length) return 0
      const range = timelineRange.value[0]
      return formattedData.value.filter((row) => {
        const fromVal = row.row?.[range.fk_from_col?.title!]
        return !fromVal || !dayjs(fromVal).isValid()
      }).length
    })

    // Data loading
    const loadTimelineData = async () => {
      if (
        ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) ||
        !timelineRange.value?.length
      )
        return

      isTimelineDataLoading.value = true

      try {
        const res = !isPublic.value
          ? await $api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id as string, {
              where: where?.value ?? '',
              limit: 400,
              include_row_color: true,
              getHiddenColumns: true,
              ...(isUIAllowed('filterSync') ? {} : { filterArrJson: stringifyFilterOrSortArr([...nestedFilters.value]) }),
            })
          : await fetchSharedViewData({
              sortsArr: sorts.value,
              filtersArr: [...nestedFilters.value],
              where: where?.value ?? '',
              limit: 400,
            })

        formattedData.value = (res?.list ?? []).map((row: any) => ({
          row,
          rowMeta: {
            range: timelineRange.value[0],
            ...getEvaluatedRowMetaRowColorInfo(row),
          },
          oldRow: { ...row },
        }))
      } catch (e) {
        console.error('Error loading timeline data:', e)
      } finally {
        isTimelineDataLoading.value = false
      }
    }

    // Navigate to the closest record on initial view load
    const navigateToClosestRecord = () => {
      const viewId = viewMeta.value?.id
      if (!viewId) return

      // Skip if already initialized or if cached state exists (user previously navigated)
      if (_initializedViews.has(viewId) || _viewStateCache.has(viewId)) return
      _initializedViews.add(viewId)

      // Check the initial_view setting (default: 'closest_record')
      const initialView = viewMetaProperties.value?.initial_view ?? 'closest_record'
      if (initialView === 'today') return

      // Find the record with a start date closest to today
      const range = timelineRange.value?.[0]
      if (!range?.fk_from_col?.title) return

      const now = dayjs()
      let closestDate: dayjs.Dayjs | null = null
      let closestDiff = Infinity

      for (const row of formattedData.value) {
        const dateVal = row.row?.[range.fk_from_col.title!]
        if (!dateVal) continue
        const d = dayjs(dateVal)
        if (!d.isValid()) continue

        const diff = Math.abs(d.diff(now, 'day'))
        if (diff < closestDiff) {
          closestDiff = diff
          closestDate = d
        }
      }

      if (closestDate && !closestDate.isSame(now, 'month')) {
        currentDate.value = closestDate
        selectedDate.value = closestDate
      }
    }

    // Navigation
    const navigateNext = () => {
      if (zoomLevel.value === 'month') {
        currentDate.value = currentDate.value.add(1, 'month')
      } else if (zoomLevel.value === 'day') {
        currentDate.value = currentDate.value.add(1, 'day')
      } else {
        currentDate.value = currentDate.value.add(1, 'week')
      }
    }

    const navigatePrev = () => {
      if (zoomLevel.value === 'month') {
        currentDate.value = currentDate.value.subtract(1, 'month')
      } else if (zoomLevel.value === 'day') {
        currentDate.value = currentDate.value.subtract(1, 'day')
      } else {
        currentDate.value = currentDate.value.subtract(1, 'week')
      }
    }

    const goToToday = () => {
      currentDate.value = dayjs()
      selectedDate.value = dayjs()
    }

    // #14: Navigate to a specific date (for date picker)
    const goToDate = (date: dayjs.Dayjs) => {
      currentDate.value = date
      selectedDate.value = date
    }

    const setZoomLevel = (level: 'day' | 'week' | 'month') => {
      zoomLevel.value = level
    }

    // Date format for updates (matching calendar store pattern)
    const updateFormat = computed(() => {
      return isMysql(meta.value?.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'
    })

    // Find a row in formattedData by primary key
    const findRowInState = (rowData: Record<string, any>) => {
      const pk = extractPkFromRow(rowData, meta.value?.columns as ColumnType[])
      return formattedData.value.find(
        (r) => extractPkFromRow(r.row, meta.value?.columns as ColumnType[]) === pk,
      )
    }

    // Update a row property (used for drag-to-resize)
    // Follows the same pattern as useCalendarViewStore.updateRowProperty
    async function updateRowProperty(toUpdate: Row, property: string[], undo = false) {
      try {
        const id = extractPkFromRow(toUpdate.row, meta?.value?.columns as ColumnType[])

        const updateObj = property.reduce(
          (acc: Record<string, string>, curr) => {
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

        return updatedRowData
      } catch (e: any) {
        message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    // Re-evaluate row colors when colour config changes (e.g. Background colour toggle)
    const smartsheetEventHandler = (event: SmartsheetStoreEvents) => {
      if (![SmartsheetStoreEvents.TRIGGER_RE_RENDER, SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE].includes(event)) {
        return
      }

      formattedData.value = formattedData.value.map((row) => {
        Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(row.row))
        return row
      })
    }

    eventBus.on(smartsheetEventHandler)

    onBeforeUnmount(() => {
      eventBus.off(smartsheetEventHandler)
    })

    return {
      // State
      zoomLevel,
      currentDate,
      selectedDate,
      formattedData,
      isTimelineDataLoading,
      searchQuery,
      timelineMetaData,
      viewMetaProperties,
      timelineRange,
      visibleDates,
      dateRangeLabel,
      isPublic,
      totalRecordCount,
      recordsWithoutDates,

      updateFormat,

      // Methods
      loadTimelineData,
      navigateToClosestRecord,
      navigateNext,
      navigatePrev,
      goToToday,
      goToDate,
      setZoomLevel,
      updateRowProperty,
    }
  },
  'timeline-view-store',
)

export { useProvideTimelineViewStore }

export function useTimelineViewStoreOrThrow() {
  const store = useTimelineViewStore()
  if (!store) {
    throw new Error('Timeline view store is not provided')
  }
  return store
}
