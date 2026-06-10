import {
  CommonAggregations,
  PermissionEntity,
  PermissionKey,
  UITypes,
  computeAggregation,
  isAIPromptCol,
  isLinksOrLTAR,
  isOrderCol,
  isReadonlyVirtualColumn,
  isSystemColumn,
  isVirtualCol,
  ncHasProperties,
} from 'nocodb-sdk'
import type { ButtonType, ColumnType, FormulaType, LinkToAnotherRecordType, TableType, UserType, ViewType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import { SpriteLoader } from '../loaders/SpriteLoader'
import { ImageWindowLoader } from '../loaders/ImageLoader'
import { MarkdownLoader } from '../loaders/markdownLoader'
import { getSingleMultiselectColOptions, getUserColOptions, parseCellWidth } from '../utils/cell'
import { clearTextCache } from '../utils/canvas'
import {
  CELL_BOTTOM_BORDER_IN_PX,
  COLUMN_HEADER_HEIGHT_IN_PX,
  EDIT_INTERACTABLE,
  ROW_COLOR_BORDER_WIDTH,
  ROW_META_COLUMN_WIDTH,
} from '../utils/constants'
import { ActionManager } from '../loaders/ActionManager'
import { useGridCellHandler } from '../cells'
import { TableMetaLoader } from '../loaders/TableMetaLoader'
import type { CanvasGridColumn } from '../../../../../lib/types'
import { CanvasElement } from '../utils/CanvasElement'
import { calculateGroupRowTop, isGroupExpanded } from '../utils/groupby'
import { BaseRoleLoader } from '../loaders/BaseRoleLoader'
import { useDataFetch } from './useDataFetch'
import { useCanvasRender } from './useCanvasRender'
import { useColumnReorder } from './useColumnReorder'
import { normalizeWidth, useColumnResize } from './useColumnResize'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { useMouseSelection } from './useMouseSelection'
import { useFillHandler } from './useFillHandler'
import { useRowReorder } from './useRowReOrder'
import { type BulkLtarOp, useCopyPaste } from './useCopyPaste'

export function useCanvasTable({
  rowHeightEnum,
  cachedRows,
  clearCache,
  chunkStates,
  totalRows,
  actualTotalRows,
  loadData,
  scrollLeft,
  scrollTop,
  width,
  height,
  scrollToCell,
  aggregations,
  vSelectedAllRecords,
  vSelectedAllRecordsSkipPks,
  selectedRows,
  selectedHeaderColumnIds,
  updateRecordOrder,
  expandRows,
  updateOrSaveRow,
  bulkUpdateRows,
  bulkUpsertRows,
  expandForm,
  addEmptyRow,
  onActiveCellChanged,
  addNewColumn,
  mousePosition,
  setCursor,
  getRows,
  cachedGroups,
  toggleExpand,
  totalGroups,
  groupSyncCount: syncGroupCount,
  groupByColumns,
  fetchMissingGroupChunks,
  getDataCache,
  maxSelectionLimit,
}: {
  rowHeightEnum?: Ref<number | undefined>
  cachedRows: Ref<Map<number, Row>>
  clearCache: (visibleStartIndex: number, visibleEndIndex: number, path?: Array<number>) => void
  chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
  totalRows: Ref<number>
  actualTotalRows: Ref<number>
  loadData: (params?: any, shouldShowLoading?: boolean, path?: Array<number>) => Promise<Array<Row>>
  scrollLeft: Ref<number>
  scrollTop: Ref<number>
  width: Ref<number>
  height: Ref<number>
  scrollToCell: CanvasScrollToCellFn
  aggregations: Ref<Record<string, any>>
  vSelectedAllRecords: WritableComputedRef<boolean>
  vSelectedAllRecordsSkipPks: WritableComputedRef<Record<string, string>>
  selectedRows: Ref<Row[]>
  selectedHeaderColumnIds: Ref<Set<string>>
  mousePosition: { x: number; y: number }
  expandForm: (row: Row, state?: Record<string, any>, fromToolbar?: boolean, path?: Array<number>) => void
  updateRecordOrder: (
    originalIndex: number,
    targetIndex: number | null,
    isFailed?: boolean,
    path?: Array<number>,
  ) => Promise<void>
  expandRows: ({
    newRows,
    newColumns,
    cellsOverwritten,
    rowsUpdated,
  }: {
    newRows: number
    newColumns: number
    cellsOverwritten: number
    rowsUpdated: number
  }) => Promise<{
    continue: boolean
    expand: boolean
  }>
  updateOrSaveRow: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
    path?: Array<number>,
  ) => Promise<any>
  bulkUpsertRows: (
    insertRows: Row[],
    updateRows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    newColumns?: Partial<ColumnType>[],
    path?: Array<number>,
  ) => Promise<void>
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    path?: Array<number>,
  ) => Promise<void>
  addEmptyRow: (
    addAfter?: number,
    skipUpdate?: boolean,
    before?: string,
    overwrite?: Record<string, any>,
    path?: Array<number>,
  ) => Row | undefined
  onActiveCellChanged: () => void
  addNewColumn: () => void
  setCursor: SetCursorType
  getRows: (start: number, end: number, path?: Array<number>) => Promise<Row[]>
  cachedGroups: Ref<Map<number, CanvasGroup>>
  totalGroups: Ref<number>
  groupByColumns: ComputedRef<
    Array<{
      column: ColumnType
      order?: number
      sort: string
    }>
  >
  toggleExpand: (group: CanvasGroup) => void
  groupSyncCount: (group?: CanvasGroup) => Promise<void>
  fetchMissingGroupChunks: (startIndex: number, endIndex: number, parentGroup?: CanvasGroup) => Promise<void>
  getDataCache: (path?: Array<number>) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }
  maxSelectionLimit: ComputedRef<number>
}) {
  const { metas, getMeta, getPartialMeta } = useMetas()
  const { getBaseRoles } = useBases()
  const { isAllowed } = usePermissions()
  const { getColor } = useTheme()
  const rowSlice = ref({ start: 0, end: 0 })
  const colSlice = ref({ start: 0, end: 0 })
  const activeCell = ref<{
    row?: number
    column?: number
    path?: Array<number>
  }>({ row: -1, column: -1, path: [] })
  const selection = ref(new CellRange())
  const hoverRow = ref<{
    path?: Array<number> | null
    rowIndex: number
  }>({
    path: [],
    rowIndex: -2,
  })
  const editEnabled = ref<CanvasEditEnabledType>(null)
  const isFillMode = ref(false)
  const dragOver = ref<{ id: string; index: number } | null>(null)
  const attachmentCellDropOver = ref<AttachmentCellDropOverType | null>(null)
  const spriteLoader = new SpriteLoader(() => triggerRefreshCanvas())
  const imageLoader = new ImageWindowLoader(() => triggerRefreshCanvas())
  const markdownLoader = new MarkdownLoader(() => triggerRefreshCanvas())
  const reloadVisibleDataHook = inject(ReloadVisibleDataHookInj, undefined)
  const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
  const elementMap = new CanvasElement([])

  // Row Reorder related states
  const isDragging = ref(false)
  const draggedRowIndex = ref(-1)
  const draggedRowGroupPath = ref([])
  const targetRowIndex = ref(-1)
  const upgradeModalInlineState = ref({
    isHoveredLearnMore: false,
    isHoveredUpgrade: false,
  })

  const { appInfo, isMobileMode } = useGlobal()
  const { $api } = useNuxtApp()
  const { t } = useI18n()
  const { currentUser } = useUserSync()
  const { gridViewCols, metaColumnById, updateGridViewColumn } = useViewColumnsOrThrow()
  const {
    eventBus,
    isDefaultView,
    meta,
    allFilters,
    sorts,
    isPkAvail: isPrimaryKeyAvailable,
    view,
    isSqlView,
    isExternalSource,
    isAlreadyShownUpgradeModal,
    gridEditEnabled,
    isViewOperationsAllowed,
  } = useSmartsheetStoreOrThrow()

  // Initialize loaders that need meta.base_id after meta is available
  const tableMetaLoader = new TableMetaLoader(getMeta, () => triggerRefreshCanvas(), (meta.value as TableType)?.base_id)
  const baseRoleLoader = new BaseRoleLoader(getBaseRoles, () => triggerRefreshCanvas())
  const { meta: metaKey, ctrl: ctrlKey } = useMagicKeys()
  const { isDataReadOnly, isUIAllowed } = useRoles()
  const { isAiFeaturesEnabled, aiIntegrations, isNocoAiAvailable, generateRows: _generateRows } = useNocoAi()
  const { isFeatureEnabled } = useBetaFeatureToggle()
  const scriptStore = useScriptStore()
  const tooltipStore = useTooltipStore()
  const { blockExternalSourceRecordVisibility, blockRowColoring } = useEeConfig()
  const { isRowColouringEnabled } = useViewRowColorRender()

  const fields = inject(FieldsInj, ref([]))

  const baseStore = useBase()

  const { isMysql, isPg } = baseStore

  const { sqlUis, isSharedBase } = storeToRefs(baseStore)

  const { basesUser } = storeToRefs(useBases())

  const rowMetaColumnWidth = computed<number>(() => {
    return !blockRowColoring.value ? ROW_META_COLUMN_WIDTH + ROW_COLOR_BORDER_WIDTH + 4 : ROW_META_COLUMN_WIDTH
  })

  const rowColouringBorderWidth = computed<number>(() => {
    return isRowColouringEnabled.value ? ROW_COLOR_BORDER_WIDTH : 0
  })

  const baseUsers = computed<(Partial<UserType> | Partial<User>)[]>(() =>
    meta.value?.base_id ? basesUser.value.get(meta.value?.base_id) || [] : [],
  )

  const { hideTooltip } = tooltipStore

  const isPublicView = inject(IsPublicInj, ref(false))
  const readOnly = inject(ReadonlyInj, ref(false))

  const { eventBus: scriptEventBus } = useScriptExecutor()

  const { loadScript } = scriptStore
  const actionManager = new ActionManager(
    $api,
    loadScript,
    generateRows,
    meta,
    triggerRefreshCanvas,
    getDataCache,
    scriptEventBus,
    currentUser,
  )

  watch(
    () => [baseStore.base?.id, baseStore.base?.fk_workspace_id] as const,
    ([baseId, workspaceId]) => {
      if (baseId && workspaceId) {
        actionManager.setBaseInfo(baseId, workspaceId)
      }
    },
    { immediate: true },
  )

  const isGroupBy = computed(() => !!groupByColumns.value?.length)

  const removeInlineAddRecord = computed(() => {
    return (
      !isGroupBy.value &&
      blockExternalSourceRecordVisibility(isExternalSource.value) &&
      totalRows.value >= EXTERNAL_SOURCE_VISIBLE_ROWS
    )
  })

  const isOrderColumnExists = computed(() => (meta.value?.columns ?? []).some((col) => isOrderCol(col)))

  const isInsertBelowDisabled = computed(() => !!allFilters.value?.length || !!sorts.value?.length || isPublicView.value)

  const isRowReorderDisabled = computed(() => sorts.value?.length || isPublicView.value || !isPrimaryKeyAvailable.value)

  const isDataEditAllowed = computed(() => isUIAllowed('dataEdit') && !isSqlView.value && !isPublicView.value)

  const isFieldEditAllowed = computed(() => isUIAllowed('fieldAdd'))

  const isRowDraggingEnabled = computed(() => isOrderColumnExists.value && !isRowReorderDisabled.value && !isMobileMode.value)

  const isAddingEmptyRowAllowed = computed(() => isDataEditAllowed.value && !meta.value?.synced && !meta.value?.mm)

  const isAddingEmptyRowPermitted = computed(() =>
    meta.value?.id ? isAllowed(PermissionEntity.TABLE, meta.value.id, PermissionKey.TABLE_RECORD_ADD) : true,
  )

  const isAddingColumnAllowed = computed(() => !readOnly.value && isFieldEditAllowed.value && !isSqlView.value)

  const rowHeight = computed(() => (isMobileMode.value ? 40 : rowHeightInPx[`${rowHeightEnum?.value ?? 1}`] ?? 32))

  const partialRowHeight = computed(() => scrollTop.value % rowHeight.value)

  const headerRowHeight = computed(() => (isMobileMode.value ? 40 : COLUMN_HEADER_HEIGHT_IN_PX))

  const isAiFillMode = computed(
    () => (isMac() ? !!metaKey?.value : !!ctrlKey?.value) && isAiFeaturesEnabled && isFeatureEnabled(FEATURE_FLAG.AI_FILL_HANDLE),
  )

  const fetchMetaIds = ref<string[][]>([])
  const isLoadingMetas = ref(false)

  // Override applied during column resize to avoid recomputing the heavy _columnsBase.
  // Set on each resize frame, cleared on mouseup.
  // During an active resize, patch the displayed width of one or more columns
  // without going through the heavy _columnsBase recomputation. When the
  // resized column is part of a multi-field header selection, `columnIds`
  // holds every selected column so they all preview the same width.
  const resizeWidthOverride = ref<{ columnIds: Set<string>; width: string } | null>(null)

  // Multi-field resize guideline: instead of live-resizing every selected column
  // while dragging (which shifts the dragged edge away from the pointer), we draw
  // a single vertical marker at `x` and defer the width change to mouseup.
  // `columnIds` snapshots the co-resize set so it survives the selection being
  // cleared by the canvas-level mouseup that fires alongside the resize mouseup.
  const resizeMarker = ref<{ x: number; columnIds: Set<string> } | null>(null)

  const _columnsBase = computed<CanvasGridColumn[]>(() => {
    // Early return if meta is not available yet
    if (!meta.value?.base_id) {
      return []
    }

    const baseId = meta.value.base_id
    const fetchMetaIdsLocal: Array<[string, string, string]> = [] // [columnId, tableId, baseId]
    const cols = fields.value
      .map((f) => {
        if (!f.id) return false
        const gridViewCol = gridViewCols.value[f.id]
        if (!gridViewCol) return false
        let relatedColObj
        let relatedTableMeta

        /**
         * Add any extra computed things inside extra and use it
         */
        f.extra = {}
        if ([UITypes.Lookup, UITypes.Rollup].includes(f.uidt)) {
          const lookupMetaKey = `${baseId}:${f.fk_model_id!}`
          relatedColObj = metas.value?.[lookupMetaKey]?.columns?.find(
            (c) => c.id === f?.colOptions?.fk_relation_column_id,
          ) as ColumnType

          if (relatedColObj && relatedColObj.colOptions?.fk_related_model_id) {
            // For cross-base links, use fk_related_base_id, otherwise use current baseId
            const relatedBaseId = (relatedColObj.colOptions as any)?.fk_related_base_id || baseId
            const relatedMetaKey = `${relatedBaseId}:${relatedColObj.colOptions.fk_related_model_id}`
            if (!metas.value?.[relatedMetaKey]) {
              fetchMetaIdsLocal.push([relatedColObj.id, relatedColObj.colOptions.fk_related_model_id, relatedBaseId])
            } else {
              relatedTableMeta = metas.value?.[relatedMetaKey]
            }
          }
        } else if (isLTAR(f.uidt, f.colOptions)) {
          if (f.colOptions?.fk_related_model_id) {
            // For cross-base links, use fk_related_base_id, otherwise use current baseId
            const relatedBaseId = (f.colOptions as any)?.fk_related_base_id || baseId
            const ltarMetaKey = `${relatedBaseId}:${f.colOptions.fk_related_model_id}`
            if (!metas.value?.[ltarMetaKey]) {
              fetchMetaIdsLocal.push([f.id, f.colOptions.fk_related_model_id, relatedBaseId])
            } else {
              relatedTableMeta = metas.value?.[ltarMetaKey]
            }
          }
        }

        if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(f.uidt)) {
          f.extra = getSingleMultiselectColOptions(f)
        } else if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(f.uidt)) {
          f.extra = getUserColOptions(f, baseUsers.value)
        }

        if ([UITypes.LastModifiedTime, UITypes.CreatedTime, UITypes.DateTime].includes(f.uidt)) {
          const meta = parseProp(f.meta)
          f.extra.timezone = appInfo.value.ee ? getTimeZoneFromName(meta?.timezone) : undefined
          f.extra.isDisplayTimezone = appInfo.value.ee ? meta?.isDisplayTimezone : undefined
        }
        if ([UITypes.Formula].includes(f.uidt)) {
          const referencedColumn = (f.colOptions as FormulaType)?.parsed_tree?.referencedColumn
          const displayType = (f.meta as any)?.display_type ?? referencedColumn?.uidt
          const displayColumnConfig = (f.meta as any)?.display_type
            ? ((f.meta as any)?.display_column_meta as any)
            : referencedColumn
            ? meta.value?.columns?.find((c) => c.id === referencedColumn.id)
            : undefined

          if ([UITypes.DateTime].includes(displayType)) {
            if (displayColumnConfig?.meta) {
              const displayColumnConfigMeta = displayColumnConfig.meta

              const extra = {
                timezone:
                  appInfo.value.ee && displayColumnConfigMeta.isDisplayTimezone
                    ? getTimeZoneFromName(displayColumnConfigMeta.timezone)
                    : undefined,
                isDisplayTimezone: appInfo.value.ee ? displayColumnConfigMeta.isDisplayTimezone : undefined,
              }
              displayColumnConfig.extra = extra
            }
          }
          f.extra.display_type = displayType
          f.extra.display_column_meta = displayColumnConfig
        }

        const isInvalid = isColumnInvalid({
          col: f,
          aiIntegrations: aiIntegrations.value,
          isReadOnly: isPublicView.value || !isDataEditAllowed.value || isSqlView.value,
          isNocoAiAvailable: isNocoAiAvailable.value,
          columns: meta.value?.columns as ColumnType[],
        })
        const sqlUi = sqlUis.value[f.source_id] ?? Object.values(sqlUis.value)[0]

        const isCellEditable =
          showReadonlyColumnTooltip(f) ||
          !showEditRestrictedColumnTooltip(f) ||
          isAllowed(PermissionEntity.FIELD, f.id, PermissionKey.RECORD_FIELD_EDIT)

        const isSyncedCol = meta.value?.synced && f.readonly && !isAutoGeneratedColumn(f)

        const aggregation = getFormattedAggrationValue(gridViewCol.aggregation, aggregations.value[f.title!], f, [], {
          col: f,
          meta: meta.value as TableType,
          metas: metas.value,
          isMysql,
          isPg,
        })

        return {
          id: f.id,
          grid_column_id: gridViewCol.id,
          title: f.title,
          uidt: f.uidt,
          width: gridViewCol.width,
          fixed: isMobileMode.value
            ? false
            : isGroupBy.value
            ? !!f.pv
            : parseCellWidth(gridViewCol.width) > width.value * (3 / 4)
            ? false
            : !!f.pv,
          readonly:
            f.readonly ||
            isDataReadOnly.value ||
            !isDataEditAllowed.value ||
            isPublicView.value ||
            !isCellEditable ||
            isSyncedCol,
          isCellEditable,
          pv: !!f.pv,
          virtual: isVirtualCol(f),
          aggregation,
          agg_prefix: gridViewCol.aggregation ? t(`aggregation.${gridViewCol.aggregation}`).replace('Percent ', '') : '',
          agg_fn: gridViewCol.aggregation,
          columnObj: f,
          relatedColObj,
          relatedTableMeta,
          isSyncedColumn: isSyncedCol,
          isInvalidColumn: {
            ...isInvalid,
            tooltip: isInvalid.ignoreTooltip ? null : isInvalid.tooltip && t(isInvalid.tooltip),
          },
          isDateDependencyField: isColumnDateDependencyField(meta.value, f.id),
          abstractType: sqlUi?.getAbstractType(f),
        }
      })
      .filter((c) => !!c)
      .sort((a, b) => !!b.fixed - !!a.fixed)

    fetchMetaIds.value.push(...fetchMetaIdsLocal)

    cols.splice(0, 0, {
      id: 'row_number',
      grid_column_id: 'row_number',
      uidt: null,
      title: '#',
      width: `${rowMetaColumnWidth.value + groupByColumns.value?.length * 13}px`,
      fixed: true,
      pv: false,
      columnObj: {
        uidt: UITypes.AutoNumber,
      },
    })
    return cols as unknown as CanvasGridColumn[]
  })

  // Walks the (possibly nested) group tree and returns the full path lineage
  // for every group node — same serialization as generateGroupPath, but
  // collected breadth-first so callers can look up each group's per-path cache.
  const collectGroupPaths = (groups: Map<number, any> | undefined, parent: any[] = [], out: any[][] = []): any[][] => {
    if (!groups) return out
    for (const [, group] of groups) {
      const cur = [...parent, ...(group?.path ?? [])]
      if (cur.length) out.push(cur)
      if (group?.groups?.size > 0) collectGroupPaths(group.groups, cur, out)
    }
    return out
  }

  // Bail-out cap for selection-mode aggregation. Beyond this many cells the
  // JS reducers get expensive and the computed re-fires per mousemove during
  // drag-select. The SQL footer is more accurate for huge selections anyway.
  const MAX_SELECTION_CELLS_FOR_AGG = 50_000

  // Debounced view of `selection` for aggregation computeds only. The raw
  // `selection` ref updates on every mousemove during drag-select; the visual
  // rect needs that immediacy, but recomputing aggregation values per move is
  // wasteful. 60ms is short enough that the footer feels live on drag-end but
  // long enough to coalesce intermediate ticks. Renderers and selection
  // visuals should keep reading `selection` directly.
  const selectionForAgg = refDebounced(selection, 60)

  // Selection-scoped aggregation. When the user has a multi-cell rectangular
  // range or any row-checkbox selection, footer aggregators recompute over the
  // selected cells (per-field), via SDK's computeAggregation. Fields outside
  // the selection scope blank out so the footer reflects only what's selected.
  // Single-cell active is NOT a selection (cellCount === 1 → leaves footer alone).
  const selectionAggregations = computed<{
    active: boolean
    values: Record<string, any>
    scopedTitles: Set<string>
  }>(() => {
    // "Select all records" via the header checkbox sets vSelectedAllRecords
    // true, but the actual selectedRows array only reflects rows currently
    // loaded into the virtualized cache. Computing client-side over that
    // partial set yields a sum that drifts as the user scrolls. The SQL
    // footer already shows the correct total for the all-rows case, so
    // deactivating selection-mode here lets it pass through unchanged.
    if (vSelectedAllRecords.value) {
      return { active: false, values: {}, scopedTitles: new Set<string>() }
    }

    const range = selectionForAgg.value
    const hasRange = !range.isEmpty() && range.cellCount > 1

    // Above this size we'd rather let the SQL footer stand than recompute over
    // tens of thousands of cells on every mousemove during a drag-select.
    if (hasRange && range.cellCount > MAX_SELECTION_CELLS_FOR_AGG) {
      return { active: false, values: {}, scopedTitles: new Set<string>() }
    }

    const topLevelCheckboxRows = selectedRows.value || []

    // In group-by mode each group has its own cachedRows + selectedRows under
    // getDataCache(path). Reading the top-level cache for a grouped selection
    // pulls rows from the wrong index space (which is why the footer summed
    // unrelated values pre-fix). Walk all groups to find any checkbox state.
    const groupCheckboxRows: Row[] = []
    if (isGroupBy.value && cachedGroups?.value) {
      for (const path of collectGroupPaths(cachedGroups.value)) {
        const groupChecked = getDataCache(path as number[]).selectedRows?.value ?? []
        if (groupChecked.length) groupCheckboxRows.push(...groupChecked)
      }
    }

    const hasCheckbox = topLevelCheckboxRows.length > 0 || groupCheckboxRows.length > 0
    if (!hasCheckbox && !hasRange) {
      return { active: false, values: {}, scopedTitles: new Set<string>() }
    }

    const values: Record<string, any> = {}
    const scopedTitles = new Set<string>()

    const computeFor = (col: ColumnType, rows: Row[]) => {
      if (!col?.id || !col?.title) return
      scopedTitles.add(col.title)
      const aggType = gridViewCols.value[col.id]?.aggregation
      if (!aggType || aggType === CommonAggregations.None) return
      const cellValues = rows.map((r) => r?.row?.[col.title!])
      try {
        values[col.title] = computeAggregation({
          aggregation: aggType,
          values: cellValues,
          column: col,
          parsedFormulaType: (col.colOptions as any)?.parsed_tree?.dataType,
        })
      } catch {
        // swallow — leaving the field unscored is safer than crashing render
      }
    }

    if (hasCheckbox) {
      const checkboxRows = topLevelCheckboxRows.length ? topLevelCheckboxRows : groupCheckboxRows
      for (const f of fields.value) computeFor(f, checkboxRows)
    } else if (isGroupBy.value && activeCell.value?.path) {
      // Grouped cell-range: read from the active cell's group cache.
      const dataCache = getDataCache(activeCell.value.path as number[])
      const rangeRows: Row[] = []
      for (let r = range.start.row; r <= range.end.row; r++) {
        const row = dataCache.cachedRows.value.get(r)
        if (row) rangeRows.push(row)
      }
      // Bail if the range overlaps unloaded rows — better to keep the SQL
      // footer than display a misleading partial-set sum.
      if (rangeRows.length === 0) {
        return { active: false, values: {}, scopedTitles: new Set<string>() }
      }
      const baseCols = _columnsBase.value
      for (let c = range.start.col; c <= range.end.col; c++) {
        const colObj = baseCols[c]
        if (!colObj || colObj.id === 'row_number' || !colObj.columnObj) continue
        computeFor(colObj.columnObj, rangeRows)
      }
    } else {
      // Non-grouped cell-range.
      const rangeRows: Row[] = []
      for (let r = range.start.row; r <= range.end.row; r++) {
        const row = cachedRows.value.get(r)
        if (row) rangeRows.push(row)
      }
      if (rangeRows.length === 0) {
        return { active: false, values: {}, scopedTitles: new Set<string>() }
      }
      const baseCols = _columnsBase.value
      for (let c = range.start.col; c <= range.end.col; c++) {
        const colObj = baseCols[c]
        if (!colObj || colObj.id === 'row_number' || !colObj.columnObj) continue
        computeFor(colObj.columnObj, rangeRows)
      }
    }

    return { active: true, values, scopedTitles }
  })

  // Per-group selection-scoped aggregations. Keyed by group path joined on
  // '-' (matches the serialization in useInfiniteGroups). Each entry holds
  // pre-formatted display values for that group's columns and the
  // scopedTitles set (column titles in selection scope; others blank).
  // Cell-range selection: only the active group gets an entry. Row-checkbox
  // selection: every group with checked rows gets its own entry.
  const groupSelectionAggregations = computed<
    Map<string, { values: Record<string, string | undefined>; scopedTitles: Set<string> }>
  >(() => {
    const result = new Map<string, { values: Record<string, string | undefined>; scopedTitles: Set<string> }>()
    if (!isGroupBy.value) return result
    // Same loading-state caveat as selectionAggregations: select-all gives a
    // partial selectedRows that grows with scroll. Skip per-group overrides;
    // SQL group totals are correct for the all-rows case.
    if (vSelectedAllRecords.value) return result

    const range = selectionForAgg.value
    const hasRange = !range.isEmpty() && range.cellCount > 1

    // Same bail-out as selectionAggregations — see MAX_SELECTION_CELLS_FOR_AGG.
    if (hasRange && range.cellCount > MAX_SELECTION_CELLS_FOR_AGG) return result

    const formatFor = (col: ColumnType, rawValue: any): string | undefined => {
      const aggType = gridViewCols.value[col.id!]?.aggregation
      if (!aggType || aggType === CommonAggregations.None || rawValue === undefined) return undefined
      return getFormattedAggrationValue(aggType, rawValue, col, [], {
        col,
        meta: meta.value as TableType,
        metas: metas.value,
        isMysql,
        isPg,
      })
    }

    const computePerGroup = (
      rows: Row[],
      colsForScope: ColumnType[],
    ): { values: Record<string, string | undefined>; scopedTitles: Set<string> } => {
      const values: Record<string, string | undefined> = {}
      const scopedTitles = new Set<string>()
      for (const f of colsForScope) {
        if (!f?.id || !f?.title) continue
        scopedTitles.add(f.title)
        const aggType = gridViewCols.value[f.id]?.aggregation
        if (!aggType || aggType === CommonAggregations.None) continue
        const cellValues = rows.map((r) => r?.row?.[f.title!])
        try {
          const raw = computeAggregation({
            aggregation: aggType,
            values: cellValues,
            column: f,
            parsedFormulaType: (f.colOptions as any)?.parsed_tree?.dataType,
          })
          values[f.title] = formatFor(f, raw)
        } catch {
          // swallow — fall back to undefined; renderer treats as blank
        }
      }
      return { values, scopedTitles }
    }

    // Cell-range: scope is the column slice [start.col, end.col] in the active group
    if (hasRange && activeCell.value?.path?.length) {
      const path = activeCell.value.path as number[]
      const dataCache = getDataCache(path)
      const rangeRows: Row[] = []
      for (let r = range.start.row; r <= range.end.row; r++) {
        const row = dataCache.cachedRows.value.get(r)
        if (row) rangeRows.push(row)
      }
      if (rangeRows.length > 0) {
        const baseCols = _columnsBase.value
        const colsForScope: ColumnType[] = []
        for (let c = range.start.col; c <= range.end.col; c++) {
          const colObj = baseCols[c]
          if (!colObj || colObj.id === 'row_number' || !colObj.columnObj) continue
          colsForScope.push(colObj.columnObj)
        }
        result.set(path.join('-'), computePerGroup(rangeRows, colsForScope))
      }
    }

    // Row-checkbox: each group with checked rows scopes ALL fields
    if (cachedGroups?.value) {
      for (const path of collectGroupPaths(cachedGroups.value)) {
        const checked = getDataCache(path as number[]).selectedRows?.value ?? []
        if (!checked.length) continue
        // Only override if not already set by cell-range branch above
        const key = (path as number[]).join('-')
        if (result.has(key)) continue
        result.set(key, computePerGroup(checked, fields.value as ColumnType[]))
      }
    }

    return result
  })

  // Lightweight wrapper: during resize, patches only the resizing column's width
  // without recomputing _columnsBase (which does heavy meta/aggregation/permission work).
  // Also layers the selection-scoped aggregation override on top.
  const columns = computed<CanvasGridColumn[]>(() => {
    const base = _columnsBase.value
    const override = resizeWidthOverride.value
    const widthApplied = override
      ? base.map((col) => (override.columnIds.has(col.id) ? { ...col, width: override.width } : col))
      : base

    const sel = selectionAggregations.value
    if (!sel.active) return widthApplied

    return widthApplied.map((col) => {
      if (col.id === 'row_number') return col

      if (sel.scopedTitles.has(col.title)) {
        // In-selection field: replace footer value with JS-computed selection aggregation.
        // If the column has no aggregation configured (`agg_fn` empty/None), nothing to override —
        // existing "Summary" affordance stays as-is, but suppress hover via the sentinel anyway
        // so the user isn't tempted to configure aggregation while a selection is active.
        const rawValue = sel.values[col.title]
        if (rawValue === undefined || !col.agg_fn || col.agg_fn === CommonAggregations.None) {
          return { ...col, aggregationSuppressed: true } as CanvasGridColumn
        }
        const formatted = getFormattedAggrationValue(col.agg_fn, rawValue, col.columnObj, [], {
          col: col.columnObj,
          meta: meta.value as TableType,
          metas: metas.value,
          isMysql,
          isPg,
        })
        return { ...col, aggregation: formatted ?? '' }
      }

      // Out-of-selection field at the global level: just set the suppression
      // flag. Don't blank agg_fn / agg_prefix / aggregation — per-group
      // rendering is a separate decision and reads them independently.
      return { ...col, aggregationSuppressed: true } as CanvasGridColumn
    })
  })

  const columnWidths = computed(() =>
    columns.value.map((col) => {
      if (col.id === 'row_number') {
        return parseCellWidth(col.width) - groupByColumns.value?.length * 13
      }
      return parseCellWidth(col.width)
    }),
  )

  const totalColumnsWidth = computed(() => columnWidths.value.reduce((sum, val) => sum + val, 0))

  const isContextMenuAllowed = computed(() => !isSqlView.value)

  const isSelectedOnlyAI = computed(() => {
    // selectedRange
    if (selection.value.start.col === selection.value.end.col) {
      const column = columns.value[selection.value.start.col]
      const field = column?.columnObj
      if (!field) return { enabled: false, disabled: false }
      return {
        enabled: isAIPromptCol(field) || isAiButton(field),
        disabled: !(field?.colOptions as ButtonType)?.fk_integration_id,
      }
    }

    return {
      enabled: false,
      disabled: false,
    }
  })

  const isSelectedOnlyScript = computed(() => {
    // selectedRange
    if (selection.value.start.col === selection.value.end.col) {
      const column = columns.value[selection.value.start.col]
      const field = column?.columnObj
      if (!field) return { enabled: false, disabled: false }
      return {
        enabled: isScriptButton(field),
        disabled: false,
      }
    }

    return {
      enabled: false,
      disabled: false,
    }
  })

  const isSelectionReadOnly = computed(() => {
    // if all the selected columns are not readonly

    return (
      (selection.value.isEmpty() && activeCell.value.column && columns.value[activeCell.value.column]?.virtual) ||
      (!selection.value.isEmpty() &&
        Array.from({ length: selection.value.end.col - selection.value.start.col + 1 }).every(
          (_, i) =>
            !columns.value[selection.value.start.col + i]?.isCellEditable ||
            columns.value[selection.value.start.col + i]?.isSyncedColumn,
        ))
    )
  })

  const isFillHandleDisabled = computed(() => {
    const dataCache = getDataCache(activeCell?.value?.path)

    return !(
      !isDataReadOnly.value &&
      !readOnly.value &&
      (!editEnabled.value || EDIT_INTERACTABLE.includes(editEnabled.value?.column?.uidt)) &&
      (!selection.value.isEmpty() || (activeCell.value.row !== null && activeCell.value.column !== null)) &&
      !dataCache.cachedRows.value.get((isNaN(selection.value.end.row) ? activeCell.value.row : selection.value.end.row) ?? -1)
        ?.rowMeta?.new &&
      activeCell.value.column !== null &&
      fields.value[activeCell.value.column - 1] &&
      dataCache.totalRows.value &&
      !isSelectionReadOnly.value &&
      !isSqlView.value
    )
  })

  const totalWidth = computed(() => {
    let xOffSet = 0

    if (groupByColumns.value.length) {
      xOffSet += groupByColumns.value.length * 13
    }

    return (
      columns.value.reduce((acc, col) => {
        return acc + parseCellWidth(col.width)
      }, xOffSet) + 256
    )
  })

  const baseColor = computed(() => {
    switch (groupByColumns.value.length) {
      case 1:
        return getColor(themeV4Colors.gray['50'])
      case 2:
        return getColor(themeV4Colors.gray['100'])
      case 3:
        return getColor(themeV4Colors.gray['200'])
      default:
        return getColor(themeV4Colors.gray['50'])
    }
  })

  const findColumnIndex = (target: number, _start = 0, end = columnWidths.value.length) => {
    let accumulatedWidth = 0
    for (let i = 0; i < end; i++) {
      if (accumulatedWidth > target) {
        return Math.max(0, i - 1)
      }
      accumulatedWidth += columnWidths.value[i] ?? 0
    }
    return end - 1
  }

  function findClickedColumn(x: number, scrollLeft = 0): { column: CanvasGridColumn; xOffset: number } {
    // First check fixed columns
    let xOffset = 0

    const fixedCols = columns.value.filter((col) => col.fixed)

    for (const column of fixedCols) {
      const width = columnWidths.value[columns.value.indexOf(column)] ?? 180
      if (x >= xOffset && x < xOffset + width) {
        if (!column.uidt) {
          xOffset += width
        }
        return { column, xOffset }
      }
      xOffset += width
    }

    // Then check scrollable columns
    const visibleStart = colSlice.value.start
    const visibleEnd = colSlice.value.end

    const startOffset = columnWidths.value.slice(0, visibleStart).reduce((sum, width) => sum + width, 0)

    xOffset = startOffset - scrollLeft

    if (groupByColumns.value.length) {
      xOffset += groupByColumns.value.length * 13
    }

    for (let i = visibleStart; i < visibleEnd; i++) {
      const width = columnWidths.value[i] ?? 180
      if (x >= xOffset && x < xOffset + width) {
        return { column: columns.value[i], xOffset }
      }
      xOffset += width
    }

    return { column: null, xOffset }
  }

  function findColumnPosition(
    columnId: string,
    scrollLeft = 0,
  ): { column?: CanvasGridColumn | null; xOffset: number; width: string } {
    // First check fixed columns
    let xOffset = 0

    const fixedCols = columns.value.filter((col) => col.fixed)

    for (const column of fixedCols) {
      const width = columnWidths.value[columns.value.indexOf(column)] ?? 180
      if (columnId === column.id) {
        if (!column.uidt) {
          xOffset += width
        }
        return { column, xOffset, width: column.width }
      }
      xOffset += width
    }

    // Then check scrollable columns
    const visibleStart = colSlice.value.start
    const visibleEnd = colSlice.value.end

    const startOffset = columnWidths.value.slice(0, visibleStart).reduce((sum, width) => sum + width, 0)

    xOffset = startOffset - scrollLeft

    if (groupByColumns.value.length) {
      xOffset += groupByColumns.value.length * 13
    }

    for (let i = visibleStart; i < visibleEnd; i++) {
      const width = columnWidths.value[i] ?? 180
      if (columns.value[i] && columnId === columns.value[i]!.id) {
        return { column: columns.value[i], xOffset, width: columns.value[i]!.width }
      }
      xOffset += width
    }

    return { column: null, xOffset, width: '0px' }
  }

  function getCellPosition(targetColumn: CanvasGridColumn, rowIndex: number, path: Array<number> = []) {
    const yOffset =
      calculateGroupRowTop(
        cachedGroups.value,
        path,
        rowIndex,
        rowHeight.value,
        headerRowHeight.value,
        isAddingEmptyRowAllowed.value,
      ) -
      scrollTop.value +
      headerRowHeight.value
    if (targetColumn.fixed) {
      let xOffset = 0
      for (let i = 0; i < columns.value.length; i++) {
        const column = columns.value[i]
        if (column?.id === targetColumn.id) {
          break
        }
        if (column?.fixed) {
          xOffset += parseCellWidth(column?.width)
        }
      }

      return {
        x: xOffset,
        y: yOffset,
        width: parseCellWidth(targetColumn.width),
        height: rowHeight.value,
      }
    }

    let xOffset = CELL_BOTTOM_BORDER_IN_PX

    // Add width of all fixed columns first
    columns.value.forEach((column) => {
      if (column.fixed) {
        xOffset += parseCellWidth(column.width)
      }
    })

    const initialXOffset = xOffset

    for (const column of columns.value) {
      if (column.id === targetColumn.id) {
        break
      }
      if (!column.fixed) {
        xOffset += parseCellWidth(column.width)
      }
    }

    return {
      x: initialXOffset + (xOffset - initialXOffset) - scrollLeft.value,
      y: yOffset,
      width: parseCellWidth(targetColumn.width),
      height: rowHeight.value,
    }
  }

  const getFillHandlerPosition = (): FillHandlerPosition | null => {
    if (isFillHandleDisabled.value) return null

    const groupPath = activeCell?.value.path

    if ((selection.value.end.row < rowSlice.value.start || selection.value.end.row >= rowSlice.value.end) && !isGroupBy.value) {
      return null
    }

    // if group by then check if the group is in expanded state
    if (isGroupBy.value && groupPath && !isGroupExpanded(cachedGroups.value, groupPath as number[])) {
      return null
    }

    // Hide fill handle for cells that can't accept a user-supplied value:
    // virtual/system/AI-prompt (computed or internal) and auto-generated
    // identity columns like AutoNumber/UUID (DB-filled, readonly).
    if (selection.value.isSingleCell()) {
      if (removeInlineAddRecord.value && selection.value.start.row >= EXTERNAL_SOURCE_VISIBLE_ROWS) return null

      const selectedColumn = columns.value[selection.value.end.col]
      if (
        selectedColumn?.virtual ||
        isSystemColumn(selectedColumn?.columnObj) ||
        (selectedColumn?.columnObj && isAIPromptCol(selectedColumn?.columnObj)) ||
        (selectedColumn?.columnObj && isAutoGeneratedColumn(selectedColumn?.columnObj))
      ) {
        return null
      }
    } else {
      // If every selected column is unfillable, hide handle; otherwise show
      // (fill will skip readonly cells during the extend op).
      const selectedColumns = columns.value.slice(selection.value.start.col, selection.value.end.col + 1)
      const allColumnsUnfillable = selectedColumns.every(
        (col) => col?.virtual || (col?.columnObj && isAutoGeneratedColumn(col.columnObj)),
      )

      if (allColumnsUnfillable) {
        return null
      }
    }

    let xPos = 0
    const fixedCols = columns.value.filter((col) => col.fixed)

    for (let i = 0; i <= Math.min(selection.value.end.col, fixedCols.length - 1); i++) {
      if (columns.value[i]?.fixed) {
        xPos += parseCellWidth(columns.value[i]?.width)
      }
    }

    for (let i = fixedCols.length; i <= selection.value.end.col; i++) {
      xPos += parseCellWidth(columns.value[i]?.width)
    }

    if (selection.value.end.col >= fixedCols.length) {
      xPos -= scrollLeft.value
    }

    const startY =
      calculateGroupRowTop(
        cachedGroups.value,
        groupPath,
        selection.value.end.row,
        rowHeight.value,
        headerRowHeight.value,
        isAddingEmptyRowAllowed.value,
      ) -
      scrollTop.value +
      headerRowHeight.value +
      rowHeight.value

    // const startY = -partialRowHeight.value + 33 + (selection.value.end.row - rowSlice.value.start + 1) * rowHeight.value

    return {
      x: xPos,
      y: startY,
      size: isAiFillMode.value ? 8 : 6,
      fixedCol: selection.value.end.col < fixedCols.length,
    }
  }

  const { handleCellClick, renderCell, updateFrameTimestamp, handleCellHover, handleCellKeyDown } = useGridCellHandler({
    getCellPosition,
    actionManager,
    markdownLoader,
    updateOrSaveRow,
    makeCellEditable,
    meta,
    hasEditPermission: isDataEditAllowed,
    setCursor,
    attachmentCellDropOver,
  })

  const { canvasRef, renderCanvas, colResizeHoveredColIds } = useCanvasRender({
    width,
    mousePosition,
    elementMap,
    height,
    columns,
    colSlice,
    groupByColumns,
    cachedGroups,
    scrollLeft,
    baseColor,
    scrollTop,
    totalGroups,
    rowSlice,
    rowHeight,
    headerRowHeight,
    activeCell,
    dragOver,
    hoverRow,
    selection,
    getFillHandlerPosition,
    isAiFillMode,
    isFillMode,
    imageLoader,
    spriteLoader,
    markdownLoader,
    tableMetaLoader,
    baseRoleLoader,
    partialRowHeight,
    vSelectedAllRecords,
    vSelectedAllRecordsSkipPks,
    isRowDraggingEnabled,
    selectedRows,
    selectedHeaderColumnIds,
    resizeMarker,
    isDragging,
    draggedRowIndex,
    targetRowIndex,
    actionManager,
    renderCell,
    updateFrameTimestamp,
    meta,
    editEnabled,
    totalWidth,
    totalRows,
    actualTotalRows,
    t,
    isAddingColumnAllowed,
    readOnly,
    isFillHandleDisabled,
    isDataEditAllowed,
    isFieldEditAllowed,
    isPublicView,
    setCursor,
    isGroupBy,
    totalColumnsWidth,
    getDataCache,
    fetchMissingGroupChunks,
    getRows,
    draggedRowGroupPath,
    isAddingEmptyRowAllowed,
    isAddingEmptyRowPermitted,
    removeInlineAddRecord,
    upgradeModalInlineState,
    rowMetaColumnWidth,
    rowColouringBorderWidth,
    isRecordSelected,
    isViewOperationsAllowed,
    groupSelectionAggregations,
  })

  const { handleDragStart } = useRowReorder({
    canvasRef,
    rowHeight,
    isDragging,
    draggedRowGroupPath,
    draggedRowIndex,
    targetRowIndex,
    partialRowHeight,
    scrollTop,
    scrollToCell,
    totalRows,
    triggerRefreshCanvas,
    updateRecordOrder,
    elementMap,
    getDataCache,
  })

  const { fetchChunk, updateVisibleRows } = useDataFetch({
    cachedRows,
    chunkStates,
    clearCache,
    totalRows,
    loadData,
    rowSlice,
    triggerRefreshCanvas,
    isAlreadyShownUpgradeModal,
    isExternalSource,
  })

  const { clearCell, copyValue, isPasteable, handleAttachmentCellDrop } = useCopyPaste({
    activeCell,
    selection,
    columns,
    editEnabled,
    scrollToCell,
    expandRows,
    view: view!,
    meta: meta as Ref<TableType>,
    syncCellData: async (ctx: { row: number; column?: number; updatedColumnTitle?: string }, path: Array<number> = []) => {
      const dataCache = getDataCache(path)
      const rowObj = dataCache.cachedRows.value.get(ctx.row)
      const columnObj = ctx.column !== undefined ? fields.value[ctx.column - 1] : null

      if (!rowObj || !columnObj) {
        triggerRefreshCanvas()
        return
      }

      if (!ctx.updatedColumnTitle && isVirtualCol(columnObj)) {
        // Reload view data if it is self link column
        if (columnObj.fk_model_id === columnObj.colOptions?.fk_related_model_id) {
          reloadViewDataHook?.trigger({ shouldShowLoading: false })
        }
        triggerRefreshCanvas()
        return
      }

      // See DateTimePicker.vue for details
      const row = dataCache.cachedRows.value.get(ctx.row)
      if (row) {
        const updatedRow = {
          ...row,
          rowMeta: {
            ...row.rowMeta,
            isUpdatedFromCopyNPaste: {
              ...(row.rowMeta.isUpdatedFromCopyNPaste || {}),
              [(ctx.updatedColumnTitle || columnObj.title) as string]: true,
            },
          },
        }
        dataCache.cachedRows.value.set(ctx.row, updatedRow)
        triggerRefreshCanvas()
      }

      // update/save cell value
      await updateOrSaveRow?.(rowObj, ctx.updatedColumnTitle || columnObj.title, undefined, undefined, undefined, path)
      triggerRefreshCanvas()
    },
    bulkUpdateRows,
    bulkUpsertRows,
    fetchChunk,
    updateOrSaveRow,
    getRows,
    getDataCache,
    actionManager,
  })

  const { handleFillEnd, handleFillMove, handleFillStart } = useFillHandler({
    isFillMode,
    isAiFillMode,
    selection,
    canvasRef,
    getFillHandlerPosition,
    triggerReRender: triggerRefreshCanvas,
    getRows,
    meta: meta as Ref<TableType>,
    columns,
    bulkUpdateRows,
    isPasteable,
    activeCell,
    elementMap,
    getDataCache,
  })

  const handleColumnWidth = (columnId: string, width: number, updateFn: (normalizedWidth: string) => void) => {
    const columnIndex = columns.value.findIndex((col) => col.id === columnId)
    if (columnIndex === -1) return

    const metaCol = metaColumnById.value[columnId]
    if (!metaCol) return

    const normalizedWidth = normalizeWidth(metaCol, width)
    updateFn(`${normalizedWidth}px`)
    reloadVisibleDataHook?.trigger()
  }

  // When resizing a column that's part of a multi-field selection (size > 1),
  // apply the resize to every selected column. Otherwise just the dragged one.
  const getCoResizeColumnIds = (resizedColumnId: string): Set<string> => {
    const selected = selectedHeaderColumnIds.value
    if (selected.size > 1 && selected.has(resizedColumnId)) {
      return new Set(selected)
    }
    return new Set([resizedColumnId])
  }

  const {
    handleMouseMove: resizeMouseMove,
    handleMouseDown: startResize,
    resizeableColumn,
    isResizing,
  } = useColumnResize(
    canvasRef,
    columns,
    colSlice,
    scrollLeft,
    isViewOperationsAllowed,
    // onResize (per-frame): set lightweight override instead of mutating gridViewCols,
    // which would trigger the heavy _columnsBase recomputation.
    //
    // Single-column resize previews the new width live. A multi-field resize
    // (the dragged column is part of a header selection) instead shows only a
    // vertical guideline marker and defers the width change to mouseup — live
    // fan-out shifts the columns left of the pointer, dragging the resized edge
    // away from the cursor (Excel / Google Sheets behaviour).
    (columnId, width, leftX) => {
      const metaCol = metaColumnById.value[columnId]
      if (!metaCol) return

      const normalizedWidth = normalizeWidth(metaCol, width)
      const coResizeIds = getCoResizeColumnIds(columnId)

      if (coResizeIds.size > 1) {
        resizeMarker.value = { x: leftX + normalizedWidth, columnIds: coResizeIds }
      } else {
        resizeWidthOverride.value = { columnIds: coResizeIds, width: `${normalizedWidth}px` }
      }
      reloadVisibleDataHook?.trigger()
    },
    // onResizeEnd (mouseup): clear override/marker, flush final width to
    // gridViewCols + persist. For a multi-field resize, apply the same width to
    // every selected column. Each column is normalized against its own type
    // (Attachment has a larger minWidth, etc.) before persisting. We read the
    // co-resize set from the marker / live override (snapshot at drag time)
    // rather than re-reading `selectedHeaderColumnIds` — the canvas-level mouseup
    // that bubbles alongside the resize mouseup clears the selection before we
    // get here.
    (columnId, width) => {
      const coResizeIds = resizeMarker.value?.columnIds ?? resizeWidthOverride.value?.columnIds ?? getCoResizeColumnIds(columnId)
      resizeWidthOverride.value = null
      resizeMarker.value = null
      for (const id of coResizeIds) {
        handleColumnWidth(id, width, (normalizedWidth) => {
          if (!gridViewCols.value[id]) return
          gridViewCols.value[id]!.width = normalizedWidth
          updateGridViewColumn(id, { width: normalizedWidth })
        })
      }
    },
  )
  const {
    isDragging: isColumnReordering,
    dragStart: columnDragStart,
    startDrag,
    findColumnAtPosition,
  } = useColumnReorder(
    canvasRef,
    columns,
    colSlice,
    scrollLeft,
    triggerRefreshCanvas,
    dragOver,
    (event, fromIndex, toIndex) => {
      const toBeReorderedCol = columns.value[fromIndex]
      const toCol = columns.value[toIndex]
      if (!toBeReorderedCol || !toCol || !meta.value?.columns) return

      const toBeReorderedViewCol = gridViewCols.value[toBeReorderedCol.id]
      const toViewCol = gridViewCols.value[toCol.id]
      if (!toBeReorderedViewCol || !toViewCol) return

      const nextToColField = toIndex < columns.value.length - 1 ? columns.value[toIndex + 1] : null
      const nextToViewCol = nextToColField ? gridViewCols.value[nextToColField.id] : null

      const lastCol = columns.value[columns.value.length - 1]
      const lastViewCol = gridViewCols.value[lastCol.id]

      if (nextToViewCol === null && lastViewCol === null) return

      const newOrder = nextToViewCol ? toViewCol.order + (nextToViewCol.order - toViewCol.order) / 2 : lastViewCol.order + 1

      toBeReorderedViewCol.order = newOrder

      if (isDefaultView.value && toBeReorderedViewCol.fk_column_id) {
        meta.value.columns = (meta.value?.columns ?? [])?.map((c) => {
          if (c.id !== toBeReorderedViewCol.fk_column_id) return c
          c.meta = { ...parseProp(c.meta || {}), defaultViewColOrder: newOrder }
          return c
        })

        if (meta.value?.columnsById?.[toBeReorderedViewCol.fk_column_id]) {
          meta.value.columnsById[toBeReorderedViewCol.fk_column_id].meta = {
            ...parseProp(meta.value.columnsById[toBeReorderedViewCol.fk_column_id].meta),
            defaultViewColOrder: newOrder,
          }
        }
      }

      updateGridViewColumn(toBeReorderedCol.id, { order: newOrder })
      eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    },
    isViewOperationsAllowed,
  )

  useKeyboardNavigation({
    activeCell,
    triggerReRender: triggerRefreshCanvas,
    columns,
    scrollToCell,
    selection,
    editEnabled,
    isGroupBy,
    cachedGroups,
    getDataCache,
    copyValue,
    clearCell,
    clearSelectedRangeOfCells,
    makeCellEditable,
    expandForm,
    isAddingEmptyRowAllowed,
    isAddingEmptyRowPermitted,
    addEmptyRow,
    onActiveCellChanged,
    addNewColumn,
    handleCellKeyDown,
    removeInlineAddRecord,
    maxSelectionLimit,
  })

  const {
    handleMouseDown: onMouseDownSelectionHandler,
    handleMouseMove: onMouseMoveSelectionHandler,
    handleMouseUp: onMouseUpSelectionHandler,
  } = useMouseSelection({
    selection,
    activeCell,
    canvasRef,
    scrollLeft,
    columns,
    triggerReRender: triggerRefreshCanvas,
    scrollToCell,
    elementMap,
    getDataCache,
    maxSelectionLimit,
  })

  async function clearSelectedRangeOfCells(path?: Array<number>) {
    if (!isDataEditAllowed.value || isDataReadOnly.value) return

    const start = selection.value.start
    const end = selection.value.end

    const startCol = Math.min(start.col, end.col)
    const endCol = Math.max(start.col, end.col)

    const cols = columns.value.slice(startCol, endCol + 1)
    const rows = await getRows(start.row, end.row, path)
    const props = []

    // Collect LTAR cells for bulk delete via single API call
    const bulkLtarDeleteOps: BulkLtarOp[] = []

    for (const row of rows) {
      for (const col of cols) {
        const colObj = col?.columnObj
        if (!row || !colObj || !isVirtualCol(colObj) || !isMMOrMMLike(colObj)) continue
        if (!col.isCellEditable || col.isSyncedColumn) continue
        if (!row.row[colObj.title!]) continue

        const rowPk = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
        if (!rowPk) continue

        const oldValue = row.row[colObj.title!]

        bulkLtarDeleteOps.push({
          columnId: colObj.id as string,
          columnTitle: colObj.title!,
          rowRef: row,
          oldValue,
          data: [
            {
              operation: 'deleteAll',
              rowId: rowPk,
              columnId: colObj.id as string,
              fk_related_model_id: (colObj.colOptions as LinkToAnotherRecordType)?.fk_related_model_id as string,
            },
          ],
        })
        row.row[colObj.title!] = null
      }
    }
    if (bulkLtarDeleteOps.length) {
      try {
        await $api.internal.postOperation(
          meta.value?.fk_workspace_id as string,
          meta.value?.base_id as string,
          {
            operation: 'nestedDataBulkCopyPasteOrDeleteAll',
            tableId: meta.value?.id as string,
          },
          bulkLtarDeleteOps.map(({ columnId, data }) => ({ columnId, data })),
        )
      } catch (e: any) {
        for (const op of bulkLtarDeleteOps) {
          op.rowRef.row[op.columnTitle] = op.oldValue
        }
        message.error({
          title: t('msg.error.failedToDeleteLinkedRecords'),
          content: await extractSdkResponseErrorMsg(e),
        })
      }
    }

    for (const row of rows) {
      for (const col of cols) {
        const colObj = col.columnObj
        if (!row || !colObj || !colObj.title || !col.isCellEditable || col.isSyncedColumn) continue

        if (isVirtualCol(colObj)) continue

        // skip readonly columns
        if (isReadonlyVirtualColumn(colObj) || isAutoGeneratedColumn(colObj) || colObj.readonly) continue

        row.row[colObj.title] = null
        props.push(colObj.title)
      }
    }

    if (props.length === 0) {
      if (!bulkLtarDeleteOps.length) {
        message.info(t('msg.info.noEditableCellsToClear'))
      }
      return
    }

    await bulkUpdateRows(rows, props, undefined, path)
  }

  const cachedCurrentRow = ref<Row>()

  watch(
    () => {
      if (isGroupBy.value && !activeCell.value.path) return null
      const dataCache = getDataCache(activeCell.value.path)
      return dataCache.cachedRows.value.get(editEnabled.value?.row.rowMeta.rowIndex ?? Infinity)
    },
    (row) => {
      if (row == null) return
      cachedCurrentRow.value = row
    },
    { deep: true },
  )

  watch(
    cachedCurrentRow,
    (cached) => {
      if (editEnabled.value?.row) {
        editEnabled.value.row = cached
      }
    },
    { deep: true },
  )

  watch(editEnabled, (value) => {
    gridEditEnabled.value = value
  })

  function generateRows(columnId: string, rowIds: string[]) {
    return _generateRows(meta.value?.id, columnId, rowIds)
  }

  function makeEditable(row: Row, clickedColumn: CanvasGridColumn) {
    const column = metaColumnById.value[clickedColumn.id]

    const rowIndex = row.rowMeta.rowIndex + 1!
    const path = row.rowMeta.path

    if (isGroupBy.value && !path && !path?.legth) return

    const yOffset =
      calculateGroupRowTop(
        cachedGroups.value,
        path,
        rowIndex,
        rowHeight.value,
        headerRowHeight.value,
        isAddingEmptyRowAllowed.value,
      ) + headerRowHeight.value

    let xOffset = (groupByColumns.value?.length ?? 0) * 13
    const columnIndex = columns.value.findIndex((col) => col.id === clickedColumn.id)

    if (clickedColumn.fixed) {
      const fixedCols = columns.value.filter((col) => col.fixed)
      for (const col of fixedCols) {
        const width = columnWidths.value[columns.value.indexOf(col)] ?? 10
        if (col.id === clickedColumn.id) {
          break
        }
        xOffset += width
      }
    } else {
      const visibleStart = colSlice.value.start
      const startOffset = columnWidths.value.slice(0, visibleStart).reduce((sum, width) => sum + width, 0)

      xOffset += startOffset

      // Add widths until our target column
      for (let i = visibleStart; i < columnIndex; i++) {
        xOffset += columnWidths.value[i] ?? 10
      }
    }

    editEnabled.value = {
      rowIndex,
      x: xOffset + ([UITypes.LongText, UITypes.Formula].includes(column.uidt) ? -1 : 0),
      y: yOffset - 1,
      column,
      row,
      minHeight: rowHeight.value,
      height: [UITypes.LongText, UITypes.Formula].includes(column.uidt) ? 'auto' : rowHeight.value + 2,
      width: parseCellWidth(clickedColumn.width) + ([UITypes.LongText, UITypes.Formula].includes(column.uidt) ? 2 : 0) + 2,
      fixed: clickedColumn.fixed,
      path,
      isCellEditable: clickedColumn.isCellEditable,
      isSyncedColumn: clickedColumn.isSyncedColumn,
    }
    hideTooltip()
    return true
  }

  function makeCellEditable(row: number | Row, clickedColumn: CanvasGridColumn, showEditCellRestrictionTooltip = true) {
    const column = metaColumnById.value[clickedColumn.id]

    row = typeof row === 'number' ? cachedRows.value.get(row)! : row

    if (!row || !column) return null

    // Row is hidden by RLS policy — lock it to prevent edits before it's removed from view
    if (row.rowMeta?.isRlsHidden) return null

    if (removeInlineAddRecord.value && row.rowMeta.rowIndex && row.rowMeta.rowIndex >= EXTERNAL_SOURCE_VISIBLE_ROWS) return

    const isEditRestricted = column.id && !isAllowed(PermissionEntity.FIELD, column.id, PermissionKey.RECORD_FIELD_EDIT)

    if (!isDataEditAllowed.value || readOnly.value || isPublicView.value || !isAddingEmptyRowAllowed.value || isEditRestricted) {
      if (
        [
          UITypes.LongText,
          UITypes.Attachment,
          UITypes.JSON,
          UITypes.Links,
          UITypes.Lookup,
          UITypes.Barcode,
          UITypes.QrCode,
          UITypes.LinkToAnotherRecord,
          UITypes.Formula,
        ].includes(column.uidt)
      ) {
        makeEditable(row, clickedColumn)
        return
      }
    }

    const isSystemCol = isSystemColumn(column) && !isLinksOrLTAR(column)

    if (!isDataEditAllowed.value || editEnabled.value || readOnly.value || isSystemCol) {
      return null
    }

    if (clickedColumn.isSyncedColumn) {
      message.toast(t('msg.info.syncedFieldsAreNotEditable'))
      return null
    }

    if (!isPrimaryKeyAvailable.value && !row.rowMeta.new) {
      message.info(t('msg.info.updateNotAllowedWithoutPK'))
      return null
    }

    if (column.ai) {
      message.info(t('msg.info.autoIncFieldNotEditable'))
      return null
    }

    if (column.pk && !row.rowMeta.new) {
      message.info(t('msg.info.editingPKnotSupported'))
      return null
    }

    if (isEditRestricted && disableMakeCellEditable(column) && isEditRestricted) {
      if (showEditCellRestrictionTooltip) {
        message.toast(t('objects.permissions.editFieldTooltip'))
      }
      return null
    }

    if (column.readonly) {
      message.info(t('msg.info.fieldReadonly'))
      return null
    }

    makeEditable(row, clickedColumn)
  }

  function isRecordSelectedInSelectedAllRecords(rowIdx?: number) {
    return vSelectedAllRecords.value && (!ncIsNumber(rowIdx) || !ncHasProperties(vSelectedAllRecordsSkipPks.value, rowIdx))
  }

  function isRecordSelected(row: Row) {
    if (!row?.rowMeta) return false

    if (vSelectedAllRecords.value) {
      return isRecordSelectedInSelectedAllRecords(row.rowMeta.rowIndex)
    }

    return !!row.rowMeta.selected
  }

  let _renderRafId: number | null = null

  function triggerRefreshCanvas() {
    // Coalesce multiple render requests into a single frame.
    // Many code paths call triggerRefreshCanvas multiple times per frame
    // (scroll handler, updateVisibleRows, data fetch completion, etc.).
    // Without batching, each call synchronously re-renders the entire canvas.
    if (_renderRafId) return
    _renderRafId = requestAnimationFrame(() => {
      _renderRafId = null
      renderCanvas()
    })
  }

  // Wrapper that renders immediately and cancels any pending deferred render.
  // Used by the scroll handler to avoid the 2-frame lag that triggerRefreshCanvas causes.
  const renderCanvasDirect = () => {
    if (_renderRafId) {
      cancelAnimationFrame(_renderRafId)
      _renderRafId = null
    }
    renderCanvas()
  }

  watch(rowHeight, () => {
    clearTextCache()
    triggerRefreshCanvas()
  })

  watch(isAiFillMode, () => {
    triggerRefreshCanvas()
  })

  const smartsheetEventHandler = (event) => {
    if ([SmartsheetStoreEvents.TRIGGER_RE_RENDER, SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE].includes(event)) {
      forcedNextTick(() => {
        triggerRefreshCanvas()
      })
    }
  }

  eventBus.on(smartsheetEventHandler)

  onBeforeUnmount(() => {
    actionManager.releaseEventListeners()
    eventBus.off(smartsheetEventHandler)
  })

  // load metas and refresh canvas
  watch(
    () => fetchMetaIds.value.length,
    async () => {
      if (!fetchMetaIds.value.length) return

      // Prevent concurrent executions that could cause infinite loops
      if (isLoadingMetas.value) return

      isLoadingMetas.value = true

      // Copy the current fetch list and clear it immediately to prevent re-triggering
      const metaIdsToFetch = [...fetchMetaIds.value]
      fetchMetaIds.value = []

      try {
        await Promise.all(
          metaIdsToFetch.map(async ([colId, tableId, relatedBaseId]) => {
            if (!tableId || !relatedBaseId) return
            // Skip the full-meta call for a cross-base LTAR rendered inside a
            // shared view or shared base — the viewer has no access to the
            // external base there, so getMeta would 401 and kick off a token
            // refresh loop. Fall straight through to partial meta.
            const isCrossBase = relatedBaseId !== meta.value?.base_id
            const skipGetMeta = isCrossBase && (isPublicView.value || isSharedBase.value)
            if (!skipGetMeta) {
              try {
                await getMeta(relatedBaseId, tableId, false, false, true)
              } catch {}
            }
            const metaKey = `${relatedBaseId}:${tableId}`
            if (!metas.value[metaKey]) {
              await getPartialMeta(relatedBaseId, colId, tableId)
            }
          }),
        )
        triggerRefreshCanvas()
      } finally {
        isLoadingMetas.value = false
      }
    },
  )

  return {
    rowSlice,
    colSlice,
    activeCell,
    editEnabled,
    rowHeight,
    headerRowHeight,
    totalWidth,
    columnWidths,
    columns,
    canvasRef,
    isDragging: isColumnReordering,
    dragStart: columnDragStart,
    selection,
    hoverRow,
    resizeableColumn,
    partialRowHeight,
    readOnly,
    dragOver,
    attachmentCellDropOver,

    // columnresize related refs
    colResizeHoveredColIds,
    isResizing,

    // Functions
    fetchChunk,
    updateVisibleRows,
    findColumnIndex,
    triggerRefreshCanvas,
    renderCanvasDirect,
    startDrag,
    findColumnAtPosition,
    findClickedColumn,
    findColumnPosition,
    isRecordSelectedInSelectedAllRecords,
    isRecordSelected,

    // GroupBy Related
    syncGroupCount,
    totalGroups,
    isGroupBy,
    fetchMissingGroupChunks,
    groupByColumns,
    cachedGroups,
    toggleExpand,
    elementMap,
    makeCellEditable,
    // Handler
    resizeMouseMove,
    startResize,

    // Mouse Selection
    onMouseUpSelectionHandler,
    onMouseMoveSelectionHandler,
    onMouseDownSelectionHandler,

    // Fill Handler
    onMouseDownFillHandlerStart: handleFillStart,
    onMouseMoveFillHandlerMove: handleFillMove,
    onMouseUpFillHandlerEnd: handleFillEnd,
    isFillHandlerActive: isFillMode,
    isFillHandleDisabled,

    // Row Reorder
    isRowReOrderEnabled: isRowDraggingEnabled,
    onMouseDownRowReorderStart: handleDragStart,
    isRowReorderActive: isDragging,

    // Selections
    isSelectedOnlyScript,
    isSelectedOnlyAI,
    isSelectionReadOnly,

    // Insert Anywhere
    isInsertBelowDisabled,
    isOrderColumnExists,

    // Meta Info
    isPrimaryKeyAvailable,
    meta,
    view,
    isAddingEmptyRowAllowed,
    isAddingEmptyRowPermitted,
    isAddingColumnAllowed,
    getCellPosition,

    // Context Actions
    clearCell,
    copyValue,
    clearSelectedRangeOfCells,

    // attachment cell drop handler
    handleAttachmentCellDrop,

    // Action Manager
    actionManager,
    imageLoader,
    markdownLoader,
    baseRoleLoader,
    handleCellClick,
    handleCellHover,
    renderCell,

    totalColumnsWidth,

    // permissions
    isFieldEditAllowed,
    isDataEditAllowed,
    isContextMenuAllowed,
    removeInlineAddRecord,
    upgradeModalInlineState,
    isRowDraggingEnabled,
    rowMetaColumnWidth,
    isRowColouringEnabled,
    rowColouringBorderWidth,
    isViewOperationsAllowed,
  }
}
