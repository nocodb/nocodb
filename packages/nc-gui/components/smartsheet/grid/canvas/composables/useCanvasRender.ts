import type { WritableComputedRef } from '@vue/reactivity'
import { AllAggregations, type ColumnType, type TableType, UITypes, isCreatedOrLastModifiedByCol } from 'nocodb-sdk'
import type { Composer } from 'vue-i18n'
import tinycolor from 'tinycolor2'
import {
  isBoxHovered,
  renderCheckbox,
  renderIconButton,
  renderMultiLineText,
  renderSingleLineText,
  renderTag,
  renderTagLabel,
  roundedRect,
  truncateText,
} from '../utils/canvas'
import type { ImageWindowLoader } from '../loaders/ImageLoader'
import type { SpriteLoader } from '../loaders/SpriteLoader'
import { renderIcon } from '../../../header/CellIcon'
import { renderIcon as renderVIcon } from '../../../header/VirtualCellIcon'
import type { TableMetaLoader } from '../loaders/TableMetaLoader'
import {
  ADD_NEW_COLUMN_WIDTH,
  AGGREGATION_HEIGHT,
  COLUMN_HEADER_HEIGHT_IN_PX,
  GROUP_EXPANDED_BOTTOM_PADDING,
  GROUP_HEADER_HEIGHT,
  GROUP_PADDING,
  MAX_SELECTED_ROWS,
  ROW_META_COLUMN_WIDTH,
} from '../utils/constants'
import { parseCellWidth } from '../utils/cell'
import {
  calculateGroupHeight,
  calculateGroupRange,
  calculateGroupRowTop,
  comparePath,
  generateGroupPath,
  getGroupColors,
} from '../utils/groupby'
import { parseKey } from '../../../../../utils/groupbyUtils'
import type { CanvasElement } from '../utils/CanvasElement'
import { ElementTypes } from '../utils/CanvasElement'
import type { RenderTagProps } from '../utils/types'

