import type { ColumnType, OutlineViewLevelType, TableType } from 'nocodb-sdk'
import { parseCellWidth } from '../../grid/canvas/utils/cell'
import { getSafe2DContext } from '../../grid/canvas/utils/safeCanvas'
import type { OutlineCanvasElement } from './types'
import {
  ADD_ROW_HEIGHT,
  CELL_PADDING,
  CHEVRON_COL_WIDTH,
  CHEVRON_SIZE,
  DEPTH_DECREASE_GAP,
  DEPTH_INCREASE_GAP,
  INDENT_PER_DEPTH,
  SUB_HEADER_HEIGHT,
} from './constants'
import type { OutlineViewRow } from '~/composables/useOutlineViewStore'

type GetColorFn = (cssVar: string, darkCssVar?: string, opacity?: number) => string

type RenderCellFn = (
  ctx: CanvasRenderingContext2D,
  column: ColumnType,
  options: {
    value: any
    row?: Record<string, any>
    x: number
    y: number
    width: number
    height: number
    pv?: boolean
    padding?: number
    pk?: any
    mousePosition?: { x: number; y: number }
    meta?: any
    isRowHovered?: boolean
    relatedColObj?: any
    relatedTableMeta?: any
    readonly?: boolean
  },
) => void

export function useCanvasRender({
  width,
  height,
  scrollLeft,
  scrollTop,
  headerRowHeight,
  rowHeight,
  cachedRows,
  rowSlice,
  slotHeight,
  totalRows,
  hoverRow,
  mousePosition,
  elementMap,
  isCollapsed,
  displayLevels,
  getColumnsForDepth,
  getColor,
  meta,
  renderCell,
  stickyHeaderDepth,
  isAddingEmptyRowAllowed,
}: {
  width: Ref<number>
  height: Ref<number>
  scrollLeft: Ref<number>
  scrollTop: Ref<number>
  headerRowHeight: ComputedRef<number>
  rowHeight: ComputedRef<number>
  cachedRows: Ref<Map<number, OutlineViewRow>>
  rowSlice: ComputedRef<{ start: number; end: number }>
  slotHeight: ComputedRef<number>
  totalRows: Ref<number>
  hoverRow: Ref<{ rowIndex: number }>
  mousePosition: { x: number; y: number }
  elementMap: Ref<OutlineCanvasElement[]>
  isCollapsed: (depth: number, pk: string) => boolean
  displayLevels: ComputedRef<OutlineViewLevelType[]>
  getColumnsForDepth: (depth: number) => CanvasGridColumn[]
  getColor: GetColorFn
  meta: Ref<TableType | undefined>
  renderCell: RenderCellFn
  stickyHeaderDepth: Ref<number>
  isAddingEmptyRowAllowed: ComputedRef<boolean>
}) {
  const canvasRef = ref<HTMLCanvasElement>()

  function getColors() {
    return {
      bg: getColor(themeV4Colors.base.white),
      rowBg: getColor(themeV4Colors.base.white),
      rowHoverBg: getColor(themeV4Colors.gray['50']),
      borderColor: getColor(themeV4Colors.gray['200']),
      borderLight: getColor(themeV4Colors.gray['100']),
      chevronColor: getColor(themeV4Colors.gray['500']),
      headerBg: getColor(themeV4Colors.base.white),
      headerText: getColor(themeV4Colors.gray['500']),
      subHeaderBg: getColor(themeV4Colors.base.white),
      subHeaderText: getColor(themeV4Colors.gray['500']),
      addRowBg: getColor(themeV4Colors.base.white),
      addRowText: getColor(themeV4Colors.gray['400']),
    }
  }

  function renderCanvas() {
    const canvas = canvasRef.value
    if (!canvas) return

    const ctx = getSafe2DContext(canvas)
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width.value * dpr
    canvas.height = height.value * dpr
    canvas.style.width = `${width.value}px`
    ctx.scale(dpr, dpr)

    const colors = getColors()

    ctx.clearRect(0, 0, width.value, canvas.height)
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width.value, canvas.height)

    elementMap.value = []

    const { start, end } = rowSlice.value
    const rows = cachedRows.value
    const sh = slotHeight.value

    const hh = headerRowHeight.value

    // Content starts after the sticky header
    let y = hh + start * sh // estimated start Y in content coords

    // Track the depth shown by the most recent sub-header that's
    // at or above the viewport top, so we can render a sticky header.
    let stickyDepth = 0
    let stickyFound = false

    // Track last parent PK per depth (for addRow context)
    const lastPkAtDepth: Record<number, string | number> = {}

    for (let i = start; i < end && i < totalRows.value; i++) {
      const row = rows.get(i)
      if (!row) {
        y += rowHeight.value
        continue
      }

      const depth = row.__nc_depth ?? 0

      // Check previous row for depth transitions
      const prevRow = i > 0 ? rows.get(i - 1) : undefined
      const prevDepth = prevRow ? prevRow.__nc_depth ?? 0 : i === 0 ? -1 : undefined

      if (prevDepth !== undefined) {
        if (depth > prevDepth) {
          // The very first group's header is covered by the sticky header — skip it
          const isFirstGroup = prevDepth === -1

          if (!isFirstGroup) {
            // Add gap before sub-header
            if (prevDepth >= 0) {
              y += DEPTH_INCREASE_GAP
            }
            // Entering a new group: draw sub-header
            const subHeaderScreenY = y - scrollTop.value
            if (subHeaderScreenY + SUB_HEADER_HEIGHT > hh && subHeaderScreenY < height.value) {
              renderSubHeader(ctx, depth, subHeaderScreenY, colors)
            }
            // Track for sticky: if this sub-header is at or above the header bottom
            if (subHeaderScreenY <= hh) {
              stickyDepth = depth
              stickyFound = true
            } else if (!stickyFound) {
              stickyDepth = depth
              stickyFound = true
            }
            y += SUB_HEADER_HEIGHT
          } else {
            // First group: sticky header covers it, just track depth
            stickyDepth = depth
            stickyFound = true
          }
        } else if (depth < prevDepth) {
          // Closing groups: draw add-row for each closed depth
          if (isAddingEmptyRowAllowed.value) {
            for (let d = prevDepth; d > depth; d--) {
              const addRowScreenY = y - scrollTop.value
              if (addRowScreenY + ADD_ROW_HEIGHT > hh && addRowScreenY < height.value) {
                renderAddRow(ctx, d, addRowScreenY, colors, lastPkAtDepth[d - 1])
              }
              y += ADD_ROW_HEIGHT
            }
          }

          // Re-render sub-header for the current depth
          // so column names are visible again after expanded children
          y += DEPTH_DECREASE_GAP
          const subHeaderScreenY = y - scrollTop.value
          if (subHeaderScreenY + SUB_HEADER_HEIGHT > hh && subHeaderScreenY < height.value) {
            renderSubHeader(ctx, depth, subHeaderScreenY, colors)
          }
          if (subHeaderScreenY <= hh) {
            stickyDepth = depth
            stickyFound = true
          }
          y += SUB_HEADER_HEIGHT
        }
      }

      // Render the data row
      const screenY = y - scrollTop.value
      if (screenY + rowHeight.value > hh && screenY < height.value) {
        renderRow(ctx, row, i, screenY, depth, colors)
      }

      // Track PK at this depth for addRow parent context
      lastPkAtDepth[depth] = row.__nc_pk

      // If no sub-header found yet, use this row's depth for the sticky
      if (!stickyFound) {
        stickyDepth = depth
        stickyFound = true
      }

      y += rowHeight.value
    }

    // After the last rendered row, insert trailing add-rows for open depths
    const lastRow = rows.get(end - 1)
    if (lastRow && end >= totalRows.value && isAddingEmptyRowAllowed.value) {
      const lastDepth = lastRow.__nc_depth ?? 0
      for (let d = lastDepth; d >= 1; d--) {
        const addRowScreenY = y - scrollTop.value
        if (addRowScreenY + ADD_ROW_HEIGHT > hh && addRowScreenY < height.value) {
          renderAddRow(ctx, d, addRowScreenY, colors, lastPkAtDepth[d - 1])
        }
        y += ADD_ROW_HEIGHT
      }
    }

    // Sticky header (drawn last to overlay — shows columns for the depth
    // of the sub-header that has scrolled past the viewport top)
    stickyHeaderDepth.value = stickyDepth
    renderHeader(ctx, stickyDepth, colors)
  }

  function renderHeader(ctx: CanvasRenderingContext2D, depth: number, colors: ReturnType<typeof getColors>) {
    const hh = headerRowHeight.value
    const cols = getColumnsForDepth(depth)
    const indent = CHEVRON_COL_WIDTH + depth * INDENT_PER_DEPTH

    // Background — shadow only when scrolled
    if (scrollTop.value > 0) {
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4
      ctx.fillStyle = colors.headerBg
      ctx.fillRect(0, -2, width.value, hh + 2)
      ctx.restore()
    } else {
      ctx.fillStyle = colors.headerBg
      ctx.fillRect(0, 0, width.value, hh)
    }

    if (cols.length === 0) return

    let x = indent - scrollLeft.value
    const isHeaderHovered = mousePosition.y >= 0 && mousePosition.y < hh

    ctx.font = '700 11px Inter'
    ctx.textBaseline = 'middle'

    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci]
      const w = parseCellWidth(col.width)

      ctx.fillStyle = colors.headerText
      const text = truncateText(ctx, col.title, w - CELL_PADDING * 2)
      ctx.fillText(text, x + CELL_PADDING, hh / 2)

      // Pill divider between columns (including after the last)
      if (isHeaderHovered) {
        const pillX = x + w
        renderHeaderPill(ctx, pillX, 0, hh)
      }

      x += w
    }
  }

  function renderSubHeader(ctx: CanvasRenderingContext2D, depth: number, screenY: number, colors: ReturnType<typeof getColors>) {
    const cols = getColumnsForDepth(depth)
    if (cols.length === 0) return

    const indent = CHEVRON_COL_WIDTH + depth * INDENT_PER_DEPTH

    // Track sub-header in element map for hit-testing (resize, etc.)
    elementMap.value.push({
      type: 'header',
      rowIndex: -1,
      x: 0,
      y: screenY,
      width: width.value,
      height: SUB_HEADER_HEIGHT,
      depth,
    })

    ctx.fillStyle = colors.subHeaderBg
    ctx.fillRect(0, screenY, width.value, SUB_HEADER_HEIGHT)

    const borderStartX = indent - scrollLeft.value

    ctx.strokeStyle = colors.borderLight
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(borderStartX, screenY + SUB_HEADER_HEIGHT - 0.5)
    ctx.lineTo(width.value, screenY + SUB_HEADER_HEIGHT - 0.5)
    ctx.stroke()

    let x = borderStartX
    const isSubHeaderHovered = mousePosition.y >= screenY && mousePosition.y < screenY + SUB_HEADER_HEIGHT

    ctx.font = '700 10px Inter'
    ctx.textBaseline = 'middle'

    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci]
      const w = parseCellWidth(col.width)

      ctx.fillStyle = colors.subHeaderText
      const text = truncateText(ctx, col.title, w - CELL_PADDING * 2)
      ctx.fillText(text, x + CELL_PADDING, screenY + SUB_HEADER_HEIGHT / 2)

      // Pill divider between columns (including after the last)
      if (isSubHeaderHovered) {
        const pillX = x + w
        renderHeaderPill(ctx, pillX, screenY, SUB_HEADER_HEIGHT)
      }

      x += w
    }
  }

  function renderAddRow(
    ctx: CanvasRenderingContext2D,
    depth: number,
    screenY: number,
    colors: ReturnType<typeof getColors>,
    parentPk?: string | number,
  ) {
    const rh = ADD_ROW_HEIGHT
    const indent = CHEVRON_COL_WIDTH + depth * INDENT_PER_DEPTH

    const isAddRowHovered = mousePosition.y >= screenY && mousePosition.y < screenY + rh

    ctx.fillStyle = isAddRowHovered ? getColor(themeV4Colors.gray['50']) : colors.addRowBg
    ctx.fillRect(0, screenY, width.value, rh)

    const borderStartX = indent - scrollLeft.value
    ctx.strokeStyle = colors.borderLight
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(borderStartX, screenY + rh - 0.5)
    ctx.lineTo(width.value, screenY + rh - 0.5)
    ctx.stroke()

    const x = borderStartX + CELL_PADDING
    ctx.font = '400 12px Inter'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = isAddRowHovered ? getColor(themeV4Colors.gray['600']) : colors.addRowText
    ctx.fillText('+ New record', x, screenY + rh / 2)

    elementMap.value.push({
      type: 'addRow',
      rowIndex: -1,
      x: 0,
      y: screenY,
      width: width.value,
      height: rh,
      depth,
      parentPk,
    })
  }

  function renderRow(
    ctx: CanvasRenderingContext2D,
    row: OutlineViewRow,
    rowIndex: number,
    screenY: number,
    depth: number,
    colors: ReturnType<typeof getColors>,
  ) {
    const rh = rowHeight.value
    const isHovered = hoverRow.value.rowIndex === rowIndex
    const maxDepth = displayLevels.value.length - 1
    const isParent = depth < maxDepth
    const collapsed = isCollapsed(depth, String(row.__nc_pk))
    const indent = CHEVRON_COL_WIDTH + depth * INDENT_PER_DEPTH

    // Row coloring
    const colorInfo = row.__nc_color as
      | {
          rowBgColor?: string
          rowHoverColor?: string
          rowLeftBorderColor?: string
          rowBorderColor?: string
          is_set_as_background?: boolean
        }
      | undefined

    const rowColor = colorInfo
      ? colorInfo.is_set_as_background && isHovered
        ? colorInfo.rowHoverColor
        : colorInfo.rowBgColor
      : null

    // Row background
    ctx.fillStyle = rowColor || (isHovered ? colors.rowHoverBg : colors.rowBg)
    ctx.fillRect(0, screenY, width.value, rh)

    // Row bottom border (starts from indent)
    const borderStartX = indent - scrollLeft.value
    ctx.strokeStyle = rowColor ? colorInfo?.rowBorderColor || colors.borderColor : colors.borderColor
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(borderStartX, screenY + rh - 0.5)
    ctx.lineTo(width.value, screenY + rh - 0.5)
    ctx.stroke()

    // Left border color indicator
    if (colorInfo?.rowLeftBorderColor) {
      const indicatorW = 4
      const indicatorH = rh - 8
      const indicatorX = borderStartX
      const indicatorY = screenY + (rh - indicatorH) / 2

      ctx.fillStyle = colorInfo.rowLeftBorderColor
      ctx.beginPath()
      ctx.roundRect(indicatorX, indicatorY, indicatorW, indicatorH, 8)
      ctx.fill()
    }

    // Element map: row
    elementMap.value.push({
      type: 'row',
      rowIndex,
      x: 0,
      y: screenY,
      width: width.value,
      height: rh,
      depth,
      pk: row.__nc_pk,
    })

    // Chevron
    if (isParent) {
      const chevronX = depth * INDENT_PER_DEPTH + (CHEVRON_COL_WIDTH - CHEVRON_SIZE) / 2 - scrollLeft.value
      const chevronY = screenY + 8

      renderChevron(ctx, chevronX, chevronY, collapsed, colors.chevronColor)

      // Hit area: full chevron column width for easier clicking
      const hitX = depth * INDENT_PER_DEPTH - scrollLeft.value
      elementMap.value.push({
        type: 'chevron',
        rowIndex,
        x: hitX,
        y: screenY,
        width: CHEVRON_COL_WIDTH,
        height: rh,
        depth,
        pk: row.__nc_pk,
      })
    }

    // Cell values per column
    const cols = getColumnsForDepth(depth)
    let x = indent - scrollLeft.value

    for (const col of cols) {
      const w = parseCellWidth(col.width)
      const value = row[col.title]
      const isEditable = !col.readonly

      // Editable cell: border + shadow
      if (isEditable && isHovered) {
        const cellX = x + 1
        const cellY = screenY + 2
        const cellW = w - 2
        const cellH = rh - 4

        // Shadow layers (approximate multi-layer CSS box-shadow)
        ctx.save()
        ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 1
        ctx.fillStyle = colors.rowBg
        ctx.beginPath()
        ctx.roundRect(cellX, cellY, cellW, cellH, 4)
        ctx.fill()
        ctx.restore()

        // Border
        ctx.strokeStyle = getColor(themeV4Colors.gray['300'])
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.roundRect(cellX, cellY, cellW, cellH, 4)
        ctx.stroke()
      }

      // Clip and render cell via the type-aware renderer
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, screenY, w, rh)
      ctx.clip()

      renderCell(ctx, col.columnObj, {
        value,
        row,
        x,
        y: screenY,
        width: w,
        height: rh,
        pv: col.pv,
        padding: CELL_PADDING,
        pk: row.__nc_pk,
        mousePosition,
        meta: meta.value,
        isRowHovered: isHovered,
        relatedColObj: col.relatedColObj,
        relatedTableMeta: col.relatedTableMeta,
        readonly: col.readonly,
      })

      ctx.restore()

      // Register editable cell hit region
      if (isEditable) {
        elementMap.value.push({
          type: 'cell',
          rowIndex,
          x,
          y: screenY,
          width: w,
          height: rh,
          depth,
          pk: row.__nc_pk,
          columnId: col.id,
        })
      }

      x += w
    }

    // "Open >" expand button on hover — positioned at the right of the first cell
    if (isHovered && cols.length > 0) {
      const firstColW = parseCellWidth(cols[0].width)
      const firstCellX = indent - scrollLeft.value

      const label = 'Open'
      ctx.font = '500 11px Inter'
      const labelW = ctx.measureText(label).width
      const chevronW = 5
      const btnPadH = 6
      const btnGap = 3
      const btnW = btnPadH + labelW + btnGap + chevronW + btnPadH
      const btnH = 20
      const btnX = firstCellX + firstColW - btnW - CELL_PADDING
      const btnY = screenY + (rh - btnH) / 2

      // Only render if button fits inside first cell
      if (btnX > firstCellX + CELL_PADDING) {
        // Background pill
        ctx.fillStyle = getColor(themeV4Colors.gray['100'])
        ctx.beginPath()
        ctx.roundRect(btnX, btnY, btnW, btnH, 4)
        ctx.fill()

        // Check hover over expand button
        const isBtnHovered =
          mousePosition.x >= btnX && mousePosition.x <= btnX + btnW && mousePosition.y >= btnY && mousePosition.y <= btnY + btnH

        if (isBtnHovered) {
          ctx.fillStyle = getColor(themeV4Colors.gray['200'])
          ctx.beginPath()
          ctx.roundRect(btnX, btnY, btnW, btnH, 4)
          ctx.fill()
        }

        // Label text
        ctx.fillStyle = getColor(themeV4Colors.gray['600'])
        ctx.font = '500 11px Inter'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, btnX + btnPadH, btnY + btnH / 2)

        // Right chevron ">"
        const chevronX = btnX + btnPadH + labelW + btnGap
        const chevronCY = btnY + btnH / 2
        const cs = 3
        ctx.beginPath()
        ctx.moveTo(chevronX, chevronCY - cs)
        ctx.lineTo(chevronX + cs, chevronCY)
        ctx.lineTo(chevronX, chevronCY + cs)
        ctx.strokeStyle = getColor(themeV4Colors.gray['600'])
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Element map for click
        elementMap.value.push({
          type: 'expandRow',
          rowIndex,
          x: btnX,
          y: btnY,
          width: btnW,
          height: btnH,
          depth,
          pk: row.__nc_pk,
        })
      }
    }
  }

  function renderHeaderPill(ctx: CanvasRenderingContext2D, pillX: number, headerY: number, headerH: number) {
    const pillW = 3
    const pillH = 14
    const pillR = 1.5
    const px = pillX - pillW / 2
    const py = headerY + (headerH - pillH) / 2

    // Check if mouse is directly over the pill (generous hit area)
    const hitPadX = 8
    const hitPadY = 4
    const isHovered =
      mousePosition.x >= px - hitPadX &&
      mousePosition.x <= px + pillW + hitPadX &&
      mousePosition.y >= py - hitPadY &&
      mousePosition.y <= py + pillH + hitPadY

    ctx.fillStyle = isHovered ? getColor(themeV4Colors.brand['500']) : getColor(themeV4Colors.gray['300'])

    ctx.beginPath()
    ctx.roundRect(px, py, pillW, pillH, pillR)
    ctx.fill()
  }

  function renderChevron(ctx: CanvasRenderingContext2D, x: number, y: number, collapsed: boolean, color: string) {
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()

    const cx = x + CHEVRON_SIZE / 2
    const cy = y + CHEVRON_SIZE / 2
    const s = 4

    if (collapsed) {
      ctx.moveTo(cx - s / 2 + 1, cy - s)
      ctx.lineTo(cx + s / 2 + 1, cy)
      ctx.lineTo(cx - s / 2 + 1, cy + s)
    } else {
      ctx.moveTo(cx - s, cy - s / 2 + 1)
      ctx.lineTo(cx, cy + s / 2 + 1)
      ctx.lineTo(cx + s, cy - s / 2 + 1)
    }

    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (maxWidth <= 0) return ''
    if (ctx.measureText(text).width <= maxWidth) return text

    const ellipsis = '...'
    const ew = ctx.measureText(ellipsis).width
    let lo = 0
    let hi = text.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (ctx.measureText(text.slice(0, mid)).width + ew <= maxWidth) lo = mid
      else hi = mid - 1
    }
    return text.slice(0, lo) + ellipsis
  }

  return {
    canvasRef,
    renderCanvas,
  }
}
