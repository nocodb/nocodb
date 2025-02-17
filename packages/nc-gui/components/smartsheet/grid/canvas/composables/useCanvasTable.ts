import {
  UITypes,
  isAIPromptCol,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isOrderCol,
  isSystemColumn,
  isVirtualCol,
} from 'nocodb-sdk'
import type { ButtonType, ColumnType, TableType, ViewType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import { SpriteLoader } from '../loaders/SpriteLoader'
import { ImageWindowLoader } from '../loaders/ImageLoader'
import { getSingleMultiselectColOptions } from '../utils/cell'
import { clearTextCache } from '../utils/canvas'
import { CELL_BOTTOM_BORDER_IN_PX, COLUMN_HEADER_HEIGHT_IN_PX } from '../utils/constants'
import { ActionManager } from '../loaders/ActionManager'
import { useGridCellHandler } from '../cells'
import { TableMetaLoader } from '../loaders/TableMetaLoader'
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
}: {
  rowHeightEnum?: Ref<number | undefined>
  cachedRows: Ref<Map<number, Row>>
  clearCache: (start: number, end: number) => void
  chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
  totalRows: Ref<number>
  loadData: (params?: any, shouldShowLoading?: boolean) => Promise<Array<Row>>
  scrollLeft: Ref<number>
  scrollTop: Ref<number>
  width: Ref<number>
  height: Ref<number>
  scrollToCell: (row?: number, column?: number) => void
  aggregations: Ref<Record<string, any>>
  vSelectedAllRecords: WritableComputedRef<boolean>
  selectedRows: Ref<Row[]>
  mousePosition: { x: number; y: number }
  expandForm: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void
  updateRecordOrder: (originalIndex: number, targetIndex: number | null) => Promise<void>
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
  ) => Promise<any>
  bulkUpsertRows: (
    insertRows: Row[],
    updateRows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    newColumns?: Partial<ColumnType>[],
  ) => Promise<void>
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
  ) => Promise<void>
  addEmptyRow: (row?: number, skipUpdate?: boolean, before?: string) => void
  onActiveCellChanged: () => void
  addNewColumn: () => void
}) {
  const { metas, getMeta } = useMetas()

  const rowSlice = ref({ start: 0, end: 0 })
  const colSlice = ref({ start: 0, end: 0 })
  const activeCell = ref({ row: -1, column: -1 })
  const selection = ref(new CellRange())
  const hoverRow = ref(-1)
  const editEnabled = ref<CanvasEditEnabledType>(null)
  const isFillMode = ref(false)
  const dragOver = ref<{ id: string; index: number } | null>(null)
  const spriteLoader = new SpriteLoader(() => triggerRefreshCanvas())
  const imageLoader = new ImageWindowLoader(() => triggerRefreshCanvas())
  const tableMetaLoader = new TableMetaLoader(getMeta, () => triggerRefreshCanvas)
  const reloadVisibleDataHook = inject(ReloadVisibleDataHookInj, undefined)

  // Row Reorder related states
  const isDragging = ref(false)
  const draggedRowIndex = ref(-1)
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
  const automationStore = useAutomationStore()
  const fields = inject(FieldsInj, ref([]))
  const { sqlUis } = storeToRefs(useBase())
  const tooltipStore = useTooltipStore()
  const { hideTooltip } = tooltipStore

  const isPublicView = inject(IsPublicInj, ref(false))
  const readOnly = inject(ReadonlyInj, ref(false))
  const isLocked = inject(IsLockedInj, ref(false))

  const { loadAutomation } = automationStore
  const actionManager = new ActionManager($api, loadAutomation, generateRows, meta, cachedRows, triggerRefreshCanvas)

  const isOrderColumnExists = computed(() => (meta.value?.columns ?? []).some((col) => isOrderCol(col)))

  const isInsertBelowDisabled = computed(() => !!allFilters.value?.length || !!sorts.value?.length || isPublicView.value)

  const isRowReorderDisabled = computed(() => sorts.value?.length || isPublicView.value || !isPrimaryKeyAvailable.value)

  const isRowDraggingEnabled = computed(
    () => !selectedRows.value.length && isOrderColumnExists.value && !isRowReorderDisabled.value && !vSelectedAllRecords.value,
  )

  const isAddingEmptyRowAllowed = computed(() => isUIAllowed('dataEdit') && !isSqlView.value && !isPublicView.value)

  const isAddingColumnAllowed = computed(() => !readOnly.value && !isLocked.value && isUIAllowed('fieldAdd') && !isSqlView.value)

  const rowHeight = computed(() => (isMobileMode.value ? 56 : rowHeightInPx[`${rowHeightEnum?.value ?? 1}`] ?? 32))

  const partialRowHeight = computed(() => scrollTop.value % rowHeight.value)

  const isAiFillMode = computed(() => (isMac() ? !!metaKey?.value : !!ctrlKey?.value))

  const fetchMetaIds = ref<string[]>([])

  const columns = computed<CanvasGridColumn[]>(() => {
    const fetchMetaIdsLocal: string[] = []

    const cols = fields.value
      .map((f) => {
        const gridViewCol = gridViewCols.value[f.id!]

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
        }

        const isInvalid = isColumnInvalid(f, aiIntegrations.value, isPublicView.value || !isAddingEmptyRowAllowed.value)

        const sqlUi = sqlUis.value[f.source_id] ?? Object.values(sqlUis.value)[0]

        return {
          id: f.id,
          grid_column_id: gridViewCol.id,
          title: f.title,
          uidt: f.uidt,
          width: gridViewCol.width,
          fixed: f.pv,
          readonly:
            isSystemColumn(f) ||
            isCreatedOrLastModifiedByCol(f) ||
            isCreatedOrLastModifiedTimeCol(f) ||
            !isAddingEmptyRowAllowed.value ||
            isDataReadOnly.value,
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
            tooltip: t(isInvalid.tooltip),
          },
          abstractType: sqlUi?.getAbstractType(f),
        }
      })
      .filter((c) => !!c)

    fetchMetaIds.value.push(...fetchMetaIdsLocal)

    cols.splice(0, 0, {
      id: 'row_number',
      grid_column_id: 'row_number',
      title: '#',
      uidt: null,
      width: '80',
      fixed: true,
      pv: false,
      columnObj: {
        uidt: UITypes.AutoNumber,
      },
    })
    return cols as unknown as CanvasGridColumn[]
  })

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

  const isSelectionReadOnly = computed(() =>
    // if all the selected columns are not readonly
    {
      return (
        (selection.value.isEmpty() && activeCell.value.column && columns.value[activeCell.value.column]?.virtual) ||
        (!selection.value.isEmpty() &&
          Array.from({ length: selection.value.end.col - selection.value.start.col + 1 }).every(
            (_, i) => columns.value[selection.value.start.col + i]?.virtual,
          ))
      )
    },
  )

  const totalWidth = computed(() => {
    return columns.value.reduce((acc, col) => acc + +(col.width?.split('px')?.[0] ?? 50), 0) + 256
  })

  const columnWidths = computed(() => columns.value.map((col) => parseInt(col.width!, 10)))

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

  function getCellPosition(targetColumn: GridCanvasColumn, rowIndex: number) {
    const yOffset = rowIndex * rowHeight.value - scrollTop.value + COLUMN_HEADER_HEIGHT_IN_PX + CELL_BOTTOM_BORDER_IN_PX

    if (targetColumn.fixed) {
      let xOffset = 0
      for (let i = 0; i < columns.value.length; i++) {
        const column = columns.value[i]
        if (column.id === targetColumn.id) {
          break
        }
        if (column.fixed) {
          xOffset += parseInt(column.width, 10)
        }
      }

      return {
        x: xOffset,
        y: yOffset,
        width: parseInt(targetColumn.width, 10),
        height: rowHeight.value,
      }
    }

    let xOffset = CELL_BOTTOM_BORDER_IN_PX

    // Add width of all fixed columns first
    columns.value.forEach((column) => {
      if (column.fixed) {
        xOffset += parseInt(column.width, 10)
      }
    })

    const initialXOffset = xOffset

    for (const column of columns.value) {
      if (column.id === targetColumn.id) {
        break
      }
      if (!column.fixed) {
        xOffset += parseInt(column.width, 10)
      }
    }

    return {
      x: initialXOffset + (xOffset - initialXOffset) - scrollLeft.value,
      y: yOffset,
      width: parseInt(targetColumn.width, 10),
      height: rowHeight.value,
    }
  }

  const getFillHandlerPosition = (): FillHandlerPosition | null => {
    if (selection.value.isEmpty()) return null

    if (selection.value.end.row < rowSlice.value.start || selection.value.end.row >= rowSlice.value.end) {
      return null
    }
    // If selection is single cell and cell is virtual, hide fill handler
    if (selection.value.isSingleCell()) {
      const selectedColumn = columns.value[selection.value.end.col]
      // If the cell is virtual or system column, hide the fill handler
      if (selectedColumn?.virtual || isSystemColumn(selectedColumn?.columnObj)) {
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
        xPos += parseInt(columns.value[i]?.width, 10)
      }
    }

    for (let i = fixedCols.length; i <= selection.value.end.col; i++) {
      xPos += parseInt(columns.value[i]?.width, 10)
    }

    if (selection.value.end.col >= fixedCols.length) {
      xPos -= scrollLeft.value
    }

    const startY = -partialRowHeight.value + 33 + (selection.value.end.row - rowSlice.value.start + 1) * rowHeight.value

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
  })

  const { canvasRef, renderCanvas } = useCanvasRender({
    width,
    mousePosition,
    height,
    columns,
    colSlice,
    scrollLeft,
    scrollTop,
    cachedRows,
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
  })

  const { handleDragStart } = useRowReorder({
    canvasRef,
    rowHeight,
    isDragging,
    draggedRowIndex,
    targetRowIndex,
    cachedRows,
    partialRowHeight,
    scrollTop,
    scrollToCell,
    totalRows,
    triggerRefreshCanvas,
    updateRecordOrder,
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
    totalRows,
    activeCell,
    selection,
    columns,
    editEnabled,
    cachedRows,
    scrollToCell,
    expandRows,
    view: view!,
    meta: meta as Ref<TableType>,
    syncCellData: async (ctx: { row: number; column?: number; updatedColumnTitle?: string }) => {
      const rowObj = cachedRows.value.get(ctx.row)
      const columnObj = ctx.column !== undefined ? fields.value[ctx.column - 1] : null
      if (!rowObj || !columnObj) {
        return
      }

      if (!ctx.updatedColumnTitle && isVirtualCol(columnObj)) {
        return
      }

      // See DateTimePicker.vue for details
      const row = cachedRows.value.get(ctx.row)
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
        cachedRows.value.set(ctx.row, updatedRow)
      }

      // update/save cell value
      await updateOrSaveRow?.(rowObj, ctx.updatedColumnTitle || columnObj.title)
    },
    bulkUpdateRows,
    bulkUpsertRows,
    fetchChunk,
    updateOrSaveRow,
  })

  const { handleFillEnd, handleFillMove, handleFillStart } = useFillHandler({
    isFillMode,
    isAiFillMode,
    selection,
    canvasRef,
    rowHeight,
    getFillHandlerPosition,
    triggerReRender: triggerRefreshCanvas,
    rowSlice,
    meta: meta as Ref<TableType>,
    cachedRows,
    columns,
    bulkUpdateRows,
    isPasteable,
    activeCell,
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
  } = useColumnResize(
    canvasRef,
    columns,
    colSlice,
    scrollLeft,
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
      if (!toBeReorderedCol || !toCol) return

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
    totalRows,
    triggerReRender: triggerRefreshCanvas,
    columns,
    scrollToCell,
    selection,
    editEnabled,
    copyValue,
    clearCell,
    clearSelectedRangeOfCells,
    makeCellEditable,
    cachedRows,
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
    activeCell,
    selection,
    totalRows,
    triggerReRender: triggerRefreshCanvas,
    columns,
    canvasRef,
    rowSlice,
    scrollLeft,
    rowHeight,
    scrollToCell,
    partialRowHeight,
  })

  async function clearSelectedRangeOfCells() {
    if (!isUIAllowed('dataEdit') || isDataReadOnly.value) return

    const start = selection.value.start
    const end = selection.value.end

    const startCol = Math.min(start.col, end.col)
    const endCol = Math.max(start.col, end.col)

    const cols = columns.value.slice(startCol, endCol + 1)
    // Get rows in the selected range
    const rows = Array.from(cachedRows.value.values()).slice(start.row, end.row + 1)

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

        row.row[colObj.title] = null
        props.push(colObj.title)
      }
    }

    await bulkUpdateRows(rows, props)
  }

  function generateRows(columnId: string, rowIds: string[]) {
    return _generateRows(meta.value?.id, columnId, rowIds)
  }

  function makeCellEditable(row: number | Row, clickedColumn: CanvasGridColumn) {
    const column = metaColumnById.value[clickedColumn.id]
    row = typeof row === 'number' ? cachedRows.value.get(row)! : row
    const rowIndex = row.rowMeta.rowIndex

    if (!row || !column) return null

    if (!isUIAllowed('dataEdit') || editEnabled.value || readOnly.value || isSystemColumn(column)) {
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

    let xOffset = 0
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
      x: xOffset,
      y: (rowIndex + 1) * rowHeight.value + 32,
      column,
      row,
      minHeight: rowHeight.value,
      height: column.uidt === UITypes.LongText ? 'auto' : rowHeight.value,
      width: parseInt(clickedColumn.width, 10) + 2,
      fixed: clickedColumn.fixed,
    }
    hideTooltip()
    return true
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

      await Promise.all(fetchMetaIds.value.map(async (id) => getMeta(id)))
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
    // Functions
    fetchChunk,
    updateVisibleRows,
    findColumnIndex,
    triggerRefreshCanvas,
    startDrag,

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
  }
}