export function useCanvasRender({
  width,
  height,
  columns,
  colSlice,
  cachedGroups,
  scrollLeft,
  scrollTop,
  rowSlice,
  rowHeight,
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
  actualTotalRows,
  t,
  readOnly,
  isFieldEditAllowed,
  setCursor,
  totalColumnsWidth,
  groupByColumns,
  totalGroups,
  isGroupBy,
  baseColor,
  fetchMissingGroupChunks,
  elementMap,
  getDataCache,
  getRows,
  draggedRowGroupPath,
  removeInlineAddRecord,
  upgradeModalInlineState,
}: {
  width: Ref<number>
  height: Ref<number>
  rowHeight: Ref<number>
  columns: ComputedRef<CanvasGridColumn[]>
  colSlice: Ref<{ start: number; end: number }>
  rowSlice: Ref<{ start: number; end: number }>
  activeCell: Ref<{
    row?: number
    column?: number
    path?: Array<number>
  }>
  scrollLeft: Ref<number>
  scrollTop: Ref<number>
  cachedGroups: Ref<Map<number, CanvasGroup>>
  dragOver: Ref<{ id: string; index: number } | null>
  hoverRow: Ref<{
    path?: Array<number> | null
    rowIndex: number
  }>
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
  actualTotalRows: Ref<number>
  totalGroups: Ref<number>
  t: Composer['t']
  readOnly: Ref<boolean>
  isFillHandleDisabled: ComputedRef<boolean>
  isFieldEditAllowed: ComputedRef<boolean>
  isDataEditAllowed: ComputedRef<boolean>
  setCursor: SetCursorType
  totalColumnsWidth: ComputedRef<number>
  groupByColumns: ComputedRef<
    {
      column: ColumnType
      sort: string
      order?: number
    }[]
  >
  isGroupBy: ComputedRef<boolean>
  baseColor: Ref<string>
  fetchMissingGroupChunks: (startIndex: number, endIndex: number, canvasGroup?: CanvasGroup) => Promise<void>
  elementMap: CanvasElement
  getDataCache: (path?: Array<number>) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }
  getRows: (start: number, end: number, path?: Array<number>) => Promise<Row[]>
  draggedRowGroupPath: Ref<number[]>
  removeInlineAddRecord: Ref<boolean>
  upgradeModalInlineState: Ref<{
    isHoveredLearnMore: boolean
    isHoveredUpgrade: boolean
  }>
}) {
  const canvasRef = ref<HTMLCanvasElement>()
  const colResizeHoveredColIds = ref(new Set())
  const { tryShowTooltip } = useTooltipStore()
  const { isMobileMode, isAddNewRecordGridMode, appInfo } = useGlobal()
  const { isWsOwner } = useEeConfig()
  const { isColumnSortedOrFiltered, appearanceConfig: filteredOrSortedAppearanceConfig } = useColumnFilteredOrSorted()
  const isLocked = inject(IsLockedInj, ref(false))

  const fixedCols = computed(() => columns.value.filter((c) => c.fixed))

  const fixedColsWidth = computed(() => fixedCols.value.reduce((sum, col) => sum + parseCellWidth(col.width), 1))

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
      totalColumnsWidth.value +
      (!isAddingColumnAllowed.value && isGroupBy.value
        ? groupByColumns?.value?.length * 13 + (groupByColumns?.value?.length - 1) * 13
        : 0) +
      (isAddingColumnAllowed.value && !isMobileMode.value ? plusColumnWidth : 0) -
      scrollLeft.value

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

    // Hack for now
    if (initialOffset === 1) {
      initialOffset = 0
    }

    // Regular columns
    ctx.fillStyle = '#6a7184'
    ctx.font = '550 12px Inter'
    ctx.textBaseline = 'middle'
    ctx.imageSmoothingEnabled = false

    let xOffset = initialOffset

    for (const column of visibleCols) {
      const colObj = column.columnObj

      const isLastCol = column.id === columns.value?.[columns.value.length - 1]?.id

      const width =
        parseCellWidth(column.width) +
        (isLastCol && !isAddingColumnAllowed.value && isGroupBy.value ? (groupByColumns.value?.length - 1) * 13 - 1 : 0)

      if (column.fixed) {
        xOffset += width
        ctx.beginPath()
        ctx.moveTo(xOffset - scrollLeft.value, 0)
        ctx.lineTo(xOffset - scrollLeft.value, 32)
        ctx.stroke()
        continue
      }

      if (colObj?.id) {
        const columnState = isColumnSortedOrFiltered(colObj.id)

        if (columnState) {
          renderTag(ctx, {
            height: 31.5,
            width,
            x: xOffset - scrollLeft.value,
            y: 0,
            radius: 0,
            fillStyle: '#ffffff88',
          })
          renderTag(ctx, {
            height: 32,
            width,
            x: xOffset - scrollLeft.value,
            y: 0,
            radius: 0,
            fillStyle: filteredOrSortedAppearanceConfig[columnState].headerBgColor,
          })
        }
      }

      ctx.fillStyle = '#6a7184'

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

      const isRequired = column.virtual ? isVirtualColRequired(colObj, meta.value?.columns || []) : colObj?.rqd && !colObj?.cdf

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

      if (isFieldEditAllowed.value && !colObj?.readonly) {
        rightOffset -= 16
        spriteLoader.renderIcon(ctx, {
          icon: 'chevronDown',
          size: 14,
          color: '#6a7184',
          x: rightOffset - scrollLeft.value,
          y: 9,
        })
      } else if (meta.value?.synced && colObj?.readonly) {
        rightOffset -= 16
        spriteLoader.renderIcon(ctx, {
          icon: 'refresh',
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

      if (isNearEdge && !isLocked.value) {
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

    if (!isGroupBy.value) {
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
        // To avoid rendering the line inside fixed columns, set the xOffset to the right of fixed columns if xOffset is less than fixedColsWidth
        const verticalLineXOffset = Math.max(fixedColsWidth.value, xOffset - scrollLeft.value)
        ctx.strokeStyle = '#f4f4f5'
        ctx.beginPath()
        ctx.moveTo(verticalLineXOffset, 32)
        ctx.lineTo(
          verticalLineXOffset,
          (rowSlice.value.end - rowSlice.value.start + 1) * rowHeight.value + 33 - partialRowHeight.value,
        )
        ctx.stroke()
      }
    }

    // Fixed columns
    if (fixedCols.value.length) {
      xOffset = 0.5

      fixedCols.value.forEach((column) => {
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

        if (column.columnObj?.id) {
          const columnState = isColumnSortedOrFiltered(column.columnObj.id)

          if (columnState) {
            renderTag(ctx, {
              height: 31.5,
              width,
              x: xOffset,
              y: 0,
              radius: 0,
              fillStyle: '#ffffff88',
            })

            renderTag(ctx, {
              height: 32,
              width,
              x: xOffset,
              y: 0,
              radius: 0,
              fillStyle: filteredOrSortedAppearanceConfig[columnState].headerBgColor,
            })
          }
        }

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

        const isRequired = column.virtual ? isVirtualColRequired(colObj, meta.value?.columns || []) : colObj?.rqd && !colObj?.cdf

        const availableTextWidth = width - (26 + iconSpace + (isRequired ? 4 : 0))

        const truncatedText = truncateText(ctx, column.title!, availableTextWidth)
        const x = xOffset + (column.uidt ? 26 : 10)
        const y = 16

        if (column.id === 'row_number') {
          if (
            !readOnly.value &&
            (vSelectedAllRecords.value || isBoxHovered({ x: 0, y: 0, width: canvasWidth, height: 32 }, mousePosition)) &&
            !isGroupBy.value
          ) {
            const checkSize = 16
            const checkboxX = x + (isRowDraggingEnabled.value ? 26 - 6 : 0)
            const isCheckboxHovered = isBoxHovered({ x: checkboxX, y: y - 8, width: checkSize, height: checkSize }, mousePosition)
            renderCheckbox(
              ctx,
              checkboxX,
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

        if (column.uidt && isFieldEditAllowed.value && !colObj?.readonly) {
          // Chevron down
          rightOffset -= 16
          spriteLoader.renderIcon(ctx, {
            icon: 'chevronDown',
            size: 14,
            color: '#6a7184',
            x: rightOffset,
            y: 9,
          })
        } else if (meta.value?.synced && colObj?.readonly) {
          rightOffset -= 16
          spriteLoader.renderIcon(ctx, {
            icon: 'refresh',
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

        if (isNearEdge && column.id !== 'row_number' && !isLocked.value) {
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
        ctx.lineWidth = 1
        ctx.moveTo(xOffset, 0)
        ctx.lineTo(xOffset, isGroupBy.value ? height.value : 32)
        ctx.stroke()

        ctx.fillStyle = 'rgba(0, 0, 0, 0.04)'
        ctx.rect(xOffset, 0, 4, isGroupBy.value ? height.value : 32)
        ctx.fill()
      } else {
        ctx.strokeStyle = '#E7E7E9'
        ctx.beginPath()
        ctx.lineWidth = 1
        ctx.moveTo(xOffset, 0)
        ctx.lineTo(xOffset, isGroupBy.value ? height.value : 32)
        ctx.stroke()
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
      roundedRect(ctx, activeState.x, activeState.y, activeState.width, activeState.height, 2, {
        borderColor: '#3366ff',
        borderWidth: 2,
      })
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
      // add extra 1px offset to x, since there is an additional border separating fixed and non-fixed columns
      roundedRect(ctx, adjustedState.x + 1, adjustedState.y, adjustedState.width, adjustedState.height, 2, {
        borderColor: '#3366ff',
        borderWidth: 2,
      })
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
    const groupPath = activeCell?.value.path

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
      const startY =
        calculateGroupRowTop(
          cachedGroups.value,
          groupPath,
          selection.value.start.row,
          rowHeight.value,
          isAddingEmptyRowAllowed.value,
        ) -
        scrollTop.value +
        COLUMN_HEADER_HEIGHT_IN_PX

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
    const isHover = hoverRow.value?.rowIndex === row.rowMeta.rowIndex && comparePath(hoverRow.value?.path, row?.rowMeta?.path)
    const isChecked = row.rowMeta?.selected || vSelectedAllRecords.value
    const isRowCellSelected =
      activeCell.value.row === row.rowMeta.rowIndex && comparePath(activeCell.value.path, row?.rowMeta?.path)
    const isDisabled = (!row.rowMeta.selected && selectedRows.value.length >= MAX_SELECTED_ROWS) || vSelectedAllRecords.value

    ctx.fillStyle = isHover || isRowCellSelected ? '#F9F9FA' : '#ffffff'
    if (row.rowMeta.selected) ctx.fillStyle = '#F6F7FE'
    ctx.fillRect(xOffset, yOffset, width, rowHeight.value)

    let currentX = xOffset + 4

    /**
     * 1. Render row index
     */
    if (readOnly.value || !(isHover || isChecked || isRowCellSelected)) {
      let rowIndexFontSize = '13px'

      if (row.rowMeta.rowIndex! + 1 >= 1000) {
        rowIndexFontSize = '12px'
      }

      if (row.rowMeta.rowIndex! + 1 >= 10000) {
        rowIndexFontSize = '10px'
      }

      ctx.textBaseline = 'middle'

      const { width: rowIndexWidth } = renderSingleLineText(ctx, {
        x: currentX + 8,
        y: yOffset,
        text: (row.rowMeta.rowIndex! + 1).toString(),
        maxWidth: ROW_META_COLUMN_WIDTH - 28,
        fontFamily: `500 ${rowIndexFontSize} Inter`,
        isTagLabel: true,
        fillStyle: '#6B7280',
      })

      currentX += Math.max(24, rowIndexWidth + 16)
    } else if ((isHover || isChecked || isRowCellSelected) && isRowDraggingEnabled.value) {
      /**
       * 2. Render drag icon -
       * If not readonly & row dragging enabled & row is hovered/selected
       * Disable row drag icon if multple rows selected for now
       */

      const isHovered = isBoxHovered(
        { x: currentX, y: yOffset + (rowHeight.value - 16) / 2, width: 24, height: 16 },
        mousePosition,
      )

      if (isHovered && !selectedRows.value.length && !vSelectedAllRecords.value) {
        roundedRect(ctx, currentX, yOffset + (rowHeight.value - 24) / 2, 24, 24, 4, {
          backgroundColor: isHovered ? themeV3Colors.gray['200'] : 'transparent',
        })
      } else if (isHovered) {
        // For now we support on single row reorder if rows are not selected so we have to set cursor
        setCursor('not-allowed')
      }

      spriteLoader.renderIcon(ctx, {
        icon: 'ncDrag',
        size: 16,
        x: currentX + 4,
        y: yOffset + (rowHeight.value - 16) / 2,
        color:
          isHovered && !selectedRows.value.length && !vSelectedAllRecords.value
            ? '#3265FF'
            : selectedRows.value.length
            ? themeV3Colors.gray['400']
            : '#6B7280',
      })
      currentX += 26
    } else {
      // add 6px padding to the left of the row meta column if the row number is not rendered
      currentX += 6
    }

    /**
     * 3. Render checkbox
     */
    if (!readOnly.value && (isChecked || isHover || isRowCellSelected)) {
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

    /**
     * 4. Render comment or expand icon
     */
    if (row.rowMeta?.commentCount) {
      const reduceFontSize = row.rowMeta.commentCount > 99
      const commentCount = reduceFontSize ? '99+' : row.rowMeta.commentCount.toString()

      const bubbleHeight = 18
      const y = yOffset + (rowHeight.value - bubbleHeight) / 2

      const _renderSingleLineText = (xOffset: number, render: boolean = false) => {
        return renderSingleLineText(ctx, {
          x: xOffset,
          y,
          render,
          text: commentCount,
          maxWidth: ROW_META_COLUMN_WIDTH / 2,
          fontFamily: `${reduceFontSize ? '600 10px' : '500 13px'} Inter`,
          textAlign: 'center',
          isTagLabel: true,
          fillStyle: '#3366FF',
          height: bubbleHeight + 2,
        })
      }

      const { width: commentCountWidth } = _renderSingleLineText(xOffset + width / 2 - 4)

      const bubbleWidth = Math.max(20, commentCountWidth + (reduceFontSize ? 6 : 8))

      const x = xOffset + width - 4 - bubbleWidth

      const isExpandHovered = isBoxHovered(
        {
          x,
          y,
          width: bubbleWidth,
          height: bubbleHeight,
        },
        mousePosition,
      )

      roundedRect(
        ctx,
        x,
        y,
        bubbleWidth,
        bubbleHeight,
        {
          topLeft: 6,
          topRight: 6,
          bottomLeft: 0,
          bottomRight: 6,
        },
        {
          backgroundColor: isExpandHovered ? themeV3Colors.brand['100'] : '#F0F3FF',
          borderColor: themeV3Colors.brand['200'],
        },
      )

      _renderSingleLineText(x + bubbleWidth / 2, true)

      if (reduceFontSize) {
        tryShowTooltip({
          mousePosition,
          text: `${row.rowMeta.commentCount} comments`,
          rect: {
            x,
            y,
            width: bubbleWidth,
            height: bubbleHeight,
          },
        })
      }
    } else if (isHover || isRowCellSelected) {
      const box = { x: xOffset + width - 4 - 20, y: yOffset + (rowHeight.value - 20) / 2, height: 20, width: 20 }

      const isExpandHovered = isBoxHovered(box, mousePosition)
      renderIconButton(ctx, {
        buttonX: box.x,
        buttonY: box.y,
        buttonSize: 20,
        icon: 'maximize',
        iconData: {
          size: 14,
          xOffset: 3,
          yOffset: 3,
          color: isExpandHovered ? themeV3Colors.gray['600'] : themeV3Colors.gray['500'],
        },
        borderRadius: 6,
        spriteLoader,
        borderColor: !isExpandHovered ? 'transparent' : undefined,
        background: !isExpandHovered ? 'transparent' : undefined,
        setCursor,
      })
    }
  }

  const renderUpgradeModalInline = (ctx: CanvasRenderingContext2D, yOffset: number) => {
    if (!removeInlineAddRecord.value) return

    yOffset = yOffset + 120

    const { lines } = renderMultiLineText(ctx, {
      x: width.value / 2,
      y: yOffset,
      text: t('upgrade.upgradeToSeeMoreRecordInline'),
      maxWidth: Math.min(width.value, 520),
      fillStyle: '#101015',
      fontFamily: `700 16px Inter`,
      height: 100,
      lineHeight: 24,
      maxLines: 2,
      textAlign: 'center',
    })

    yOffset = yOffset + lines.length * 24 + 8

    const totalRecords = Math.max(totalRows.value, actualTotalRows.value ?? 0)

    const { lines: subtitleLines } = renderMultiLineText(ctx, {
      x: width.value / 2,
      y: yOffset,
      text: t('upgrade.upgradeToSeeMoreRecordInlineSubtitle', {
        limit: 100,
        total: totalRecords,
        remaining: totalRecords - 100,
      }),
      maxWidth: Math.min(width.value, 520),
      fillStyle: '#4A5268',
      fontFamily: `500 14px Inter`,
      height: 100,
      lineHeight: 20,
      maxLines: 4,
      textAlign: 'center',
    })

    yOffset = yOffset + subtitleLines.length * 20 + 20

    const renderLearnMoreBtn = (render = false, xOffset: number = width.value / 2) => {
      return renderSingleLineText(ctx, {
        x: xOffset + 10,
        y: yOffset,
        text: t('msg.learnMore'),
        maxWidth: 120,
        height: 32,
        verticalAlign: 'middle',
        fontFamily: '600 14px Inter',
        fillStyle: '#374151',
        isTagLabel: true,
        render,
      })
    }

    const renderUpgradeBtn = (render = false, xOffset: number = width.value / 2) => {
      return renderSingleLineText(ctx, {
        x: xOffset + 10,
        y: yOffset,
        text: isWsOwner.value ? t('general.upgrade') : t('general.requestUpgrade'),
        maxWidth: 120,
        height: 32,
        verticalAlign: 'middle',
        fontFamily: '600 14px Inter',
        fillStyle: 'white',
        isTagLabel: true,
        render,
      })
    }

    const learnMoreBtnInfo = renderLearnMoreBtn(false)

    const UpgradeBtnInfo = renderUpgradeBtn(false)

    /**
     * learn more button width + upgrade button width + gap
     */
    const buttonsWidth = learnMoreBtnInfo.width + 10 * 2 + UpgradeBtnInfo.width + 10 * 2 + 12

    const xOffSet = width.value / 2 - buttonsWidth / 2
    yOffset = yOffset + 20

    const isLearnMoreBtnHovered = isBoxHovered(
      { x: xOffSet, y: yOffset, width: learnMoreBtnInfo.width + 10 * 2, height: 32 },
      mousePosition,
    )

    const _renderTag = (params: Partial<RenderTagProps>) => {
      renderTag(ctx, {
        x: xOffSet,
        radius: 8,
        y: yOffset,
        height: 32,
        width: 100,
        ...params,
      })
    }

    _renderTag({
      x: xOffSet,
      width: learnMoreBtnInfo.width + 10 * 2,
      borderColor: '#E7E7E9',
      borderWidth: 1,
      fillStyle: isLearnMoreBtnHovered ? themeV3Colors.gray['100'] : 'white',
    })

    renderLearnMoreBtn(true, xOffSet)

    const isUpgradeBtnHovered = isBoxHovered(
      { x: xOffSet + learnMoreBtnInfo.width + 10 * 2 + 12, y: yOffset, width: UpgradeBtnInfo.width + 10 * 2, height: 32 },
      mousePosition,
    )

    _renderTag({
      x: xOffSet + learnMoreBtnInfo.width + 10 * 2 + 12,
      width: UpgradeBtnInfo.width + 10 * 2,
      fillStyle: isUpgradeBtnHovered ? themeV3Colors.brand['600'] : themeV3Colors.brand['500'],
    })

    renderUpgradeBtn(true, xOffSet + learnMoreBtnInfo.width + 10 * 2 + 12)

    upgradeModalInlineState.value.isHoveredLearnMore = isLearnMoreBtnHovered
    upgradeModalInlineState.value.isHoveredUpgrade = isUpgradeBtnHovered
    if (isLearnMoreBtnHovered || isUpgradeBtnHovered) {
      setCursor('pointer')
    }
  }

  function renderRow(
    ctx: CanvasRenderingContext2D,
    {
      row,
      initialXOffset,
      visibleCols,
      startColIndex,
      rowIdx,
      yOffset,
      group,
    }: {
      row: Row
      initialXOffset: number
      visibleCols: CanvasGridColumn[]
      startColIndex: number
      yOffset: number
      rowIdx: number
      group?: CanvasGroup
    },
  ) {
    let activeState: { col: any; x: number; y: number; width: number; height: number } | null = null
    const renderRedBorders: {
      rowIndex: number
      column: CanvasGridColumn
    }[] = []
    const groupPath = generateGroupPath(group)
    const isHovered = hoverRow.value?.rowIndex === rowIdx && comparePath(hoverRow.value?.path, row?.rowMeta?.path ?? group?.path)
    const isActiveCellInCurrentGroup = comparePath(activeCell.value?.path, groupPath ?? group?.path)
    const isRowCellSelected =
      activeCell.value.row === rowIdx && comparePath(activeCell.value.path, row?.rowMeta?.path ?? group?.path)

    if (row) {
      const pk = extractPkFromRow(row.row, meta.value?.columns ?? [])
      let xOffset = initialXOffset
      if (isGroupBy.value) {
        for (let i = 0; i < startColIndex; i++) {
          const col = columns.value[i]
          if (col?.id === 'row_number') {
            xOffset -= groupByColumns.value?.length * 13
          }
          xOffset += parseCellWidth(col?.width)
        }
      }
      visibleCols.forEach((column, colIdx) => {
        let width = parseCellWidth(column.width)

        if (column.id === 'row_number') {
          width -= initialXOffset
        }

        if (column.fixed) {
          xOffset += width
          return
        }

        const columnState = column.columnObj?.id ? isColumnSortedOrFiltered(column.columnObj?.id) : null

        const prevColumnState =
          colIdx - 1 >= 0 && visibleCols[colIdx - 1] && visibleCols[colIdx - 1]?.columnObj?.id
            ? isColumnSortedOrFiltered(visibleCols[colIdx - 1]?.columnObj?.id)
            : null

        const absoluteColIdx = startColIndex + colIdx

        const isCellEditEnabled =
          editEnabled.value &&
          activeCell.value.row === rowIdx &&
          activeCell.value.column === absoluteColIdx &&
          isActiveCellInCurrentGroup

        if (
          row.rowMeta.selected ||
          (selection.value.isCellInRange({ row: rowIdx, col: absoluteColIdx }) && isActiveCellInCurrentGroup)
        ) {
          ctx.fillStyle = '#F6F7FE'
          ctx.fillRect(xOffset - scrollLeft.value, yOffset, width, rowHeight.value)
        } else if (isRowCellSelected) {
          ctx.fillStyle = 'red'
        }

        const isColumnInSelection =
          (selection.value.isCellInRange({ row: rowIdx, col: absoluteColIdx }) ||
            selection.value.isCellInRange({ row: rowIdx, col: absoluteColIdx - 1 })) &&
          isActiveCellInCurrentGroup

        // Vertical cell lines
        ctx.strokeStyle =
          isHovered || row.rowMeta.selected || isColumnInSelection || isRowCellSelected || columnState || prevColumnState
            ? themeV3Colors.gray['200']
            : themeV3Colors.gray['100']
        ctx.beginPath()
        ctx.moveTo(xOffset - scrollLeft.value, yOffset)
        ctx.lineTo(xOffset - scrollLeft.value, yOffset + rowHeight.value)
        ctx.stroke()
        // add white background color for active cell
        if (startColIndex + colIdx === activeCell.value.column && rowIdx === activeCell.value.row && isActiveCellInCurrentGroup) {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(xOffset - scrollLeft.value, yOffset, width, rowHeight.value)
        }

        const isActive =
          activeCell.value.row === rowIdx && activeCell.value.column === absoluteColIdx && isActiveCellInCurrentGroup

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
          rowMeta: row.rowMeta,
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
          path: groupPath,
          skipRender: isCellEditEnabled,
          isRowHovered: isHovered,
          isRowChecked: row.rowMeta.selected,
          isCellInSelectionRange:
            selection.value.isCellInRange({ row: rowIdx, col: absoluteColIdx }) && isActiveCellInCurrentGroup,
        })
        ctx.restore()
        xOffset += width
      })

      if (fixedCols.value.length) {
        xOffset = isGroupBy.value ? initialXOffset : 0
        fixedCols.value.forEach((column, idx) => {
          let width = parseCellWidth(column.width)

          const colIdx = columns.value.findIndex((col) => col.id === column.id)

          const isCellEditEnabled =
            editEnabled.value &&
            activeCell.value.row === rowIdx &&
            activeCell.value.column === colIdx &&
            isActiveCellInCurrentGroup

          if (
            row.rowMeta.selected ||
            (selection.value.isCellInRange({ row: rowIdx, col: colIdx }) && isActiveCellInCurrentGroup)
          ) {
            ctx.fillStyle = '#F6F7FE'
            ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
          } else {
            ctx.fillStyle = isHovered || isRowCellSelected ? '#F9F9FA' : '#ffffff'
            ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
          }

          // add white background color for active cell
          // For Fixed columns, do not need to add startColIndex
          if (colIdx === activeCell.value.column && rowIdx === activeCell.value.row && isActiveCellInCurrentGroup) {
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
          }

          if (column.id === 'row_number') {
            if (isGroupBy.value) width -= initialXOffset
            renderRowMeta(ctx, row, { xOffset, yOffset, width })
          } else {
            const value = row.row[column.title]

            const isActive = activeCell.value.row === rowIdx && activeCell.value.column === colIdx && isActiveCellInCurrentGroup

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
              rowMeta: row.rowMeta,
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
              path: groupPath,
              isRowHovered: isHovered,
              isRowChecked: row.rowMeta.selected,
              isCellInSelectionRange: selection.value.isCellInRange({ row: rowIdx, col: colIdx }) && isActiveCellInCurrentGroup,
            })
            ctx.restore()
          }

          const isColumnInSelection =
            (selection.value.isCellInRange({ row: rowIdx, col: colIdx }) ||
              selection.value.isCellInRange({ row: rowIdx, col: colIdx - 1 })) &&
            isActiveCellInCurrentGroup

          ctx.strokeStyle =
            idx !== 0 && (isHovered || row.rowMeta.selected || isColumnInSelection || isRowCellSelected)
              ? themeV3Colors.gray['200']
              : themeV3Colors.gray['100']
          ctx.lineWidth = 1

          ctx.beginPath()
          ctx.moveTo(xOffset, yOffset)
          ctx.lineTo(xOffset, yOffset + rowHeight.value)
          ctx.stroke()

          xOffset += width
        })

        if (scrollLeft.value && !isGroupBy.value) {
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
          path: group ? group.path : [],
        },
        oldRow: {},
      }
      let xOffset = initialXOffset
      if (isGroupBy.value) {
        for (let i = 0; i < startColIndex; i++) {
          const col = columns.value[i]
          if (col?.id === 'row_number') {
            xOffset -= groupByColumns.value?.length * 13
          }
          xOffset += parseCellWidth(col?.width)
        }
      }

      visibleCols.forEach((column, colIdx) => {
        let width = parseCellWidth(column.width)
        const absoluteColIdx = startColIndex + colIdx

        if (column.id === 'row_number') {
          width -= initialXOffset
        }

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

      if (fixedCols.value.length) {
        xOffset = isGroupBy.value ? initialXOffset : 0

        fixedCols.value.forEach((column) => {
          let width = parseCellWidth(column.width)

          const colIdx = columns.value.findIndex((col) => col.id === column.id)
          if (selection.value.isCellInRange({ row: rowIdx, col: colIdx })) {
            ctx.fillStyle = '#F6F7FE'
            ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
          } else {
            ctx.fillStyle = isHovered || isRowCellSelected ? '#F9F9FA' : '#ffffff'
            ctx.fillRect(xOffset, yOffset, width, rowHeight.value)
          }

          if (column.id === 'row_number') {
            if (isGroupBy.value) width -= initialXOffset
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

    return {
      activeState,
      renderRedBorders,
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

    let renderRedBorders: {
      rowIndex: number
      column: CanvasGridColumn
    }[] = []

    const adjustedWidth = Math.max(
      fixedColsWidth.value,
      totalWidth.value - scrollLeft.value - 256 < width.value ? totalWidth.value - scrollLeft.value - 256 : width.value,
    )

    let warningRow: { row: Row; yOffset: number } | null = null
    const dataCache = getDataCache()

    for (let rowIdx = startRowIndex; rowIdx < endRowIndex; rowIdx++) {
      if (
        yOffset + rowHeight.value > 0 &&
        yOffset < height.value &&
        (!removeInlineAddRecord.value || rowIdx <= EXTERNAL_SOURCE_TOTAL_ROWS)
      ) {
        const row = dataCache.cachedRows.value.get(rowIdx)

        const nextRow = rowIdx + 1 < endRowIndex ? dataCache.cachedRows.value.get(rowIdx + 1) : null

        if (rowIdx === draggedRowIndex.value) {
          ctx.globalAlpha = 0.5
        }

        const isRowHovered = hoverRow.value?.rowIndex === rowIdx && comparePath(hoverRow.value?.path, row?.rowMeta?.path)
        const isRowCellSelected = activeCell.value.row === rowIdx && comparePath(activeCell.value.path, row?.rowMeta?.path)

        const isNextRowHovered = hoverRow.value?.rowIndex === rowIdx + 1 && comparePath(hoverRow.value?.path, row?.rowMeta?.path)
        const isNextRowCellSelected =
          activeCell.value.row === rowIdx + 1 && comparePath(activeCell.value.path, row?.rowMeta?.path)
        const isNextRowSelected = nextRow && nextRow.rowMeta.selected

        ctx.fillStyle = isRowHovered || isRowCellSelected ? '#F9F9FA' : '#ffffff'
        ctx.fillRect(0, yOffset, adjustedWidth, rowHeight.value)
        const renderedProp = renderRow(ctx, {
          row,
          initialXOffset,
          visibleCols,
          rowIdx,
          startColIndex,
          yOffset,
        })
        elementMap.addElement({
          y: yOffset,
          x: 0,
          height: rowHeight.value,
          row,
          type: ElementTypes.ROW,
        })
        activeState = renderedProp.activeState ?? activeState
        renderRedBorders = [...renderRedBorders, ...renderedProp.renderRedBorders]

        if (rowIdx === draggedRowIndex.value) {
          ctx.globalAlpha = 1
        }

        // Bottom border for each row
        ctx.strokeStyle =
          isRowHovered ||
          row?.rowMeta?.selected ||
          isRowCellSelected ||
          isNextRowHovered ||
          isNextRowCellSelected ||
          isNextRowSelected
            ? themeV3Colors.gray['300']
            : themeV3Colors.gray['200']
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, yOffset + rowHeight.value)
        ctx.lineTo(adjustedWidth, yOffset + rowHeight.value)
        ctx.stroke()

        // Since blur is not working we can use just fill rect
        if (removeInlineAddRecord.value && rowIdx >= EXTERNAL_SOURCE_VISIBLE_ROWS) {
          ctx.fillStyle = 'rgba(231, 231, 233, 0.8)'
          ctx.fillRect(0, yOffset, adjustedWidth, rowHeight.value)

          ctx.fill()
        }

        if (row?.rowMeta.isValidationFailed || row?.rowMeta.isRowOrderUpdated) {
          warningRow = { row, yOffset }
        }

        yOffset += rowHeight.value
      }
    }

    // Add New Row
    if (isAddingEmptyRowAllowed.value && !isMobileMode.value && !removeInlineAddRecord.value) {
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
      elementMap.addElement({
        y: yOffset,
        x: 0,
        height: COLUMN_HEADER_HEIGHT_IN_PX,
        path: [],
        type: ElementTypes.ADD_NEW_ROW,
      })
    }

    if (warningRow) {
      const orange = '#fcbe3a'
      // Warning top border
      ctx.strokeStyle = 'orange'
      ctx.beginPath()
      ctx.moveTo(0, warningRow.yOffset)
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
        fontFamily: '600 12px Inter',
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
    renderUpgradeModalInline(ctx, yOffset)

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
    const { start: startColIndex, end: endColIndex } = colSlice.value

    // Top border
    ctx.beginPath()
    ctx.strokeStyle = '#E7E7E9'
    ctx.moveTo(0, height.value - AGGREGATION_HEIGHT - 0.5)
    ctx.lineTo(width.value, height.value - AGGREGATION_HEIGHT - 0.5)
    ctx.stroke()

    // Background
    ctx.fillStyle = '#F9F9FA'
    ctx.fillRect(0, height.value - AGGREGATION_HEIGHT, width.value, AGGREGATION_HEIGHT)

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

        ctx.font = '600 12px Inter'
        const aggWidth = ctx.measureText(column.aggregation).width
        if (column.agg_prefix) {
          ctx.font = '400 12px Inter'
          ctx.fillStyle = '#6a7184'
          ctx.fillText(
            column.agg_prefix,
            xOffset + width - aggWidth - 16 - scrollLeft.value,
            height.value - AGGREGATION_HEIGHT / 2,
          )
        }
        ctx.font = '600 12px Inter'
        ctx.fillStyle = '#4a5268'
        ctx.fillText(column.aggregation ?? ' - ', xOffset + width - 8 - scrollLeft.value, height.value - AGGREGATION_HEIGHT / 2)

        ctx.restore()
      } else if (isHovered) {
        if (!isLocked.value) {
          ctx.save()
          ctx.beginPath()

          ctx.rect(xOffset - scrollLeft.value, height.value - AGGREGATION_HEIGHT, width, AGGREGATION_HEIGHT)
          ctx.fill()
          ctx.clip()

          ctx.font = '600 10px Inter'
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
        }
        ctx.restore()
      }

      ctx.beginPath()
      ctx.strokeStyle = '#f4f4f5'
      ctx.moveTo(xOffset - scrollLeft.value, height.value - AGGREGATION_HEIGHT)
      ctx.lineTo(xOffset - scrollLeft.value, height.value)
      ctx.stroke()

      xOffset += width
    })

    if (fixedCols.value.length) {
      xOffset = 0
      const rowNumberCol = fixedCols.value.find((col) => col.id === 'row_number')
      const firstFixedCol = fixedCols.value.find((col) => col.id !== 'row_number')

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

          ctx.font = '600 12px Inter'
          const aggWidth = ctx.measureText(firstFixedCol.aggregation).width

          if (firstFixedCol.agg_prefix) {
            ctx.font = '400 12px Inter'
            ctx.fillStyle = '#6a7184'
            ctx.fillText(firstFixedCol.agg_prefix, mergedWidth - aggWidth - 16, height.value - AGGREGATION_HEIGHT / 2)
            const w = ctx.measureText(firstFixedCol.agg_prefix).width
            availWidth -= w
          }

          ctx.font = '600 12px Inter'
          ctx.fillStyle = '#4a5268'
          ctx.fillText(firstFixedCol.aggregation ?? ' - ', mergedWidth - 8, height.value - AGGREGATION_HEIGHT / 2)

          const w = ctx.measureText(firstFixedCol.aggregation).width
          availWidth -= w
          ctx.restore()
        } else if (isHovered) {
          if (!isLocked.value) {
            ctx.save()
            ctx.beginPath()
            ctx.rect(xOffset, height.value - AGGREGATION_HEIGHT, mergedWidth, AGGREGATION_HEIGHT)
            ctx.clip()

            ctx.font = '600 10px Inter'
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
          }
          availWidth -= 18
          ctx.restore()
        }

        const count = isGroupBy.value ? totalGroups.value : Math.max(totalRows.value, actualTotalRows.value ?? 0)
        const label = isGroupBy.value
          ? count !== 1
            ? t('objects.groups')
            : t('objects.group')
          : count !== 1
          ? t('objects.records')
          : t('objects.record')

        renderSingleLineText(ctx, {
          text: `${Intl.NumberFormat('en', { notation: 'compact' }).format(count)} ${label}`,
          x: xOffset + 8,
          y: height.value - AGGREGATION_HEIGHT + 2,
          fillStyle: '#6a7184',
          textAlign: 'left',
          fontSize: 12,
          maxWidth: availWidth - 16,
          fontFamily: '500 12px Inter',
        })
        //  Not exactly sure, but height.value becomes zero, randomly when scroll
        if (height.value) {
          tryShowTooltip({
            mousePosition,
            text: `${count} ${label}`,
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

        fixedCols.value.slice(2).forEach((column) => {
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

            ctx.font = '600 12px Inter'
            const aggWidth = ctx.measureText(column.aggregation).width

            if (column.agg_prefix) {
              ctx.font = '400 12px Inter'
              ctx.fillStyle = '#6a7184'
              ctx.fillText(column.agg_prefix, xOffset + width - aggWidth - 16, height.value - AGGREGATION_HEIGHT / 2)
            }

            ctx.font = '600 12px Inter'
            ctx.fillStyle = '#4a5268'
            ctx.fillText(column.aggregation, xOffset + width - 8, height.value - AGGREGATION_HEIGHT / 2)

            ctx.restore()
          } else if (isHovered) {
            ctx.save()
            ctx.beginPath()
            ctx.rect(xOffset, height.value - AGGREGATION_HEIGHT, width, AGGREGATION_HEIGHT)
            ctx.clip()

            ctx.font = '600 10px Inter'
            ctx.fillStyle = '#6a7184'
            ctx.textAlign = 'right'
            ctx.textBaseline = 'middle'

            const rightEdge = xOffset + width - 8
            const textY = height.value - AGGREGATION_HEIGHT / 2

            ctx.fillText('Summary', rightEdge, textY)

            const textLen = ctx.measureText('Summary').width
            if (!isLocked.value) {
              spriteLoader.renderIcon(ctx, {
                icon: 'chevronDown',
                size: 14,
                color: '#6a7184',
                x: rightEdge - textLen - 18,
                y: textY - 7,
              })
            }
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

  const renderRowDragPreview = (ctx: CanvasRenderingContext2D, path: Array<number> = []) => {
    if (!isDragging.value || draggedRowIndex.value === null || targetRowIndex.value === null) return

    let targetRowLine
    if (isGroupBy.value) {
      targetRowLine =
        calculateGroupRowTop(cachedGroups.value, path, targetRowIndex.value, rowHeight.value, isAddingEmptyRowAllowed.value) -
        scrollTop.value +
        // add column header height since it's not included
        COLUMN_HEADER_HEIGHT_IN_PX
    } else {
      targetRowLine =
        (targetRowIndex.value - rowSlice.value.start) * rowHeight.value - partialRowHeight.value + COLUMN_HEADER_HEIGHT_IN_PX
    }

    // First render the blue line indicator
    ctx.strokeStyle = '#3366ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    // pass x offset based on number of group level(8px padding and 1px border)
    ctx.moveTo(groupByColumns.value.length * 13, targetRowLine)
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

    const dataCache = getDataCache(path)

    const row = dataCache.cachedRows.value.get(draggedRowIndex.value)
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
            rowMeta: row.rowMeta,
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

  function renderGroupRows(
    ctx: CanvasRenderingContext2D,
    group: CanvasGroup,
    yOffset: number,
    level: number,
    startIndex: number,
    endIndex: number,
  ) {
    if (!group.path) return yOffset
    const dataCache = getDataCache(group.path)

    const rows = dataCache.cachedRows.value
    const { start: startColIndex, end: endColIndex } = colSlice.value
    const visibleCols = columns.value.slice(startColIndex, endColIndex)

    const rowsToFetch = []

    let activeState: { col: any; x: number; y: number; width: number; height: number } | null = null

    let renderRedBorders: {
      rowIndex: number
      column: CanvasGridColumn
    }[] = []

    let warningRow: { row: Row; yOffset: number } | null = null
    yOffset += 1
    const indent = level * 13 + 1

    const adjustedWidth = Math.max(
      fixedColsWidth.value - indent,
      totalWidth.value - scrollLeft.value - 256 < width.value
        ? totalWidth.value - scrollLeft.value - 256 - 2 * indent
        : width.value,
    )

    for (let i = startIndex; i <= endIndex; i++) {
      const row = rows?.get(i)

      if (!row) {
        rowsToFetch.push(i)
      }

      const isHovered = hoverRow.value?.rowIndex === i && comparePath(hoverRow.value?.path, row?.rowMeta?.path ?? group.path)

      roundedRect(ctx, indent, yOffset, adjustedWidth, rowHeight.value, 0, {
        backgroundColor: isHovered ? '#F9F9FA' : '#fff',
      })
      ctx.save()
      ctx.rect(indent, yOffset, adjustedWidth, rowHeight.value)
      ctx.clip()
      const renderedProp = renderRow(ctx, {
        row,
        initialXOffset: indent,
        visibleCols,
        startColIndex,
        rowIdx: i,
        yOffset,
        group,
      })
      ctx.restore()
      elementMap.addElement({
        y: yOffset,
        x: indent,
        group,
        level,
        height: rowHeight.value,
        path: group.nestedIn,
        rowIndex: i,
        row,
        type: ElementTypes.ROW,
      })

      activeState = renderedProp.activeState ?? activeState
      renderRedBorders = [...renderRedBorders, ...renderedProp.renderRedBorders]

      // Bottom border for each row
      ctx.strokeStyle = '#e7e7e9'
      ctx.beginPath()
      ctx.moveTo(indent, yOffset + rowHeight.value)
      ctx.lineTo(adjustedWidth + indent, yOffset + rowHeight.value)
      ctx.stroke()

      if (row?.rowMeta.isValidationFailed || row?.rowMeta.isRowOrderUpdated || row?.rowMeta.isGroupChanged) {
        warningRow = { row, yOffset }
      }

      yOffset += rowHeight.value
    }

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
      roundedRect(
        ctx,
        level * 13,
        yOffset,
        adjustedWidth + 2,
        COLUMN_HEADER_HEIGHT_IN_PX,
        {
          bottomLeft: 8,
          bottomRight: 8,
          topRight: 0,
          topLeft: 0,
        },
        {
          backgroundColor: isNewRowHovered ? '#F9F9FA' : '#ffffff',
          borders: {
            bottom: true,
          },
          borderColor: '#e7e7e9',
          borderWidth: 1,
        },
      )
      spriteLoader.renderIcon(ctx, {
        icon: isAddNewRecordGridMode.value ? 'ncPlus' : 'form',
        color: isNewRowHovered ? '#000000' : '#4a5268',
        x: 16 + level * 13,
        y: yOffset + 9,
        size: 14,
      })

      const { width: renderedWidth } = renderSingleLineText(ctx, {
        x: 16 + 20 + level * 13,
        y: yOffset + 2,
        fontFamily: '600 13px Inter',
        height: COLUMN_HEADER_HEIGHT_IN_PX,
        fillStyle: '#374151',
        text: `${t('activity.newRecord')}`,
      })

      spriteLoader.renderIcon(ctx, {
        icon: 'chevronDown',
        color: isNewRowHovered ? '#000000' : '#4a5268',
        x: 16 + 20 + level * 13 + renderedWidth + 12,
        y: yOffset + 10,
        size: 14,
      })

      elementMap.addElement({
        x: 16 + 20 + level * 13 + renderedWidth + 12,
        y: yOffset + 9,
        width: 16,
        group,
        level,
        height: COLUMN_HEADER_HEIGHT_IN_PX,
        path: group.nestedIn,
        groupPath: group?.path,
        type: ElementTypes.EDIT_NEW_ROW_METHOD,
      })

      elementMap.addElement({
        y: yOffset,
        x: level * 13,
        group,
        level,
        height: COLUMN_HEADER_HEIGHT_IN_PX,
        path: group.nestedIn,
        groupPath: group?.path,
        type: ElementTypes.ADD_NEW_ROW,
      })

      yOffset += COLUMN_HEADER_HEIGHT_IN_PX
    }

    if (warningRow) {
      const orange = '#fcbe3a'
      // Group level x axis offset
      const gXOffset = level * 13

      // Warning top border
      ctx.strokeStyle = 'orange'
      ctx.beginPath()
      ctx.moveTo(gXOffset, warningRow.yOffset)
      ctx.lineTo(adjustedWidth + gXOffset + 2, warningRow.yOffset)
      ctx.lineWidth = 2
      ctx.stroke()

      // Warning bottom border
      ctx.strokeStyle = 'orange'
      ctx.beginPath()
      ctx.moveTo(gXOffset, warningRow.yOffset + rowHeight.value)
      ctx.lineTo(adjustedWidth + gXOffset + 2, warningRow.yOffset + rowHeight.value)
      ctx.lineWidth = 2
      ctx.stroke()

      roundedRect(ctx, gXOffset, warningRow.yOffset + rowHeight.value, 90, 25, { bottomRight: 6 }, { backgroundColor: orange })
      renderSingleLineText(ctx, {
        text: warningRow.row.rowMeta.isValidationFailed ? 'Row filtered' : 'Row moved',
        x: 10 + gXOffset,
        y: warningRow.yOffset + rowHeight.value,
        py: 7,
        fillStyle: '#1f293a',
        fontSize: 12,
        fontFamily: '600 12px Inter',
      })
    }

    const postRenderCbk = () => {
      // render this at the end to avoid clipping
      renderActiveState(ctx, activeState)
      renderFillHandle(ctx)
    }

    if (rowsToFetch?.length) {
      const maxIndex = Math.max(...rowsToFetch)
      const minIndex = Math.min(...rowsToFetch)
      getRows(minIndex, maxIndex, group.path)
    }

    return { yOffset, postRenderCbk }
  }

  function renderGroups(
    ctx: CanvasRenderingContext2D,
    {
      level = 0,
      yOffset,
      pGroup,
      startIndex,
      endIndex,
      _isStartGroup,
    }: {
      level: number
      yOffset: number
      pGroup?: CanvasGroup
      startIndex: number
      endIndex: number
      gHeight?: number
      _isStartGroup?: boolean
    },
  ) {
    const groups = pGroup?.groups ?? cachedGroups.value

    const missingChunks = []

    const rowNumberCol = fixedCols.value.find((col) => col.id === 'row_number')
    const firstFixedCol = fixedCols.value.find((col) => col.id !== 'row_number')
    const xOffset = (level + 1) * 13

    const mergedWidth = parseCellWidth(rowNumberCol?.width) + parseCellWidth(firstFixedCol?.width) - xOffset
    const adjustedWidth = Math.max(
      fixedColsWidth.value - (level + 1) * 13,
      totalWidth.value - scrollLeft.value - 256 < width.value
        ? totalWidth.value - scrollLeft.value - 256 - 2 * xOffset
        : width.value,
    )
    // Track absolute position in virtual space
    let currentOffset = yOffset

    const postRenderCbks: Array<() => void> = []
    for (let i = startIndex; i <= endIndex; i++) {
      const isStartGroup = (_isStartGroup ?? true) && i === startIndex
      const group = groups.get(i)
      if (!group) {
        missingChunks.push(i)
      }
      const groupHeaderY = currentOffset
      const groupHeight = calculateGroupHeight(group, rowHeight.value, isAddingEmptyRowAllowed.value)
      const groupBottom = groupHeaderY + groupHeight

      // Skip if group is fully outside viewport
      if (groupBottom < 0 || groupHeaderY > height.value) {
        currentOffset += groupHeight
        continue
      }

      if (group) {
        elementMap.addElement({
          y: groupHeaderY,
          x: xOffset,
          level,
          height: GROUP_HEADER_HEIGHT,
          path: group.nestedIn,
          groupIndex: i,
          group,
          type: ElementTypes.GROUP,
        })
      }

      const {
        background: groupBackgroundColor,
        border: groupBorderColor,
        aggregation: { hover: aggregationHoverBg, default: aggregationDefaultBg, border: aggregationBorderColor },
      } = getGroupColors(level, groupByColumns.value.length)

      if (groupHeaderY + groupHeight >= 0 && groupHeaderY < height.value) {
        let tempCurrentOffset = currentOffset + GROUP_HEADER_HEIGHT

        if (group?.isExpanded) {
          const nestedContentStart = tempCurrentOffset
          // Calculate the total height of groups up to the relevant index
          // If the group is at top, then use startIndex, else use endIndex
          const gHeight = Array.from({ length: startIndex }, (_, g) => {
            const group = groups.get(g)
            return calculateGroupHeight(group!, rowHeight.value, isAddingEmptyRowAllowed.value)
          }).reduce((sum, c) => sum + c, 0)

          // todo:  figure out the 2px difference which is not expected
          // calculate the relative scroll top for the group
          // where gHeight + GROUP_PADDING is the height of previous groups before startIndex
          const relativeScrollTop = isStartGroup ? scrollTop.value - gHeight : 0

          roundedRect(
            ctx,
            xOffset,
            groupHeaderY + GROUP_HEADER_HEIGHT,
            adjustedWidth,
            groupHeight - GROUP_PADDING - GROUP_HEADER_HEIGHT,
            {
              bottomRight: 8,
              bottomLeft: 8,
            },
            {
              backgroundColor: groupBackgroundColor,
              borderColor: groupBorderColor,
              borders: {
                top: false,
                right: true,
                bottom: true,
                left: true,
              },
            },
          )

          if (group.path) {
            // Calculate visible viewport height from current offset to container bottom
            const viewportHeight = height.value - tempCurrentOffset
            const itemHeight = rowHeight.value
            // Calculate first visible item index, accounting for header height
            // Math.max ensures no negative indices
            const nestedStart = Math.min(
              group.count,
              // Use the negative offset to calculate the start index, as it helps determine how many rows are hidden
              Math.max(0, Math.floor(-(groupHeaderY + GROUP_HEADER_HEIGHT - COLUMN_HEADER_HEIGHT_IN_PX) / itemHeight)),
            )
            // Calculate number of visible rows based on viewport height
            const visibleRowCount = Math.ceil(viewportHeight / itemHeight)
            // Calculate last visible item index, bounded by total count
            const nestedEnd = Math.min(nestedStart + visibleRowCount, group.count - 1)

            const { yOffset: _tempCurrentOffset, postRenderCbk } = renderGroupRows(
              ctx,
              group,
              // Start rendering from the top of the group
              nestedContentStart + nestedStart * rowHeight.value,
              level + 1,
              nestedStart,
              nestedEnd,
            )
            tempCurrentOffset = _tempCurrentOffset
            postRenderCbks.push(postRenderCbk)
          } else {
            // Calculate the range of nested groups that should be visible
            // based on scroll position and available height
            const { endIndex: nestedEnd } = calculateGroupRange(
              group.groups,
              relativeScrollTop,
              rowHeight.value,
              group.groupCount,
              height.value - groupHeaderY - GROUP_HEADER_HEIGHT - GROUP_EXPANDED_BOTTOM_PADDING,
              true,
              isAddingEmptyRowAllowed.value,
            )

            const {
              currentOffset: _tempOffset,
              missingChunks: nestedMissingChunks,
              postRenderCbk,
            } = renderGroups(ctx, {
              level: level + 1,
              yOffset: nestedContentStart + GROUP_EXPANDED_BOTTOM_PADDING,
              pGroup: group,
              startIndex: 0,
              endIndex: Math.max(0, nestedEnd),
              gHeight: 0,
              _isStartGroup: isStartGroup,
            })
            postRenderCbks.push(postRenderCbk)

            tempCurrentOffset = _tempOffset

            if (nestedMissingChunks.length) {
              const minIndex = Math.min(...nestedMissingChunks)
              const maxIndex = Math.max(...nestedMissingChunks)

              fetchMissingGroupChunks(minIndex, maxIndex, group)
            }
          }
        }
        roundedRect(
          ctx,
          xOffset,
          groupHeaderY,
          adjustedWidth,
          GROUP_HEADER_HEIGHT,
          group?.isExpanded ? { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 } : 8,
          {
            backgroundColor: groupBackgroundColor,
            borderColor: groupBorderColor,
            borders: {
              bottom: !group?.isExpanded || !!group?.path?.length,
              top: true,
              left: true,
              right: true,
            },
          },
        )

        if (appInfo.value?.ee) {
          const { start: startColIndex, end: endColIndex } = colSlice.value
          const visibleCols = columns.value.slice(startColIndex, endColIndex)

          let aggXOffset = 1

          for (let i = 0; i < startColIndex; i++) {
            aggXOffset += parseCellWidth(columns.value[i]?.width)
          }
          visibleCols.forEach((column, index) => {
            const width = parseCellWidth(column.width)

            if (column.fixed) {
              aggXOffset += width
              return
            }

            const isHovered = isBoxHovered(
              {
                x: aggXOffset - scrollLeft.value,
                y: Math.max(currentOffset, COLUMN_HEADER_HEIGHT_IN_PX) + 1,
                width,
                height: GROUP_HEADER_HEIGHT - 1 + (group?.isExpanded && !group?.path ? GROUP_EXPANDED_BOTTOM_PADDING : 0),
              },
              mousePosition,
            )

            if (isHovered) {
              setCursor('pointer')
            }

            ctx.fillStyle = isHovered ? aggregationHoverBg : aggregationDefaultBg

            // Difference between where the column starts and how much the user has scrolled
            const aggOffset = aggXOffset - scrollLeft.value

            // If fixed columns overlap with the scrolling columns, calculate the overlap
            const overlap = Math.max(0, fixedColsWidth.value - aggOffset)

            // Whether the current column is the last visible one (for minor visual adjustment)
            const isLastCol = index === visibleCols.length - 1
            const adjustment = isLastCol ? 1 : 0

            // Final `left` position: Either the scroll-adjusted offset or the width of fixed columns, whichever is greater
            const left = Math.max(aggOffset, fixedColsWidth.value)

            // Final `width`: Remaining space after accounting for fixed column overlap and last column adjustment
            const widthClamped = Math.max(width - overlap - adjustment, 0)

            if (column.agg_fn && ![AllAggregations.None].includes(column.agg_fn as any)) {
              ctx.save()
              ctx.beginPath()

              roundedRect(
                ctx,
                left,
                groupHeaderY + 1,
                widthClamped,
                GROUP_HEADER_HEIGHT - 2 + (group?.isExpanded && !group?.path ? GROUP_EXPANDED_BOTTOM_PADDING : 0),
                {
                  topLeft: 0,
                  bottomLeft: 0,
                  topRight: index === visibleCols.length - 1 ? 8 : 0,
                  bottomRight: index === visibleCols.length - 1 ? 8 : 0,
                },
                { backgroundColor: isHovered ? aggregationHoverBg : aggregationDefaultBg },
              )

              ctx.fill()
              ctx.clip()

              ctx.textBaseline = 'middle'
              ctx.textAlign = 'right'

              ctx.font = '600 12px Inter'
              const aggWidth = ctx.measureText(group?.aggregations[column.title] ?? ' - ').width
              if (column.agg_prefix) {
                ctx.font = '400 12px Inter'
                ctx.fillStyle = '#6a7184'
                ctx.fillText(
                  column.agg_prefix,
                  aggXOffset + width - aggWidth - 16 - scrollLeft.value,
                  groupHeaderY +
                    (GROUP_HEADER_HEIGHT + (group?.isExpanded && !group?.path ? GROUP_EXPANDED_BOTTOM_PADDING : 0)) / 2,
                )
              }
              ctx.fillStyle = '#374151'
              ctx.font = '600 12px Inter'
              ctx.fillText(
                group?.aggregations[column.title] ?? ' - ',
                aggXOffset + width - 8 - scrollLeft.value,
                groupHeaderY +
                  (GROUP_HEADER_HEIGHT + (group?.isExpanded && !group?.path ? GROUP_EXPANDED_BOTTOM_PADDING : 0)) / 2,
              )

              ctx.restore()
            } else if (isHovered) {
              if (!isLocked.value) {
                ctx.save()
                ctx.beginPath()

                roundedRect(
                  ctx,
                  left,
                  groupHeaderY + 1,
                  widthClamped,
                  GROUP_HEADER_HEIGHT - 2 + (group?.isExpanded && !group?.path ? GROUP_EXPANDED_BOTTOM_PADDING : 0),
                  {
                    topLeft: 0,
                    bottomLeft: 0,
                    topRight: index === visibleCols.length - 1 ? 8 : 0,
                    bottomRight: index === visibleCols.length - 1 ? 8 : 0,
                  },
                  { backgroundColor: isHovered ? aggregationHoverBg : aggregationDefaultBg },
                )

                ctx.fill()
                ctx.clip()

                ctx.font = '600 10px Inter'
                ctx.fillStyle = '#6a7184'
                ctx.textAlign = 'right'
                ctx.textBaseline = 'middle'

                const rightEdge = aggXOffset + width - 8 - scrollLeft.value
                const textY =
                  groupHeaderY +
                  (GROUP_HEADER_HEIGHT + (group?.isExpanded && !group?.path ? GROUP_EXPANDED_BOTTOM_PADDING : 0)) / 2

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
            }

            ctx.save()
            ctx.rect(
              Math.max(aggXOffset - scrollLeft.value, fixedColsWidth.value),
              groupHeaderY + 1,
              width,
              GROUP_HEADER_HEIGHT - 2 + (group?.isExpanded && !group?.path ? GROUP_EXPANDED_BOTTOM_PADDING : 0),
            )

            ctx.clip()
            ctx.beginPath()
            ctx.strokeStyle = aggregationBorderColor
            ctx.moveTo(aggXOffset - scrollLeft.value, groupHeaderY + 1)
            ctx.lineTo(
              aggXOffset - scrollLeft.value,
              groupHeaderY + GROUP_HEADER_HEIGHT - 2 + (group?.isExpanded && !group?.path ? GROUP_EXPANDED_BOTTOM_PADDING : 0),
            )
            ctx.stroke()
            ctx.restore()
            aggXOffset += width
          })
        }

        spriteLoader.renderIcon(ctx, {
          icon: group?.isExpanded ? 'ncChevronDown' : 'ncChevronRight',
          size: 16,
          color: '#374150',
          x: xOffset + 12,
          y: groupHeaderY + (GROUP_HEADER_HEIGHT - 16) / 2,
        })

        // 16px is the icon size
        // 16px is the right padding
        // xOffset + 16 is the left padding
        const availableWidth = mergedWidth - (xOffset + 16 + 16)

        const contentX = xOffset + 34

        const contentY = groupHeaderY + (GROUP_HEADER_HEIGHT - 30) / 2

        const isMouseHoveringOverGroupHeader = isBoxHovered(
          { x: xOffset, y: groupHeaderY, width: mergedWidth, height: GROUP_HEADER_HEIGHT },
          mousePosition,
        )

        let contentWidth = 0
        let countWidth = 0

        if (isMouseHoveringOverGroupHeader) {
          setCursor('pointer')
        }

        const countRender = renderSingleLineText(ctx, {
          text: `${group?.count ?? '-'}`,
          x: xOffset + mergedWidth - 12,
          y: contentY - 1,
          height: GROUP_HEADER_HEIGHT,
          verticalAlign: 'middle',
          fontFamily: '600 12px Inter',
          fillStyle: '#374151',
          textAlign: 'right',
        })
        countWidth = countRender.width

        const contentRender = renderSingleLineText(ctx, {
          text: 'Count',
          x: xOffset + mergedWidth - 12 - countWidth - 8,
          y: contentY - 1,
          height: GROUP_HEADER_HEIGHT,
          verticalAlign: 'middle',
          textAlign: 'right',
          fontFamily: '400 12px Inter',
          fillStyle: '#6A7184',
        })

        contentWidth = contentRender.width

        ctx.save()

        ctx.letterSpacing = '1px'
        const { isTruncated } = renderSingleLineText(ctx, {
          text: (group?.column?.title ?? '').toUpperCase(),
          fillStyle: '#4A5268',
          x: contentX,
          maxWidth: availableWidth - 20 - countWidth,
          fontFamily: '600 10px Inter',
          y: groupHeaderY,
          py: 6,
        })
        if (isTruncated) {
          tryShowTooltip({
            mousePosition,
            text: (group?.column?.title ?? '').toUpperCase(),
            rect: {
              x: contentX,
              y: groupHeaderY,
              height: 16,
              width: availableWidth - 20 - countWidth,
            },
          })
        }

        ctx.restore()

        renderGroupContent(ctx, group, contentX, contentY + 22, availableWidth - contentWidth - countWidth, i)

        currentOffset = tempCurrentOffset
      }
      currentOffset += GROUP_PADDING
    }

    return {
      currentOffset,
      missingChunks,
      postRenderCbk: () => postRenderCbks.map((p) => p?.()),
    }
  }

  function renderGroupContent(
    ctx: CanvasRenderingContext2D,
    group: CanvasGroup,
    x: number,
    y: number,
    maxWidth: number,
    groupIdx: number,
  ) {
    if (!group) {
      drawShimmerEffect(ctx, x - 11, y - GROUP_HEADER_HEIGHT / 2 + 2, maxWidth, groupIdx)
      return
    }

    if (
      [UITypes.SingleSelect, UITypes.MultiSelect, UITypes.LinkToAnotherRecord].includes(group?.column?.uidt) &&
      !(group.value in GROUP_BY_VARS.VAR_TITLES)
    ) {
      // parse value if LTAR and extract values separated by ___
      const parsedValue = group?.column?.uidt === UITypes.LinkToAnotherRecord ? parseKey(group) : group.value
      const tags = Array.isArray(parsedValue) ? parsedValue : parsedValue.split(',')
      const colors = group.color.split(',')
      let xPosition = x
      let tagsRendered = 0

      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i] || ''
        const color = colors[i] || '#ccc'
        const displayText = tag in GROUP_BY_VARS.VAR_TITLES ? GROUP_BY_VARS.VAR_TITLES[tag] : tag

        const textColor = tinycolor.isReadable(color, '#fff', {
          level: 'AA',
          size: 'large',
        })
          ? '#fff'
          : tinycolor.mostReadable(color, ['#1f293a', '#fff']).toHex8String()

        ctx.save()
        ctx.font = '700 13px Inter'
        const tagPaddingX = 12
        const tagSpacing = 0
        const remainingWidth = maxWidth - (xPosition - x)

        const textMetrics = ctx.measureText(displayText || '')
        const estimatedTagWidth = textMetrics.width + tagPaddingX * 2 + tagSpacing

        if (xPosition > x && (estimatedTagWidth > remainingWidth - 30 || remainingWidth < 50)) {
          ctx.fillStyle = '#6a7184'
          ctx.font = '400 12px Inter'

          const indicatorX = Math.min(xPosition, x + maxWidth - 24)

          ctx.fillText(`+${tags.length - tagsRendered}`, indicatorX, y)
          ctx.restore()
          break
        }

        const { x: newX } = renderTagLabel(ctx, {
          x: xPosition,
          y: y - 7,
          height: 22,
          width: remainingWidth,
          padding: 0,
          textColor,
          text: displayText || '',
          tag: {
            tagPaddingX: 12,
            tagPaddingY: 2,
            tagHeight: 22,
            tagRadius: 12,
            tagBgColor: color,
            tagSpacing: 0,
            tagFontFamily: '700 13px Inter',
          },
        } as any)

        ctx.restore()

        xPosition = newX + 8
        tagsRendered++

        if (xPosition + 30 >= x + maxWidth) {
          if (i < tags.length - 1) {
            ctx.save()
            ctx.fillStyle = '#6a7184'
            ctx.font = '400 12px Inter'

            const indicatorSpace = Math.max(24, x + maxWidth - xPosition)

            const indicatorX = indicatorSpace < 24 ? x + maxWidth - 24 : xPosition

            ctx.fillText(`+${tags.length - tagsRendered}`, indicatorX, y)
            ctx.restore()
          }
          break
        }
      }
    } else if (group.value in GROUP_BY_VARS.VAR_TITLES) {
      const displayText =
        group.value in GROUP_BY_VARS.VAR_TITLES ? GROUP_BY_VARS.VAR_TITLES[group.value] : parseKey(group)?.join(', ')

      const isCheckBox = group.column?.uidt === UITypes.Checkbox

      renderSingleLineText(ctx, {
        text: displayText,
        fillStyle: isCheckBox ? '#1f293a' : '#6A7184',
        fontFamily: '700 13px Inter',
        x,
        y: y - GROUP_HEADER_HEIGHT / 2 + 8,
        height: 20,
        maxWidth,
      })
    } else if (isUser(group.column) || isCreatedOrLastModifiedByCol(group.column)) {
      let val = group.value

      try {
        val = JSON.parse(group.value)
      } catch (e) {
        val = group.value
      }

      renderCell(ctx, group.column, {
        value: val,
        x: x - 11,
        y: y - 16,
        width: maxWidth,
        height: rowHeight.value,
        row: {},
        selected: false,
        pv: false,
        spriteLoader,
        readonly: true,
        textColor: '#1f293a', // gray-800
        imageLoader,
        tableMetaLoader,
        relatedColObj: group.relatedColumn,
        relatedTableMeta: group.relatedTableMeta,
        mousePosition,
        skipRender: false,
        fontFamily: '700 13px Inter',
        isGroupHeader: true,
      })
    } else {
      renderCell(ctx, group.column, {
        value: group.value?.toString?.().split(','),
        x: x - 11,
        y: y - 13,
        width: maxWidth,
        height: rowHeight.value,
        row: {},
        selected: false,
        pv: false,
        spriteLoader,
        readonly: true,
        textColor: '#1f293a', // gray-800
        imageLoader,
        tableMetaLoader,
        relatedColObj: group.relatedColumn,
        relatedTableMeta: group.relatedTableMeta,
        mousePosition,
        skipRender: false,
        renderAsPlainCell: true,
        fontFamily: '700 13px Inter',
        isGroupHeader: true,
      })
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

    let activeState

    elementMap.clear()
    let postRenderCbk
    if (!groupByColumns.value?.length) {
      activeState = renderRows(ctx)
    } else {
      ctx.save()
      ctx.fillStyle = baseColor.value
      ctx.fillRect(0, 0, width.value, height.value)
      ctx.restore()

      const { startIndex, endIndex, startGroupYOffset } = calculateGroupRange(
        cachedGroups.value,
        scrollTop.value,
        rowHeight.value,
        totalGroups.value,
        height.value,
        false,
        isAddingEmptyRowAllowed.value,
      )

      const { missingChunks, postRenderCbk: _postRenderCbk } = renderGroups(ctx, {
        level: 0,
        yOffset: startGroupYOffset,
        startIndex,
        endIndex,
      })
      postRenderCbk = _postRenderCbk

      if (missingChunks.length) {
        const minIndex = Math.min(...missingChunks)
        const maxIndex = Math.max(...missingChunks)

        fetchMissingGroupChunks(minIndex, maxIndex)
      }
    }

    renderHeader(ctx, activeState)
    renderColumnDragIndicator(ctx)
    renderRowDragPreview(ctx, draggedRowGroupPath.value)
    renderAggregations(ctx)

    // render the active cell state and clip the header and aggregation footer areas
    ctx.beginPath()
    ctx.rect(0, COLUMN_HEADER_HEIGHT_IN_PX, totalWidth.value, height.value - COLUMN_HEADER_HEIGHT_IN_PX - AGGREGATION_HEIGHT)
    ctx.clip()
    postRenderCbk?.()
    ctx.restore()
  }

  return {
    canvasRef,
    renderActiveState,
    renderCanvas,
    colResizeHoveredColIds,
  }
}
