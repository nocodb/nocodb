import { UITypes } from 'nocodb-sdk'
import { roundedRect, truncateText } from '../utils/canvas'
import { useCellRenderer } from '../cells'

export function useCanvasRender({
  width,
  height,
  columns,
  colSlice,
  scrollLeft,
  rowSlice,
  rowHeight,
  cachedRows,
  activeCell,
  dragOver,
  hoverRow,
  selection,
  isAiFillMode,
  isFillMode,
  getFillHandlerPosition,
}: {
  width: Ref<number>
  height: Ref<number>
  rowHeight: Ref<number>
  columns: ComputedRef<
    | {
        id: string
        grid_column_id: string
        title: string
        width: string
        uidt: keyof typeof UITypes | null
        fixed: boolean
        pv: boolean
      }[]
  >
  colSlice: Ref<{ start: number; end: number }>
  rowSlice: Ref<{ start: number; end: number }>
  activeCell: Ref<{ row: number; column: number }>
  scrollLeft: Ref<number>
  cachedRows: Ref<Map<number, Row>>
  dragOver: Ref<{ id: string; index: number } | null>
  hoverRow: Ref<number>
  selection: Ref<CellRange>
  isAiFillMode: ComputedRef<boolean>
  isFillMode: Ref<boolean>
  getFillHandlerPosition: () => FillHandlerPosition | null
}) {
  const canvasRef = ref()
  const { renderCell } = useCellRenderer()
  const { metaColumnById } = useViewColumnsOrThrow()

  function renderHeader(ctx: CanvasRenderingContext2D) {
    // Header background
    ctx.fillStyle = '#f4f4f5'
    ctx.fillRect(0, 0, width.value, 32)

    // Header borders
    ctx.strokeStyle = '#e7e7e9'
    ctx.lineWidth = 1

    // Bottom border
    ctx.beginPath()
    ctx.moveTo(0, 32)
    ctx.lineTo(width.value, 32)
    ctx.stroke()

    const { start: startColIndex, end: endColIndex } = colSlice.value
    const visibleCols = columns.value.slice(startColIndex, endColIndex)

    let initialOffset = 0
    for (let i = 0; i < startColIndex; i++) {
      initialOffset += parseInt(columns.value[i]!.width, 10)
    }

    // Regular columns
    ctx.fillStyle = '#6a7184'
    ctx.font = '550 12px Manrope'
    ctx.textBaseline = 'middle'
    ctx.imageSmoothingEnabled = false

    let xOffset = initialOffset
    visibleCols.forEach((column) => {
      const width = parseInt(column.width, 10)
      const truncatedText = truncateText(ctx, column.title!, width - 20)

      ctx.fillText(truncatedText, xOffset + 10 - scrollLeft.value, 16)

      xOffset += width

      ctx.beginPath()
      ctx.moveTo(xOffset - scrollLeft.value, 0)
      ctx.lineTo(xOffset - scrollLeft.value, 32)
      ctx.stroke()
    })

    // Fixed columns
    const fixedCols = columns.value.filter((col) => col.fixed)
    if (fixedCols.length) {
      xOffset = 0

      fixedCols.forEach((column, index) => {
        const width = parseInt(column.width, 10)

        // Draw background
        ctx.fillStyle = '#f4f4f5'
        ctx.fillRect(xOffset, 0, width, 32)

        // Draw title
        ctx.fillStyle = '#6a7184'
        const truncatedText = truncateText(ctx, column.title!, width - 20)
        ctx.fillText(truncatedText, xOffset + 10, 16)

        xOffset += width

        // Draw vertical border
        ctx.strokeStyle = index === fixedCols.length - 1 ? '#d1d1d1' : '#e7e7e9'
        ctx.beginPath()
        ctx.moveTo(xOffset, 0)
        ctx.lineTo(xOffset, 32)
        ctx.stroke()
      })
    }
  }

  const renderActiveState = (
    ctx: CanvasRenderingContext2D,
    activeState: {
      x: number
      y: number
      width: number
      height: number
    } | null,
  ) => {
    if (activeState) {
      ctx.strokeStyle = '#3366ff'
      ctx.lineWidth = 2
      roundedRect(ctx, activeState.x, activeState.y, activeState.width, activeState.height - 2, 2)
    }
  }

  const calculateXPosition = (colIndex: number) => {
    let xPos = 0
    for (let i = 0; i < colIndex; i++) {
      xPos += parseInt(columns.value[i]!.width, 10)
    }
    return xPos
  }

  const calculateSelectionWidth = (startCol: number, endCol: number) => {
    let width = 0
    for (let i = startCol; i <= endCol; i++) {
      width += parseInt(columns.value[i]!.width, 10)
    }
    return width
  }

  const renderFillHandle = (ctx: CanvasRenderingContext2D) => {
    if (selection.value.isEmpty()) return

    const fillHandler = getFillHandlerPosition()
    if (!fillHandler) return
    ctx.fillStyle = isAiFillMode.value ? '#9751d7' : '#ff4a3f'
    ctx.beginPath()
    ctx.arc(fillHandler.x, fillHandler.y, fillHandler.size / 2, 0, Math.PI * 2)
    ctx.fill()

    if (isFillMode.value) {
      ctx.setLineDash([2, 2])
      ctx.strokeStyle = '#3366ff'
      ctx.strokeRect(
        calculateXPosition(selection.value.start.col) - scrollLeft.value,
        selection.value.start.row * rowHeight.value + 32,
        calculateSelectionWidth(selection.value.start.col, selection.value.end.col),
        (selection.value.end.row - selection.value.start.row + 1) * rowHeight.value,
      )

      ctx.setLineDash([])
    }
  }

  function renderRows(ctx: CanvasRenderingContext2D) {
    const { start: startRowIndex, end: endRowIndex } = rowSlice.value
    const { start: startColIndex, end: endColIndex } = colSlice.value
    const visibleCols = columns.value.slice(startColIndex, endColIndex)

    let yOffset = 32
    let activeState = null

    let initialXOffset = 0
    for (let i = 0; i < startColIndex; i++) {
      initialXOffset += parseInt(columns.value[i]!.width, 10)
    }

    for (let rowIdx = startRowIndex; rowIdx < endRowIndex; rowIdx++) {
      const row = cachedRows.value.get(rowIdx)

      // Row background
      ctx.fillStyle = hoverRow.value === rowIdx ? '#F9F9FA' : '#ffffff'
      ctx.fillRect(0, yOffset, width.value, rowHeight.value)

      if (row) {
        let xOffset = initialXOffset

        visibleCols.forEach((column, colIdx) => {
          const width = parseInt(column.width, 10)
          const absoluteColIdx = startColIndex + colIdx

          if (column.fixed) {
            xOffset += width
            return
          }

          if (selection.value.isCellInRange({ row: rowIdx, col: absoluteColIdx })) {
            ctx.fillStyle = '#EBF0FF'
            ctx.fillRect(xOffset - scrollLeft.value, yOffset, width, rowHeight.value)
          }

          ctx.strokeStyle = '#f4f4f5'
          ctx.beginPath()
          ctx.moveTo(xOffset - scrollLeft.value, yOffset)
          ctx.lineTo(xOffset - scrollLeft.value, yOffset + rowHeight.value)
          ctx.stroke()

          const isActive = activeCell.value.row === rowIdx && activeCell.value.column === absoluteColIdx

          if (isActive) {
            activeState = {
              col: column,
              x: xOffset - scrollLeft.value,
              y: yOffset,
              width,
              height: rowHeight.value,
            }
          }

          const value = column.id === 'row_number' ? row.rowMeta.rowIndex! + 1 : row.row[column.title]

          renderCell(
            ctx,
            metaColumnById.value[column.id] ?? {
              uidt: UITypes.AutoNumber,
            },
            {
              value,
              x: xOffset - scrollLeft.value,
              y: yOffset,
              width,
              height: rowHeight.value,
              row: row.row,
              selected: isActive,
              pv: column.pv,
            },
          )
          xOffset += width
        })

        renderActiveState(ctx, activeState)
        activeState = null
        renderFillHandle(ctx)

        // Draw fixed columns if any (overlay on top)
        const fixedCols = columns.value.filter((col) => col.fixed)
        if (fixedCols.length) {
          xOffset = 0

          fixedCols.forEach((column, index) => {
            const width = parseInt(column.width, 10)
            const value = column.id === 'row_number' ? row.rowMeta.rowIndex! + 1 : row.row[column.title]
            const colIdx = columns.value.findIndex((col) => col.id === column.id)
            const isActive = activeCell.value.row === rowIdx && activeCell.value.column === colIdx

            if (isActive) {
              activeState = {
                col: column,
                x: xOffset,
                y: yOffset,
                width,
                height: rowHeight.value,
              }
            }

            if (selection.value.isCellInRange({ row: rowIdx, col: colIdx })) {
              ctx.fillStyle = '#EBF0FF'
              ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
            } else {
              ctx.fillStyle = hoverRow.value === rowIdx ? '#F9F9FA' : '#ffffff'
              ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
            }

            renderCell(
              ctx,
              metaColumnById.value[column.id] ?? {
                uidt: UITypes.AutoNumber,
              },
              {
                value,
                x: xOffset,
                y: yOffset,
                width,
                height: rowHeight.value,
                row: row.row,
                selected: isActive,
                pv: column.pv,
              },
            )

            ctx.strokeStyle = index === fixedCols.length - 1 ? '#f4f4f5' : '#d1d1d1'
            ctx.beginPath()
            ctx.moveTo(xOffset, yOffset)
            ctx.lineTo(xOffset, yOffset + rowHeight.value)
            ctx.stroke()

            xOffset += width
          })
        }
      } else {
        // Loading state
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, yOffset, width.value, rowHeight.value)
      }

      // Bottom border for each row
      ctx.strokeStyle = '#e7e7e9'
      ctx.beginPath()
      ctx.moveTo(0, yOffset + rowHeight.value)
      ctx.lineTo(width.value, yOffset + rowHeight.value)
      ctx.stroke()

      yOffset += rowHeight.value
    }
    renderActiveState(ctx, activeState)
    renderFillHandle(ctx)
  }

  const renderDragIndicator = (ctx: CanvasRenderingContext2D) => {
    if (!dragOver.value) return

    let xPosition = 0
    for (let i = 0; i < dragOver.value.index; i++) {
      xPosition += parseInt(columns.value[i]!.width, 10)
    }

    const width = parseInt(columns.value[dragOver.value.index - 1]!.width, 10)

    // Draw a Ghost Column
    ctx.fillStyle = '#f4f4f5'
    ctx.globalAlpha = 0.6

    ctx.fillRect(xPosition - scrollLeft.value, 0, width, height.value)
    ctx.globalAlpha = 1

    ctx.strokeStyle = '#3366ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(xPosition - scrollLeft.value, 0)
    ctx.lineTo(xPosition - scrollLeft.value, height.value)
    ctx.stroke()
  }

  function renderCanvas() {
    const canvas = canvasRef.value
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    canvas.width = width.value * dpr
    canvas.height = height.value * dpr

    canvas.style.width = `${width.value}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width.value, canvas.height)

    renderHeader(ctx)
    renderRows(ctx)
    renderDragIndicator(ctx)
  }

  const triggerRefreshCanvas = () => {
    renderCanvas()
  }

  return {
    canvasRef,
    renderHeader,
    renderActiveState,
    triggerRefreshCanvas,
  }
}
