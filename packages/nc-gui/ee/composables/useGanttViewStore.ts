import dayjs from 'dayjs'
import type { ColumnType, TableType, GanttType, ViewType } from 'nocodb-sdk'
import { EventType, UITypes } from 'nocodb-sdk'
import { type ComputedRef, type Ref, computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDateAxisState } from './useDateAxisState'
import type { TimelineZoomLevel } from '../utils/timelineUtils'
import type { Row } from '~/lib/types'
import { NOCO } from '~/lib/constants'

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

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const { $api, $ncSocket } = useNuxtApp()

    const baseStore = useBase()
    const { isMysql } = baseStore
    const { base } = storeToRefs(baseStore)

    const { sharedView, fetchSharedViewData } = useSharedView()

    const { sorts, nestedFilters, eventBus } = useSmartsheetStoreOrThrow()

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
          // shapes, nestedList returns the current row's CHILDREN. The dialog
          // labels the field as a "Predecessor Link" and sets
          // `dependency_linkrow_role = 'predecessors'`, but in practice users
          // store successor-pointing values (Task-1.NextTask → Task-2). The
          // cascade logic on the backend respects the role; the arrow render
          // follows the observed data semantics (linked = successor).
          dependency_direction: 'successor',
          id: `${dep.fk_start_date_field_id}_${dep.fk_end_date_field_id ?? 'none'}`,
          is_readonly: ![UITypes.Date, UITypes.DateTime].includes(fromCol.uidt as UITypes),
        },
      ]
    })

    // #3 + #15: Record statistics for the info badge
    const totalRecordCount = computed(() => formattedData.value.length)

    const recordsWithoutDates = computed(() => {
      if (!ganttRange.value?.length) return 0
      const range = ganttRange.value[0]
      return formattedData.value.filter((row) => {
        const fromVal = range.fk_from_col?.title ? row.row?.[range.fk_from_col.title] : undefined
        return !fromVal || !dayjs(fromVal).isValid()
      }).length
    })

    // Data loading
    const loadGanttData = async () => {
      if (((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) || !ganttRange.value?.length)
        return

      isGanttDataLoading.value = true

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
            range: ganttRange.value[0],
            ...getEvaluatedRowMetaRowColorInfo(row),
          },
          oldRow: { ...row },
        }))
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isGanttDataLoading.value = false
      }

      // After rows land, resolve the dependency graph (if a dep field is set).
      // Fire-and-forget — arrows appear once links load; row data is already usable.
      loadDependencyLinks()
    }

    // Dependency graph — Map<rowId, linkedRowIds[]>.
    // Populated from the Links field configured in DateDependency; fetched via
    // N+1 nestedList calls (bulk endpoint doesn't exist yet). Acceptable for
    // Gantt's 400-row cap; optimise later if needed.
    const dependencyLinks = ref<Map<string, string[]>>(new Map())

    const loadDependencyLinks = async () => {
      const range = ganttRange.value?.[0]
      const depCol = range?.fk_dependency_col as ColumnType | undefined
      if (!depCol || !formattedData.value.length) {
        dependencyLinks.value = new Map()
        return
      }

      const pkCols = (meta.value?.columns ?? []) as ColumnType[]

      // Shared view: no public nestedList endpoint. Derive the dep graph from
      // the row data itself — LTAR fields ship as an array of linked records
      // in the row payload (backend getAst includes depCol for Gantt views).
      if (isPublic.value) {
        const graph = new Map<string, string[]>()
        for (const row of formattedData.value) {
          const rowId = extractPkFromRow(row.row, pkCols)
          if (rowId == null) continue
          const linked = row.row[depCol.title!]
          if (!Array.isArray(linked)) continue
          const ids = linked
            .map((r: any) => extractPkFromRow(r, pkCols))
            .filter((id: any) => id != null)
            .map((id: any) => String(id))
          if (ids.length) graph.set(String(rowId), ids)
        }
        dependencyLinks.value = graph
        return
      }

      const tableId = meta.value?.id
      if (!tableId || !base.value?.id) {
        dependencyLinks.value = new Map()
        return
      }
      const colType = (depCol.colOptions as any)?.type as
        | 'mm' | 'hm' | 'om' | 'bt' | 'oo' | 'ln' | undefined
      if (!colType) {
        dependencyLinks.value = new Map()
        return
      }
      // Every relation subtype (mm/ln/om/oo) routes to mmList on the backend
      // except 'hm' which has its own handler; cast to any to sidestep the
      // narrower SDK enum that predates 'om'.
      const relType = colType as any
      const baseId = base.value.id

      const entries = await Promise.all(
        formattedData.value.map(async (row) => {
          const rowId = extractPkFromRow(row.row, pkCols)
          if (rowId == null) return null
          try {
            const res: any = await $api.dbTableRow.nestedList(
              NOCO,
              baseId,
              tableId,
              encodeURIComponent(String(rowId)),
              relType,
              depCol.id!,
              { limit: 1000 } as any,
            )
            const ids = (res?.list ?? [])
              .map((r: any) => extractPkFromRow(r, pkCols))
              .filter((id: any) => id != null)
              .map((id: any) => String(id))
            return ids.length ? ([String(rowId), ids] as const) : null
          } catch {
            return null
          }
        }),
      )

      const graph = new Map<string, string[]>()
      for (const e of entries) {
        if (e) graph.set(e[0], e[1])
      }
      dependencyLinks.value = graph
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

    // Find a row in formattedData by primary key
    const findRowInState = (rowData: Record<string, any>) => {
      const pk = extractPkFromRow(rowData, meta.value?.columns as ColumnType[])
      return formattedData.value.find((r) => extractPkFromRow(r.row, meta.value?.columns as ColumnType[]) === pk)
    }

    // Update a row property (used for drag-to-resize)
    // Follows the same pattern as useCalendarViewStore.updateRowProperty
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

    const handleDataEvent = (data: { action?: string; payload?: Record<string, any> }) => {
      const payload = data?.payload
      if (!payload) return
      const idx = findRowIndex(payload)

      if (data.action === 'delete') {
        if (idx >= 0) {
          // Close the inspector if it was holding the now-deleted row;
          // its `props.record` ref would otherwise point at an orphan and
          // any subsequent edit would silently write to a vanished row.
          if (inspectorRecord.value && inspectorRecord.value === formattedData.value[idx]) {
            inspectorRecord.value = null
          }
          formattedData.value.splice(idx, 1)
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

      if (data.action === 'add') {
        formattedData.value.push({
          row: payload,
          oldRow: { ...payload },
          rowMeta: {
            new: false,
            ...getEvaluatedRowMetaRowColorInfo(payload),
          },
        })
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
      recordsWithoutDates,
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
