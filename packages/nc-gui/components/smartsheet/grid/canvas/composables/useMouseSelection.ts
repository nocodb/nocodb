const MAX_SELECTION_LIMIT = 100

export function useMouseSelection({
  selection,
  activeCell,
  canvasRef,
  scrollLeft,
  columns,
  rowHeight,
  triggerReRender,
  scrollToCell,
  rowSlice,
}: {
  selection: Ref<CellRange>
  activeCell: Ref<{ row: number; column: number }>
  canvasRef: Ref<HTMLCanvasElement>
  scrollLeft: Ref<number>
  columns: ComputedRef<any[]>
  rowHeight: Ref<number>
  triggerReRender: () => void
  scrollToCell: (row: number, column: number) => void
  rowSlice: Ref<{ start: number; end: number }>
}) {
  const isSelecting = ref(false)

  const findCellFromPosition = (x: number, y: number) => {
    const row = Math.floor((y - 32) / rowHeight.value) + rowSlice.value.start

    let fixedWidth = 0
    const fixedCols = columns.value.filter((col) => col.fixed)
    for (let i = 1; i < fixedCols.length; i++) {
      const width = parseInt(fixedCols[i].width, 10)
      if (x >= fixedWidth && x < fixedWidth + width) {
        return { row, col: columns.value.findIndex((c) => c.id === fixedCols[i].id) }
      }
      fixedWidth += width
    }

    const adjustedX = x + scrollLeft.value - fixedWidth

    let accumulatedWidth = 0
    for (let i = fixedCols.length; i < columns.value.length; i++) {
      if (columns.value[i].fixed) continue
      const width = parseInt(columns.value[i].width, 10)
      if (adjustedX >= accumulatedWidth && adjustedX < accumulatedWidth + width) {
        return { row, col: i }
      }
      accumulatedWidth += width
    }

    return { row, col: -1 }
  }

  const handleMouseDown = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect || e.button !== 0) return

    const cell = findCellFromPosition(e.clientX - rect.left, e.clientY - rect.top)

    if (cell.col !== -1) {
      isSelecting.value = true
      selection.value.startRange(cell)
      activeCell.value = { row: cell.row, column: cell.col }
      scrollToCell(cell.row, cell.col)
      triggerReRender()
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isSelecting.value) return

    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const cell = findCellFromPosition(e.clientX - rect.left, e.clientY - rect.top)

    if (cell.col !== -1) {
      const maxRow = Math.max(selection.value._start?.row ?? 0, cell.row)
      const minRow = Math.min(selection.value._start?.row ?? 0, cell.row)

      if (maxRow - minRow >= MAX_SELECTION_LIMIT) {
        const direction = cell.row > (selection.value._start?.row ?? 0) ? 1 : -1
        cell.row = (selection.value._start?.row ?? 0) + (MAX_SELECTION_LIMIT - 1) * direction
      }

      selection.value.endRange(cell)
      activeCell.value = { row: cell.row, column: cell.col }
      scrollToCell(cell.row, cell.col)
      triggerReRender()
    }
  }

  const handleMouseUp = () => {
    isSelecting.value = false
  }

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}
