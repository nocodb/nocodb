import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { defaultOffscreen2DContext, isBoxHovered, renderIconButton, renderSingleLineText } from '../../utils/canvas'
import { PlainCellRenderer } from '../Plain'
import { renderAsCellLookupOrLtarValue } from '../../utils/cell'

const ellipsisWidth = 15
const buttonSize = 20

export const ManyToManyCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const {
      value,
      x,
      y,
      width,
      height,
      readonly,
      spriteLoader,
      mousePosition,
      relatedTableMeta,
      renderCell,
      setCursor,
      cellRenderStore,
      selected,
      getColor,
    } = props

    const fkDisplayValueColumnId = (props.column?.colOptions as LinkToAnotherRecordType)?.fk_display_value_column_id

    const relatedTableDisplayValueProp = fkDisplayValueColumnId
      ? relatedTableMeta?.columns?.find((c) => c.id === fkDisplayValueColumnId)?.title || ''
      : (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.title || ''

    const m2mColumn = relatedTableMeta?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp) as
      | ColumnType
      | undefined

    if (!m2mColumn) return

    const cells = (ncIsArray(value) ? value : []).reduce((acc, curr) => {
      if (!relatedTableDisplayValueProp) return acc

      const value = curr[relatedTableDisplayValueProp]

      acc.push({ value, item: curr })

      return acc
    }, []) as { value: any; item: Record<string, any> }[]
    const initialX = x + 4
    const initialWidth = width - 6
    // Use a fixed right boundary for layout to avoid cumulative rounding errors.
    const rightBoundary = initialX + initialWidth

    let currentX = initialX
    let currentY = y + (rowHeightInPx['1'] === height ? 0 : 2)

    // Clip to cell bounds to prevent overflow into adjacent cells.
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, width, height)
    ctx.clip()

    /**
     * Chip info which is oldX, oldY, x, y, width, height, value is required when user click on chip item to expand record
     * Value added in returnData because we don't want to calculate it again
     */
    const returnData: CellRenderStore['ltar'] = []

    const renderProps: CellRendererOptions = {
      ...props,
      column: m2mColumn,
      relatedColObj: undefined,
      relatedTableMeta: undefined,
      readonly: true,
      height: rowHeightInPx['1']!,
      // Smaller padding to maximize usable content width.
      padding: 4,
      textColor: getColor(themeV4Colors.brand['500']),
      tag: {
        renderAsTag: true,
        tagBgColor: getColor(themeV4Colors.brand['50'], 'var(--nc-bg-gray-light)'),
        tagHeight: 24,
        // Tighter tag spacing for denser chip layout.
        tagPaddingX: 6,
        tagSpacing: 2,
      },
      meta: relatedTableMeta,
    }

    const cellRenderer = (options: CellRendererOptions) => {
      return renderAsCellLookupOrLtarValue.includes(m2mColumn.uidt)
        ? renderCell(ctx, m2mColumn, options)
        : PlainCellRenderer.render(ctx, options)
    }
    const measureCellRenderer = (options: CellRendererOptions) => {
      // Measure offscreen first to decide line breaks before committing to render.
      return renderAsCellLookupOrLtarValue.includes(m2mColumn.uidt)
        ? renderCell(defaultOffscreen2DContext, m2mColumn, options)
        : PlainCellRenderer.render(defaultOffscreen2DContext, options)
    }

    const maxLines = rowHeightTruncateLines(height, true)
    // Small compensation for slightly conservative renderer return values.
    const chipEndCompensation = 4
    // Minimum chip width to guarantee at least one visible character.
    const minChipTextSafeWidth = 36
    const chipSpacing = 2
    const measureMaxWidth = Math.max(initialWidth, 1200)
    const chipIdealWidths = cells.map((cell) => {
      const p = measureCellRenderer({
        ...renderProps,
        value: cell.value,
        x: 0,
        y: 0,
        width: measureMaxWidth,
      })
      return Math.max(minChipTextSafeWidth, p?.x ?? minChipTextSafeWidth)
    })
    const flexShrinkWidths = (idealWidths: number[], containerWidth: number, minWidth: number) => {
      if (!idealWidths.length) return []

      const widths = [...idealWidths]
      let total = widths.reduce((acc, w) => acc + w, 0)
      if (total <= containerWidth) return widths

      let overflow = total - containerWidth
      const frozen = new Array(widths.length).fill(false)

      while (overflow > 0.1) {
        let activeWeight = 0
        for (let i = 0; i < widths.length; i++) {
          if (!frozen[i]) activeWeight += widths[i]!
        }
        if (activeWeight <= 0) break

        let consumed = 0
        for (let i = 0; i < widths.length; i++) {
          if (frozen[i]) continue
          const current = widths[i]!
          const shrink = overflow * (current / activeWeight)
          const next = Math.max(minWidth, current - shrink)
          consumed += current - next
          widths[i] = next
        }

        overflow -= consumed
        if (consumed <= 0.1) break

        for (let i = 0; i < widths.length; i++) {
          if (!frozen[i] && widths[i]! <= minWidth + 0.1) {
            frozen[i] = true
            widths[i] = minWidth
          }
        }
      }

      total = widths.reduce((acc, w) => acc + w, 0)
      if (total > containerWidth) {
        let extra = total - containerWidth
        for (let i = widths.length - 1; i >= 0 && extra > 0; i--) {
          const current = widths[i]!
          if (current <= minWidth) continue
          const reducible = current - minWidth
          const cut = Math.min(reducible, extra)
          widths[i] = current - cut
          extra -= cut
        }
      }

      return widths
    }

    let flag = false
    let hasHiddenItems = false
    let cellIndex = 0

    for (let line = 1; line <= maxLines && cellIndex < cells.length; line++) {
      const isLastLine = line === maxLines
      const remainingLines = maxLines - line + 1
      const lineY = y + (rowHeightInPx['1'] === height ? 0 : 2) + (line - 1) * 28
      const remaining = cells.length - cellIndex

      let reserveEllipsisWidth = 0
      const maxChipsPerLine = Math.max(1, Math.floor((initialWidth + chipSpacing) / (minChipTextSafeWidth + chipSpacing)))
      let lineCellsCount = 1

      if (isLastLine) {
        const lastLineCapacityNoEllipsis = Math.max(
          1,
          Math.floor((initialWidth + chipSpacing) / (minChipTextSafeWidth + chipSpacing)),
        )
        if (remaining > lastLineCapacityNoEllipsis) {
          reserveEllipsisWidth = ellipsisWidth + 1
        }
        const lastLineCapacity = Math.max(
          1,
          Math.floor((Math.max(0, initialWidth - reserveEllipsisWidth) + chipSpacing) / (minChipTextSafeWidth + chipSpacing)),
        )
        lineCellsCount = Math.min(remaining, lastLineCapacity)
      } else {
        // Non-last line: use balanced soft threshold to distribute chips evenly across lines.
        const maxCountByFeasibility = Math.max(1, remaining - (remainingLines - 1))
        const hardLimit = Math.max(1, Math.min(maxChipsPerLine, maxCountByFeasibility))
        // Balanced minimum: spread remaining chips across remaining lines to avoid lopsided layouts (e.g. 1-1-4).
        const balancedMinCount = Math.max(1, Math.min(hardLimit, Math.ceil(remaining / remainingLines)))
        const remainingIdealTotal = chipIdealWidths
          .slice(cellIndex)
          .reduce((acc, w, idx) => acc + w + (idx > 0 ? chipSpacing : 0), 0)
        const softLineWidth =
          remainingLines > 1
            ? Math.max(minChipTextSafeWidth, Math.min(initialWidth, remainingIdealTotal / remainingLines))
            : initialWidth

        let lineIdealWidth = 0
        let count = 0
        while (count < hardLimit) {
          const w = chipIdealWidths[cellIndex + count]!
          const nextWidth = lineIdealWidth + (count > 0 ? chipSpacing : 0) + w
          if (count > 0 && nextWidth > softLineWidth) break
          lineIdealWidth = nextWidth
          count++
        }
        lineCellsCount = Math.max(balancedMinCount, count)
      }

      const chipRightBoundary = rightBoundary - reserveEllipsisWidth
      const availableLineWidth = Math.max(minChipTextSafeWidth, chipRightBoundary - initialX)
      const lineIdealWidths = chipIdealWidths.slice(cellIndex, cellIndex + lineCellsCount)
      const lineAssignedWidths = flexShrinkWidths(lineIdealWidths, availableLineWidth, minChipTextSafeWidth)

      currentX = initialX
      currentY = lineY

      for (let j = 0; j < lineCellsCount; j++) {
        const cell = cells[cellIndex + j]!
        const widthCap = Math.max(minChipTextSafeWidth, lineAssignedWidths[j] ?? minChipTextSafeWidth)
        const point = cellRenderer({
          ...renderProps,
          value: cell.value,
          x: currentX,
          y: currentY,
          width: widthCap,
        })

        const cellRightBoundary = Math.min(chipRightBoundary, currentX + widthCap)
        const boundedPointX = point?.x
          ? Math.min(point.x + chipEndCompensation, cellRightBoundary)
          : Math.min(currentX + widthCap, cellRightBoundary)

        returnData.push({
          oldX: currentX + 4,
          oldY: currentY + 4,
          x: boundedPointX,
          y: point?.y ?? currentY + 24,
          width: boundedPointX - (currentX + 4),
          height: point?.y ? point.y - (currentY + 4) : 24,
          value: cell.item,
        })

        if (
          !readonly &&
          selected &&
          isBoxHovered(
            { x: currentX, y: currentY, width: boundedPointX - currentX, height: point?.y ? point.y - currentY : 24 },
            mousePosition,
          )
        ) {
          setCursor('pointer')
        }

        currentX = boundedPointX
      }

      cellIndex += lineCellsCount

      if (isLastLine && cellIndex < cells.length) {
        flag = true
        hasHiddenItems = true
        break
      }
    }

    if (flag && hasHiddenItems) {
      // Anchor ellipsis to right boundary for consistent visual alignment.
      const ellipsisX = rightBoundary
      renderSingleLineText(ctx, {
        x: ellipsisX,
        y,
        text: '...',
        maxWidth: ellipsisWidth,
        textAlign: 'right',
        verticalAlign: 'middle',
        fontFamily: '500 13px Inter',
        fillStyle: '#666',
        height,
      })
    }

    ctx.restore()

    Object.assign(cellRenderStore, { ltar: returnData })

    if (selected) {
      const borderRadius = 6

      if (!readonly) {
        renderIconButton(ctx, {
          buttonX: x + width - 54,
          buttonY: y + 6,
          borderRadius,
          buttonSize,
          spriteLoader,
          mousePosition,
          icon: 'ncPlus',
          iconData: {
            size: 14,
            xOffset: 3,
            yOffset: 3,
            color: getColor(themeV4Colors.gray['700']),
          },
          setCursor,
          background: getColor(themeV4Colors.base.white),
          borderColor: getColor(themeV4Colors.gray['200']),
          hoveredBackground: getColor(themeV4Colors.gray['100']),
        })
      }

      renderIconButton(ctx, {
        buttonX: x + width - 30,
        buttonY: y + 6,
        borderRadius,
        buttonSize,
        spriteLoader,
        mousePosition,
        icon: 'maximize',
        setCursor,
        iconData: {
          size: 12,
          xOffset: 4,
          yOffset: 4,
          color: getColor(themeV4Colors.gray['700']),
        },
        background: getColor(themeV4Colors.base.white),
        borderColor: getColor(themeV4Colors.gray['200']),
        hoveredBackground: getColor(themeV4Colors.gray['100']),
      })
    }
  },
  async handleClick({
    row,
    column,
    getCellPosition,
    mousePosition,
    makeCellEditable,
    cellRenderStore,
    selected,
    isPublic,
    isDoubleClick,
    openDetachedExpandedForm,
  }) {
    if (!selected && !isDoubleClick) return false

    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width, height } = getCellPosition(column, rowIndex)

    /**
     * Note: The order of click action trigger is matter here to mimic behaviour of editable cell
     */

    /**
     * When user clicks on Maximize/Plus icon make cell editable
     * Open linked/unlinked record dropdown will handled in editable cell component
     */
    if (
      isBoxHovered({ x: x + width - 57, y: y + 7, height: buttonSize, width: buttonSize }, mousePosition) ||
      isBoxHovered({ x: x + width - 30, y: y + 7, height: buttonSize, width: buttonSize }, mousePosition)
    ) {
      makeCellEditable(row, column)
      return true
    }

    if ((selected || isDoubleClick) && ncIsArray(cellRenderStore?.ltar)) {
      // Value is array of object so we have to iterate over it
      for (const cellItem of cellRenderStore.ltar) {
        /**
         * Expand record on click chip item if cell is selected and user has permission to edit data (e.g, not readonly)
         */
        if (
          ncIsObject(cellItem.value) &&
          cellItem.width &&
          cellItem.height &&
          isBoxHovered(
            {
              x: cellItem.oldX!,
              y: cellItem.oldY!,
              height: cellItem.height,
              width: cellItem.width,
            },
            mousePosition,
          )
        ) {
          /**
           * To mimic editable cell behaviour we added return statement here
           * If isPublic (stop event propagation on click chip item) `@click.stop="openExpandedForm"`
           */
          if (isPublic) return true

          const rowId = extractPkFromRow(cellItem.value, (column.relatedTableMeta?.columns || []) as ColumnType[])
          if (rowId) {
            openDetachedExpandedForm({
              isOpen: true,
              row: { row: cellItem.value, rowMeta: {}, oldRow: { ...cellItem.value } },
              meta: column.relatedTableMeta || ({} as TableType),
              rowId,
              useMetaFields: true,
              maintainDefaultViewOrder: true,
              loadRow: !isPublic,
            })
          }

          /**
           * It's imp to add return here on click chip item to stop event propagation as while cell click action is also present below
           */
          return true
        }
      }
    }

    /**
     * This is same as `cellClickHook`, on click cell make cell editable
     */
    if ((selected || isDoubleClick) && isBoxHovered({ x, y, width, height }, mousePosition)) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  handleHover: async (props) => {
    const { row, column, mousePosition, getCellPosition, selected, t } = props

    if (!selected) return

    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width } = getCellPosition(column, rowIndex)

    const box = { x: x + width - 30, y: y + 4, width: buttonSize, height: buttonSize }

    tryShowTooltip({ rect: box, mousePosition, text: t('tooltip.expandShiftSpace') })
  },
}
