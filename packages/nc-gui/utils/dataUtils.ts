import { RelationTypes, UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { isColumnRequiredAndNull } from './columnUtils'
import type { Row } from '~/lib/types'

export const isValidValue = (val: unknown) => {
  if (ncIsNull(val) || ncIsUndefined(val)) {
    return false
  }

  if (ncIsString(val) && val === '') {
    return false
  }

  if (ncIsEmptyArray(val)) {
    return false
  }

  if (ncIsEmptyObject(val)) {
    return false
  }

  return true
}

export const extractPkFromRow = (row: Record<string, any>, columns: ColumnType[]) => {
  if (!row || !columns) return null

  const pkCols = columns.filter((c: Required<ColumnType>) => c.pk)
  // if multiple pk columns, join them with ___ and escape _ in id values with \_ to avoid conflicts
  if (pkCols.length > 1) {
    return pkCols.map((c: Required<ColumnType>) => row?.[c.title]?.toString?.().replaceAll('_', '\\_') ?? null).join('___')
  } else if (pkCols.length) {
    const id = row?.[pkCols[0].title] ?? null
    return id === null ? null : `${id}`
  }
}

export const rowPkData = (row: Record<string, any>, columns: ColumnType[]) => {
  const pkData: Record<string, string> = {}
  const pks = columns?.filter((c) => c.pk)
  if (row && pks && pks.length) {
    for (const pk of pks) {
      if (pk.title) pkData[pk.title] = row[pk.title]
    }
  }
  return pkData
}

export const extractPk = (columns: ColumnType[]) => {
  if (!columns && !Array.isArray(columns)) return null
  return columns
    .filter((c) => c.pk)
    .map((c) => c.title)
    .join('___')
}

export const findIndexByPk = (pk: Record<string, string>, data: Row[]) => {
  for (const [i, row] of Object.entries(data)) {
    if (Object.keys(pk).every((k) => pk[k] === row.row[k])) {
      return parseInt(i)
    }
  }
  return -1
}

// a function to populate insert object and verify if all required fields are present
export async function populateInsertObject({
  getMeta,
  row,
  meta,
  ltarState,
  throwError,
  undo = false,
}: {
  meta: TableType
  ltarState: Record<string, any>
  getMeta: (tableIdOrTitle: string, force?: boolean) => Promise<TableType | null>
  row: Record<string, any>
  throwError?: boolean
  undo?: boolean
}) {
  const missingRequiredColumns = new Set()
  const insertObj = await meta.columns?.reduce(async (_o: Promise<any>, col) => {
    const o = await _o

    // if column is BT relation then check if foreign key is not_null(required)
    if (
      ltarState &&
      col.uidt === UITypes.LinkToAnotherRecord &&
      (<LinkToAnotherRecordType>col.colOptions).type === RelationTypes.BELONGS_TO
    ) {
      if (ltarState[col.title!]) {
        const colOpt = <LinkToAnotherRecordType>col.colOptions
        const childCol = meta.columns!.find((c) => colOpt.fk_child_column_id === c.id)
        const relatedTableMeta = (await getMeta(colOpt.fk_related_model_id!)) as TableType
        if (relatedTableMeta && childCol) {
          o[childCol.title!] =
            ltarState[col.title!][relatedTableMeta!.columns!.find((c) => c.id === colOpt.fk_parent_column_id)!.title!]
          missingRequiredColumns.delete(childCol.title)
        }
      }
    }
    // check all the required columns are not null
    if (isColumnRequiredAndNull(col, row)) {
      missingRequiredColumns.add(col.title)
    }

    if ((!col.ai || undo) && row?.[col.title as string] !== null) {
      o[col.title as string] = row?.[col.title as string]
    }

    return o
  }, Promise.resolve({}))

  if (throwError && missingRequiredColumns.size) {
    throw new Error(`Missing required columns: ${[...missingRequiredColumns].join(', ')}`)
  }

  return { missingRequiredColumns, insertObj }
}

// a function to get default values of row
export const rowDefaultData = (columns: ColumnType[] = []) => {
  const defaultData: Record<string, string> = columns.reduce<Record<string, any>>((acc: Record<string, any>, col: ColumnType) => {
    //  avoid setting default value for system col, virtual col, rollup, formula, barcode, qrcode, links, ltar
    if (
      !isSystemColumn(col) &&
      !isVirtualCol(col) &&
      ![UITypes.Rollup, UITypes.Lookup, UITypes.Formula, UITypes.Barcode, UITypes.QrCode].includes(col.uidt) &&
      isValidValue(col?.cdf) &&
      !/^\w+\(\)|CURRENT_TIMESTAMP$/.test(col.cdf)
    ) {
      const defaultValue = col.cdf
      acc[col.title!] = typeof defaultValue === 'string' ? defaultValue.replace(/^'|'$/g, '') : defaultValue
    }
    return acc
  }, {} as Record<string, any>)

  return defaultData
}

export const isRowEmpty = (record: any, col: any) => {
  if (!record || !col) return true

  const val = record.row[col.title]
  if (val === null || val === undefined || val === '') return true

  return Array.isArray(val) && val.length === 0
}
