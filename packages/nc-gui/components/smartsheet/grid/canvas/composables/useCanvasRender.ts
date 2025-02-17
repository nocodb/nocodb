import type { WritableComputedRef } from '@vue/reactivity'
import { renderCheckbox, roundedRect, truncateText } from '../utils/canvas'
import { useCellRenderer } from '../cells'
import type { ImageWindowLoader } from '../loaders/ImageLoader'
import type { SpriteLoader } from '../loaders/SpriteLoader'
import { renderIcon } from '../../../header/CellIcon'
import { renderIcon as renderVIcon } from '../../../header/VirtualCellIcon'

export function useCanvasRender({
  width,
  height,
  columns,
  colSlice,
  scrollLeft,
  scrollTop,
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
  spriteLoader,
  imageLoader,
  partialRowHeight,
  vSelectedAllRecords,
  isRowDraggingEnabled,
  selectedRows,
}: {
  width: Ref<number>
  height: Ref<number>
  rowHeight: Ref<number>
  columns: ComputedRef<CanvasGridColumn[]>
  colSlice: Ref<{ start: number; end: number }>
  rowSlice: Ref<{ start: number; end: number }>
  activeCell: Ref<{ row: number; column: number }>
  scrollLeft: Ref<number>
  scrollTop: Ref<number>
  cachedRows: Ref<Map<number, Row>>
  dragOver: Ref<{ id: string; index: number } | null>
  hoverRow: Ref<number>
  selection: Ref<CellRange>
  isAiFillMode: ComputedRef<boolean>
  isRowDraggingEnabled: ComputedRef<boolean>
  isFillMode: Ref<boolean>
  getFillHandlerPosition: () => FillHandlerPosition | null
  imageLoader: ImageWindowLoader
  spriteLoader: SpriteLoader
  partialRowHeight: Ref<number>
  vSelectedAllRecords: WritableComputedRef<boolean>
  selectedRows: ComputedRef<Row[]>
}) {
  const canvasRef = ref()
  const { renderCell } = useCellRenderer()
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

    let xOffset = initialOffset + 1
    visibleCols.forEach((column) => {
      const width = parseInt(column.width, 10)

      const iconConfig = (
        column?.virtual ? renderVIcon(column.columnObj, column.relatedColObj) : renderIcon(column.columnObj, null)
      ) as any
      if (column.uidt) {
        spriteLoader.renderIcon(ctx, {
          icon: column?.virtual ? iconConfig?.icon : iconConfig,
          size: 13,
          color: iconConfig?.hex ?? '#6a7184',
          x: xOffset + 8 - scrollLeft.value,
          y: 8,
        })
      }

      const truncatedText = truncateText(ctx, column.title!, width - 20)
      ctx.fillText(truncatedText, xOffset + 26 - scrollLeft.value, 16)

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

      fixedCols.forEach((column) => {
        const width = parseInt(column.width, 10)

        ctx.fillStyle = '#f4f4f5'
        ctx.fillRect(xOffset, 0, width, 32)

        ctx.fillStyle = '#6a7184'
        const iconConfig = (
          column?.virtual ? renderVIcon(column.columnObj, column.relatedColObj) : renderIcon(column.columnObj, null)
        ) as any
        if (column.uidt) {
          spriteLoader.renderIcon(ctx, {
            icon: column?.virtual ? iconConfig?.icon : iconConfig,
            size: 13,
            color: iconConfig?.hex ?? '#6a7184',
            x: xOffset + 8,
            y: 8,
          })
        }

        const truncatedText = truncateText(ctx, column.title!, width - 20)
        ctx.fillText(truncatedText, xOffset + (column.uidt ? 26 : 10), 16)

        ctx.strokeStyle = '#e7e7e9'
        ctx.beginPath()
        ctx.moveTo(xOffset, 0)
        ctx.lineTo(xOffset, 32)
        ctx.stroke()

        xOffset += width
      })

      if (scrollLeft.value) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
        ctx.shadowBlur = 2
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 0
      }

      ctx.strokeStyle = '#f4f4f5'
      ctx.beginPath()
      ctx.moveTo(xOffset, 0)
      ctx.lineTo(xOffset, 32)
      ctx.stroke()

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    }
  }

  const renderActiveState = (
    ctx: CanvasRenderingContext2D,
    activeState: { x: number; y: number; width: number; height: number } | null,
    renderOverFixed = false,
  ) => {
    if (!activeState) return
    const fixedWidth = columns.value.filter((col) => col.fixed).reduce((sum, col) => sum + parseInt(col.width, 10), 0)
    const isInFixedArea = activeState.x <= fixedWidth

    if (isInFixedArea && !renderOverFixed) {
      if (activeState.x + activeState.width <= fixedWidth) return

      activeState = {
        ...activeState,
        x: fixedWidth,
        width: activeState.width - (fixedWidth - activeState.x),
      }
    }

    ctx.strokeStyle = '#3366ff'
    ctx.lineWidth = 2
    roundedRect(ctx, activeState.x, activeState.y, activeState.width, activeState.height - 2, 2)
    ctx.lineWidth = 1
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

  const renderFillHandle = (ctx: CanvasRenderingContext2D, renderOverFixed = false) => {
    if (selection.value.isEmpty()) return true

    const fillHandler = getFillHandlerPosition()
    if (!fillHandler) return true

    let fixedWidth = 0
    for (const col of columns.value) {
      if (!col.fixed) break
      fixedWidth += parseInt(col.width, 10)
    }

    const isInFixedColumn = fillHandler.x <= fixedWidth
    if (isInFixedColumn) {
      if (!renderOverFixed && !fillHandler.fixedCol) {
        return true
      }
    }

    ctx.fillStyle = isAiFillMode.value ? '#9751d7' : '#ff4a3f'
    ctx.beginPath()
    ctx.arc(fillHandler.x, fillHandler.y, fillHandler.size / 2, 0, Math.PI * 2)
    ctx.fill()

    if (isFillMode.value) {
      const startY = -partialRowHeight.value + 33 + (selection.value.start.row - rowSlice.value.start) * rowHeight.value

      ctx.setLineDash([2, 2])
      ctx.strokeStyle = isAiFillMode.value ? '#9751d7' : '#3366ff'
      ctx.strokeRect(
        calculateXPosition(selection.value.start.col) - scrollLeft.value,
        startY,
        calculateSelectionWidth(selection.value.start.col, selection.value.end.col),
        (selection.value.end.row - selection.value.start.row + 1) * rowHeight.value,
      )
      ctx.setLineDash([])
    }
    return true
  }

  const renderRowMeta = (
    ctx: CanvasRenderingContext2D,
    row: Row,
    {
      xOffset,
      yOffset,
      width,
    }: {
      xOffset: number
      yOffset: number
      width: number
    },
  ) => {
    const isHover = hoverRow.value === row.rowMeta.rowIndex
    ctx.fillStyle = isHover ? '#F9F9FA' : '#ffffff'
    ctx.fillRect(xOffset, yOffset, width, rowHeight.value)

    let currentX = xOffset + 4

    const isChecked = row.rowMeta?.selected || vSelectedAllRecords.value
    const isDisabled = selectedRows.value.length >= 100 || vSelectedAllRecords.value

    if (isChecked) {
      renderCheckbox(ctx, currentX, yOffset + (rowHeight.value - 16) / 2, isChecked, isDisabled, spriteLoader)
      currentX += 24
    } else {
      if (isHover && isRowDraggingEnabled.value) {
        spriteLoader.renderIcon(ctx, {
          icon: 'ncDrag',
          size: 16,
          x: currentX,
          y: yOffset + (rowHeight.value - 16) / 2,
          color: '#6B7280',
        })
      } else {
        ctx.font = '500 12px Manrope'
        ctx.fillStyle = '#6B7280'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText((row.rowMeta.rowIndex! + 1).toString(), currentX + 8, yOffset + rowHeight.value / 2)
      }

      currentX += 24
    }

    if (isHover && !isDisabled) {
      renderCheckbox(ctx, currentX, yOffset + (rowHeight.value - 16) / 2, isChecked, isDisabled, spriteLoader)
      currentX += 24
    }

    ctx.font = '500 12px Manrope'
    ctx.fillStyle = '#6B7280'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    if (row.rowMeta?.commentCount) {
      const commentCount = row.rowMeta.commentCount.toString()

      ctx.font = '600 12px Manrope'
      const textMetrics = ctx.measureText(commentCount)
      const bubbleHeight = 20
      const bubbleWidth = textMetrics.width + 8

      ctx.beginPath()
      const x = currentX
      const y = yOffset + (rowHeight.value - bubbleHeight) / 2
      const radius = {
        topLeft: 4,
        topRight: 4,
        bottomLeft: 0,
        bottomRight: 4,
      }

      ctx.beginPath()
      ctx.moveTo(x + radius.topLeft, y)
      ctx.lineTo(x + bubbleWidth - radius.topRight, y)
      ctx.arcTo(x + bubbleWidth, y, x + bubbleWidth, y + radius.topRight, radius.topRight)
      ctx.lineTo(x + bubbleWidth, y + bubbleHeight - radius.bottomRight)
      ctx.arcTo(x + bubbleWidth, y + bubbleHeight, x + bubbleWidth - radius.bottomRight, y + bubbleHeight, radius.bottomRight)
      ctx.lineTo(x, y + bubbleHeight)
      ctx.lineTo(x, y + radius.topLeft)
      ctx.arcTo(x, y, x + radius.topLeft, y, radius.topLeft)
      ctx.closePath()

      ctx.fillStyle = '#EEF2FF'
      ctx.fill()
      ctx.strokeStyle = '#3366FF'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = '#3366FF'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(commentCount, x + bubbleWidth / 2, y + bubbleHeight / 2)
    } else if (isHover) {
      spriteLoader.renderIcon(ctx, {
        icon: 'maximize',
        size: 14,
        x: currentX,
        y: yOffset + (rowHeight.value - 14) / 2,
        color: '#6B7280',
      })
    }
  }

  function renderRows(ctx: CanvasRenderingContext2D) {
    const { end: endRowIndex } = rowSlice.value
    const { start: startColIndex, end: endColIndex } = colSlice.value
    const startRowIndex = Math.floor(scrollTop.value / rowHeight.value)

    const visibleCols = columns.value.slice(startColIndex, endColIndex)
    let yOffset = -partialRowHeight.value + 33

    let activeState: { col: any; x: number; y: number; width: number; height: number } | null = null

    let initialXOffset = 1
    for (let i = 0; i < startColIndex; i++) {
      initialXOffset += parseInt(columns.value[i]!.width, 10)
    }
    let fillHandlerRendered = false

    for (let rowIdx = startRowIndex; rowIdx < endRowIndex; rowIdx++) {
      if (yOffset + rowHeight.value > 0 && yOffset < height.value) {
        const row = cachedRows.value.get(rowIdx)

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

            const value = row.row[column.title]

            renderCell(ctx, column.columnObj, {
              value,
              x: xOffset - scrollLeft.value,
              y: yOffset,
              width,
              height: rowHeight.value,
              row: row.row,
              selected: isActive,
              pv: column.pv,
              spriteLoader,
              imageLoader,
            })
            xOffset += width
          })

          renderActiveState(ctx, activeState)
          activeState = null
          fillHandlerRendered = renderFillHandle(ctx)

          const fixedCols = columns.value.filter((col) => col.fixed)
          if (fixedCols.length) {
            xOffset = 0

            fixedCols.forEach((column) => {
              const width = parseInt(column.width, 10)

              const colIdx = columns.value.findIndex((col) => col.id === column.id)
              if (selection.value.isCellInRange({ row: rowIdx, col: colIdx })) {
                ctx.fillStyle = '#EBF0FF'
                ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
              } else {
                ctx.fillStyle = hoverRow.value === rowIdx ? '#F9F9FA' : '#ffffff'
                ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
              }

              if (column.id === 'row_number') {
                renderRowMeta(ctx, row, { xOffset, yOffset, width })
              } else {
                const value = row.row[column.title]

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

                renderCell(ctx, column.columnObj, {
                  value,
                  x: xOffset,
                  y: yOffset,
                  width,
                  height: rowHeight.value,
                  row: row.row,
                  selected: isActive,
                  pv: column.pv,
                  spriteLoader,
                  imageLoader,
                })
              }

              ctx.strokeStyle = '#f4f4f5'
              ctx.beginPath()

              ctx.moveTo(xOffset, yOffset)
              ctx.lineTo(xOffset, yOffset + rowHeight.value)
              ctx.stroke()
              renderActiveState(ctx, activeState, true)
              activeState = null

              xOffset += width
            })
            if (scrollLeft.value) {
              ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
              ctx.shadowBlur = 2
              ctx.shadowOffsetX = 1
              ctx.shadowOffsetY = 0
            }

            ctx.strokeStyle = '#f4f4f5'
            ctx.beginPath()
            ctx.moveTo(xOffset, yOffset)
            ctx.lineTo(xOffset, yOffset + rowHeight.value)
            ctx.stroke()

            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 0
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
    }
    if (!fillHandlerRendered) {
      renderFillHandle(ctx, true)
    }
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

  function renderAggregations(ctx: CanvasRenderingContext2D) {
    const AGGREGATION_HEIGHT = 36
    const { start: startColIndex, end: endColIndex } = colSlice.value

    // Background
    ctx.fillStyle = '#F9F9FA'
    ctx.fillRect(0, height.value - AGGREGATION_HEIGHT, width.value, AGGREGATION_HEIGHT)

    // Top border
    ctx.beginPath()
    ctx.strokeStyle = '#E7E7E9'
    ctx.moveTo(0, height.value - AGGREGATION_HEIGHT)
    ctx.lineTo(width.value, height.value - AGGREGATION_HEIGHT)
    ctx.stroke()

    let initialOffset = 0
    for (let i = 0; i < startColIndex; i++) {
      initialOffset += parseInt(columns.value[i]!.width, 10)
    }

    const visibleCols = columns.value.slice(startColIndex, endColIndex)
    let xOffset = initialOffset + 1

    visibleCols.forEach((column) => {
      const width = parseInt(column.width, 10)

      if (column.aggregation) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(xOffset - scrollLeft.value, height.value - AGGREGATION_HEIGHT, width, AGGREGATION_HEIGHT)
        ctx.clip()

        ctx.textBaseline = 'middle'
        ctx.textAlign = 'right'

        ctx.font = '600 12px Manrope'
        const aggWidth = ctx.measureText(column.aggregation).width

        if (column.agg_prefix) {
          ctx.font = '400 12px Manrope'
          ctx.fillStyle = '#6a7184'
          ctx.fillText(
            column.agg_prefix,
            xOffset + width - aggWidth - 16 - scrollLeft.value,
            height.value - AGGREGATION_HEIGHT / 2,
          )
        }

        ctx.font = '600 12px Manrope'
        ctx.fillStyle = '#4a5268'
        ctx.fillText(column.aggregation, xOffset + width - 8 - scrollLeft.value, height.value - AGGREGATION_HEIGHT / 2)

        ctx.restore()
      }

      ctx.beginPath()
      ctx.strokeStyle = '#f4f4f5'
      ctx.moveTo(xOffset - scrollLeft.value, height.value - AGGREGATION_HEIGHT)
      ctx.lineTo(xOffset - scrollLeft.value, height.value)
      ctx.stroke()

      xOffset += width
    })

    const fixedCols = columns.value.filter((col) => col.fixed)
    if (fixedCols.length) {
      xOffset = 0
      const rowNumberCol = fixedCols.find((col) => col.id === 'row_number')
      const firstFixedCol = fixedCols.find((col) => col.id !== 'row_number')

      if (rowNumberCol && firstFixedCol) {
        const mergedWidth = parseInt(rowNumberCol.width, 10) + parseInt(firstFixedCol.width, 10)

        ctx.fillStyle = '#F9F9FA'
        ctx.fillRect(xOffset, height.value - AGGREGATION_HEIGHT, mergedWidth, AGGREGATION_HEIGHT)

        if (firstFixedCol.aggregation) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(xOffset, height.value - AGGREGATION_HEIGHT, mergedWidth, AGGREGATION_HEIGHT)
          ctx.clip()

          ctx.textBaseline = 'middle'
          ctx.textAlign = 'right'

          ctx.font = '600 12px Manrope'
          const aggWidth = ctx.measureText(firstFixedCol.aggregation).width

          if (firstFixedCol.agg_prefix) {
            ctx.font = '400 12px Manrope'
            ctx.fillStyle = '#6a7184'
            ctx.fillText(firstFixedCol.agg_prefix, mergedWidth - aggWidth - 16, height.value - AGGREGATION_HEIGHT / 2)
          }

          ctx.font = '600 12px Manrope'
          ctx.fillStyle = '#4a5268'
          ctx.fillText(firstFixedCol.aggregation, mergedWidth - 8, height.value - AGGREGATION_HEIGHT / 2)

          ctx.restore()
        }

        ctx.strokeStyle = '#e7e7e9'
        ctx.beginPath()
        ctx.moveTo(xOffset, height.value - AGGREGATION_HEIGHT)
        ctx.lineTo(xOffset, height.value)
        ctx.stroke()

        xOffset += mergedWidth

        fixedCols.slice(2).forEach((column) => {
          const width = parseInt(column.width, 10)

          ctx.fillStyle = '#F9F9FA'
          ctx.fillRect(xOffset, height.value - AGGREGATION_HEIGHT, width, AGGREGATION_HEIGHT)

          if (column.aggregation) {
            ctx.save()
            ctx.beginPath()
            ctx.rect(xOffset, height.value - AGGREGATION_HEIGHT, width, AGGREGATION_HEIGHT)
            ctx.clip()

            ctx.font = '600 12px Manrope'
            const aggWidth = ctx.measureText(column.aggregation).width

            if (column.agg_prefix) {
              ctx.font = '400 12px Manrope'
              ctx.fillStyle = '#6a7184'
              ctx.fillText(column.agg_prefix, xOffset + width - aggWidth - 16, height.value - AGGREGATION_HEIGHT / 2)
            }

            ctx.font = '600 12px Manrope'
            ctx.fillStyle = '#4a5268'
            ctx.fillText(column.aggregation, xOffset + width - 8, height.value - AGGREGATION_HEIGHT / 2)

            ctx.restore()
          }

          ctx.strokeStyle = '#e7e7e9'
          ctx.beginPath()
          ctx.moveTo(xOffset, height.value - AGGREGATION_HEIGHT)
          ctx.lineTo(xOffset, height.value)
          ctx.stroke()

          xOffset += width
        })

        if (scrollLeft.value) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
          ctx.shadowBlur = 2
          ctx.shadowOffsetX = 1
          ctx.shadowOffsetY = 0
        }

        ctx.strokeStyle = '#f4f4f5'
        ctx.beginPath()
        ctx.moveTo(xOffset, height.value - AGGREGATION_HEIGHT)
        ctx.lineTo(xOffset, height.value)
        ctx.stroke()

        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      }
    }
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

    renderRows(ctx)
    renderHeader(ctx)
    renderDragIndicator(ctx)
    renderAggregations(ctx)
  }

  return {
    canvasRef,
    renderActiveState,
    renderCanvas,
  }
}
