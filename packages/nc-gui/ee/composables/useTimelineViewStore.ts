import dayjs from 'dayjs'
import type { ColumnType, DataPayload, FilterType, TableType, TimelineType, ViewType } from 'nocodb-sdk'
import { EventType, UITypes } from 'nocodb-sdk'
import { type ComputedRef, type Ref, computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDateAxisState } from './useDateAxisState'
import type { Row } from '~/lib/types'
import { NOCO } from '~/lib/constants'

const [useProvideTimelineViewStore, useTimelineViewStore] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    viewMeta: Ref<(ViewType | TimelineType | undefined) & { id: string }>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    const { isUIAllowed } = useRoles()

    const { t } = useI18n()

    const { $api, $ncSocket } = useNuxtApp()

    const baseStore = useBase()
    const { isMysql } = baseStore
    const { base } = storeToRefs(baseStore)

    const { sharedView } = useSharedView()

    const { nestedFilters, eventBus, rowMatchesSearchAndUrl } = useSmartsheetStoreOrThrow()

    const { getEvaluatedRowMetaRowColorInfo } = useViewRowColorRender()

    const isPublic = shared ? ref(shared) : inject(IsPublicInj, ref(false))

    // ---- Date-axis state (shared with Gantt via composables/useDateAxisState) ----

    const axis = useDateAxisState({
      viewId: computed(() => viewMeta.value?.id),
      initialZoom: 'month',
    })

    const {
      zoomLevel,
      currentDate,
      selectedDate,
      bufferStart,
      bufferEnd,
      scrollLeft,
      viewportWidth,
      colWidth,
      visibleDates,
      totalGridWidth,
      gridlineOffsets,
      weekendOffsets,
      minorLabels,
      majorHeaderTiers,
      dateRangeLabel,
      reAnchorBuffer,
      requestScrollToDate,
      onScrollUpdate,
      setViewportWidth,
      onScrollAdjustment,
      goToDate,
      goToToday,
      navigateNext,
      navigatePrev,
      setZoomLevel,
      isViewInitialized,
      markViewInitialized,
    } = axis

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

    const totalRecordCount = computed(() => formattedData.value.length)

    // Format buffer endpoints to match the column type. Date columns store
    // `YYYY-MM-DD`; DateTime needs a TZ-aware boundary so a record with a
    // mid-day timestamp on the boundary day still falls inside the window.
    const formatBufferDate = (d: dayjs.Dayjs, col: ColumnType, end: boolean) => {
      if (col?.uidt === UITypes.Date) return d.format('YYYY-MM-DD')
      const anchored = end ? d.endOf('day') : d.startOf('day')
      return anchored.format('YYYY-MM-DD HH:mm:ssZ')
    }

    // Sequence number — defensive belt-and-suspenders for the serialized
    // dispatch below: if for any reason two requests do end up in flight
    // (HMR, re-entrant calls), only the response whose seq matches the
    // newest dispatch commits.
    let _fetchSeq = 0

    // Serialize fetches — at most one request in flight at a time. While a
    // fetch is running, additional calls are coalesced into a single
    // pending slot (the most recent args win); when the current fetch
    // settles, the pending slot fires next. Prevents fast scroll / zoom
    // spam from issuing parallel network calls.
    let _isFetching = false
    let _pending: { showLoading: boolean } | null = null

    const _fetchTimelineRecordsImpl = async ({ showLoading }: { showLoading: boolean }) => {
      if (((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) || !timelineRange.value?.length)
        return

      const range = timelineRange.value[0]
      const fromCol = range.fk_from_col
      const toCol = range.fk_to_col
      if (!fromCol?.id) return

      const fromStr = formatBufferDate(bufferStart.value, fromCol, false)
      const toStr = formatBufferDate(bufferEnd.value, toCol ?? fromCol, true)

      // The server builds the bar-overlap predicate from from_date/to_date
      // and merges it with any user-supplied filterArrJson. We only pass
      // the user's nested filters when filterSync is off (otherwise the
      // saved view filters are already applied server-side).
      const userFilters: FilterType[] = isUIAllowed('filterSync') ? [] : [...nestedFilters.value]

      const seq = ++_fetchSeq
      if (showLoading) isTimelineDataLoading.value = true

      try {
        const queryParams: Record<string, string> = {
          from_date: fromStr,
          to_date: toStr,
          where: where?.value ?? '',
          include_row_color: 'true',
        }
        if (userFilters.length) {
          queryParams.filterArrJson = stringifyFilterOrSortArr(userFilters)
        }

        // Hit the dedicated timeline endpoint. Server enforces
        // TIMELINE_RECORD_LIMIT via `limitOverride`, bypassing the
        // deployment-level NC_DB_QUERY_LIMIT_MAX clamp that would
        // otherwise cap us at e.g. 100 on cloud builds.
        const url = !isPublic.value
          ? `/api/v1/db/timeline-data/noco/${base.value.id}/${meta.value!.id}/views/${viewMeta.value!.id}`
          : `/api/v2/public/timeline-view/${sharedView.value?.uuid}`

        const res = await $api.instance
          .get(url, {
            params: queryParams,
            ...(isPublic.value ? { headers: { 'xc-password': sharedView.value?.password } } : {}),
          })
          .then((r: any) => r.data)

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
        if (seq === _fetchSeq) {
          // @ts-expect-error - extractSdkResponseErrorMsg defensively handles unknown shapes
          message.error(await extractSdkResponseErrorMsg(e))
        }
      } finally {
        if (seq === _fetchSeq && showLoading) {
          isTimelineDataLoading.value = false
        }
      }
    }

    const fetchTimelineRecords = async (args: { showLoading: boolean }): Promise<void> => {
      if (_isFetching) {
        // Replace any earlier queued request — only the latest matters.
        // If any caller wanted the loading spinner shown, preserve that.
        _pending = {
          showLoading: (_pending?.showLoading ?? false) || args.showLoading,
        }
        return
      }
      _isFetching = true
      try {
        await _fetchTimelineRecordsImpl(args)
      } finally {
        _isFetching = false
        if (_pending) {
          const next = _pending
          _pending = null
          // Fire-and-forget — the new call goes through the same gate.
          fetchTimelineRecords(next)
        }
      }
    }

    const loadTimelineData = () => fetchTimelineRecords({ showLoading: true })

    // Silent refetch on buffer changes — fires when the user pans, zooms, or
    // jumps to a date that re-anchors the buffer. Debounced so a fast scroll
    // that triggers multiple `extendBuffer*` calls collapses into one fetch.
    // Doesn't toggle isTimelineDataLoading — the existing bars stay visible
    // until the new window arrives, then patch in place.
    const _silentRefetch = useDebounceFn(() => fetchTimelineRecords({ showLoading: false }), 250)

    watch([bufferStart, bufferEnd], () => {
      _silentRefetch()
    })

    const navigateToClosestRecord = async () => {
      const viewId = viewMeta.value?.id
      if (!viewId) return

      if (isViewInitialized(viewId)) return
      markViewInitialized(viewId)

      const initialView = viewMetaProperties.value?.initial_view ?? 'closest_record'
      if (initialView === 'today') {
        // Centre on today via scroll once viewport width is known
        requestScrollToDate(dayjs())
        return
      }

      const range = timelineRange.value?.[0]
      const fromCol = range?.fk_from_col
      if (!fromCol?.id || !fromCol?.title) {
        requestScrollToDate(dayjs())
        return
      }

      const now = dayjs()
      let closestDate: dayjs.Dayjs | null = null
      let closestDiff = Infinity

      for (const row of formattedData.value) {
        const dateVal = row.row?.[fromCol.title!]
        if (!dateVal) continue
        const d = dayjs(dateVal)
        if (!d.isValid()) continue

        const diff = Math.abs(d.diff(now, 'day'))
        if (diff < closestDiff) {
          closestDiff = diff
          closestDate = d
        }
      }

      // The initial windowed fetch is bounded to ±bufferDays around today.
      // If no records fall in that window formattedData is empty and the
      // scan above yields nothing — anchor would silently snap back to
      // today and the user lands on a blank timeline. Probe the first
      // record via the normal list API (limit 1, sorted asc on from-col)
      // so the buffer re-anchors on real data.
      if (!closestDate && !isPublic.value && base?.value?.id && meta.value?.id) {
        try {
          const res = await $api.dbViewRow.list('noco', base.value.id, meta.value.id, viewId, {
            limit: 1,
            sortArrJson: stringifyFilterOrSortArr([{ fk_column_id: fromCol.id, direction: 'asc' }]),
          } as any)
          const dateVal = (res as any)?.list?.[0]?.[fromCol.title!]
          if (dateVal) {
            const d = dayjs(dateVal)
            if (d.isValid()) closestDate = d
          }
        } catch {
          // Probe is best-effort — fall through to today on any error.
        }
      }

      const target = closestDate && !closestDate.isSame(now, 'month') ? closestDate : now
      currentDate.value = target
      selectedDate.value = target
      reAnchorBuffer(target)
      requestScrollToDate(target)
    }

    const updateFormat = computed(() => {
      return isMysql(meta.value?.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'
    })

    const _findRowInState = (rowData: Record<string, any>) => {
      const pk = extractPkFromRow(rowData, meta.value?.columns as ColumnType[])
      return formattedData.value.find((r) => extractPkFromRow(r.row, meta.value?.columns as ColumnType[]) === pk)
    }

    async function updateRowProperty(toUpdate: Row, property: string[]) {
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

        Object.assign(toUpdate.row, updatedRowData)
        Object.assign(toUpdate.oldRow, updatedRowData)
        Object.assign(toUpdate.rowMeta, getEvaluatedRowMetaRowColorInfo(toUpdate.row))

        return updatedRowData
      } catch (e) {
        // @ts-expect-error - extractSdkResponseErrorMsg defensively handles unknown shapes
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

    // Saved view filters → trust the server's matchedViewIds. Ad-hoc URL `where` + toolbar search
    // → server can't know them, so AND them in client-side via rowMatchesSearchAndUrl.
    const recordPassesViewFilter = (data: DataPayload) => {
      if (Array.isArray(data.matchedViewIds) && !data.matchedViewIds.includes(viewMeta.value?.id as string)) {
        return false
      }
      return rowMatchesSearchAndUrl(data.payload)
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

      // A bulk op arrives as one event carrying its rows — replay each through the per-row
      // handler so it applies incrementally (no refetch).
      if (action === 'bulk') {
        if (Array.isArray(data.rows)) {
          for (const row of data.rows) handleDataEvent(row)
        }
        return
      }

      if (action === 'add') {
        try {
          if (!payload || !recordPassesViewFilter(data) || !passesWindow(payload)) return

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
          // Realtime payload from external source — surface shape mismatches
          // to dev tools without crashing the listener. Next windowed fetch
          // will reconcile state.
          console.warn('[timeline] realtime add handler failed', e)
        }
      } else if (action === 'update') {
        try {
          if (!payload) return

          const existingIndex = findRowIndexByPk(id)
          const matchesFilters = recordPassesViewFilter(data)
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
          // Defensive — same rationale as the 'add' branch above.
          console.warn('[timeline] realtime update handler failed', e)
        }
      } else if (action === 'delete') {
        try {
          const existingIndex = findRowIndexByPk(id)
          if (existingIndex !== -1) {
            formattedData.value.splice(existingIndex, 1)
          }
        } catch (e) {
          // Defensive — same rationale as the 'add' branch above.
          console.warn('[timeline] realtime delete handler failed', e)
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
      onScrollAdjustment,
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
