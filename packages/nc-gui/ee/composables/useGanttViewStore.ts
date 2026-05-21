import dayjs from 'dayjs'
import type { ColumnType, DataPayload, FilterType, TableType, GanttType, ViewType } from 'nocodb-sdk'
import { EventType, UITypes } from 'nocodb-sdk'
import { type ComputedRef, type Ref, computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDateAxisState } from './useDateAxisState'
import type { TimelineZoomLevel } from '../utils/timelineUtils'
import type { Row } from '~/lib/types'
import { NOCO } from '~/lib/constants'
import { validateRowFilters } from '~/utils/dataUtils'

// Gantt uses Timeline's scale model minus the day-level zoom. A single-day
// viewport is too narrow once dependency arrows + milestones are rendered —
// callers want at least a week of horizon. The remaining 8 scales mirror
// Timeline so future scale-config tweaks land in one place.
const GANTT_ZOOM_LEVELS: readonly TimelineZoomLevel[] = [
  'week',
  '2week',
  'month',
  'quarter',
  '6month',
  'year',
  '2year',
  '5year',
]

const [useProvideGanttViewStore, useGanttViewStore] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    viewMeta: Ref<(ViewType | GanttType | undefined) & { id: string }>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    const { isUIAllowed } = useRoles()

    const { t } = useI18n()

    const { $api, $ncSocket } = useNuxtApp()

    const { user } = useGlobal()

    const baseStore = useBase()
    const { isMysql, getBaseType } = baseStore
    const { base } = storeToRefs(baseStore)

    const { sharedView } = useSharedView()

    const { nestedFilters, eventBus, allFilters, validFiltersFromUrlParams } = useSmartsheetStoreOrThrow()

    const { metas } = useMetas()

    const { getEvaluatedRowMetaRowColorInfo } = useViewRowColorRender()

    const isPublic = shared ? ref(shared) : inject(IsPublicInj, ref(false))

    // ---- Date-axis state (shared with Timeline) ----

    const axis = useDateAxisState({
      viewId: computed(() => viewMeta.value?.id),
      zoomLevels: GANTT_ZOOM_LEVELS,
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
      allowedZoomLevels,
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

    const formattedData = ref<Row[]>([])

    const isGanttDataLoading = ref<boolean>(false)

    const searchQuery = reactive({
      value: '',
      field: '',
    })

    // The record currently shown in the right-rail inspector. null = panel
    // closed. Lifted to the store so a single inspector applies across all
    // per-group Grid instances in grouped mode.
    const inspectorRecord = ref<Row | null>(null)

    // Gantt meta data
    const ganttMetaData = computed<GanttType>(() => {
      return isPublic.value ? (sharedView.value?.view as GanttType) : (viewMeta.value?.view as GanttType)
    })

    const viewMetaProperties = computed(() => {
      const metaObj = ganttMetaData.value?.meta
      if (typeof metaObj === 'string') {
        try {
          return JSON.parse(metaObj)
        } catch {
          return {}
        }
      }
      return metaObj ?? {}
    })

    // Gantt range resolution (Airtable-style per-view config with table-level fallback):
    //   1. View-owned DateDependency rule (eagerly loaded into ganttMetaData.date_dependency)
    //   2. Table-level default rule (meta.date_dependency, fk_gantt_view_id IS NULL)
    // The view-owned rule takes precedence, so multiple Gantt views on the
    // same table can have independent schedules. The shape below is kept the
    // same as before so Grid.vue / index.vue continue to consume
    // `ganttRange[0].fk_from_col` etc. without changes.
    const ganttRange = computed<
      Array<{
        fk_from_col: ColumnType
        fk_to_col?: ColumnType | null
        fk_dependency_col?: ColumnType | null
        dependency_direction?: 'predecessor' | 'successor'
        id: string
        is_readonly: boolean
      }>
    >(() => {
      const dep =
        (ganttMetaData.value as any)?.date_dependency ??
        (meta.value as any)?.date_dependency
      if (!dep || dep.is_active === false) return []

      const cols = meta.value?.columns ?? []
      const fromCol = cols.find((col) => col.id === dep.fk_start_date_field_id)
      if (!fromCol) return []

      const toCol = dep.fk_end_date_field_id
        ? cols.find((col) => col.id === dep.fk_end_date_field_id)
        : null
      const depCol = dep.fk_dependency_linkrow_field_id
        ? cols.find((col) => col.id === dep.fk_dependency_linkrow_field_id)
        : null

      return [
        {
          fk_from_col: fromCol,
          fk_to_col: toCol,
          fk_dependency_col: depCol,
          // DateDependency only accepts hm/om/oo self-relations. For those
          // shapes, nestedList returns the current row's CHILDREN — and in
          // practice users store successor-pointing values
          // (Task-1.Successor → Task-2). The dialog labels the field as
          // "Successor Link" to match. The arrow render follows the
          // observed data semantics (linked child = successor) regardless
          // of the dependency_linkrow_role flag.
          dependency_direction: 'successor',
          id: `${dep.fk_start_date_field_id}_${dep.fk_end_date_field_id ?? 'none'}`,
          is_readonly: ![UITypes.Date, UITypes.DateTime].includes(fromCol.uidt as UITypes),
        },
      ]
    })

    // Surfaced for the toolbar — counts rows currently loaded into formattedData.
    // Under row-index pagination this is the high-water mark of pages fetched
    // so far, not the total row count of the view.
    const totalRecordCount = computed(() => formattedData.value.length)

    // ---- Row-index pagination ----
    // Gantt's list is decoupled from the date axis: rows load in chronological
    // chunks via offset/limit, and bars paint at their stored dates. A bar
    // outside the visible date window just doesn't paint — it isn't pruned
    // from the list. Sidebar infinite-scroll triggers loadMoreGanttRecords()
    // when the user nears the bottom; the date axis pans/zooms freely without
    // refetching rows.
    const PAGE_SIZE = 100
    const _offset = ref(0)
    const hasMoreRecords = ref(true)

    // Sequence number — defensive belt-and-suspenders for the serialized
    // dispatch below: if for any reason two requests do end up in flight
    // (HMR, re-entrant calls), only the response whose seq matches the
    // newest dispatch commits.
    let _fetchSeq = 0

    // Separate seq for loadDependencyLinks — it is fired fire-and-forget
    // from _fetchGanttRecordsImpl on reset and can also be triggered by
    // rapid filter/view changes, so two requests may race. Older responses
    // must not clobber newer ones.
    let _depsFetchSeq = 0

    // Set true in onBeforeUnmount. Any lingering callback (debounced fetch
    // that fires within its window post-unmount, fire-and-forget deps load,
    // etc.) checks this and short-circuits — otherwise a Gantt request goes
    // out for the old view id after the user has already switched away,
    // producing a 400 against the non-Gantt view.
    let _unmounted = false

    // Serialize fetches — at most one request in flight at a time. While a
    // fetch is running, additional calls are coalesced into a single
    // pending slot (the most recent args win); when the current fetch
    // settles, the pending slot fires next. Prevents reset + loadMore
    // races from issuing parallel network calls.
    let _isFetching = false
    let _pending: { showLoading: boolean; reset: boolean } | null = null

    const fetchGanttRecords = async (args: { showLoading: boolean; reset: boolean }): Promise<void> => {
      if (_isFetching) {
        // Replace any earlier queued request — only the latest matters.
        // OR the flags so a follow-up `reset` after a `loadMore` still
        // takes effect, and a `showLoading` from any caller wins.
        _pending = {
          showLoading: (_pending?.showLoading ?? false) || args.showLoading,
          reset: (_pending?.reset ?? false) || args.reset,
        }
        return
      }
      _isFetching = true
      try {
        await _fetchGanttRecordsImpl(args)
      } finally {
        _isFetching = false
        if (_pending) {
          const next = _pending
          _pending = null
          // Fire-and-forget — the new call goes through the same gate.
          fetchGanttRecords(next)
        }
      }
    }

    const _fetchGanttRecordsImpl = async ({
      showLoading,
      reset,
    }: {
      showLoading: boolean
      reset: boolean
    }) => {
      if (_unmounted) return
      if (((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) || !ganttRange.value?.length)
        return

      if (reset) {
        _offset.value = 0
        hasMoreRecords.value = true
        formattedData.value = []
      }

      // Nothing left to fetch — bail before issuing a network call so the
      // sidebar can fire loadMore liberally on near-bottom scroll without
      // hammering the server once the table is fully loaded.
      if (!hasMoreRecords.value) return

      const range = ganttRange.value[0]
      const fromCol = range.fk_from_col
      if (!fromCol?.id) return

      // Only pass user filters when filterSync is off — otherwise the saved
      // view filters are already applied server-side and re-sending them
      // would AND the same predicate twice.
      const userFilters: FilterType[] = isUIAllowed('filterSync') ? [] : [...nestedFilters.value]

      const seq = ++_fetchSeq
      if (showLoading) isGanttDataLoading.value = true

      try {
        const queryParams: Record<string, string> = {
          offset: String(_offset.value),
          limit: String(PAGE_SIZE),
          where: where?.value ?? '',
          include_row_color: 'true',
          getHiddenColumns: 'true',
        }
        if (userFilters.length) {
          queryParams.filterArrJson = stringifyFilterOrSortArr(userFilters)
        }

        // Hit the dedicated gantt endpoint. With no from_date/to_date the
        // backend skips the bar-overlap filter and just paginates by
        // offset/limit with a default sort by start_date ASC.
        const url = !isPublic.value
          ? `/api/v1/db/gantt-data/noco/${base.value.id}/${meta.value!.id}/views/${viewMeta.value!.id}`
          : `/api/v2/public/gantt-view/${sharedView.value?.uuid}`

        const res = await $api.instance
          .get(url, {
            params: queryParams,
            ...(isPublic.value ? { headers: { 'xc-password': sharedView.value?.password } } : {}),
          })
          .then((r: any) => r.data)

        if (seq !== _fetchSeq) return

        const newRows: Row[] = (res?.list ?? []).map((row: any) => ({
          row,
          rowMeta: {
            range: ganttRange.value[0],
            ...getEvaluatedRowMetaRowColorInfo(row),
          },
          oldRow: { ...row },
        }))

        formattedData.value = [...formattedData.value, ...newRows]
        _offset.value += newRows.length
        // End-of-table signals: either a short page, or the server flagged
        // this as the last page (totalRows is an exact match — the next
        // offset would land at totalRows and the server rejects that with
        // ERR_INVALID_OFFSET_VALUE rather than returning an empty list).
        const pageInfo = res?.pageInfo
        const totalRows = Number(pageInfo?.totalRows)
        const reachedEnd =
          newRows.length < PAGE_SIZE ||
          pageInfo?.isLastPage === true ||
          (Number.isFinite(totalRows) && _offset.value >= totalRows)
        if (reachedEnd) {
          hasMoreRecords.value = false
        }
      } catch (e) {
        if (seq === _fetchSeq) {
          // @ts-expect-error - extractSdkResponseErrorMsg defensively handles unknown shapes
          message.error(await extractSdkResponseErrorMsg(e))
        }
      } finally {
        if (seq === _fetchSeq && showLoading) {
          isGanttDataLoading.value = false
        }
      }

      // Deps cover the full table in a single round-trip — only refresh on
      // a reset (view/filter change), not on every page load.
      if (reset) {
        loadDependencyLinks()
      }
    }

    const loadGanttData = () => fetchGanttRecords({ showLoading: true, reset: true })
    const loadMoreGanttRecords = () => fetchGanttRecords({ showLoading: false, reset: false })

    // Dependency graph — Map<parentRowId, childRowIds[]>.
    // Fetched in a single batch call from the dedicated /deps endpoint;
    // covers the full table (within view filters + RLS) so arrows render
    // for any pair of rows currently in formattedData. Patched
    // optimistically by patchDependencyLinks on link/unlink.
    const dependencyLinks = ref<Map<string, string[]>>(new Map())

    const loadDependencyLinks = async () => {
      if (_unmounted) return
      const range = ganttRange.value?.[0]
      const depCol = range?.fk_dependency_col as ColumnType | undefined
      if (!depCol) {
        dependencyLinks.value = new Map()
        return
      }

      let url: string
      if (isPublic.value) {
        const uuid = sharedView.value?.uuid
        if (!uuid) return
        url = `/api/v2/public/gantt-view/${uuid}/deps`
      } else {
        const baseId = base.value?.id
        const tableId = meta.value?.id
        const viewId = viewMeta.value?.id
        if (!baseId || !tableId || !viewId) return
        url = `/api/v1/db/gantt-data/noco/${baseId}/${tableId}/views/${viewId}/deps`
      }

      const seq = ++_depsFetchSeq

      try {
        const res = await $api.instance
          .get(url, {
            ...(isPublic.value ? { headers: { 'xc-password': sharedView.value?.password } } : {}),
          })
          .then((r: any) => r.data)

        if (seq !== _depsFetchSeq) return

        // Backend returns `{ edges: [[childPk, parentPk], ...] }`. Group
        // by parent so the renderer can look up children directly.
        const graph = new Map<string, string[]>()
        for (const [childId, parentId] of (res?.edges ?? []) as Array<[string, string]>) {
          const arr = graph.get(parentId) ?? []
          arr.push(childId)
          graph.set(parentId, arr)
        }
        dependencyLinks.value = graph
      } catch {
        if (seq !== _depsFetchSeq) return
        dependencyLinks.value = new Map()
      }
    }

    // Mutate the in-memory dep graph without a round-trip; used for optimistic
    // updates on unlink/link and for undo after a toast.
    const patchDependencyLinks = (
      rowId: string,
      linkedId: string,
      action: 'add' | 'remove',
    ) => {
      const next = new Map(dependencyLinks.value)
      const current = [...(next.get(rowId) ?? [])]
      if (action === 'remove') {
        const idx = current.indexOf(linkedId)
        if (idx !== -1) current.splice(idx, 1)
      } else {
        if (!current.includes(linkedId)) current.push(linkedId)
      }
      if (current.length) next.set(rowId, current)
      else next.delete(rowId)
      dependencyLinks.value = next
    }

    const _depEndpointArgs = () => {
      const range = ganttRange.value?.[0]
      const depCol = range?.fk_dependency_col as ColumnType | undefined
      const tableId = meta.value?.id
      const baseId = base.value?.id
      const colType = (depCol?.colOptions as any)?.type as
        | 'mm' | 'hm' | 'om' | 'bt' | 'oo' | 'ln' | undefined
      if (!depCol || !tableId || !baseId || !colType) return null
      return { baseId, tableId, colId: depCol.id!, relType: colType as any }
    }

    const unlinkDependency = async (rowId: string, linkedId: string) => {
      const args = _depEndpointArgs()
      if (!args) return false
      patchDependencyLinks(rowId, linkedId, 'remove')
      try {
        await $api.dbTableRow.nestedRemove(
          NOCO,
          args.baseId,
          args.tableId,
          encodeURIComponent(rowId),
          args.relType,
          args.colId,
          encodeURIComponent(linkedId),
        )
        return true
      } catch (e) {
        patchDependencyLinks(rowId, linkedId, 'add')
        throw e
      }
    }

    const linkDependency = async (rowId: string, linkedId: string) => {
      const args = _depEndpointArgs()
      if (!args) return false
      patchDependencyLinks(rowId, linkedId, 'add')
      try {
        await $api.dbTableRow.nestedAdd(
          NOCO,
          args.baseId,
          args.tableId,
          encodeURIComponent(rowId),
          args.relType,
          args.colId,
          encodeURIComponent(linkedId),
        )
        return true
      } catch (e) {
        patchDependencyLinks(rowId, linkedId, 'remove')
        throw e
      }
    }

    // Navigate to the closest record on initial view load
    const navigateToClosestRecord = () => {
      const viewId = viewMeta.value?.id
      if (!viewId) return

      // Skip if already initialized or if cached state exists (user previously navigated)
      if (isViewInitialized(viewId)) return
      markViewInitialized(viewId)

      // Check the initial_view setting (default: 'closest_record')
      const initialView = viewMetaProperties.value?.initial_view ?? 'closest_record'
      if (initialView === 'today') {
        goToDate(dayjs())
        return
      }

      // Find the record with a start date closest to today
      const range = ganttRange.value?.[0]
      if (!range?.fk_from_col?.title) {
        goToDate(dayjs())
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
      goToDate(target)
    }

    // Date format for updates (matching calendar store pattern)
    const updateFormat = computed(() => {
      return isMysql(meta.value?.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'
    })

    const findRowInState = (rowData: Record<string, any>) => {
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

    // Socket subscription — keep formattedData in sync with row-level changes
    // broadcast by the backend. Crucial for date-dependency cascades: when the
    // user drags one bar, the backend reschedules dependent rows and emits a
    // DATA_EVENT per update; without this listener, Gantt would need a reload.
    const findRowIndex = (payloadRow: Record<string, any>): number => {
      const pkCols = (meta.value?.columns ?? []).filter((c) => (c as any).pk)
      if (!pkCols.length) return -1
      return formattedData.value.findIndex((row) =>
        pkCols.every(
          (pk) => pk.title && row.row?.[pk.title] != null && row.row[pk.title] === payloadRow[pk.title],
        ),
      )
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

    // Row-index pagination semantic: _offset is "next index to request from
    // the server's chronological ordering." When realtime mutates the list
    // locally, the server's row count has also changed, so _offset must move
    // in lockstep — otherwise the next loadMoreGanttRecords() either skips
    // a row (offset too high) or returns a duplicate (offset too low).
    const handleDataEvent = (data: DataPayload) => {
      const { action, payload } = data as { action?: string; payload?: Record<string, any> }
      if (!payload) return
      const idx = findRowIndex(payload)

      if (action === 'delete') {
        if (idx >= 0) {
          // Close the inspector if it was holding the now-deleted row;
          // its `props.record` ref would otherwise point at an orphan and
          // any subsequent edit would silently write to a vanished row.
          if (inspectorRecord.value && inspectorRecord.value === formattedData.value[idx]) {
            inspectorRecord.value = null
          }
          formattedData.value.splice(idx, 1)
          _offset.value = Math.max(0, _offset.value - 1)
        }
        return
      }

      if (action === 'update') {
        const matchesFilters = passesViewFilters(payload)

        if (!matchesFilters) {
          if (idx >= 0) {
            if (inspectorRecord.value && inspectorRecord.value === formattedData.value[idx]) {
              inspectorRecord.value = null
            }
            formattedData.value.splice(idx, 1)
            _offset.value = Math.max(0, _offset.value - 1)
          }
          return
        }

        const existing = idx >= 0 ? formattedData.value[idx] : undefined
        if (existing) {
          // Mutate the Row object in place rather than replacing the array
          // slot. Components holding a reference to the row (notably the
          // RecordInspector and any per-bar drag handlers) would otherwise
          // hold a stale snapshot and saves would go to an orphan.
          const merged = { ...existing.row, ...payload }
          Object.assign(existing.row, merged)
          existing.oldRow = { ...merged }
          Object.assign(existing.rowMeta, getEvaluatedRowMetaRowColorInfo(merged))
          return
        }

        // Row newly passes filters — treat as add.
        formattedData.value.push({
          row: payload,
          oldRow: { ...payload },
          rowMeta: {
            new: false,
            ...getEvaluatedRowMetaRowColorInfo(payload),
          },
        })
        _offset.value += 1
        return
      }

      if (action === 'add') {
        if (!passesViewFilters(payload)) return
        if (idx >= 0) return

        formattedData.value.push({
          row: payload,
          oldRow: { ...payload },
          rowMeta: {
            new: false,
            ...getEvaluatedRowMetaRowColorInfo(payload),
          },
        })
        _offset.value += 1
      }
    }

    const activeDataListener = ref<string | null>(null)
    watch(
      meta,
      (newMeta: any, oldMeta: any) => {
        if (!newMeta?.fk_workspace_id || !newMeta?.base_id || !newMeta?.id) return
        if (oldMeta?.id && oldMeta.id === newMeta.id) return

        if (activeDataListener.value) {
          $ncSocket.offMessage(activeDataListener.value)
        }
        activeDataListener.value = $ncSocket.onMessage(
          `${EventType.DATA_EVENT}:${newMeta.fk_workspace_id}:${newMeta.base_id}:${newMeta.id}`,
          handleDataEvent,
        )
      },
      { immediate: true },
    )

    onBeforeUnmount(() => {
      _unmounted = true
      eventBus.off(smartsheetEventHandler)
      if (activeDataListener.value) {
        $ncSocket.offMessage(activeDataListener.value)
      }
    })

    return {
      // Axis state (from shared composable)
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
      allowedZoomLevels,

      // Gantt-specific state
      formattedData,
      isGanttDataLoading,
      searchQuery,
      ganttMetaData,
      viewMetaProperties,
      ganttRange,
      isPublic,
      totalRecordCount,
      dependencyLinks,
      updateFormat,
      inspectorRecord,

      // Axis methods
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

      // Gantt-specific methods
      loadGanttData,
      loadMoreGanttRecords,
      hasMoreRecords,
      loadDependencyLinks,
      unlinkDependency,
      linkDependency,
      navigateToClosestRecord,
      updateRowProperty,
    }
  },
  'gantt-view-store',
)

export { useProvideGanttViewStore }

export function useGanttViewStoreOrThrow() {
  const store = useGanttViewStore()
  if (!store) {
    throw new Error('Gantt view store is not provided')
  }
  return store
}
