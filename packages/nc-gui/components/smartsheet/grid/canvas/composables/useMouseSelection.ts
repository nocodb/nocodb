import { parseCellWidth } from '../utils/cell'
import { type CanvasElement, ElementTypes } from '../utils/CanvasElement'

const MAX_SELECTION_LIMIT = 100

export function useMouseSelection({
  selection,
  activeCell,
  canvasRef,
  scrollLeft,
  columns,
  triggerReRender,
  scrollToCell,
  elementMap,
  getDataCache,
}: {
  selection: Ref<CellRange>
  activeCell: Ref<{
    row?: number
    column?: number
    path?: Array<number>
  }>
  canvasRef: Ref<HTMLCanvasElement>
  scrollLeft: Ref<number>
  columns: ComputedRef<CanvasGridColumn[]>
  triggerReRender: () => void
  scrollToCell: (row?: number, column?: number, path?: Array<number>) => void
  elementMap: CanvasElement
  getDataCache: (path?: Array<number>) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }
}) {
  const isSelecting = ref(false)

  const findCellFromPosition = (x: number, y: number) => {
    const element = elementMap.findElementAt(x, y, ElementTypes.ROW)

    const row = element?.rowIndex
    const path = element?.row?.rowMeta?.path

    let fixedWidth = 0
    const fixedCols = columns.value.filter((col) => col.fixed)
    for (let i = 0; i < fixedCols.length; i++) {
      if (!fixedCols[i]?.width) continue
      const width = parseCellWidth(fixedCols[i]?.width)
      if (x >= fixedWidth && x < fixedWidth + width) {
        return { row, col: i === 0 ? -1 : columns.value.findIndex((c) => c.id === fixedCols[i]!.id), path: path ?? [] }
      }
      fixedWidth += width
    }

    const adjustedX = x + scrollLeft.value - fixedWidth

    let accumulatedWidth = 0
    for (let i = fixedCols.length; i < columns.value.length; i++) {
      if (columns.value?.[i]?.fixed) continue
      const width = parseCellWidth(columns.value[i]?.width)
      if (adjustedX >= accumulatedWidth && adjustedX < accumulatedWidth + width) {
        return { row, col: i, path: path ?? [] }
      }
      accumulatedWidth += width
    }

    return { row, col: -1, path: path ?? [] }
  }

  const handleMouseDown = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect || e.button !== 0) return

    const cell = findCellFromPosition(e.clientX - rect.left, e.clientY - rect.top)

    if (e.shiftKey) {
      // If Shift key is pressed, we should set the end range as the current cell
      if (cell.col !== -1) {
        isSelecting.value = true
        selection.value.endRange(cell)
        triggerReRender()
      }
      return
    }

    if (cell.col !== -1) {
      isSelecting.value = true
      selection.value.startRange(cell)
      activeCell.value = { row: cell.row, column: cell.col, path: cell.path }
      triggerReRender()
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isSelecting.value) return

    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const cell = findCellFromPosition(e.clientX - rect.left, e.clientY - rect.top)

    if (ncIsNullOrUndefined(cell.row)) return

    const dataCache = getDataCache(cell?.path)

    if (cell.col !== -1) {
      // Clamp cell.row between 0 and totalRows - 1
      cell.row = Math.max(0, Math.min(cell.row, dataCache.totalRows.value - 1))

      const maxRow = Math.max(selection.value._start?.row ?? 0, cell.row)
      const minRow = Math.min(selection.value._start?.row ?? 0, cell.row)

      if (maxRow - minRow >= MAX_SELECTION_LIMIT) {
        const direction = cell.row > (selection.value._start?.row ?? 0) ? 1 : -1
        const newRow = (selection.value._start?.row ?? 0) + (MAX_SELECTION_LIMIT - 1) * direction
        // Clamp the new row value between 0 and totalRows - 1
        cell.row = Math.max(0, Math.min(newRow, dataCache.totalRows.value - 1))
      }

      selection.value.endRange(cell)
      scrollToCell(cell.row, cell.col, cell.path)
      triggerReRender()
    }
  }
  const handleMouseUp = () => {
    isSelecting.value = false

    if (!selection.value.isEmpty()) {
      return !(selection.value.end?.row === selection.value.start?.row && selection.value.end?.col === selection.value.start?.col)
    }
  }

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}
