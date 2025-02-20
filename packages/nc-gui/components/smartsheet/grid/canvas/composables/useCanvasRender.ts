import type { WritableComputedRef } from '@vue/reactivity'
import { AllAggregations, type ColumnType, type TableType } from 'nocodb-sdk'
import type { Composer } from 'vue-i18n'
import { isBoxHovered, renderCheckbox, renderIconButton, renderSingleLineText, roundedRect, truncateText } from '../utils/canvas'
import type { ImageWindowLoader } from '../loaders/ImageLoader'
import type { SpriteLoader } from '../loaders/SpriteLoader'
import { renderIcon } from '../../../header/CellIcon'
import { renderIcon as renderVIcon } from '../../../header/VirtualCellIcon'
import type { TableMetaLoader } from '../loaders/TableMetaLoader'
import { ADD_NEW_COLUMN_WIDTH, COLUMN_HEADER_HEIGHT_IN_PX, MAX_SELECTED_ROWS, ROW_META_COLUMN_WIDTH } from '../utils/constants'
import { parseCellWidth } from '../utils/cell'

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
  tableMetaLoader,
  partialRowHeight,
  vSelectedAllRecords,
  isRowDraggingEnabled,
  isAddingColumnAllowed,
  isAddingEmptyRowAllowed,
  selectedRows,
  isDragging,
  draggedRowIndex,
  targetRowIndex,
  mousePosition,
  renderCell,
  meta,
  editEnabled,
  totalWidth,
  totalRows,
  t,
  readOnly,

  isFieldEditAllowed,
  setCursor,
  totalColumnsWidth,
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
  totalWidth: ComputedRef<number>
  selection: Ref<CellRange>
  isAiFillMode: ComputedRef<boolean>
  isRowDraggingEnabled: ComputedRef<boolean>
  isAddingColumnAllowed: ComputedRef<boolean>
  isAddingEmptyRowAllowed: ComputedRef<boolean>
  isFillMode: Ref<boolean>
  getFillHandlerPosition: () => FillHandlerPosition | null
  imageLoader: ImageWindowLoader
  spriteLoader: SpriteLoader
  tableMetaLoader: TableMetaLoader
  partialRowHeight: Ref<number>
  vSelectedAllRecords: WritableComputedRef<boolean>
  selectedRows: Ref<Row[]>
  isDragging: Ref<boolean>
  draggedRowIndex: Ref<number | null>
  targetRowIndex: Ref<number | null>
  mousePosition: { x: number; y: number }
  renderCell: (ctx: CanvasRenderingContext2D, column: ColumnType, options: any) => void
  meta: ComputedRef<TableType>
  editEnabled: Ref<CanvasEditEnabledType>
  totalRows: Ref<number>
  t: Composer['t']
  readOnly: Ref<boolean>
  isFillHandleDisabled: ComputedRef<boolean>
  isFieldEditAllowed: ComputedRef<boolean>
  isDataEditAllowed: ComputedRef<boolean>
  setCursor: SetCursorType
  totalColumnsWidth: ComputedRef<number>
}) {
  const canvasRef = ref<HTMLCanvasElement>()
  const colResizeHoveredColIds = ref(new Set())
  const { tryShowTooltip } = useTooltipStore()
  const { isMobileMode } = useGlobal()

  const drawShimmerEffect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, rowIdx: number) => {
    ctx.save()

    width = Math.min(width, rowIdx % 2 === 0 ? 124 : 144) - 24

    ctx.beginPath()
    ctx.roundRect(x + 12, y + 7.5, width, 16, 10)
    ctx.fillStyle = '#E7E7E9'
    ctx.fill()

    ctx.clip()

    ctx.restore()
  }

  function renderHeader(
    ctx: CanvasRenderingContext2D,
    activeState?: {
      x: number
      y: number
      width: number
      height: number
    } | null,
  ) {
    const canvasWidth = width.value
    // ctx.textAlign is previously set during the previous render calls and that carries over here
    // causing the misalignment. Resetting textAlign fixes it.
    ctx.textAlign = 'left'
    const plusColumnWidth = ADD_NEW_COLUMN_WIDTH
    const columnsWidth =
      totalColumnsWidth.value + (isAddingColumnAllowed.value && !isMobileMode.value ? plusColumnWidth : 0) - scrollLeft.value

    // Header background
    ctx.fillStyle = '#f4f4f5'
    ctx.fillRect(0, 0, columnsWidth, 32)

    // Header borders
    ctx.strokeStyle = '#e7e7e9'
    ctx.lineWidth = 1

    // Bottom border
    ctx.beginPath()
    ctx.moveTo(0, 32)
    ctx.lineTo(columnsWidth, 32)
    ctx.stroke()

    const { start: startColIndex, end: endColIndex } = colSlice.value
    const visibleCols = columns.value.slice(startColIndex, endColIndex)

    let initialOffset = 1
    for (let i = 0; i < startColIndex; i++) {
      initialOffset += parseCellWidth(columns.value[i]?.width)
    }

    // Regular columns
    ctx.fillStyle = '#6a7184'
    ctx.font = '550 12px Manrope'
    ctx.textBaseline = 'middle'
    ctx.imageSmoothingEnabled = false

    let xOffset = initialOffset

    for (const column of visibleCols) {
      const colObj = column.columnObj
      const width = parseCellWidth(column.width)

      if (column.fixed) {
        xOffset += width
        ctx.beginPath()
        ctx.moveTo(xOffset - scrollLeft.value, 0)
        ctx.lineTo(xOffset - scrollLeft.value, 32)
        ctx.stroke()
        continue
      }
      const rightPadding = 8
      let iconSpace = rightPadding

      iconSpace += 16

      if (column.isInvalidColumn?.isInvalid && !column.isInvalidColumn?.ignoreTooltip) {
        iconSpace += 18
      }

      if (column?.columnObj?.description?.length) {
        iconSpace += 18
      }

      const iconConfig = (
        column?.virtual ? renderVIcon(column.columnObj, column.relatedColObj) : renderIcon(column.columnObj, column.abstractType)
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

      const isRequired = colObj.rqd && !colObj.cdf

      const availableTextWidth = width - (26 + iconSpace + (isRequired ? 4 : 0))
      const truncatedText = truncateText(ctx, column.title!, availableTextWidth)
      ctx.fillText(truncatedText, xOffset + 26 - scrollLeft.value, 16)
      if (isRequired) {
        ctx.save()
        ctx.fillStyle = '#EF4444'
        ctx.fillText('*', xOffset + 28 - scrollLeft.value + ctx.measureText(truncatedText).width, 16)
        ctx.restore()
      }

      let rightOffset = xOffset + width - rightPadding

      if (isFieldEditAllowed.value) {
        rightOffset -= 16
        spriteLoader.renderIcon(ctx, {
          icon: 'chevronDown',
          size: 14,
          color: '#6a7184',
          x: rightOffset - scrollLeft.value,
          y: 9,
        })
      }

      if (column.isInvalidColumn?.isInvalid && !column.isInvalidColumn?.ignoreTooltip) {
        rightOffset -= 18
        spriteLoader.renderIcon(ctx, {
          icon: 'alertTriangle',
          size: 14,
          color: '#FF928C',
          x: rightOffset - scrollLeft.value,
          y: 9,
        })
      }

      if (column?.columnObj?.description?.length) {
        rightOffset -= 18
        spriteLoader.renderIcon(ctx, {
          icon: 'ncInfo',
          size: 13,
          color: '#6B7280',
          x: rightOffset - scrollLeft.value,
          y: 9,
        })
      }
      xOffset += width

      const resizeHandleWidth = 10
      const isNearEdge =
        mousePosition && Math.abs(xOffset - scrollLeft.value - mousePosition.x) <= resizeHandleWidth && mousePosition.y <= 32

      if (isNearEdge) {
        colResizeHoveredColIds.value.add(column.id)
        ctx.strokeStyle = '#9CDAFA'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(xOffset - scrollLeft.value, 0)
        ctx.lineTo(xOffset - scrollLeft.value, 32)
        ctx.stroke()

        // Reset for regular column separator
        ctx.strokeStyle = '#e7e7e9'
        ctx.lineWidth = 1
      } else {
        colResizeHoveredColIds.value.delete(column.id)
        ctx.beginPath()
        ctx.moveTo(xOffset - scrollLeft.value, 0)
        ctx.lineTo(xOffset - scrollLeft.value, 32)
        ctx.stroke()
      }
    }

    if (isAddingColumnAllowed.value && !isMobileMode.value) {
      ctx.fillStyle = '#F9F9FA'
      ctx.fillRect(xOffset - scrollLeft.value, 0, plusColumnWidth, 32)
      spriteLoader.renderIcon(ctx, {
        icon: 'ncPlus',
        size: 16,
        color: '#6a7184',
        x: xOffset + plusColumnWidth / 2 - 8 - scrollLeft.value,
        y: 8,
      })

      ctx.beginPath()
      ctx.moveTo(xOffset + plusColumnWidth - scrollLeft.value, 0)
      ctx.lineTo(xOffset + plusColumnWidth - scrollLeft.value, 32)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(xOffset - scrollLeft.value, 32)
      ctx.lineTo(xOffset + plusColumnWidth - scrollLeft.value, 32)
      ctx.stroke()
    }
    const fillHandler = getFillHandlerPosition()

    // The issue is the border gets drawn over the active state border.
    // For quick hack, we skip rendering border over the y values of the active state to avoid the overlap.
    if (
      (activeState &&
        xOffset - scrollLeft.value >= activeState.x &&
        xOffset - scrollLeft.value <= activeState.x + activeState.width) ||
      (fillHandler && xOffset - scrollLeft.value + 1 >= fillHandler.x && xOffset - scrollLeft.value - 1 <= fillHandler.x)
    ) {
      // Draw line above active state
      ctx.strokeStyle = '#f4f4f5'
      if (fillHandler && activeState?.y) {
        ctx.beginPath()
        ctx.moveTo(xOffset - scrollLeft.value, 32)
        ctx.lineTo(xOffset - scrollLeft.value, activeState.y)
        ctx.stroke()
      }

      if (fillHandler) {
        // draw line between active state and fill handler
        if (!isFillMode.value && !selection.value.isSingleCell()) {
          ctx.beginPath()

          if (selection.value.start.col !== selection.value.end.col) {
            ctx.moveTo(xOffset - scrollLeft.value, activeState ? activeState.y : 32)
          } else {
            let y = activeState ? activeState.y + activeState.height : 32

            // Adjust y position if fill handler is in the same active cell and multiple rows are selected
            if (y === fillHandler.y) y -= fillHandler.size / 2

            ctx.moveTo(xOffset - scrollLeft.value, y)
          }
          ctx.lineTo(xOffset - scrollLeft.value, fillHandler.y - fillHandler.size / 2)
          ctx.stroke()
        }
        // Draw line below the fill handler
        ctx.beginPath()
        ctx.moveTo(xOffset - scrollLeft.value, fillHandler.y + fillHandler.size / 2)
        ctx.lineTo(xOffset - scrollLeft.value, (rowSlice.value.end - rowSlice.value.start + 1) * rowHeight.value + 32)
        ctx.stroke()
      } else if (activeState?.y && activeState?.height) {
        // Draw line below active state
        ctx.beginPath()
        ctx.moveTo(xOffset - scrollLeft.value, activeState.y + activeState.height)
        ctx.lineTo(xOffset - scrollLeft.value, (rowSlice.value.end - rowSlice.value.start + 1) * rowHeight.value + 32)
        ctx.stroke()
      }
    } else if (visibleCols.filter((f) => !f.fixed).length) {
      // Draw full line if not intersecting with active state
      ctx.strokeStyle = '#f4f4f5'
      ctx.beginPath()
      ctx.moveTo(xOffset - scrollLeft.value, 32)
      ctx.lineTo(
        xOffset - scrollLeft.value,
        (rowSlice.value.end - rowSlice.value.start + 1) * rowHeight.value + 33 - partialRowHeight.value,
      )
      ctx.stroke()
    }

    // Fixed columns
    const fixedCols = columns.value.filter((col) => col.fixed)
    if (fixedCols.length) {
      xOffset = 0.5

      fixedCols.forEach((column) => {
        const width = parseCellWidth(column.width)
        const rightPadding = 8
        let iconSpace = rightPadding
        const colObj = column.columnObj
        iconSpace += 16

        if (column.isInvalidColumn?.isInvalid && !column.isInvalidColumn?.ignoreTooltip) {
          iconSpace += 18
        }

        if (column?.columnObj?.description?.length) {
          iconSpace += 18
        }

        // Background
        ctx.fillStyle = '#f4f4f5'
        ctx.fillRect(xOffset, 0, width, 32)

        ctx.fillStyle = '#6a7184'
        const iconConfig = (
          column?.virtual
            ? renderVIcon(column.columnObj, column.relatedColObj)
            : renderIcon(column.columnObj, column.abstractType)
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

        const isRequired = colObj?.rqd && !colObj?.cdf

        const availableTextWidth = width - (26 + iconSpace + (isRequired ? 4 : 0))

        const truncatedText = truncateText(ctx, column.title!, availableTextWidth)
        const x = xOffset + (column.uidt ? 26 : 10)
        const y = 16

        if (column.id === 'row_number') {
          if (
            !readOnly.value &&
            (vSelectedAllRecords.value || isBoxHovered({ x: 0, y: 0, width: canvasWidth, height: 32 }, mousePosition))
          ) {
            const checkSize = 16
            const isCheckboxHovered = isBoxHovered({ x, y: y - 8, width: checkSize, height: checkSize }, mousePosition)
            renderCheckbox(
              ctx,
              x,
              y - 8,
              vSelectedAllRecords.value,
              false,
              spriteLoader,
              isCheckboxHovered ? '#3366FF' : '#D9D9D9',
            )
          } else {
            ctx.fillText(truncatedText, x, y)
          }
        } else {
          ctx.fillText(truncatedText, x, y)

          if (isRequired) {
            ctx.save()
            ctx.fillStyle = '#EF4444'
            ctx.fillText('*', xOffset + 28 + ctx.measureText(truncatedText).width, 16)
            ctx.restore()
          }
        }

        let rightOffset = xOffset + width - rightPadding

        if (column.uidt && isFieldEditAllowed.value) {
          // Chevron down
          rightOffset -= 16
          spriteLoader.renderIcon(ctx, {
            icon: 'chevronDown',
            size: 14,
            color: '#6a7184',
            x: rightOffset,
            y: 9,
          })
        }

        // Error icon if invalid
        if (column.isInvalidColumn?.isInvalid && !column.isInvalidColumn?.ignoreTooltip) {
          rightOffset -= 18
          spriteLoader.renderIcon(ctx, {
            icon: 'alertTriangle',
            size: 14,
            color: '#FF928C',
            x: rightOffset,
            y: 9,
          })
        }

        // Info icon if has description
        if (column?.columnObj?.description?.length) {
          rightOffset -= 18
          spriteLoader.renderIcon(ctx, {
            icon: 'ncInfo',
            size: 13,
            color: '#6B7280',
            x: rightOffset,
            y: 9,
          })
        }
        xOffset += width

        // Border
        const resizeHandleWidth = 10
        const isNearEdge = mousePosition && Math.abs(xOffset - mousePosition.x) <= resizeHandleWidth && mousePosition.y <= 32

        // Right border for row number field
        if (column.id === 'row_number') {
          ctx.strokeStyle = '#e7e7e9'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(xOffset, 0)
          ctx.lineTo(xOffset, 32)
          ctx.stroke()
        }

        if (isNearEdge && column.id !== 'row_number') {
          colResizeHoveredColIds.value.add(column.id)
          ctx.strokeStyle = '#9CDAFA'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(xOffset, 0)
          ctx.lineTo(xOffset, 32)
          ctx.stroke()

          // Reset for regular column separator
          ctx.strokeStyle = '#e7e7e9'
          ctx.lineWidth = 1
        } else {
          colResizeHoveredColIds.value.delete(column.id)
        }
      })

      if (scrollLeft.value) {
        ctx.strokeStyle = '#D5D5D9'
        ctx.beginPath()
        ctx.moveTo(xOffset, 0)
        ctx.lineTo(xOffset, 32)
        ctx.stroke()

        ctx.fillStyle = 'rgba(0, 0, 0, 0.04)'
        ctx.rect(xOffset, 0, 4, 32)
        ctx.fill()
      }
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    }
  }

  const renderActiveState = (
    ctx: CanvasRenderingContext2D,
    activeState: { x: number; y: number; width: number; height: number; col: CanvasGridColumn } | null,
  ) => {
    if (!activeState) return

    const fixedWidth = columns.value.filter((col) => col.fixed).reduce((sum, col) => sum + parseCellWidth(col.width), 0)
    const isInFixedArea = activeState.x <= fixedWidth

    if (activeState.col.fixed || !isInFixedArea) {
      ctx.strokeStyle = '#3366ff'
      ctx.lineWidth = 2
      roundedRect(ctx, activeState.x, activeState.y, activeState.width, activeState.height, 2)
      ctx.lineWidth = 1
      return
    }

    // For non-fixed columns in fixed area, render only the part that extends beyond fixed area
    if (isInFixedArea) {
      if (activeState.x + activeState.width <= fixedWidth) {
        return
      }

      const adjustedState = {
        ...activeState,
        x: fixedWidth,
        width: activeState.width - (fixedWidth - activeState.x),
      }

      ctx.strokeStyle = '#3366ff'
      ctx.lineWidth = 2
      // add extra 1px offset to x, since there is an additional border separating fixed and non-fixed columns
      roundedRect(ctx, adjustedState.x + 1, adjustedState.y, adjustedState.width, adjustedState.height, 2)
      ctx.lineWidth = 1
    }
  }

  const calculateXPosition = (colIndex: number) => {
    let xPos = 0
    for (let i = 0; i < colIndex; i++) {
      xPos += parseCellWidth(columns.value[i]?.width)
    }
    // add additional 1 px if the column is non-fixed since there is a border between fixed and non-fixed columns
    return xPos + (columns.value[colIndex]?.fixed ? 0 : 1)
  }

  const calculateSelectionWidth = (startCol: number, endCol: number) => {
    let width = 0
    let includeNonFixed = false
    let isIncludeFixed = false
    for (let i = startCol; i <= endCol; i++) {
      width += parseCellWidth(columns.value[i]?.width)
      includeNonFixed = includeNonFixed || !columns.value[i]!.fixed
      isIncludeFixed = isIncludeFixed || columns.value[i]!.fixed
    }
    // add additional 1 px if the columns include both fixed and non-fixed columns
    return width + (includeNonFixed && isIncludeFixed ? 1 : 0)
  }

  const renderFillHandle = (ctx: CanvasRenderingContext2D) => {
    const fillHandler = getFillHandlerPosition()
    if (!fillHandler) return true

    let fixedWidth = 0
    for (const col of columns.value) {
      if (!col.fixed) continue
      fixedWidth += parseCellWidth(col.width)
    }

    const isInFixedColumn = fillHandler.x <= fixedWidth

    // Don't render if the handle is in fixed column area but the column itself isn't fixed
    if (isInFixedColumn && !fillHandler.fixedCol) {
      return false
    }

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

    ctx.fillStyle = isAiFillMode.value ? '#9751d7' : '#ff4a3f'
    ctx.beginPath()
    ctx.arc(fillHandler.x + (fillHandler.fixedCol ? 0 : 1), fillHandler.y, fillHandler.size / 2, 0, Math.PI * 2)
    ctx.fill()

    // check if the fill handle is hovered
    const isHovered =
      mousePosition &&
      mousePosition.x >= fillHandler.x - fillHandler.size / 2 &&
      mousePosition.x <= fillHandler.x + fillHandler.size / 2 &&
      mousePosition.y >= fillHandler.y - fillHandler.size / 2 &&
      mousePosition.y <= fillHandler.y + fillHandler.size / 2

    if (isHovered) {
      setCursor('crosshair')
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
    if (row.rowMeta.selected) ctx.fillStyle = '#F6F7FE'
    ctx.fillRect(xOffset, yOffset, width, rowHeight.value)

    let currentX = xOffset + 4

    const isChecked = row.rowMeta?.selected || vSelectedAllRecords.value
    const isDisabled = (!row.rowMeta.selected && selectedRows.value.length >= MAX_SELECTED_ROWS) || vSelectedAllRecords.value
    let isCheckboxRendered = false
    if (isChecked || (selectedRows.value.length && isHover)) {
      const isCheckboxHovered = isHover && mousePosition.x >= currentX && mousePosition.x <= currentX + 24 && !isDisabled
      if (!readOnly.value && (isChecked || isHover)) {
        renderCheckbox(
          ctx,
          currentX + 6,
          yOffset + (rowHeight.value - 16) / 2,
          isChecked,
          isDisabled,
          spriteLoader,
          isCheckboxHovered ? '#3366FF' : '#D9D9D9',
        )
        currentX += 30
        isCheckboxRendered = true
      }
    } else {
      if (!readOnly.value && isHover && isRowDraggingEnabled.value) {
        const isHovered = isBoxHovered(
          { x: currentX, y: yOffset + (rowHeight.value - 16) / 2, width: 24, height: 16 },
          mousePosition,
        )

        if (isHovered) {
          roundedRect(ctx, currentX, yOffset + (rowHeight.value - 20) / 2, 20, 20, 4, {
            backgroundColor: isHovered ? '#F4F4F5' : 'transparent',
          })
        }

        spriteLoader.renderIcon(ctx, {
          icon: 'ncDrag',
          size: 16,
          x: currentX + 2,
          y: yOffset + (rowHeight.value - 16) / 2,
          color: isHovered ? '#3265FF' : '#6B7280',
        })
        currentX += 24
      } else if (!isHover) {
        ctx.font = '500 12px Manrope'
        ctx.fillStyle = '#6B7280'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        const len = ctx.measureText(totalRows.value.toString()).width
        ctx.fillText((row.rowMeta.rowIndex! + 1).toString(), currentX + 8, yOffset + rowHeight.value / 2)
        currentX += Math.max(24, len + 16)
      } else {
        // add 6px padding to the left of the row meta column if the row number is not rendered
        currentX += 6
      }
    }

    if (isHover && !isCheckboxRendered) {
      if (!readOnly.value) {
        const isCheckboxHovered = isHover && mousePosition.x >= currentX && mousePosition.x <= currentX + 24 && !isDisabled
        renderCheckbox(
          ctx,
          currentX,
          yOffset + (rowHeight.value - 16) / 2,
          isChecked,
          isDisabled,
          spriteLoader,
          isCheckboxHovered ? '#3366FF' : '#D9D9D9',
        )
        currentX += 24
      }
    }

    ctx.font = '500 12px Manrope'
    ctx.fillStyle = '#6B7280'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    if (row.rowMeta?.commentCount) {
      const commentCount = row.rowMeta.commentCount.toString()

      ctx.font = '600 12px Manrope'
      const textMetrics = ctx.measureText(commentCount)

      const maxX = ROW_META_COLUMN_WIDTH

      if (maxX - currentX < textMetrics.width + 8) {
        currentX = maxX - textMetrics.width - 8
      }

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
      const box = { x: currentX, y: yOffset + (rowHeight.value - 14) / 2, height: 14, width: 14 }
      if (!isBoxHovered(box, mousePosition)) {
        spriteLoader.renderIcon(ctx, {
          icon: 'maximize',
          size: 14,
          x: currentX,
          y: yOffset + (rowHeight.value - 14) / 2,
          color: '#6B7280',
        })
      } else {
        renderIconButton(ctx, {
          buttonX: box.x - 2,
          buttonY: box.y - 2,
          buttonSize: 18,
          icon: 'maximize',
          iconData: {
            size: 14,
            xOffset: 2,
            yOffset: 2,
          },
          borderRadius: 4,
          spriteLoader,
        })
      }
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
      initialXOffset += parseCellWidth(columns.value[i]?.width)
    }

    const renderRedBorders: {
      rowIndex: number
      column: CanvasGridColumn
    }[] = []

    const adjustedWidth =
      totalWidth.value - scrollLeft.value - 256 < width.value ? totalWidth.value - scrollLeft.value - 256 : width.value

    let warningRow: { row: Row; yOffset: number } | null = null

    for (let rowIdx = startRowIndex; rowIdx < endRowIndex; rowIdx++) {
      if (yOffset + rowHeight.value > 0 && yOffset < height.value) {
        let row = cachedRows.value.get(rowIdx)

        if (rowIdx === draggedRowIndex.value) {
          ctx.globalAlpha = 0.5
        }

        ctx.fillStyle = hoverRow.value === rowIdx ? '#F9F9FA' : '#ffffff'
        ctx.fillRect(0, yOffset, adjustedWidth, rowHeight.value)
        if (row) {
          const pk = extractPkFromRow(row.row, meta.value?.columns ?? [])

          let xOffset = initialXOffset

          visibleCols.forEach((column, colIdx) => {
            const width = parseCellWidth(column.width)
            const absoluteColIdx = startColIndex + colIdx

            const isCellEditEnabled =
              editEnabled.value && activeCell.value.row === rowIdx && activeCell.value.column === absoluteColIdx

            if (column.fixed) {
              xOffset += width
              return
            }

            if (row.rowMeta.selected || selection.value.isCellInRange({ row: rowIdx, col: absoluteColIdx })) {
              ctx.fillStyle = '#F6F7FE'
              ctx.fillRect(xOffset - scrollLeft.value, yOffset, width, rowHeight.value)
            }

            ctx.strokeStyle = '#f4f4f5'
            ctx.beginPath()
            ctx.moveTo(xOffset - scrollLeft.value, yOffset)
            ctx.lineTo(xOffset - scrollLeft.value, yOffset + rowHeight.value)
            ctx.stroke()

            // add white background color for active cell
            if (startColIndex + colIdx === activeCell.value.column && rowIdx === activeCell.value.row) {
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(xOffset - scrollLeft.value, yOffset, width, rowHeight.value)
            }

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

            if (isColumnRequiredAndNull(column.columnObj, row.row)) {
              renderRedBorders.push({ rowIndex: rowIdx, column })
            }

            ctx.save()
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
              readonly: column.readonly,
              imageLoader,
              tableMetaLoader,
              relatedColObj: column.relatedColObj,
              relatedTableMeta: column.relatedTableMeta,
              disabled: column?.isInvalidColumn,
              mousePosition,
              pk,
              skipRender: isCellEditEnabled,
            })
            ctx.restore()
            xOffset += width
          })

          const fixedCols = columns.value.filter((col) => col.fixed)
          if (fixedCols.length) {
            xOffset = 0

            fixedCols.forEach((column) => {
              const width = parseCellWidth(column.width)

              const colIdx = columns.value.findIndex((col) => col.id === column.id)

              const isCellEditEnabled = editEnabled.value && activeCell.value.row === rowIdx && activeCell.value.column === colIdx

              if (row.rowMeta.selected || selection.value.isCellInRange({ row: rowIdx, col: colIdx })) {
                ctx.fillStyle = '#F6F7FE'
                ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
              } else {
                ctx.fillStyle = hoverRow.value === rowIdx ? '#F9F9FA' : '#ffffff'
                ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
              }

              // add white background color for active cell
              // For Fixed columns, do not need to add startColIndex
              if (colIdx === activeCell.value.column && rowIdx === activeCell.value.row) {
                ctx.fillStyle = '#FFFFFF'
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
                ctx.save()
                if (isColumnRequiredAndNull(column.columnObj, row.row)) {
                  renderRedBorders.push({ rowIndex: rowIdx, column })
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
                  readonly: column.readonly,
                  spriteLoader,
                  imageLoader,
                  tableMetaLoader,
                  relatedColObj: column.relatedColObj,
                  relatedTableMeta: column.relatedTableMeta,
                  mousePosition,
                  disabled: column?.isInvalidColumn,
                  pk,
                  skipRender: isCellEditEnabled,
                })
                ctx.restore()
              }

              ctx.strokeStyle = '#f4f4f5'
              ctx.beginPath()

              ctx.moveTo(xOffset, yOffset)
              ctx.lineTo(xOffset, yOffset + rowHeight.value)
              ctx.stroke()

              xOffset += width
            })

            if (scrollLeft.value) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.04)'
              ctx.rect(xOffset, yOffset, 4, rowHeight.value)
              ctx.fill()
              ctx.strokeStyle = '#D5D5D9'
              ctx.beginPath()
              ctx.moveTo(xOffset, yOffset)
              ctx.lineTo(xOffset, yOffset + rowHeight.value)
              ctx.stroke()
            }

            if (!visibleCols.filter((f) => !f.fixed).length) {
              ctx.strokeStyle = '#f4f4f5'
              ctx.beginPath()
              ctx.moveTo(xOffset, yOffset)
              ctx.lineTo(xOffset, yOffset + rowHeight.value)
              ctx.stroke()
            }

            ctx.fillStyle = 'transparent'
            ctx.strokeStyle = 'white'
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 0
          }
        } else {
          row = {
            row: {},
            rowMeta: {
              rowIndex: rowIdx,
              selected: false,
              commentCount: 0,
            },
            oldRow: {},
          }
          let xOffset = initialXOffset

          visibleCols.forEach((column, colIdx) => {
            const width = parseCellWidth(column.width)
            const absoluteColIdx = startColIndex + colIdx

            if (column.fixed) {
              xOffset += width
              return
            }

            if (selection.value.isCellInRange({ row: rowIdx, col: absoluteColIdx })) {
              ctx.fillStyle = '#F6F7FE'
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
            xOffset += width
          })

          const fixedCols = columns.value.filter((col) => col.fixed)
          if (fixedCols.length) {
            xOffset = 0

            fixedCols.forEach((column) => {
              const width = parseCellWidth(column.width)

              const colIdx = columns.value.findIndex((col) => col.id === column.id)
              if (selection.value.isCellInRange({ row: rowIdx, col: colIdx })) {
                ctx.fillStyle = '#F6F7FE'
                ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
              } else {
                ctx.fillStyle = hoverRow.value === rowIdx ? '#F9F9FA' : '#ffffff'
                ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
              }

              if (column.id === 'row_number') {
                renderRowMeta(ctx, row!, { xOffset, yOffset, width })
              } else {
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
                drawShimmerEffect(ctx, xOffset, yOffset, width, rowIdx)
              }

              ctx.strokeStyle = '#f4f4f5'
              ctx.beginPath()

              ctx.moveTo(xOffset, yOffset)
              ctx.lineTo(xOffset, yOffset + rowHeight.value)
              ctx.stroke()

              xOffset += width
            })

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
        }

        if (rowIdx === draggedRowIndex.value) {
          ctx.globalAlpha = 1
        }

        // Bottom border for each row
        ctx.strokeStyle = '#e7e7e9'
        ctx.beginPath()
        ctx.moveTo(0, yOffset + rowHeight.value)
        ctx.lineTo(adjustedWidth, yOffset + rowHeight.value)
        ctx.stroke()

        if (row?.rowMeta.isValidationFailed || row?.rowMeta.isRowOrderUpdated) {
          warningRow = { row, yOffset }
        }

        yOffset += rowHeight.value
      }
    }

    // Add New Row
    if (isAddingEmptyRowAllowed.value && !isMobileMode.value) {
      const isNewRowHovered = isBoxHovered(
        {
          x: 0,
          y: yOffset,
          height: COLUMN_HEADER_HEIGHT_IN_PX,
          width: adjustedWidth,
        },
        mousePosition,
      )
      ctx.fillStyle = isNewRowHovered ? '#F9F9FA' : '#ffffff'
      ctx.fillRect(0, yOffset, adjustedWidth, COLUMN_HEADER_HEIGHT_IN_PX)
      // Bottom border for new row
      ctx.strokeStyle = '#f4f4f5'
      ctx.beginPath()
      ctx.moveTo(0, yOffset + COLUMN_HEADER_HEIGHT_IN_PX)
      ctx.lineTo(adjustedWidth, yOffset + COLUMN_HEADER_HEIGHT_IN_PX)
      ctx.stroke()

      spriteLoader.renderIcon(ctx, {
        icon: 'ncPlus',
        color: isNewRowHovered ? '#000000' : '#4a5268',
        x: 16,
        y: yOffset + 9,
        size: 14,
      })
    }

    if (warningRow) {
      const orange = '#fcbe3a'
      // Warning top border
      ctx.strokeStyle = 'orange'
      ctx.beginPath()
      ctx.moveTo(0, warningRow.yOffset - 2)
      ctx.lineTo(adjustedWidth, warningRow.yOffset)
      ctx.lineWidth = 2
      ctx.stroke()

      // Warning bottom border
      ctx.strokeStyle = 'orange'
      ctx.beginPath()
      ctx.moveTo(0, warningRow.yOffset + rowHeight.value)
      ctx.lineTo(adjustedWidth, warningRow.yOffset + rowHeight.value)
      ctx.lineWidth = 2
      ctx.stroke()

      roundedRect(ctx, 0, warningRow.yOffset + rowHeight.value, 90, 25, { bottomRight: 6 }, { backgroundColor: orange })
      renderSingleLineText(ctx, {
        text: warningRow.row.rowMeta.isValidationFailed ? 'Row filtered' : 'Row moved',
        x: 10,
        y: warningRow.yOffset + rowHeight.value,
        py: 7,
        fillStyle: '#1f293a',
        fontSize: 12,
        fontFamily: '600 12px Manrope',
      })
    }
    renderActiveState(ctx, activeState)

    for (const { rowIndex, column } of renderRedBorders) {
      if (editEnabled.value?.column?.id === column.id && editEnabled.value?.rowIndex === rowIndex) continue
      const yOffset = -partialRowHeight.value + 33 + (rowIndex - rowSlice.value.start) * rowHeight.value
      const xOffset = calculateXPosition(columns.value.findIndex((c) => c.id === column.id))
      const width = parseCellWidth(column.width)

      const fixedWidth = columns.value.filter((col) => col.fixed).reduce((sum, col) => sum + parseCellWidth(col.width), 1)

      const isInFixedArea = xOffset - scrollLeft.value <= fixedWidth

      ctx.strokeStyle = '#ff4a3f'
      ctx.lineWidth = 2
      if (column.fixed || !isInFixedArea) {
        roundedRect(ctx, column.fixed ? xOffset : xOffset - scrollLeft.value, yOffset, width, rowHeight.value, 2)
      } else if (isInFixedArea) {
        if (xOffset + width <= fixedWidth) {
          continue
        }

        const adjustedX = fixedWidth
        const adjustedWidth = xOffset + width - fixedWidth - scrollLeft.value

        roundedRect(ctx, adjustedX + 1, yOffset, adjustedWidth, rowHeight.value, 2)
      }

      ctx.lineWidth = 1
    }
    renderFillHandle(ctx)

    return activeState
  }

  const renderColumnDragIndicator = (ctx: CanvasRenderingContext2D) => {
    if (!dragOver.value) return

    let xPosition = 0
    for (let i = 0; i < dragOver.value.index; i++) {
      xPosition += parseCellWidth(columns.value[i]?.width)
    }

    const width = parseCellWidth(columns.value[dragOver.value.index - 1]?.width)

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
      initialOffset += parseCellWidth(columns.value[i]?.width)
    }

    const visibleCols = columns.value.slice(startColIndex, endColIndex)
    let xOffset = initialOffset

    visibleCols.forEach((column) => {
      const width = parseCellWidth(column.width)

      if (column.fixed) {
        xOffset += width
        return
      }

      const isHovered = isBoxHovered(
        {
          x: xOffset - scrollLeft.value,
          y: height.value - AGGREGATION_HEIGHT,
          width,
          height: AGGREGATION_HEIGHT,
        },
        mousePosition,
      )
      ctx.fillStyle = isHovered ? '#F4F4F5' : '#F9F9FA'
      if (column.agg_fn && ![AllAggregations.None].includes(column.agg_fn as any)) {
        ctx.save()
        ctx.beginPath()

        ctx.rect(xOffset - scrollLeft.value, height.value - AGGREGATION_HEIGHT, width, AGGREGATION_HEIGHT)
        ctx.fill()
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
      } else if (isHovered) {
        ctx.save()
        ctx.beginPath()

        ctx.rect(xOffset - scrollLeft.value, height.value - AGGREGATION_HEIGHT, width, AGGREGATION_HEIGHT)
        ctx.fill()
        ctx.clip()

        ctx.font = '600 10px Manrope'
        ctx.fillStyle = '#6a7184'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'

        const rightEdge = xOffset + width - 8 - scrollLeft.value
        const textY = height.value - AGGREGATION_HEIGHT / 2

        ctx.fillText('Summary', rightEdge, textY)

        const textLen = ctx.measureText('Summary').width

        spriteLoader.renderIcon(ctx, {
          icon: 'chevronDown',
          size: 14,
          color: '#6a7184',
          x: rightEdge - textLen - 18,
          y: textY - 7,
        })
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
        const mergedWidth = parseCellWidth(rowNumberCol.width) + parseCellWidth(firstFixedCol.width)

        const isHovered = isBoxHovered(
          {
            x: xOffset,
            y: height.value - AGGREGATION_HEIGHT,
            width: mergedWidth,
            height: AGGREGATION_HEIGHT,
          },
          mousePosition,
        )

        ctx.fillStyle = isHovered ? '#F4F4F5' : '#F9F9FA'
        ctx.fillRect(xOffset, height.value - AGGREGATION_HEIGHT, mergedWidth, AGGREGATION_HEIGHT)

        ctx.fillStyle = '#6a7184'
        ctx.textBaseline = 'middle'
        let availWidth = mergedWidth - 16

        if (firstFixedCol.agg_fn && ![AllAggregations.None].includes(firstFixedCol.agg_fn as any)) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(xOffset, height.value - AGGREGATION_HEIGHT, mergedWidth, AGGREGATION_HEIGHT)
          ctx.clip()

          ctx.textAlign = 'right'

          ctx.font = '600 12px Manrope'
          const aggWidth = ctx.measureText(firstFixedCol.aggregation).width

          if (firstFixedCol.agg_prefix) {
            ctx.font = '400 12px Manrope'
            ctx.fillStyle = '#6a7184'
            ctx.fillText(firstFixedCol.agg_prefix, mergedWidth - aggWidth - 16, height.value - AGGREGATION_HEIGHT / 2)
            const w = ctx.measureText(firstFixedCol.agg_prefix).width
            availWidth -= w
          }

          ctx.font = '600 12px Manrope'
          ctx.fillStyle = '#4a5268'
          ctx.fillText(firstFixedCol.aggregation, mergedWidth - 8, height.value - AGGREGATION_HEIGHT / 2)

          const w = ctx.measureText(firstFixedCol.aggregation).width
          availWidth -= w
          ctx.restore()
        } else if (isHovered) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(xOffset, height.value - AGGREGATION_HEIGHT, mergedWidth, AGGREGATION_HEIGHT)
          ctx.clip()

          ctx.font = '600 10px Manrope'
          ctx.textAlign = 'right'

          const rightEdge = xOffset + mergedWidth - 8
          const textY = height.value - AGGREGATION_HEIGHT / 2

          ctx.fillText('Summary', rightEdge, textY)

          const textLen = ctx.measureText('Summary').width

          availWidth -= textLen

          spriteLoader.renderIcon(ctx, {
            icon: 'chevronDown',
            size: 14,
            color: '#6a7184',
            x: rightEdge - textLen - 18,
            y: textY - 7,
          })

          availWidth -= 18
          ctx.restore()
        }

        renderSingleLineText(ctx, {
          text: `${Intl.NumberFormat('en', { notation: 'compact' }).format(totalRows.value)} ${
            totalRows.value !== 1 ? t('objects.records') : t('objects.record')
          }`,
          x: xOffset + 8,
          y: height.value - AGGREGATION_HEIGHT + 2,
          fillStyle: '#6a7184',
          textAlign: 'left',
          fontSize: 12,
          maxWidth: availWidth - 16,
          fontFamily: '500 12px Manrope',
        })
        //  Not exactly sure, but height.value becomes zero, randomly when scroll
        if (height.value) {
          tryShowTooltip({
            mousePosition,
            text: `${totalRows.value} ${totalRows.value !== 1 ? t('objects.records') : t('objects.record')}`,
            rect: {
              x: xOffset,
              y: height.value - AGGREGATION_HEIGHT,
              width: availWidth - 16,
              height: AGGREGATION_HEIGHT,
            },
          })
        }

        ctx.strokeStyle = '#e7e7e9'
        ctx.beginPath()
        ctx.moveTo(xOffset, height.value - AGGREGATION_HEIGHT)
        ctx.lineTo(xOffset, height.value)
        ctx.stroke()

        xOffset += mergedWidth

        fixedCols.slice(2).forEach((column) => {
          const width = parseCellWidth(column.width)

          const isHovered = isBoxHovered(
            {
              x: xOffset,
              y: height.value - AGGREGATION_HEIGHT,
              width,
              height: AGGREGATION_HEIGHT,
            },
            mousePosition,
          )

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
          } else if (isHovered) {
            ctx.save()
            ctx.beginPath()
            ctx.rect(xOffset, height.value - AGGREGATION_HEIGHT, width, AGGREGATION_HEIGHT)
            ctx.clip()

            ctx.font = '600 10px Manrope'
            ctx.fillStyle = '#6a7184'
            ctx.textAlign = 'right'
            ctx.textBaseline = 'middle'

            const rightEdge = xOffset + width - 8
            const textY = height.value - AGGREGATION_HEIGHT / 2

            ctx.fillText('Summary', rightEdge, textY)

            const textLen = ctx.measureText('Summary').width

            spriteLoader.renderIcon(ctx, {
              icon: 'chevronDown',
              size: 14,
              color: '#6a7184',
              x: rightEdge - textLen - 18,
              y: textY - 7,
            })
            ctx.restore()
          }

          ctx.strokeStyle = '#e7e7e9'
          ctx.beginPath()
          ctx.moveTo(xOffset, height.value - AGGREGATION_HEIGHT)
          ctx.lineTo(xOffset, height.value)
          ctx.stroke()

          xOffset += width
        })

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

  const renderRowDragPreview = (ctx: CanvasRenderingContext2D) => {
    if (!isDragging.value || draggedRowIndex.value === null || targetRowIndex.value === null) return

    const targetRowLine = (targetRowIndex.value - rowSlice.value.start) * rowHeight.value - partialRowHeight.value + 32
    // First render the blue line indicator
    ctx.strokeStyle = '#3366ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, targetRowLine)
    ctx.lineTo(ctx.canvas.width, targetRowLine)
    ctx.stroke()

    // Then render the preview row
    ctx.save()

    const targetY = mousePosition.y

    const previewWidth = 500
    const xPos = mousePosition.x

    // Apply tilt transform
    ctx.translate(xPos + previewWidth / 2, targetY)
    ctx.rotate((0.5 * Math.PI) / 180)
    ctx.translate(-(xPos + previewWidth / 2), -targetY)

    ctx.beginPath()
    ctx.roundRect(xPos, targetY - rowHeight.value / 2, previewWidth, rowHeight.value, 6)
    ctx.clip()

    ctx.shadowColor = 'rgba(0, 0, 0, 0.10)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 12
    ctx.shadowOffsetX = 0

    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 4

    ctx.fillStyle = '#ffffff'
    ctx.fill()

    ctx.restore()

    ctx.strokeStyle = '#D5D5D9'
    ctx.lineWidth = 1
    ctx.stroke()

    const row = cachedRows.value.get(draggedRowIndex.value)
    if (row) {
      let xOffset = xPos
      columns.value.forEach((column) => {
        const width = parseCellWidth(column.width)
        if (xOffset - xPos < previewWidth) {
          ctx.save()
          renderCell(ctx, column.columnObj, {
            value: row.row[column.title],
            x: xOffset,
            y: targetY - rowHeight.value / 2,
            width: Math.min(width, previewWidth - (xOffset - xPos)),
            height: rowHeight.value,
            row: row.row,
            selected: false,
            readonly: true,
            pv: column.pv,
            spriteLoader,
            imageLoader,
            relatedColObj: column.relatedColObj,
            relatedTableMeta: column.relatedTableMeta,
            disabled: column?.isInvalidColumn,
            mousePosition: { x: -1, y: -1 },
            pk: extractPkFromRow(row.row, meta.value?.columns ?? []),
          })
          ctx.restore()
        }
        xOffset += width
      })
    }

    ctx.restore()
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

    const activeState = renderRows(ctx)
    renderHeader(ctx, activeState)
    renderColumnDragIndicator(ctx)
    renderRowDragPreview(ctx)
    renderAggregations(ctx)
  }

  return {
    canvasRef,
    renderActiveState,
    renderCanvas,
    colResizeHoveredColIds,
  }
}
