import { type ColumnType, UITypes, isSystemColumn } from 'nocodb-sdk'
const unsupportedUITypes = [UITypes.Button]

export const getValidLookupColumn = ({ lookupColumnId, column }: { lookupColumnId?: string; column: ColumnType }) => {
  return (
    (!lookupColumnId || column.id !== lookupColumnId) &&
    !isSystemColumn(column) &&
    !unsupportedUITypes.includes(column.uidt as UITypes)
  )
}

export const getValidLookupColumns = ({ lookupColumnId, columns }: { lookupColumnId?: string; columns: ColumnType[] }) => {
  return columns.map((column) =>
    getValidLookupColumn({
      lookupColumnId,
      column,
    }),
  )
}
