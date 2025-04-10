import { UITypes, isAIPromptCol, isLinksOrLTAR, isOrderCol, isReadonly, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { ButtonType, ColumnType, TableType, UserType, ViewType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import { SpriteLoader } from '../loaders/SpriteLoader'
import { ImageWindowLoader } from '../loaders/ImageLoader'
import { getSingleMultiselectColOptions, getUserColOptions, parseCellWidth } from '../utils/cell'
import { clearTextCache } from '../utils/canvas'
import { CELL_BOTTOM_BORDER_IN_PX, COLUMN_HEADER_HEIGHT_IN_PX, EDIT_INTERACTABLE } from '../utils/constants'
import { ActionManager } from '../loaders/ActionManager'
import { useGridCellHandler } from '../cells'
import { TableMetaLoader } from '../loaders/TableMetaLoader'
import type { CanvasGridColumn } from '../../../../../lib/types'
import { CanvasElement } from '../utils/CanvasElement'
import { calculateGroupRowTop, isGroupExpanded } from '../utils/groupby'
import { useDataFetch } from './useDataFetch'
import { useCanvasRender } from './useCanvasRender'
import { useColumnReorder } from './useColumnReorder'
import { normalizeWidth, useColumnResize } from './useColumnResize'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { useMouseSelection } from './useMouseSelection'
import { useFillHandler } from './useFillHandler'
import { useRowReorder } from './useRowReOrder'
import { useCopyPaste } from './useCopyPaste'

export function useCanvasTable({
  rowHeightEnum,
  cachedRows,
  clearCache,
  chunkStates,
  totalRows,
  loadData,
  scrollLeft,
  scrollTop,
  width,
  height,
  scrollToCell,
  aggregations,
  vSelectedAllRecords,
  selectedRows,
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
}: {
  rowHeightEnum?: Ref<number | undefined>
  cachedRows: Ref<Map<number, Row>>
  clearCache: (visibleStartIndex: number, visibleEndIndex: number, path?: Array<number>) => void
  chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
  totalRows: Ref<number>
  loadData: (params?: any, shouldShowLoading?: boolean) => Promise<Array<Row>>
  scrollLeft: Ref<number>
  scrollTop: Ref<number>
  width: Ref<number>
  height: Ref<number>
  scrollToCell: (row?: number, column?: number, path?: Array<number>) => void
  aggregations: Ref<Record<string, any>>
  vSelectedAllRecords: WritableComputedRef<boolean>
  selectedRows: Ref<Row[]>
  mousePosition: { x: number; y: number }
  expandForm: (row: Row, state?: Record<string, any>, fromToolbar?: boolean, path?: Array<number>) => void
  updateRecordOrder: (
    originalIndex: number,
    targetIndex: number | null,
    undo?: boolean,
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
    undo?: boolean,
    path?: Array<number>,
  ) => Promise<void>
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
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
}) {
  const { metas, getMeta } = useMetas()
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
  const spriteLoader = new SpriteLoader(() => triggerRefreshCanvas())
  const imageLoader = new ImageWindowLoader(() => triggerRefreshCanvas())
  const tableMetaLoader = new TableMetaLoader(getMeta, () => triggerRefreshCanvas)
  const reloadVisibleDataHook = inject(ReloadVisibleDataHookInj, undefined)
  const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
  const elementMap = new CanvasElement([])

  // Row Reorder related states
  const isDragging = ref(false)
  const draggedRowIndex = ref(-1)
  const draggedRowGroupPath = ref([])
  const targetRowIndex = ref(-1)

  const { isMobileMode } = useGlobal()
  const { $api } = useNuxtApp()
  const { t } = useI18n()
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
  } = useSmartsheetStoreOrThrow()
  const { addUndo, defineViewScope } = useUndoRedo()
  const { activeView } = storeToRefs(useViewsStore())
  const { meta: metaKey, ctrl: ctrlKey } = useMagicKeys()
  const { isDataReadOnly, isUIAllowed } = useRoles()
  const { aiIntegrations, generateRows: _generateRows } = useNocoAi()
  const { isFeatureEnabled } = useBetaFeatureToggle()
  const automationStore = useAutomationStore()
  const tooltipStore = useTooltipStore()

  const fields = inject(FieldsInj, ref([]))

  const { sqlUis } = storeToRefs(useBase())

  const { basesUser } = storeToRefs(useBases())

  const baseUsers = computed<(Partial<UserType> | Partial<User>)[]>(() =>
    meta.value?.base_id ? basesUser.value.get(meta.value?.base_id) || [] : [],
  )

  const { hideTooltip } = tooltipStore

  const isPublicView = inject(IsPublicInj, ref(false))
  const readOnly = inject(ReadonlyInj, ref(false))

  const { loadAutomation } = automationStore
  const actionManager = new ActionManager($api, loadAutomation, generateRows, meta, triggerRefreshCanvas, getDataCache)

  const isGroupBy = computed(() => !!groupByColumns.value?.length)

  const isOrderColumnExists = computed(() => (meta.value?.columns ?? []).some((col) => isOrderCol(col)))

  const isInsertBelowDisabled = computed(() => !!allFilters.value?.length || !!sorts.value?.length || isPublicView.value)

  const isRowReorderDisabled = computed(() => sorts.value?.length || isPublicView.value || !isPrimaryKeyAvailable.value)

  const isDataEditAllowed = computed(() => isUIAllowed('dataEdit') && !isSqlView.value)

  const isFieldEditAllowed = computed(() => isUIAllowed('fieldAdd'))

  const isRowDraggingEnabled = computed(
    () => !selectedRows.value.length && isOrderColumnExists.value && !isRowReorderDisabled.value && !vSelectedAllRecords.value,
  )

  const isAddingEmptyRowAllowed = computed(
    () => isDataEditAllowed.value && !isSqlView.value && !isPublicView.value && !meta.value?.synced,
  )

  const isAddingColumnAllowed = computed(() => !readOnly.value && isFieldEditAllowed.value && !isSqlView.value)

  const rowHeight = computed(() => (isMobileMode.value ? 56 : rowHeightInPx[`${rowHeightEnum?.value ?? 1}`] ?? 32))

  const partialRowHeight = computed(() => scrollTop.value % rowHeight.value)

  const isAiFillMode = computed(
    () => (isMac() ? !!metaKey?.value : !!ctrlKey?.value) && isFeatureEnabled(FEATURE_FLAG.AI_FEATURES),
  )

  const fetchMetaIds = ref<string[]>([])

  const columns = computed<CanvasGridColumn[]>(() => {
    const fetchMetaIdsLocal: string[] = []
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
          relatedColObj = metas.value?.[f.fk_model_id!]?.columns?.find(
            (c) => c.id === f?.colOptions?.fk_relation_column_id,
          ) as ColumnType

          if (relatedColObj && relatedColObj.colOptions?.fk_related_model_id) {
            if (!metas.value?.[relatedColObj.colOptions.fk_related_model_id]) {
              fetchMetaIdsLocal.push(relatedColObj.colOptions.fk_related_model_id)
            } else {
              relatedTableMeta = metas.value?.[relatedColObj.colOptions.fk_related_model_id]
            }
          }
        } else if (isLTAR(f.uidt, f.colOptions)) {
          if (f.colOptions?.fk_related_model_id) {
            if (!metas.value?.[f.colOptions.fk_related_model_id]) {
              fetchMetaIdsLocal.push(f.colOptions.fk_related_model_id)
            } else {
              relatedTableMeta = metas.value?.[f.colOptions.fk_related_model_id]
            }
          }
        }

        if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(f.uidt)) {
          f.extra = getSingleMultiselectColOptions(f)
        } else if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(f.uidt)) {
          f.extra = getUserColOptions(f, baseUsers.value)
        }

        const isInvalid = isColumnInvalid(
          f,
          aiIntegrations.value,
          isPublicView.value || !isDataEditAllowed.value || isSqlView.value,
        )

        const sqlUi = sqlUis.value[f.source_id] ?? Object.values(sqlUis.value)[0]

        return {
          id: f.id,
          grid_column_id: gridViewCol.id,
          title: f.title,
          uidt: f.uidt,
          width: gridViewCol.width,
          fixed: isMobileMode.value ? false : !!f.pv,
          readonly: !isAddingEmptyRowAllowed.value || isDataReadOnly.value,
          isCellEditable: !isReadonly(f),
          pv: !!f.pv,
          virtual: isVirtualCol(f),
          aggregation: formatAggregation(gridViewCol.aggregation, aggregations.value[f.title], f),
          agg_prefix: gridViewCol.aggregation ? t(`aggregation.${gridViewCol.aggregation}`).replace('Percent ', '') : '',
          agg_fn: gridViewCol.aggregation,
          columnObj: f,
          relatedColObj,
          relatedTableMeta,
          isInvalidColumn: {
            ...isInvalid,
            tooltip: isInvalid.ignoreTooltip ? null : isInvalid.tooltip && t(isInvalid.tooltip),
          },
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
      width: `${80 + groupByColumns.value?.length * 13}px`,
      fixed: true,
      pv: false,
      columnObj: {
        uidt: UITypes.AutoNumber,
      },
    })
    return cols as unknown as CanvasGridColumn[]
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
          (_, i) => !columns.value[selection.value.start.col + i]?.isCellEditable,
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
        return '#F9F9FA'
      case 2:
        return '#F4F4F5'
      case 3:
        return '#E7E7E9'
      default:
        return '#F9F9FA'
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

  function getCellPosition(targetColumn: CanvasGridColumn, rowIndex: number, path: Array<number> = []) {
    const yOffset =
      calculateGroupRowTop(cachedGroups.value, path, rowIndex, rowHeight.value, isAddingEmptyRowAllowed.value) -
      scrollTop.value +
      COLUMN_HEADER_HEIGHT_IN_PX
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

    // If selection is single cell and cell is virtual, hide fill handler
    if (selection.value.isSingleCell()) {
      const selectedColumn = columns.value[selection.value.end.col]
      // If the cell is virtual or system column, hide the fill handler
      if (
        selectedColumn?.virtual ||
        isSystemColumn(selectedColumn?.columnObj) ||
        (selectedColumn?.columnObj && isAIPromptCol(selectedColumn?.columnObj))
      ) {
        return null
      }
    } else {
      // If selection is not single cell and atleast one column is not virtual, show handler
      // Check if all selected columns are virtual
      const selectedColumns = columns.value.slice(selection.value.start.col, selection.value.end.col + 1)
      const allColumnsVirtual = selectedColumns.every((col) => col?.virtual)

      if (allColumnsVirtual) {
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
        isAddingEmptyRowAllowed.value,
      ) -
      scrollTop.value +
      COLUMN_HEADER_HEIGHT_IN_PX +
      rowHeight.value

    // const startY = -partialRowHeight.value + 33 + (selection.value.end.row - rowSlice.value.start + 1) * rowHeight.value

    return {
      x: xPos,
      y: startY,
      size: isAiFillMode.value ? 10 : 8,
      fixedCol: selection.value.end.col < fixedCols.length,
    }
  }

  const { handleCellClick, renderCell, handleCellHover, handleCellKeyDown } = useGridCellHandler({
    getCellPosition,
    actionManager,
    updateOrSaveRow,
    makeCellEditable,
    meta,
    hasEditPermission: isAddingEmptyRowAllowed,
    setCursor,
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
    activeCell,
    dragOver,
    hoverRow,
    selection,
    getFillHandlerPosition,
    isAiFillMode,
    isFillMode,
    imageLoader,
    spriteLoader,
    tableMetaLoader,
    partialRowHeight,
    vSelectedAllRecords,
    isRowDraggingEnabled,
    selectedRows,
    isDragging,
    draggedRowIndex,
    targetRowIndex,
    actionManager,
    renderCell,
    meta,
    editEnabled,
    totalWidth,
    totalRows,
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
  })

  const { clearCell, copyValue, isPasteable } = useCopyPaste({
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

  const updateDefaultViewColumnOrder = (columnId: string, order: number) => {
    if (!meta.value?.columns || !meta.value?.columnsById) return

    meta.value.columns = (meta.value.columns || []).map((c: ColumnType) => {
      if (c.id !== columnId) return c

      c.meta = { ...parseProp(c.meta || {}), defaultViewColOrder: order }
      return c
    })

    if (meta.value?.columnsById?.[columnId]) {
      meta.value.columnsById[columnId].meta = { ...parseProp(meta.value.columnsById[columnId].meta), defaultViewColOrder: order }
    }
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
    setCursor,
    (columnId, width) =>
      handleColumnWidth(columnId, width, (normalizedWidth) => (gridViewCols.value[columnId]!.width = normalizedWidth)),
    (columnId, width) =>
      handleColumnWidth(columnId, width, (normalizedWidth) => updateGridViewColumn(columnId, { width: normalizedWidth })),
  )
  const { isDragging: isColumnReordering, startDrag } = useColumnReorder(
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
      const oldOrder = toBeReorderedViewCol.order

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

      addUndo({
        undo: {
          fn: async () => {
            toBeReorderedViewCol.order = oldOrder
            if (isDefaultView.value) {
              updateDefaultViewColumnOrder(toBeReorderedViewCol.fk_column_id, oldOrder)
            }
            await updateGridViewColumn(toBeReorderedCol.id, { order: oldOrder })
            eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
          },
          args: [],
        },
        redo: {
          fn: async () => {
            toBeReorderedViewCol.order = newOrder
            if (isDefaultView.value) {
              updateDefaultViewColumnOrder(toBeReorderedViewCol.fk_column_id, newOrder)
            }
            await updateGridViewColumn(toBeReorderedCol.id, { order: newOrder })
            eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
          },
          args: [],
        },
        scope: defineViewScope({ view: activeView.value }),
      })

      updateGridViewColumn(toBeReorderedCol.id, { order: newOrder }, true)
      eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    },
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
    addEmptyRow,
    onActiveCellChanged,
    addNewColumn,
    handleCellKeyDown,
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
    let isInfoShown = false

    for (const row of rows) {
      for (const col of cols) {
        const colObj = col.columnObj
        if (!row || !colObj || !colObj.title) continue

        if (isVirtualCol(colObj)) {
          if ((isBt(colObj) || isOo(colObj) || isMm(colObj)) && !isInfoShown) {
            message.info(t('msg.info.groupClearIsNotSupportedOnLinksColumn'))
            isInfoShown = true
          }
          continue
        }

        // skip readonly columns
        if (isReadonly(colObj)) continue

        if (colObj.readonly) continue

        row.row[colObj.title] = null
        props.push(colObj.title)
      }
    }

    await bulkUpdateRows(rows, props, undefined, false, path)
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

  function generateRows(columnId: string, rowIds: string[]) {
    return _generateRows(meta.value?.id, columnId, rowIds)
  }

  function makeEditable(row: Row, clickedColumn: CanvasGridColumn) {
    const column = metaColumnById.value[clickedColumn.id]

    const rowIndex = row.rowMeta.rowIndex + 1!
    const path = row.rowMeta.path

    if (!path) return

    const yOffset =
      calculateGroupRowTop(cachedGroups.value, path, rowIndex, rowHeight.value, isAddingEmptyRowAllowed.value) +
      COLUMN_HEADER_HEIGHT_IN_PX

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
      width: parseCellWidth(clickedColumn.width) + ([UITypes.LongText, UITypes.Formula].includes(column.uidt) ? 2 : 0),
      fixed: clickedColumn.fixed,
      path,
    }
    hideTooltip()
    return true
  }

  function makeCellEditable(row: number | Row, clickedColumn: CanvasGridColumn) {
    const column = metaColumnById.value[clickedColumn.id]

    row = typeof row === 'number' ? cachedRows.value.get(row)! : row

    if (!row || !column) return null

    if (!isDataEditAllowed.value || readOnly.value || isPublicView.value || !isAddingEmptyRowAllowed.value) {
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

    if (column.readonly) {
      message.info(t('msg.info.fieldReadonly'))
      return null
    }

    makeEditable(row, clickedColumn)
  }

  function triggerRefreshCanvas() {
    renderCanvas()
  }

  watch(rowHeight, () => {
    clearTextCache()
    triggerRefreshCanvas()
  })

  watch(isAiFillMode, () => {
    triggerRefreshCanvas()
  })

  // load metas and refresh canvas
  watch(
    () => fetchMetaIds.value.length,
    async () => {
      if (!fetchMetaIds.value.length) return

      await Promise.all(fetchMetaIds.value.map(async (id) => getMeta(id, false, false, undefined, true)))
      fetchMetaIds.value = []
      triggerRefreshCanvas()
    },
  )

  return {
    rowSlice,
    colSlice,
    activeCell,
    editEnabled,
    rowHeight,
    totalWidth,
    columnWidths,
    columns,
    canvasRef,
    isDragging: isColumnReordering,
    selection,
    hoverRow,
    resizeableColumn,
    partialRowHeight,
    readOnly,

    // columnresize related refs
    colResizeHoveredColIds,
    isResizing,

    // Functions
    fetchChunk,
    updateVisibleRows,
    findColumnIndex,
    triggerRefreshCanvas,
    startDrag,
    findClickedColumn,

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
    isAddingColumnAllowed,
    getCellPosition,

    // Context Actions
    clearCell,
    copyValue,
    clearSelectedRangeOfCells,

    // Action Manager
    actionManager,
    imageLoader,
    handleCellClick,
    handleCellHover,
    renderCell,

    totalColumnsWidth,

    // permissions
    isFieldEditAllowed,
    isDataEditAllowed,
    isContextMenuAllowed,
  }
}
