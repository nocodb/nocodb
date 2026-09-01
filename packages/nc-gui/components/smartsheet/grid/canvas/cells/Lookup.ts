import {
  NC_ERROR_SENTINEL,
  RelationTypes,
  UITypes,
  getEffectiveLookupColumn,
  getMetaWithCompositeKey,
  isBtLikeV2Junction,
  isLinksOrLTAR,
  isVirtualCol,
} from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, LookupType, TableType } from 'nocodb-sdk'
import { getRelatedBaseId, getSingleMultiselectColOptions, getUserColOptions, renderAsCellLookupOrLtarValue } from '../utils/cell'
import { isBoxHovered, renderCellError, renderSingleLineText } from '../utils/canvas'
import { PlainCellRenderer } from './Plain'

const renderOnly1Row = [UITypes.QrCode, UITypes.Barcode, UITypes.Attachment, UITypes.LinkToAnotherRecord, UITypes.Links]

const ellipsisWidth = 15

export const LookupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const {
      column,
      x: _x,
      y: _y,
      value,
      renderCell,
      metas,
      meta,
      height,
      width: _width,
      padding = 10,
      tableMetaLoader,
      row,
      getColor,
      cellRenderStore,
      mousePosition,
      selected,
      setCursor,
    } = props
    let x = _x
    let y = _y
    let width = _width - ellipsisWidth

    if (parseProp(column.colOptions)?.error || value === NC_ERROR_SENTINEL) {
      renderCellError(ctx, { x, y, width: _width, height, padding, getColor })
      return
    }

    // If it is empty text then no need to render
    if (!metas) return

    const colOptions = column.colOptions as LookupType

    const relatedColObj = getMetaWithCompositeKey(metas, meta?.base_id, column.fk_model_id)?.columns?.find(
      (c: any) => c.id === (column?.colOptions as LookupType)?.fk_relation_column_id,
    ) as ColumnType

    if (!relatedColObj) return

    const relatedColOptions = relatedColObj.colOptions as LinkToAnotherRecordType
    if (!relatedColOptions) return

    // Get the correct base ID for the related table (handles cross-base links)
    const relatedBaseId = getRelatedBaseId(relatedColObj, meta?.base_id || '')
    const relatedTableMeta = getMetaWithCompositeKey(metas, relatedBaseId, relatedColOptions.fk_related_model_id)

    // Load related table meta if not present
    if (!relatedTableMeta) {
      const relatedModelId = relatedColOptions.fk_related_model_id
      if (!relatedModelId) return

      if (!tableMetaLoader || tableMetaLoader.isLoading(relatedModelId, relatedBaseId)) return

      tableMetaLoader.getTableMeta(relatedModelId, relatedBaseId)

      return
    }

    const lookupColumn = (relatedTableMeta?.columns || []).find((c: ColumnType) => c.id === colOptions?.fk_lookup_column_id)

    if (!lookupColumn || lookupColumn?.uidt === UITypes.Button) return

    // Apply the lookup column's own formatting override (meta.display_type +
    // meta.display_column_meta) on top of the resolved child column. For number/date
    // result types this swaps in the chosen display type + format meta; otherwise the
    // child column is returned unchanged so its native formatting is inherited.
    const effectiveLookupColumn = getEffectiveLookupColumn(parseProp(column.meta), lookupColumn)

    y =
      y +
      (renderOnly1Row.includes(lookupColumn.uidt) && lookupColumn.uidt !== UITypes.Attachment
        ? Math.floor(height / 2 - rowHeightInPx['1']! / 2)
        : 0)

    if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(lookupColumn.uidt)) {
      lookupColumn.extra = getSingleMultiselectColOptions(lookupColumn)
    } else if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(lookupColumn.uidt)) {
      lookupColumn.extra = getUserColOptions(lookupColumn, props.baseUsers || [])
    }

    // Resolve the leaf of a nested lookup chain (Lookup -> Lookup -> ... -> X).
    // When the chain ultimately points to an Attachment, the value reaching
    // here is already a flat array of attachment objects, so it must render as
    // a single attachment strip rather than one stacked nested cell per file.
    // When it points to a URL, the intermediate Lookup hop would otherwise drop
    // the URL type and render the value as a plain string, so capture the leaf
    // to render it through the URL renderer (a clickable link) instead.
    let attachmentLeafColumn: ColumnType | undefined
    let nestedLeafColumn: ColumnType | undefined
    if (lookupColumn.uidt === UITypes.Lookup) {
      let nextCol: ColumnType | undefined = lookupColumn
      let ownMeta: TableType | undefined = relatedTableMeta
      let guard = 0
      while (nextCol && nextCol.uidt === UITypes.Lookup && guard++ < 20) {
        const lkOpt = nextCol.colOptions as LookupType
        const relCol = ownMeta?.columns?.find((c) => c.id === lkOpt.fk_relation_column_id)
        const relOpt = relCol?.colOptions as LinkToAnotherRecordType | undefined
        if (!relCol || !relOpt?.fk_related_model_id) {
          nextCol = undefined
          break
        }

        const leafBaseId = getRelatedBaseId(relCol, ownMeta?.base_id || '')
        const leafMeta = getMetaWithCompositeKey(metas, leafBaseId, relOpt.fk_related_model_id)

        // Leaf meta not loaded yet — request it and bail (before any clipping).
        if (!leafMeta) {
          if (tableMetaLoader && !tableMetaLoader.isLoading(relOpt.fk_related_model_id, leafBaseId)) {
            tableMetaLoader.getTableMeta(relOpt.fk_related_model_id, leafBaseId)
          }
          return
        }

        ownMeta = leafMeta
        nextCol = leafMeta.columns?.find((c) => c.id === lkOpt.fk_lookup_column_id)
      }

      nestedLeafColumn = nextCol

      if (nextCol && isAttachment(nextCol)) {
        attachmentLeafColumn = nextCol
      }
    }

    // The URL column to render each value with — a single-level URL lookup, or the
    // resolved leaf of a nested chain ending in a URL. Rendered as a clickable link
    // (like a plain URL field) rather than a generic string.
    const urlLeafColumn: ColumnType | undefined =
      lookupColumn.uidt === UITypes.URL ? lookupColumn : nestedLeafColumn?.uidt === UITypes.URL ? nestedLeafColumn : undefined

    // Clickable link boxes recorded during render for handleClick / cursor.
    const urlLinkBoxes: { x: number; y: number; width: number; height: number; url: string }[] = []

    const getArrValue = () => {
      const relatedColType = (relatedColObj.colOptions as LinkToAnotherRecordType)?.type

      if (
        lookupColumn.uidt === UITypes.Checkbox &&
        relatedColType &&
        [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(relatedColType as RelationTypes)
      ) {
        const hasLink = !!(row && relatedColObj?.title && row[relatedColObj.title])

        if (!value && !hasLink) return []

        return (ncIsArray(value) ? value : [value]).map(getCheckBoxValue)
      }

      if (ncIsNullOrUndefined(value)) return []

      if (lookupColumn.uidt === UITypes.Attachment || attachmentLeafColumn) {
        if (relatedColType && [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(relatedColType as RelationTypes)) {
          return ncIsArray(value) ? value : [value]
        }

        if (
          ncIsArray(value) &&
          value.every((v) => {
            if (ncIsNull(v)) return true

            if (ncIsArray(v)) {
              return !v.length || ncIsObject(v[0])
            }

            return false
          })
        ) {
          return value
            .filter((v) => v !== null)
            .reduce((acc, v) => {
              acc.push(...v)

              return acc
            }, [])
        }
      }

      if (ncIsArray(value)) {
        return value.filter((v) => v !== null)
      }

      return [value]
    }

    const arrValue = getArrValue()

    if (!arrValue.length) return

    // Begin clipping
    ctx.save()
    ctx.beginPath()
    ctx.rect(_x, _y, _width - padding, height) // Define the clipping rectangle
    ctx.clip()

    let lkRelatedTableMeta: TableType | undefined

    // if lookup column is LTAR/Links then extract the related table meta
    const lkRelatedModelId = (lookupColumn.colOptions as LinkToAnotherRecordType)?.fk_related_model_id

    if (isLinksOrLTAR(lookupColumn) && lkRelatedModelId) {
      // Get the correct base ID for the lookup column's related table (handles cross-base links)
      const lkRelatedBaseId = (lookupColumn.colOptions as LinkToAnotherRecordType)?.fk_related_base_id || relatedBaseId
      lkRelatedTableMeta = getMetaWithCompositeKey(metas, lkRelatedBaseId, lkRelatedModelId)

      // Load related table meta if not present
      if (!lkRelatedTableMeta) {
        // Restore canvas context before returning — ctx.save()/ctx.clip() was already called above
        ctx.restore()

        if (!tableMetaLoader || tableMetaLoader.isLoading(lkRelatedModelId, lkRelatedBaseId)) return

        tableMetaLoader.getTableMeta(lkRelatedModelId, lkRelatedBaseId)

        return
      }
    }

    const renderProps: CellRendererOptions = {
      ...props,
      column: effectiveLookupColumn,
      relatedColObj: undefined,
      relatedTableMeta: lkRelatedTableMeta,
      isUnderLookup: true,
      readonly: true,
      value: arrValue,
      height: isAttachment(lookupColumn) ? height : rowHeightInPx['1']!,
      padding: 10,
      tag: {
        renderAsTag: true,
        tagBgColor: getColor(themeV4Colors.base.white),
        tagHeight: 20,
        tagBorderColor: getColor(themeV4Colors.gray['200']),
        tagBorderWidth: 1,
      },
      meta: relatedTableMeta,
      textAlign: isAttachment(lookupColumn) ? 'center' : props.textAlign,
      textColor: getColor(themeV4Colors.gray['700']),
    }

    // getEffectiveDisplayColumn returns a new object only when an override is active.
    const hasDisplayOverride = effectiveLookupColumn !== lookupColumn

    const lookupRenderer = (options: CellRendererOptions) => {
      // With a formatting override the result is always a scalar number/date type
      // (even for computed Formula/Rollup children), so render it as a plain value
      // using the effective column carried in options.column.
      if (hasDisplayOverride) {
        return PlainCellRenderer.render(ctx, options)
      }

      // Render a URL value (direct or resolved from a nested lookup chain) as a
      // clickable link, and record its box so handleClick can open it.
      if (urlLeafColumn) {
        const point = renderCell(ctx, urlLeafColumn, {
          ...options,
          column: urlLeafColumn,
          tag: { ...options.tag, renderAsTag: false },
        })

        const urlText = addMissingUrlSchma(options.value?.toString() ?? '')
        if (urlText && isValidURL(urlText)) {
          urlLinkBoxes.push({
            x: options.x,
            y: options.y,
            width: Math.max((point?.x ?? options.x) - options.x, 0),
            height: rowHeightInPx['1']!,
            url: urlText,
          })
        }

        return point
      }

      return renderAsCellLookupOrLtarValue.includes(lookupColumn.uidt) || isRichText(lookupColumn)
        ? renderCell(ctx, lookupColumn, options)
        : PlainCellRenderer.render(ctx, options)
    }

    const maxLines = rowHeightTruncateLines(height, true)
    let line = 1
    let flag = false
    let count = 1

    const handleRenderEllipsis = () => {
      if (x === _x) return

      renderSingleLineText(ctx, {
        x: x + padding,
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

    const handleRenderVirtualCol = () => {
      for (const v of arrValue) {
        const point = lookupRenderer({
          ...renderProps,
          value: v,
          x,
          y,
          width,
          tag: { ...renderProps.tag, renderAsTag: renderOnly1Row.includes(lookupColumn.uidt) },
        })

        if (renderOnly1Row.includes(lookupColumn.uidt)) {
          if (point?.x) {
            x = point?.x
          }
        } else if (point?.x) {
          if (point?.x >= _x + _width - padding * 2 - (count < arrValue.length ? 50 - ellipsisWidth : 0)) {
            if (line + 1 > maxLines || renderOnly1Row.includes(lookupColumn.uidt)) {
              flag = true
              break
            }

            x = _x
            width = _width - ellipsisWidth
            y = point?.y && y !== point?.y && point?.y - y >= 24 ? point?.y : y + 24
            line += 1
          } else {
            width = x + width - (point?.x - 2 * 4) - padding * 2 - ellipsisWidth
            x = point?.x
          }
        } else {
          if (line + 1 > maxLines || renderOnly1Row.includes(lookupColumn.uidt)) {
            break
          }

          x = _x
          y += 24
          width = _width
          line += 1
        }
        count += 1
      }

      if (flag && count < arrValue.length) {
        handleRenderEllipsis()
      }
    }

    const handleRenderDefault = () => {
      for (const v of arrValue) {
        const point = lookupRenderer({ ...renderProps, value: v, x, y, width })

        if (renderOnly1Row.includes(lookupColumn.uidt)) {
          if (point?.x) {
            x = point?.x
          }
        } else if (point?.x && !point?.nextLine) {
          if (point?.x >= _x + _width - padding * 4 - (line + 1 > maxLines && count < arrValue.length ? 50 - ellipsisWidth : 0)) {
            if (line + 1 > maxLines || renderOnly1Row.includes(lookupColumn.uidt)) {
              flag = true

              if (point?.x) {
                x = point?.x + padding
              } else {
                x = _x + _width - padding - ellipsisWidth
              }

              break
            }

            x = _x
            width = _width - ellipsisWidth
            y = point?.y && y !== point?.y && point?.y - y >= 24 ? point?.y : y + 24
            line += 1
          } else {
            width = _x + _width - (point?.x - 2 * 4) - padding * 2
            x = point?.x
          }
        } else {
          if (line + 1 > maxLines || renderOnly1Row.includes(lookupColumn.uidt)) {
            if (!point?.nextLine) {
              flag = true
            }
            break
          }

          x = _x
          y += 24
          width = _width
          line += 1
        }

        if (line > maxLines) {
          flag = true

          break
        }
        count++
      }

      if (flag && count < arrValue.length) {
        handleRenderEllipsis()
      }
    }

    if (attachmentLeafColumn && ncIsObject(arrValue[0])) {
      // Nested lookup whose leaf is an Attachment — render the flattened
      // attachment array as a single strip instead of one cell per file.
      renderCell(ctx, attachmentLeafColumn, {
        ...renderProps,
        column: attachmentLeafColumn,
        value: arrValue,
        height,
        textAlign: 'center',
        tag: { ...renderProps.tag, renderAsTag: false },
      })
    } else if (isVirtualCol(lookupColumn) && ![UITypes.Rollup, UITypes.Formula].includes(lookupColumn.uidt)) {
      if (
        lookupColumn.uidt !== UITypes.LinkToAnotherRecord ||
        (lookupColumn.uidt === UITypes.LinkToAnotherRecord &&
          (isBtLikeV2Junction(lookupColumn) ||
            [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(lookupColumn.colOptions?.type)))
      ) {
        handleRenderVirtualCol()
      } else {
        lookupRenderer({
          ...renderProps,
          tag: { ...renderProps.tag, renderAsTag: false },
        })
      }
    } else {
      if (isAttachment(lookupColumn) && ncIsObject(arrValue[0])) {
        renderCell(ctx, lookupColumn, {
          ...renderProps,
          tag: { ...renderProps.tag, renderAsTag: false },
        })
      } else {
        handleRenderDefault()
      }
    }

    // Restore context after clipping
    ctx.restore()

    // Expose the clickable URL link boxes for handleClick and show a pointer
    // cursor when hovering one (only meaningful once the cell is selected).
    if (urlLeafColumn && cellRenderStore) {
      cellRenderStore.links = urlLinkBoxes

      if (selected && mousePosition && urlLinkBoxes.some((box) => isBoxHovered(box, mousePosition))) {
        setCursor?.('pointer')
      }
    }
  },
  async handleClick(ctx) {
    const { selected, isDoubleClick, mousePosition, cellRenderStore } = ctx

    // Open a lookup URL value when the (selected) cell's link is clicked. Anything
    // else returns false so the default handling (e.g. double-click opens the
    // lookup value overlay) still runs.
    const links = cellRenderStore?.links
    if ((selected || isDoubleClick) && mousePosition && ncIsArray(links) && links.length) {
      for (const link of links) {
        if (isBoxHovered(link, mousePosition)) {
          confirmPageLeavingRedirect(link.url, '_blank')
          return true
        }
      }
    }

    return false
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (e.key === 'Enter' || isExpandCellKey(e)) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
