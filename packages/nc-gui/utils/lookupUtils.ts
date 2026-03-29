import type { ColumnType } from 'nocodb-sdk'
import { isSystemColumn, UITypes } from 'nocodb-sdk'

const unsupportedUITypes = [UITypes.Button]

export function getValidLookupColumn({ lookupColumnId, column }: { lookupColumnId?: string, column: ColumnType }) {
  return (
    (!lookupColumnId || column.id !== lookupColumnId)
    && !isSystemColumn(column)
    && !unsupportedUITypes.includes(column.uidt as UITypes)
  )
}

export function getValidLookupColumns({ lookupColumnId, columns }: { lookupColumnId?: string, columns: ColumnType[] }) {
  return columns.map(column =>
    getValidLookupColumn({
      lookupColumnId,
      column,
    }),
  )
}
