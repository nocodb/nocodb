import dayjs from 'dayjs'
import type { ColumnType, DataPayload, FilterType, TableType, TimelineType, ViewType } from 'nocodb-sdk'
import { EventType, UITypes } from 'nocodb-sdk'
import { type ComputedRef, type Ref, computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { Row } from '~/lib/types'
import { NOCO } from '~/lib/constants'
import { validateRowFilters } from '~/utils/dataUtils'
import type { TimelineZoomLevel } from '../utils/timelineUtils'
import { TIMELINE_RECORD_LIMIT, isFortnightMonday, isGridlineBoundary } from '../utils/timelineUtils'

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
  minorLabel:
    | 'weekday-full'
    | 'weekday-short'
    | 'weekday-letter'
    | 'day-number'
    | 'mondays'
    | 'fortnight'
    | 'quarter-month'
    | 'none'
  // Gridline cadence — only render vertical lines at boundaries of this unit.
  // At fine zooms this matches the day cells; at coarse zooms it strips away
  // daily gridlines so the grid reads as week/fortnight/month/quarter chunks.
  gridlineUnit: 'day' | 'week' | 'fortnight' | 'month' | 'quarter'
}

const SCALE_CONFIG: Record<TimelineZoomLevel, ScaleConfig> = {
  day: { colWidth: 160, bufferDays: 30, navUnit: 'day', navAmount: 1, majorTiers: [], minorLabel: 'weekday-full', gridlineUnit: 'day' },
  week: { colWidth: 72, bufferDays: 60, navUnit: 'week', navAmount: 1, majorTiers: [], minorLabel: 'weekday-short', gridlineUnit: 'day' },
  '2week': { colWidth: 56, bufferDays: 90, navUnit: 'week', navAmount: 2, majorTiers: ['month'], minorLabel: 'weekday-letter', gridlineUnit: 'day' },
  month: { colWidth: 36, bufferDays: 120, navUnit: 'month', navAmount: 1, majorTiers: [], minorLabel: 'weekday-letter', gridlineUnit: 'day' },
  quarter: { colWidth: 12, bufferDays: 365, navUnit: 'month', navAmount: 3, majorTiers: ['quarter', 'month'], minorLabel: 'mondays', gridlineUnit: 'week' },
  '6month': { colWidth: 6, bufferDays: 540, navUnit: 'month', navAmount: 6, majorTiers: ['quarter', 'month'], minorLabel: 'mondays', gridlineUnit: 'week' },
  year: { colWidth: 4, bufferDays: 730, navUnit: 'year', navAmount: 1, majorTiers: ['month'], minorLabel: 'fortnight', gridlineUnit: 'fortnight' },
  '2year': { colWidth: 2, bufferDays: 1095, navUnit: 'year', navAmount: 2, majorTiers: ['year', 'quarter'], minorLabel: 'quarter-month', gridlineUnit: 'month' },
  '5year': { colWidth: 1, bufferDays: 1825, navUnit: 'year', navAmount: 5, majorTiers: ['year', 'quarter'], minorLabel: 'quarter-month', gridlineUnit: 'quarter' },
}


const quarterOf = (d: dayjs.Dayjs): number => Math.floor(d.month() / 3) + 1

// Extend the buffer once the user scrolls within this many pixels of an edge.
const EXTEND_THRESHOLD_PX = 240

// Cap total buffer span at this multiple of one extension chunk. Long
// scroll sessions trim the opposite edge so visibleDates and the four
// derived sparse arrays don't grow without bound.
const MAX_BUFFER_MULTIPLIER = 6

// Module-level cache to persist timeline navigation state across view switches.
// Keyed by view ID so each timeline view remembers its own position. Bounded
// LRU — every view a user opens leaves an entry, so without a cap this would
// grow unboundedly across long sessions.
const MAX_CACHED_VIEWS = 50
const _viewStateCache = new Map<string, { currentDate: string; zoomLevel: TimelineZoomLevel }>()
const _initializedViews = new Set<string>()

// LRU helpers: re-insert on access so the most recently touched entry is
// always last. When the cache exceeds MAX_CACHED_VIEWS, evict the oldest
// entry from the head of the Map (insertion order is the LRU order).
const lruViewCacheGet = (viewId: string) => {
  const entry = _viewStateCache.get(viewId)
  if (entry) {
    _viewStateCache.delete(viewId)
    _viewStateCache.set(viewId, entry)
  }
  return entry
}

