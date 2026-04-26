import dayjs from 'dayjs'
import type { ColumnType, DataPayload, TableType, TimelineType, ViewType } from 'nocodb-sdk'
import { EventType, UITypes } from 'nocodb-sdk'
import { type ComputedRef, type Ref, computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { Row } from '~/lib/types'
import { NOCO } from '~/lib/constants'
import { validateRowFilters } from '~/utils/dataUtils'
import type { TimelineZoomLevel } from '../utils/timelineUtils'

// Per-scale config drives column width, buffer size, prev/next step, and
// header rendering. `colWidth` is the fixed pixel width of one day-column.
// `bufferDays` is how many days each side of the anchor we render initially
// (and extend by when the user nears an edge).
//
// Header layout has up to N stacked major rows + one minor (per-day) row.
// `majorTiers` lists the major rows top-down — e.g. `['quarter', 'month']`
// shows "Q2 2026" over "April / May / June". Empty array = no major row.
// `minorLabel` controls per-day cell labels in the bottom row.
type MajorTier = 'year' | 'quarter' | 'month'

interface ScaleConfig {
  colWidth: number
  bufferDays: number
  navUnit: 'day' | 'week' | 'month' | 'year'
  navAmount: number
  majorTiers: MajorTier[]
  minorLabel: 'weekday-full' | 'weekday-short' | 'weekday-letter' | 'day-number' | 'mondays' | 'none'
  // Gridline cadence — only render vertical lines at boundaries of this unit.
  // At fine zooms this matches the day cells; at coarse zooms it strips away
  // daily gridlines so the grid reads as week/month/quarter chunks.
  gridlineUnit: 'day' | 'week' | 'month' | 'quarter'
}

const SCALE_CONFIG: Record<TimelineZoomLevel, ScaleConfig> = {
  day: { colWidth: 160, bufferDays: 30, navUnit: 'day', navAmount: 1, majorTiers: [], minorLabel: 'weekday-full', gridlineUnit: 'day' },
  week: { colWidth: 72, bufferDays: 60, navUnit: 'week', navAmount: 1, majorTiers: [], minorLabel: 'weekday-short', gridlineUnit: 'day' },
  month: { colWidth: 36, bufferDays: 120, navUnit: 'month', navAmount: 1, majorTiers: [], minorLabel: 'weekday-letter', gridlineUnit: 'day' },
  quarter: { colWidth: 12, bufferDays: 365, navUnit: 'month', navAmount: 3, majorTiers: ['quarter', 'month'], minorLabel: 'mondays', gridlineUnit: 'week' },
  year: { colWidth: 4, bufferDays: 730, navUnit: 'year', navAmount: 1, majorTiers: ['month'], minorLabel: 'none', gridlineUnit: 'month' },
  '5year': { colWidth: 1, bufferDays: 1825, navUnit: 'year', navAmount: 5, majorTiers: ['year'], minorLabel: 'none', gridlineUnit: 'quarter' },
}

const quarterOf = (d: dayjs.Dayjs): number => Math.floor(d.month() / 3) + 1

// Extend the buffer once the user scrolls within this many pixels of an edge.
const EXTEND_THRESHOLD_PX = 240

// Module-level cache to persist timeline navigation state across view switches.
// Keyed by view ID so each timeline view remembers its own position.
const _viewStateCache = new Map<string, { currentDate: string; zoomLevel: TimelineZoomLevel }>()

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

    const { $api, $ncSocket } = useNuxtApp()

    const { user } = useGlobal()

    const baseStore = useBase()
    const { isMysql, getBaseType } = baseStore
    const { base } = storeToRefs(baseStore)

    const { sharedView, fetchSharedViewData } = useSharedView()

    const { sorts, nestedFilters, eventBus, allFilters, validFiltersFromUrlParams } = useSmartsheetStoreOrThrow()

    const { metas } = useMetas()

    const { getEvaluatedRowMetaRowColorInfo } = useViewRowColorRender()

    const isPublic = shared ? ref(shared) : inject(IsPublicInj, ref(false))

    // ---- Timeline state ----

    const zoomLevel = ref<TimelineZoomLevel>('month')

    // `currentDate` is the date currently centred in the viewport. It is
    // primarily *derived* from scroll position (via `onScrollUpdate`), but
    // explicit navigation actions (date picker, today, prev/next) write to
    // it as well. It drives the breadcrumb label and is what gets cached.
    const currentDate = ref<dayjs.Dayjs>(dayjs())

    const selectedDate = ref<dayjs.Dayjs>(dayjs())

    // ---- Buffered window ----

    // Initial buffer is sized for the default zoom level; it gets re-anchored
    // on zoom level changes and extended on near-edge scrolls.
    const bufferStart = ref<dayjs.Dayjs>(currentDate.value.startOf('day').subtract(SCALE_CONFIG.month.bufferDays, 'day'))
    const bufferEnd = ref<dayjs.Dayjs>(currentDate.value.startOf('day').add(SCALE_CONFIG.month.bufferDays, 'day'))

    // Scroll position (px from buffer start) and viewport width — set by the
    // grid component. The store reads these to derive `currentDate` and to
    // compute scroll targets for goToDate / today / prev / next.
    const scrollLeft = ref(0)
    const viewportWidth = ref(0)

    // Per-scale fixed column width.
    const colWidth = computed(() => SCALE_CONFIG[zoomLevel.value].colWidth)

    const visibleDates = computed<dayjs.Dayjs[]>(() => {
      const dates: dayjs.Dayjs[] = []
      let d = bufferStart.value
      // bufferEnd is inclusive
      while (!d.isAfter(bufferEnd.value, 'day')) {
        dates.push(d)
        d = d.add(1, 'day')
      }
      return dates
    })

    const totalGridWidth = computed(() => visibleDates.value.length * colWidth.value)

    // Header config for the current scale — drives whether/which major rows
    // render, what the per-cell minor row shows, and the gridline cadence.
    const headerConfig = computed(() => {
      const cfg = SCALE_CONFIG[zoomLevel.value]
      return { majorTiers: cfg.majorTiers, minorLabel: cfg.minorLabel, gridlineUnit: cfg.gridlineUnit }
    })

    // Stacked major rows. Each tier is one row of consecutive same-unit spans
    // (e.g. quarter spans, then month spans below). When a parent tier already
    // shows year context, child tiers omit the year from their labels.
    const majorHeaderTiers = computed(() => {
      const tiers = SCALE_CONFIG[zoomLevel.value].majorTiers
      const dates = visibleDates.value
      const cw = colWidth.value
      return tiers.map((unit, tierIdx) => {
        const omitYear = tiers.slice(0, tierIdx).some((t) => t === 'year' || t === 'quarter')
        const spans: Array<{ key: string; leftPx: number; widthPx: number; label: string }> = []
        let i = 0
        while (i < dates.length) {
          const start = dates[i]
          let j = i + 1
          while (j < dates.length) {
            if (unit === 'quarter') {
              if (quarterOf(dates[j]) !== quarterOf(start) || dates[j].year() !== start.year()) break
            } else if (!dates[j].isSame(start, unit)) {
              break
            }
            j++
          }
          let label = ''
          if (unit === 'year') label = start.format('YYYY')
          else if (unit === 'quarter') label = omitYear ? `Q${quarterOf(start)}` : `Q${quarterOf(start)} ${start.format('YYYY')}`
          else label = omitYear ? start.format('MMMM') : start.format('MMM YYYY')

          spans.push({
            key: `${unit}-${start.format('YYYY-MM-DD')}`,
            leftPx: i * cw,
            widthPx: (j - i) * cw,
            label,
          })
          i = j
        }
        return spans
      })
    })

    // Event hook used to ask the grid component to imperatively adjust the
    // body's scrollLeft. `absolute` sets a target; `delta` adds to current
    // (used after extending the buffer leftward to keep the visible content
    // anchored).
    const scrollAdjustmentHook = createEventHook<{ type: 'absolute' | 'delta'; value: number }>()

    // ---- Persistence (watcher set up further down — needs scroll helpers) ----

    // Track the last timeline view ID we cached state for, so we can
    // detect when the active view switches back to a timeline and restore.
    let _lastCachedViewId: string | undefined

    // ---- Data ----

    const formattedData = ref<Row[]>([])

    const isTimelineDataLoading = ref<boolean>(false)

    const searchQuery = reactive({
      value: '',
      field: '',
    })

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
          const fromCol = (meta.value?.columns ?? []).find((col) => col.id === range.fk_from_column_id)
          const toCol = range.fk_to_column_id ? (meta.value?.columns ?? []).find((col) => col.id === range.fk_to_column_id) : null

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

    const dateRangeLabel = computed(() => {
      switch (zoomLevel.value) {
        case 'day':
          return currentDate.value.format('ddd, MMM D, YYYY')
        case 'week': {
          const start = currentDate.value.startOf('week')
          const end = currentDate.value.endOf('week')
          if (start.month() === end.month()) {
            return `${start.format('D')} - ${end.format('D MMM YYYY')}`
          }
          return `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`
        }
        case 'month':
          return currentDate.value.format('MMMM YYYY')
        case 'quarter':
          return `Q${quarterOf(currentDate.value)} ${currentDate.value.format('YYYY')}`
        case 'year':
          return currentDate.value.format('YYYY')
        case '5year': {
          const startYear = currentDate.value.year() - 2
          return `${startYear} - ${startYear + 4}`
        }
      }
    })

    const totalRecordCount = computed(() => formattedData.value.length)

    const recordsWithoutDates = computed(() => {
      if (!timelineRange.value?.length) return 0
      const range = timelineRange.value[0]
      return formattedData.value.filter((row) => {
        const fromVal = range.fk_from_col?.title ? row.row?.[range.fk_from_col.title] : undefined
        return !fromVal || !dayjs(fromVal).isValid()
      }).length
    })

    const loadTimelineData = async () => {
      if (((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) || !timelineRange.value?.length)
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

    const navigateToClosestRecord = () => {
      const viewId = viewMeta.value?.id
      if (!viewId) return

      if (_initializedViews.has(viewId) || _viewStateCache.has(viewId)) return
      _initializedViews.add(viewId)

      const initialView = viewMetaProperties.value?.initial_view ?? 'closest_record'
      if (initialView === 'today') {
        // Centre on today via scroll once viewport width is known
        requestScrollToDate(dayjs())
        return
      }

      const range = timelineRange.value?.[0]
      if (!range?.fk_from_col?.title) {
        requestScrollToDate(dayjs())
        return
      }

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

      const target = closestDate && !closestDate.isSame(now, 'month') ? closestDate : now
      currentDate.value = target
      selectedDate.value = target
      reAnchorBuffer(target)
      requestScrollToDate(target)
    }

    // ---- Buffer / scroll mechanics ----

    const reAnchorBuffer = (date: dayjs.Dayjs) => {
      const days = SCALE_CONFIG[zoomLevel.value].bufferDays
      bufferStart.value = date.startOf('day').subtract(days, 'day')
      bufferEnd.value = date.startOf('day').add(days, 'day')
    }

    const extendBufferLeft = () => {
      const days = SCALE_CONFIG[zoomLevel.value].bufferDays
      bufferStart.value = bufferStart.value.subtract(days, 'day')
      return days * colWidth.value
    }

    const extendBufferRight = () => {
      const days = SCALE_CONFIG[zoomLevel.value].bufferDays
      bufferEnd.value = bufferEnd.value.add(days, 'day')
    }

    // Compute and emit a scroll target so `date` ends up centred in the
    // viewport. If viewport width hasn't been measured yet (initial mount,
    // before the grid container has rendered), queue the date and re-issue
    // once the width is known.
    const _pendingScrollDate = ref<dayjs.Dayjs | null>(null)

    const requestScrollToDate = (date: dayjs.Dayjs) => {
      if (viewportWidth.value <= 0) {
        _pendingScrollDate.value = date
        return
      }
      const dayOffset = date.diff(bufferStart.value, 'day')
      const target = dayOffset * colWidth.value + colWidth.value / 2 - viewportWidth.value / 2
      scrollAdjustmentHook.trigger({ type: 'absolute', value: Math.max(0, target) })
    }

    // Drain pending scroll once the grid measures itself.
    watch(viewportWidth, (w) => {
      if (w > 0 && _pendingScrollDate.value) {
        const date = _pendingScrollDate.value
        _pendingScrollDate.value = null
        requestScrollToDate(date)
      }
    })

    // Called from the grid on every scroll event. Updates derived state and
    // grows the buffer when the user nears an edge.
    const onScrollUpdate = (newScrollLeft: number) => {
      scrollLeft.value = newScrollLeft

      // Update currentDate from viewport center
      if (viewportWidth.value > 0 && colWidth.value > 0) {
        const centerPx = newScrollLeft + viewportWidth.value / 2
        const dayIdx = Math.floor(centerPx / colWidth.value)
        const newDate = bufferStart.value.add(dayIdx, 'day')
        if (!newDate.isSame(currentDate.value, 'day')) {
          currentDate.value = newDate
        }
      }

      // Edge-driven extension
      if (newScrollLeft < EXTEND_THRESHOLD_PX) {
        const delta = extendBufferLeft()
        scrollAdjustmentHook.trigger({ type: 'delta', value: delta })
      } else if (
        viewportWidth.value > 0 &&
        newScrollLeft + viewportWidth.value > totalGridWidth.value - EXTEND_THRESHOLD_PX
      ) {
        extendBufferRight()
      }
    }

    const setViewportWidth = (w: number) => {
      viewportWidth.value = w
    }

    // Re-anchor + scroll when zoom level changes — keeps `currentDate` centred.
    watch(zoomLevel, () => {
      const center = currentDate.value
      reAnchorBuffer(center)
      // Wait for re-render before requesting scroll, since visibleDates length
      // changes synchronously but DOM hasn't reflected it yet.
      nextTick(() => requestScrollToDate(center))
    })

    // ---- Persistence: cache writes + cross-view restore ----
    // Persist navigation state whenever currentDate or zoomLevel changes.
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

    // When the active view changes (e.g., user switches back to timeline from
    // grid), restore the cached navigation state for that view.
    watch(
      () => viewMeta.value?.id,
      (newViewId) => {
        if (!newViewId || newViewId === _lastCachedViewId) return
        const cached = _viewStateCache.get(newViewId)
        if (cached) {
          zoomLevel.value = cached.zoomLevel
          const date = dayjs(cached.currentDate)
          currentDate.value = date
          selectedDate.value = date
          reAnchorBuffer(date)
          nextTick(() => requestScrollToDate(date))
          _lastCachedViewId = newViewId
        }
      },
      { immediate: true },
    )

    // ---- Navigation ----

    const goToDate = (date: dayjs.Dayjs) => {
      currentDate.value = date
      selectedDate.value = date

      const inBuffer = !date.isBefore(bufferStart.value, 'day') && !date.isAfter(bufferEnd.value, 'day')
      if (inBuffer) {
        requestScrollToDate(date)
      } else {
        reAnchorBuffer(date)
        nextTick(() => requestScrollToDate(date))
      }
    }

    const goToToday = () => goToDate(dayjs())

    const navigateNext = () => {
      const cfg = SCALE_CONFIG[zoomLevel.value]
      goToDate(currentDate.value.add(cfg.navAmount, cfg.navUnit))
    }

    const navigatePrev = () => {
      const cfg = SCALE_CONFIG[zoomLevel.value]
      goToDate(currentDate.value.subtract(cfg.navAmount, cfg.navUnit))
    }

    const setZoomLevel = (level: TimelineZoomLevel) => {
      zoomLevel.value = level
    }

    const updateFormat = computed(() => {
      return isMysql(meta.value?.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'
    })

    const findRowInState = (rowData: Record<string, any>) => {
      const pk = extractPkFromRow(rowData, meta.value?.columns as ColumnType[])
      return formattedData.value.find((r) => extractPkFromRow(r.row, meta.value?.columns as ColumnType[]) === pk)
    }

    async function updateRowProperty(toUpdate: Row, property: string[], undo = false) {
      try {
        const id = extractPkFromRow(toUpdate.row, meta?.value?.columns as ColumnType[])

        const updateObj = property.reduce((acc: Record<string, string>, curr) => {
          acc[curr] = toUpdate.row[curr]
          return acc
        }, {})

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
                  Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(row.row))
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
                  Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(row.row))
                }
                Object.assign(row!.oldRow, updatedData)
              },
              args: [clone(toUpdate), property],
            },
            scope: defineViewScope({ view: viewMeta.value as ViewType }),
          })
          Object.assign(toUpdate.row, updatedRowData)
          Object.assign(toUpdate.oldRow, updatedRowData)
          Object.assign(toUpdate.rowMeta, getEvaluatedRowMetaRowColorInfo(toUpdate.row))
        }

        return updatedRowData
      } catch (e: any) {
        message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

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

    const activeDataListener = ref<string | null>(null)

    const findRowIndexByPk = (pkVal: string | number) => {
      return formattedData.value.findIndex((row) => {
        const pk = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
        return pk && `${pk}` === `${pkVal}`
      })
    }

    const passesViewFilters = (rowPayload: Record<string, any>) => {
      return validateRowFilters(
        [...allFilters.value, ...validFiltersFromUrlParams.value],
        rowPayload,
        meta.value?.columns as ColumnType[],
        getBaseType(viewMeta.value?.view?.source_id),
        metas.value,
        meta.value?.base_id,
        {
          currentUser: user.value,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      )
    }

    const handleDataEvent = (data: DataPayload) => {
      const { id, action, payload } = data

      if (action === 'add') {
        try {
          if (!payload || !passesViewFilters(payload)) return

          const existingIndex = findRowIndexByPk(id)
          if (existingIndex !== -1) return

          formattedData.value.push({
            row: payload,
            oldRow: { ...payload },
            rowMeta: {
              new: false,
              ...getEvaluatedRowMetaRowColorInfo(payload),
            },
          })
        } catch (e) {
          console.error('Failed to add timeline row on socket event', e)
        }
      } else if (action === 'update') {
        try {
          if (!payload) return

          const existingIndex = findRowIndexByPk(id)
          const matchesFilters = passesViewFilters(payload)

          if (!matchesFilters) {
            if (existingIndex !== -1) {
              formattedData.value.splice(existingIndex, 1)
            }
            return
          }

          if (existingIndex === -1) {
            handleDataEvent({ ...data, action: 'add' })
            return
          }

          const existingRow = formattedData.value[existingIndex]
          Object.assign(existingRow.row, payload)
          Object.assign(existingRow.oldRow, payload)
          Object.assign(existingRow.rowMeta, getEvaluatedRowMetaRowColorInfo(existingRow.row))
          existingRow.rowMeta.changed = false
        } catch (e) {
          console.error('Failed to update timeline row on socket event', e)
        }
      } else if (action === 'delete') {
        try {
          const existingIndex = findRowIndexByPk(id)
          if (existingIndex !== -1) {
            formattedData.value.splice(existingIndex, 1)
          }
        } catch (e) {
          console.error('Failed to delete timeline row on socket event', e)
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
      eventBus.off(smartsheetEventHandler)

      if (activeDataListener.value) {
        $ncSocket.offMessage(activeDataListener.value)
      }
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

      // Scroll/buffer state
      bufferStart,
      bufferEnd,
      colWidth,
      totalGridWidth,
      scrollLeft,
      viewportWidth,

      // Header rendering
      headerConfig,
      majorHeaderTiers,

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
      onScrollUpdate,
      setViewportWidth,
      onScrollAdjustment: scrollAdjustmentHook.on,
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
