import { isVirtualCol, RelationTypes, UITypes, type ColumnType, type LookupType, type RollupType } from 'nocodb-sdk'

export const LookupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, x: _x, y: _y, value, renderCell, metas } = props
    let x = _x
    let y = _y
    // If it is empty text then no need to render
    if (!isValidValue(value) || !metas) return

    const colOptions = column.colOptions as LookupType

    const relatedColObj = metas.value?.[column.fk_model_id!]?.columns?.find(
      (c) => c.id === column?.colOptions?.fk_relation_column_id,
    ) as ColumnType

    if (!relatedColObj) return

    const relatedTableMeta = metas.value?.[relatedColObj.colOptions?.fk_related_model_id]

    const lookupColumn = (relatedTableMeta?.columns || []).find((c: ColumnType) => c.id === colOptions?.fk_lookup_column_id)

    if (!lookupColumn) return

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

    const renderProps: CellRendererOptions = {
      ...props,
      column: lookupColumn,
      relatedColObj: undefined,
      relatedTableMeta: undefined,
      isUnderLookup: true,
      readonly: true,
      value: arrValue,
      height: isAttachment(lookupColumn) ? props.height : rowHeightInPx['1']!,
      tag: {
        renderAsTag: true,
      },
    }

    // Todo: handle x and y value if we are rendering multiple chips also we have to wrap each cell in chip
    if (isVirtualCol(lookupColumn) && lookupColumn.uidt !== UITypes.Rollup) {
      if (
        lookupColumn.uidt !== UITypes.LinkToAnotherRecord ||
        (lookupColumn.uidt === UITypes.LinkToAnotherRecord &&
          [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(lookupColumn.colOptions?.type))
      ) {
        arrValue.forEach((v) => {
          renderCell(ctx, lookupColumn, { ...renderProps, value: v, x, y })
          x = _x
          // y = y + 28
        })
      } else {
        renderCell(ctx, lookupColumn, renderProps)
      }
    } else {
      if (isAttachment(lookupColumn) && arrValue[0] && !Array.isArray(arrValue[0]) && typeof arrValue[0] === 'object') {
        renderCell(ctx, lookupColumn, renderProps)
      } else {
        arrValue.forEach((v) => {
          const point = renderCell(ctx, lookupColumn, { ...renderProps, value: v, x, y })
          x = point?.x ? point?.x + 4 : _x
          y = point?.y ? point?.y + 4 : _y + 24
        })
      }
    }
  },
}
