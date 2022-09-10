import type { ColumnType } from 'nocodb-sdk'

export const extractPkFromRow = (row: Record<string, any>, columns: ColumnType[]) => {
  return (
    row &&
    columns
      ?.filter((c) => c.pk)
      .map((c) => row?.[c.title as string])
      .join('___')
  )
}
