import { type ColumnType, type LookupType, RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { getSingleMultiselectColOptions, renderAsCellLookupOrLtarValue } from '../utils/cell'
import { renderSingleLineText } from '../utils/canvas'
import { PlainCellRenderer } from './Plain'

const renderOnly1Row = [UITypes.QrCode, UITypes.Barcode]

const ellipsisWidth = 15

export const LookupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, x: _x, y: _y, value, renderCell, metas, height, width: _width, padding = 10, tableMetaLoader } = props
    let x = _x
    let y = _y
    let width = _width - ellipsisWidth
    // If it is empty text then no need to render
    if (!isValidValue(value) || !metas) return

    const colOptions = column.colOptions as LookupType

    const relatedColObj = metas?.[column.fk_model_id!]?.columns?.find(
      (c) => c.id === column?.colOptions?.fk_relation_column_id,
    ) as ColumnType

    if (!relatedColObj) return

    const relatedTableMeta = metas?.[relatedColObj.colOptions?.fk_related_model_id]

    // Load related table meta if not present
    if (!relatedTableMeta) {
      if (tableMetaLoader.isLoading(relatedColObj.colOptions?.fk_related_model_id)) return

      tableMetaLoader.getTableMeta(relatedColObj.colOptions?.fk_related_model_id)

      return
    }

    const lookupColumn = (relatedTableMeta?.columns || []).find((c: ColumnType) => c.id === colOptions?.fk_lookup_column_id)

    if (!lookupColumn || lookupColumn?.uidt === UITypes.Button) return

    y = y + (renderOnly1Row.includes(lookupColumn.uidt) ? Math.floor(height / 2 - rowHeightInPx['1']! / 2) : 0)

    if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(lookupColumn.uidt)) {
      lookupColumn.extra = getSingleMultiselectColOptions(lookupColumn)
    }

    let arrValue = []

    if (
      lookupColumn.uidt === UITypes.Attachment &&
      [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(relatedColObj?.colOptions?.type)
    ) {
      arrValue = [value]
    } else if (ncIsArray(value)) {
      arrValue = value.filter((v) => v !== null)
    } else {
      arrValue = [value]
    }

    if (!arrValue.length) return

    // Begin clipping
    ctx.save()
    ctx.beginPath()
    ctx.rect(_x, _y, _width, height) // Define the clipping rectangle
    ctx.clip()

    const renderProps: CellRendererOptions = {
      ...props,
      column: lookupColumn,
      relatedColObj: undefined,
      relatedTableMeta: undefined,
      isUnderLookup: true,
      readonly: true,
      value: arrValue,
      height: rowHeightInPx['1']!,
      padding: 10,
      tag: {
        renderAsTag: true,
        tagBgColor: themeV3Colors.base.white,
        tagHeight: 20,
        tagBorderColor: themeV3Colors.gray['200'],
        tagBorderWidth: 1,
      },
      meta: relatedTableMeta,
    }

    const lookupRenderer = (options: CellRendererOptions) => {
      return renderAsCellLookupOrLtarValue.includes(lookupColumn.uidt) || isRichText(lookupColumn)
        ? renderCell(ctx, lookupColumn, options)
        : PlainCellRenderer.render(ctx, options)
    }

    const maxLines = rowHeightTruncateLines(height, true)
    let line = 1
    let flag = false
    let count = 1

    const handleRenderEllipsis = () => {
      renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text: '...',
        maxWidth: ellipsisWidth,
        textAlign: 'right',
        verticalAlign: 'middle',
        fontFamily: '500 13px Manrope',
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

        if (point?.x && !point?.nextLine) {
          if (point?.x >= _x + _width - padding * 2 - 50) {
            x = _x
            width = _width
            y = point?.y && y !== point?.y && point?.y - y >= 24 ? point?.y : y + 24
            line += 1
            if (renderOnly1Row.includes(lookupColumn.uidt)) break
          } else {
            width = _x + _width - (point?.x - 2 * 4) - padding * 2
            x = point?.x
          }
        } else {
          x = _x
          y += 24
          width = _width
          line += 1
          if (renderOnly1Row.includes(lookupColumn.uidt)) break
        }

        if (line > maxLines) {
          break
        }
        count++
      }
    }

    if (isVirtualCol(lookupColumn) && lookupColumn.uidt !== UITypes.Rollup) {
      if (
        lookupColumn.uidt !== UITypes.LinkToAnotherRecord ||
        (lookupColumn.uidt === UITypes.LinkToAnotherRecord &&
          [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(lookupColumn.colOptions?.type))
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
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (e.key === 'Enter') {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
