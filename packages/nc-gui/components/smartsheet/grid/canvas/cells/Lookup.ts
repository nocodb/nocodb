import { isVirtualCol, RelationTypes, UITypes, type ColumnType, type LookupType, type RollupType } from 'nocodb-sdk'

export const LookupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, relatedColObj, relatedTableMeta, renderCell } = props

    // If it is empty text then no need to render
    if (!isValidValue(value)) return

    const colOptions = column.colOptions as LookupType

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
    }

    // Todo: handle x and y value if we are rendering multiple chips
    if (isVirtualCol(lookupColumn) && lookupColumn.uidt !== UITypes.Rollup) {
      if (
        lookupColumn.uidt !== UITypes.LinkToAnotherRecord ||
        (lookupColumn.uidt === UITypes.LinkToAnotherRecord &&
          [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(lookupColumn.colOptions?.type))
      ) {
        arrValue.forEach((v) => {
          renderCell(ctx, lookupColumn, { ...renderProps, value: v })
        })
      } else {
        renderCell(ctx, lookupColumn, renderProps)
      }
    } else {
      if (isAttachment(lookupColumn) && arrValue[0] && !Array.isArray(arrValue[0]) && typeof arrValue[0] === 'object') {
        renderCell(ctx, lookupColumn, renderProps)
      } else {
        let x = renderProps.x
        arrValue.forEach((v) => {
          renderCell(ctx, lookupColumn, { ...renderProps, value: v, x })
          x += 50
        })
      }
    }
  },
}
