import { type ColumnType, type LinkToAnotherRecordType, isVirtualCol } from 'nocodb-sdk'
import {
  RelationTypes,
  UITypes,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isSystemColumn,
} from 'nocodb-sdk'

export const isLTAR = (uidt: string | undefined, colOptions: unknown): colOptions is LinkToAnotherRecordType => {
  if (!uidt) return false
  return isLinksOrLTAR(uidt)
}

export const isHm = (column: ColumnType) =>
  isLTAR(column.uidt!, column.colOptions) && column.colOptions?.type === RelationTypes.HAS_MANY

export const isMm = (column: ColumnType) =>
  isLTAR(column.uidt!, column.colOptions) && column.colOptions?.type === RelationTypes.MANY_TO_MANY

export const isBt = (column: ColumnType) =>
  isLTAR(column.uidt!, column.colOptions) && column.colOptions?.type === RelationTypes.BELONGS_TO

export const isOo = (column: ColumnType) =>
  isLTAR(column.uidt!, column.colOptions) && column.colOptions?.type === RelationTypes.ONE_TO_ONE

export const isLookup = (column: ColumnType) => column.uidt === UITypes.Lookup
export const isRollup = (column: ColumnType) => column.uidt === UITypes.Rollup
export const isFormula = (column: ColumnType) => column.uidt === UITypes.Formula
export const isQrCode = (column: ColumnType) => column.uidt === UITypes.QrCode
export const isBarcode = (column: ColumnType) => column.uidt === UITypes.Barcode
export const isCount = (column: ColumnType) => column.uidt === UITypes.Count
export const isLink = (column: ColumnType) => column.uidt === UITypes.Links

export function isReadOnlyVirtualCell(col: ColumnType) {
  return (
    isRollup(col) ||
    isFormula(col) ||
    isBarcode(col) ||
    isLookup(col) ||
    isQrCode(col) ||
    isSystemColumn(col) ||
    isCreatedOrLastModifiedTimeCol(col) ||
    isCreatedOrLastModifiedByCol(col)
  )
}

export const isReadonly = (col: ColumnType) => {
  return (
    isSystemColumn(col) ||
    isLookup(col) ||
    isRollup(col) ||
    isFormula(col) ||
    isButton(col) ||
    isVirtualCol(col) ||
    isCreatedOrLastModifiedTimeCol(col) ||
    isCreatedOrLastModifiedByCol(col)
  )
}
