import {
  type ColumnType,
  type LookupType,
  type RollupType,
  UITypes,
  getRollupResultUidt,
  integerRollupFunctions,
  isSystemColumn,
} from 'nocodb-sdk'
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

const isAttachmentValue = (v: unknown) =>
  !!v && typeof v === 'object' && !Array.isArray(v) && ['path', 'url', 'signedPath', 'signedUrl'].some((k) => k in v)

/**
 * Stand-in for a Lookup's target column when the related table's meta is partial
 * (pk + display value only, e.g. a cross-base link into a base the user can't read).
 * Attachments are detected from the value; anything else renders as plain text.
 */
export const getFallbackLookupColumn = (column: ColumnType, value: unknown): ColumnType => {
  const values = (Array.isArray(value) ? value.flat(Infinity) : [value]).filter((v) => v !== null && v !== undefined)
  const isAttachment = values.length > 0 && values.every(isAttachmentValue)

  return {
    id: (column.colOptions as LookupType)?.fk_lookup_column_id,
    title: column.title,
    uidt: isAttachment ? UITypes.Attachment : UITypes.SingleLineText,
  }
}

/**
 * Stand-in for a Rollup's target column when the related table's meta lacks it. min/max
 * over a date keeps its date type (`colOptions.result_uidt`); everything else is numeric.
 */
export const getFallbackRollupColumn = (column: ColumnType): ColumnType => {
  const fn = (column.colOptions as RollupType)?.rollup_function ?? ''

  return {
    id: (column.colOptions as RollupType)?.fk_rollup_column_id,
    title: column.title,
    uidt: getRollupResultUidt(column) ?? (integerRollupFunctions.includes(fn) ? UITypes.Number : UITypes.Decimal),
  }
}