const lruViewCacheSet = (
  viewId: string,
  entry: { currentDate: string; zoomLevel: TimelineZoomLevel },
) => {
  if (_viewStateCache.has(viewId)) _viewStateCache.delete(viewId)
  _viewStateCache.set(viewId, entry)
  while (_viewStateCache.size > MAX_CACHED_VIEWS) {
    const oldest = _viewStateCache.keys().next().value
    if (oldest === undefined) break
    _viewStateCache.delete(oldest)
    _initializedViews.delete(oldest)
  }
}

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

    // Sparse gridline + label arrays, replacing per-day v-for loops in the
    // header and body. At year/5-year zoom levels the buffer holds 1.4k–3.7k
    // dates; iterating that many cells per scroll frame stalls Vue's diff
    // even though most cells produce no DOM. By pre-filtering once per zoom
    // change we render only the few hundred elements that actually paint.

    // Show weekend stripes only when columns are wide enough to make them
    // visually distinct — at quarter+ zoom each weekend day collapses to
    // ≤12px and the alternating shade reads as noise.
    const SHOW_WEEKEND_MIN_COL_WIDTH = 30

    // Vertical gridlines at the current scale's cadence (day / week /
    // fortnight / month / quarter). The leftPx is the right edge of the
    // boundary date — i.e. the start of the next cell.
    const gridlineOffsets = computed(() => {
      const cw = colWidth.value
      const unit = SCALE_CONFIG[zoomLevel.value].gridlineUnit
      const dates = visibleDates.value
      const offsets: Array<{ leftPx: number; key: string }> = []
      for (let i = 0; i < dates.length; i++) {
        if (isGridlineBoundary(dates[i], unit)) {
          offsets.push({ leftPx: (i + 1) * cw, key: dates[i].format('YYYY-MM-DD') })
        }
      }
      return offsets
    })

    // Weekend day positions — only emitted at fine zooms so we don't paint
    // thousands of useless 1-2px stripes at 5-year scale.
    const weekendOffsets = computed(() => {
      const cw = colWidth.value
      if (cw < SHOW_WEEKEND_MIN_COL_WIDTH) return []
      const dates = visibleDates.value
      const offsets: Array<{ leftPx: number; key: string }> = []
      for (let i = 0; i < dates.length; i++) {
        const d = dates[i].day()
        if (d === 0 || d === 6) {
          offsets.push({ leftPx: i * cw, key: dates[i].format('YYYY-MM-DD') })
        }
      }
      return offsets
    })

    // Header minor-row labels — only entries that produce non-empty text.
    // At 'mondays' that's 1-in-7; at 'none' it's empty; at 'weekday-*' modes
    // it's still per-day but those scales have small buffers anyway.
    const minorLabels = computed(() => {
      const cw = colWidth.value
      const mode = SCALE_CONFIG[zoomLevel.value].minorLabel
      if (mode === 'none') return []
      const dates = visibleDates.value
      const showWeekday = mode === 'weekday-full' || mode === 'weekday-short' || mode === 'weekday-letter'
      const labels: Array<{ idx: number; leftPx: number; weekday: string; dayNum: string; key: string }> = []
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i]
        let weekday = ''
        let dayNum = ''
        if (showWeekday) {
          if (mode === 'weekday-full') weekday = date.format('dddd')
          else if (mode === 'weekday-short') weekday = date.format('ddd')
          else weekday = date.format('dd').charAt(0)
        }
        if (mode === 'mondays') {
          if (date.day() === 1) dayNum = date.format('D')
        } else if (mode === 'fortnight') {
          if (isFortnightMonday(date)) dayNum = date.format('D')
        } else if (mode === 'quarter-month') {
          if (date.date() === 1 && date.month() % 3 === 0) dayNum = date.format('MMM')
        } else if (showWeekday) {
          dayNum = date.format('D')
        }
        if (weekday || dayNum) {
          labels.push({ idx: i, leftPx: i * cw, weekday, dayNum, key: date.format('YYYY-MM-DD') })
        }
      }
      return labels
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
        case '2week': {
          const start = currentDate.value.startOf('week')
          const end = start.add(13, 'day')
          if (start.year() !== end.year()) {
            return `${start.format('D MMM YYYY')} - ${end.format('D MMM YYYY')}`
          }
          if (start.month() === end.month()) {
            return `${start.format('D')} - ${end.format('D MMM YYYY')}`
          }
          return `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`
        }
        case 'month':
          return currentDate.value.format('MMMM YYYY')
        case 'quarter':
          return `Q${quarterOf(currentDate.value)} ${currentDate.value.format('YYYY')}`
        case '6month': {
          const half = currentDate.value.month() < 6 ? 'H1' : 'H2'
          return `${half} ${currentDate.value.format('YYYY')}`
        }
        case 'year':
          return currentDate.value.format('YYYY')
        case '2year': {
          const startYear = currentDate.value.year()
          return `${startYear} - ${startYear + 1}`
        }
        case '5year': {
          const startYear = currentDate.value.year() - 2
          return `${startYear} - ${startYear + 4}`
        }
      }
    })

    const totalRecordCount = computed(() => formattedData.value.length)

    const recordsWithoutDates = computed(() => {
      if (!timelineRange.value?.length) return 0
      const colTitle = timelineRange.value[0].fk_from_col?.title
      if (!colTitle) return 0
      let count = 0
      for (const row of formattedData.value) {
        const fromVal = row.row?.[colTitle]
        if (!fromVal || !dayjs(fromVal).isValid()) count++
      }
      return count
    })

    // Build the bar-overlap filter for the current buffer window. Records are
    // included when their from/to span overlaps [bufferStart, bufferEnd].
    //
    // NOTE: ideally we'd also OR in null-end / null-start clauses so that
    // single-day events whose other column is blank still render — but the
    // backend filter parser currently mis-handles `comparison_op: 'blank'`
    // inside an OR group (verified: OR(strict-overlap, anything-with-blank)
    // returns 0 rows even when the strict-overlap clause alone returns tens
    // of thousands). Until that's fixed, records with a null from/to column
    // won't appear in the windowed fetch. Tracked separately.
    const buildWindowFilter = (
      fromCol: ColumnType,
      toCol: ColumnType | null | undefined,
      fromStr: string,
      toStr: string,
    ): FilterType => {
      if (toCol?.id) {
        // Strict overlap: from <= bufferEnd AND to >= bufferStart
        return {
          is_group: true,
          logical_op: 'and',
          children: [
            { fk_column_id: fromCol.id, comparison_op: 'lte', comparison_sub_op: 'exactDate', value: toStr },
            { fk_column_id: toCol.id, comparison_op: 'gte', comparison_sub_op: 'exactDate', value: fromStr },
          ],
        } as FilterType
      }
      // From-only range: bar is single-day at `from`.
      return {
        is_group: true,
        logical_op: 'and',
        children: [
          { fk_column_id: fromCol.id, comparison_op: 'gte', comparison_sub_op: 'exactDate', value: fromStr },
          { fk_column_id: fromCol.id, comparison_op: 'lte', comparison_sub_op: 'exactDate', value: toStr },
        ],
      } as FilterType
    }

    // Format buffer endpoints to match the column type. Date columns store
    // `YYYY-MM-DD`; DateTime needs a TZ-aware boundary so a record with a
    // mid-day timestamp on the boundary day still falls inside the window.
    const formatBufferDate = (d: dayjs.Dayjs, col: ColumnType, end: boolean) => {
      if (col?.uidt === UITypes.Date) return d.format('YYYY-MM-DD')
      const anchored = end ? d.endOf('day') : d.startOf('day')
      return anchored.format('YYYY-MM-DD HH:mm:ssZ')
    }

    // Sequence number — fast scrolling can fire several refetches in flight
    // at once. Increment on every dispatch and only commit the response whose
    // seq matches when it returns; older inflight responses drop on the floor.
    let _fetchSeq = 0

    const fetchTimelineRecords = async ({ showLoading }: { showLoading: boolean }) => {
      if (((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) || !timelineRange.value?.length)
        return

      const range = timelineRange.value[0]
      const fromCol = range.fk_from_col
      const toCol = range.fk_to_col
      if (!fromCol?.id) return

      const fromStr = formatBufferDate(bufferStart.value, fromCol, false)
      const toStr = formatBufferDate(bufferEnd.value, toCol ?? fromCol, true)
      const windowFilter = buildWindowFilter(fromCol, toCol, fromStr, toStr)

      // When the view's filterSync is server-managed, saved filters are
      // already applied — only attach the window predicate. Otherwise merge
      // the user's nested filters in here too so they apply on top of the
      // window scope.
      const filtersArr: FilterType[] = isUIAllowed('filterSync')
        ? [windowFilter]
        : [...nestedFilters.value, windowFilter]

      const seq = ++_fetchSeq
      if (showLoading) isTimelineDataLoading.value = true

      try {
        const res = !isPublic.value
          ? await $api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id as string, {
              where: where?.value ?? '',
              limit: TIMELINE_RECORD_LIMIT,
              include_row_color: true,
              getHiddenColumns: true,
              filterArrJson: stringifyFilterOrSortArr(filtersArr),
            })
          : await fetchSharedViewData(
              {
                sortsArr: sorts.value,
                filtersArr,
                where: where?.value ?? '',
                limit: TIMELINE_RECORD_LIMIT,
              },
              // Preserve our limit. Without this opt, fetchSharedViewData
              // overrides limit with paginationData.pageSize (default 25),
              // which would cap the timeline at 25 records on shared views.
              { isInfiniteScroll: true },
            )

        if (seq !== _fetchSeq) return

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
        if (seq === _fetchSeq && showLoading) {
          isTimelineDataLoading.value = false
        }
      }
    }

    const loadTimelineData = () => fetchTimelineRecords({ showLoading: true })

    // Silent refetch on buffer changes — fires when the user pans, zooms, or
    // jumps to a date that re-anchors the buffer. Debounced so a fast scroll
    // that triggers multiple `extendBuffer*` calls collapses into one fetch.
    // Doesn't toggle isTimelineDataLoading — the existing bars stay visible
    // until the new window arrives, then patch in place.
    const _silentRefetch = useDebounceFn(
      () => fetchTimelineRecords({ showLoading: false }),
      250,
    )

    watch([bufferStart, bufferEnd], () => {
      _silentRefetch()
    })

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

    // Both extend* functions are () => void. They mutate buffer refs and emit
    // any scroll-delta the user's viewport needs to stay anchored on the same
    // logical date — extendLeft prepends days (visible content shifts right
    // in pixel space, so scrollLeft must shift right to compensate); extendRight
    // appends days (no compensation unless the trim cap kicks in and bufferStart
    // moves forward, in which case scrollLeft must shift left).
    const extendBufferLeft = () => {
      const cw = colWidth.value
      const days = SCALE_CONFIG[zoomLevel.value].bufferDays
      const maxSpan = days * MAX_BUFFER_MULTIPLIER
      bufferStart.value = bufferStart.value.subtract(days, 'day')
      scrollAdjustmentHook.trigger({ type: 'delta', value: days * cw })
      // Trim the far (right) edge if total span exceeds the cap. Safe because
      // edge-extension only fires when the user is near the *opposite* edge,
      // so the trimmed dates aren't visible.
      const span = bufferEnd.value.diff(bufferStart.value, 'day')
      if (span > maxSpan) {
        bufferEnd.value = bufferEnd.value.subtract(span - maxSpan, 'day')
      }
    }

    const extendBufferRight = () => {
      const cw = colWidth.value
      const days = SCALE_CONFIG[zoomLevel.value].bufferDays
      const maxSpan = days * MAX_BUFFER_MULTIPLIER
      bufferEnd.value = bufferEnd.value.add(days, 'day')
      // Trim the far (left) edge if total span exceeds the cap. Adjust
      // scrollLeft so the visible content stays put after the trim.
      const span = bufferEnd.value.diff(bufferStart.value, 'day')
      if (span > maxSpan) {
        const trimDays = span - maxSpan
        bufferStart.value = bufferStart.value.add(trimDays, 'day')
        scrollAdjustmentHook.trigger({ type: 'delta', value: -trimDays * cw })
      }
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
        extendBufferLeft()
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

    // Re-anchor + scroll when zoom level changes — keep the *fractional* date
    // at viewport centre stable across the scale switch.
    //
    // `currentDate` is rounded to whole days (via Math.floor in onScrollUpdate),
    // so using it as the centre source loses up to half a day's worth of
    // pixels. At fine zoom (day = 160 px) that's a visible 80 px shift on
    // each scale change. Reading `scrollLeft + viewportWidth/2` against the
    // OLD colWidth gives the exact fractional day offset, which we then
    // re-position to viewport centre in the new layout.
    //
    // We also project `scrollLeft.value` synchronously so derived layout
    // (bar labels, viewport tests) is consistent with new buffer/colWidth on
    // the first frame. The imperative DOM scroll catches up in nextTick to
    // handle scrollWidth changes (which can clamp the sync write if the new
    // grid is wider than the old DOM had room for).
    watch(zoomLevel, (_newLevel, oldLevel) => {
      const oldColWidth = SCALE_CONFIG[oldLevel].colWidth
      const newBufferDays = SCALE_CONFIG[zoomLevel.value].bufferDays

      // When the viewport has been measured (the normal case — user clicked
      // the zoom dropdown), read the *fractional* date at viewport centre
      // off the old layout. When it hasn't been measured yet (initial mount
      // via the cache-restore path, before Grid measures itself), fall back
      // to the current `currentDate` so we don't stomp it to bufferStart;
      // the pending-scroll mechanism re-issues once the viewport arrives.
      let center: dayjs.Dayjs
      let subdayFrac = 0
      if (viewportWidth.value > 0 && oldColWidth > 0) {
        const fracOffset = (scrollLeft.value + viewportWidth.value / 2) / oldColWidth
        const wholeDays = Math.floor(fracOffset)
        subdayFrac = fracOffset - wholeDays
        center = bufferStart.value.add(wholeDays, 'day')
      } else {
        center = currentDate.value
      }

      currentDate.value = center
      reAnchorBuffer(center)

      // After reAnchor: center is exactly `newBufferDays` whole days from
      // the new bufferStart. Add `subdayFrac` to keep the fractional position.
      const computeTarget = () =>
        (newBufferDays + subdayFrac) * colWidth.value - viewportWidth.value / 2

      if (viewportWidth.value > 0) {
        scrollLeft.value = Math.max(0, computeTarget())
        nextTick(() => {
          if (viewportWidth.value <= 0) return
          scrollAdjustmentHook.trigger({ type: 'absolute', value: Math.max(0, computeTarget()) })
        })
      } else {
        // No viewport yet — defer to the pending-scroll path so the date
        // ends up centred once Grid measures itself.
        _pendingScrollDate.value = center
      }
    })

    // ---- Persistence: cache writes + cross-view restore ----
    // Debounced cache write. `_lastCachedViewId` updates synchronously so the
    // view-id watcher's "is this the view we were just navigating?" check
    // stays correct even if the user switches views before the next flush.
    // The Map write itself can lag without losing state — we capture values
    // at change time, not at flush time.
    const _persistViewState = useDebounceFn(
      (viewId: string, isoDate: string, zoom: TimelineZoomLevel) => {
        lruViewCacheSet(viewId, { currentDate: isoDate, zoomLevel: zoom })
      },
      250,
    )

    watch([currentDate, zoomLevel], () => {
      const viewId = viewMeta.value?.id
      if (!viewId) return
      _lastCachedViewId = viewId
      _persistViewState(viewId, currentDate.value.toISOString(), zoomLevel.value)
    })

    // When the active view changes (e.g., user switches back to timeline from
    // grid), restore the cached navigation state for that view.
    watch(
      () => viewMeta.value?.id,
      (newViewId) => {
        if (!newViewId || newViewId === _lastCachedViewId) return
        const cached = lruViewCacheGet(newViewId)
        if (cached) {
          zoomLevel.value = cached.zoomLevel
          const date = dayjs(cached.currentDate)
          currentDate.value = date
          selectedDate.value = date
          reAnchorBuffer(date)
          if (viewportWidth.value > 0) {
            const dayOffset = date.diff(bufferStart.value, 'day')
            const target = dayOffset * colWidth.value + colWidth.value / 2 - viewportWidth.value / 2
            scrollLeft.value = Math.max(0, target)
          }
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
                  Object.assign(row.oldRow, updatedRow)
                }
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
                  Object.assign(row.oldRow, updatedData)
                }
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

    // True when the row's bar overlaps the current buffer window — used to
    // gate realtime add/update events so out-of-window rows don't bloat
    // formattedData (the next windowed fetch would re-include them anyway
    // when the user pans there).
    const passesWindow = (rowPayload: Record<string, any>) => {
      const range = timelineRange.value?.[0]
      const fromCol = range?.fk_from_col
      if (!fromCol?.title) return true

      const fromVal = rowPayload[fromCol.title]
      const toVal = range?.fk_to_col?.title ? rowPayload[range.fk_to_col.title] : null

      const fromDate = fromVal ? dayjs(fromVal) : null
      const toDate = toVal ? dayjs(toVal) : null
      const start = fromDate?.isValid() ? fromDate : toDate?.isValid() ? toDate : null
      const end = toDate?.isValid() ? toDate : fromDate?.isValid() ? fromDate : null
      if (!start || !end) return false

      return !end.isBefore(bufferStart.value, 'day') && !start.isAfter(bufferEnd.value, 'day')
    }

    const handleDataEvent = (data: DataPayload) => {
      const { id, action, payload } = data

      if (action === 'add') {
        try {
          if (!payload || !passesViewFilters(payload) || !passesWindow(payload)) return

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
          const inWindow = passesWindow(payload)

          if (!matchesFilters || !inWindow) {
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
      majorHeaderTiers,
      gridlineOffsets,
      weekendOffsets,
      minorLabels,

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
