import { UITypes, isAIPromptCol, isOrderCol, isVirtualCol } from 'nocodb-sdk'
import type { ButtonType, ColumnType, TableType, ViewType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import { SpriteLoader } from '../loaders/SpriteLoader'
import { ImageWindowLoader } from '../loaders/ImageLoader'
import { getSingleMultiselectColOptions } from '../utils/cell'
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
  selectedRows: Row[]
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
}) {
  const rowSlice = ref({ start: 0, end: 0 })
  const colSlice = ref({ start: 0, end: 0 })
  const activeCell = ref({ row: -1, column: -1 })
  const selection = ref(new CellRange())
  const hoverRow = ref(-1)
  const editEnabled = ref<{
    rowIndex: number
    column: ColumnType
    row: Row
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const isFillMode = ref(false)
  const dragOver = ref<{ id: string; index: number } | null>(null)
  const spriteLoader = new SpriteLoader(() => triggerRefreshCanvas())
  const imageLoader = new ImageWindowLoader(() => triggerRefreshCanvas())

  // Row Reorder related states
  const isDragging = ref(false)
  const draggedRowIndex = ref(-1)
  const targetRowIndex = ref(-1)

  const { isMobileMode } = useGlobal()
  const { t } = useI18n()
  const { gridViewCols, metaColumnById, updateGridViewColumn } = useViewColumnsOrThrow()
  const { eventBus, isDefaultView, meta, allFilters, sorts, isPkAvail: isPrimaryKeyAvailable, view } = useSmartsheetStoreOrThrow()
  const { addUndo, defineViewScope } = useUndoRedo()
  const { activeView } = storeToRefs(useViewsStore())
  const { meta: metaKey, ctrl: ctrlKey } = useMagicKeys()
  const { metas, getMeta } = useMetas()
  const { allFilters, sorts, isPkAvail } = useSmartsheetStoreOrThrow()
  const { isMysql } = useBase()

  const fields = inject(FieldsInj, ref([]))
  const isPublicView = inject(IsPublicInj, ref(false))

  const isOrderColumnExists = computed(() => (meta.value?.columns ?? []).some((col) => isOrderCol(col)))

  const isInsertBelowDisabled = computed(() => !!allFilters.value?.length || !!sorts.value?.length || isPublicView.value)

  const isRowReorderDisabled = computed(() => sorts.value?.length || isPublicView.value || !isPrimaryKeyAvailable.value)

  const isRowDraggingEnabled = computed(
    () => !selectedRows.length && isOrderColumnExists.value && !isRowReorderDisabled.value && !vSelectedAllRecords.value,
  )

  const rowHeight = computed(() => (isMobileMode.value ? 56 : rowHeightInPx[`${rowHeightEnum?.value ?? 1}`] ?? 32))

  const partialRowHeight = computed(() => scrollTop.value % rowHeight.value)

  const isAiFillMode = computed(() => (isMac() ? !!metaKey?.value : !!ctrlKey?.value))

  const fetchMetaIds = ref<string[]>([])

  const columns = computed<CanvasGridColumn[]>(() => {
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
              fetchMetaIds.value.push(relatedColObj.colOptions.fk_related_model_id)
            } else {
              relatedTableMeta = metas.value?.[relatedColObj.colOptions.fk_related_model_id]
            }
          }
        }

        if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(f.uidt)) {
          f.extra = getSingleMultiselectColOptions(f)
        }

        return {
          id: f.id,
          grid_column_id: gridViewCol.id,
          title: f.title,
          uidt: f.uidt,
          width: gridViewCol.width,
          fixed: f.pv,
          pv: !!f.pv,
          virtual: isVirtualCol(f),
          aggregation: formatAggregation(gridViewCol.aggregation, aggregations.value[f.title], f),
          agg_prefix: gridViewCol.aggregation ? t(`aggregation.${gridViewCol.aggregation}`).replace('Percent ', '') : '',
          agg_fn: gridViewCol.aggregation,
          columnObj: f,
          relatedColObj,
          relatedTableMeta,
          isMysql,
        }
      })
      .filter((c) => !!c)
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
      const field = fields.value[selection.value.start.col]
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
      const field = fields.value[selection.value.start.col]
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

  const getFillHandlerPosition = (): FillHandlerPosition | null => {
    if (selection.value.isEmpty()) return null

    if (selection.value.end.row < rowSlice.value.start || selection.value.end.row >= rowSlice.value.end) {
      return null
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
      size: 8,
      fixedCol: selection.value.end.col < fixedCols.length,
    }
  }
  const { canvasRef, renderCanvas } = useCanvasRender({
    width,
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
    partialRowHeight,
    vSelectedAllRecords,
    isRowDraggingEnabled,
    selectedRows,
    isDragging,
    draggedRowIndex,
    targetRowIndex,
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

  const { handleFillEnd, handleFillMove, handleFillStart } = useFillHandler({
    isFillMode,
    selection,
    canvasRef,
    rowHeight,
    getFillHandlerPosition,
    triggerReRender: triggerRefreshCanvas,
    rowSlice,
  })

  const handleColumnWidth = (columnId: string, width: number, updateFn: (normalizedWidth: string) => void) => {
    const columnIndex = columns.value.findIndex((col) => col.id === columnId)
    if (columnIndex === -1) return

    const metaCol = metaColumnById.value[columnId]
    if (!metaCol) return

    const normalizedWidth = normalizeWidth(metaCol, width)
    updateFn(`${normalizedWidth}px`)
    triggerRefreshCanvas()
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
  })

  const { clearCell, copyValue } = useCopyPaste({
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

  const {
    handleMouseDown: onMouseDownSelectionHandler,
    handleMouseMove: onMouseMoveSelectionHandler,
    handleMouseUp: onMouseUpSelectionHandler,
  } = useMouseSelection({
    activeCell,
    selection,
    triggerReRender: triggerRefreshCanvas,
    columns,
    canvasRef,
    rowSlice,
    scrollLeft,
    rowHeight,
    scrollToCell,
    partialRowHeight,
  })

  function triggerRefreshCanvas() {
    renderCanvas()
  }

  watch(rowHeight, () => {
    triggerRefreshCanvas()
  })

  // load metas
  watch(
    () => fetchMetaIds.value.length,
    async () => {
      if (!fetchMetaIds.value.length) return

      await Promise.all(fetchMetaIds.value.map(async (id) => getMeta(id)))
      fetchMetaIds.value = []
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

    // Context Actions
    clearCell,
    copyValue,
  }
}
