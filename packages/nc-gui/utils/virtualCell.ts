import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes } from 'nocodb-sdk'

export const isLTAR = (uidt: string, colOptions: unknown): colOptions is LinkToAnotherRecordType =>
  uidt === UITypes.LinkToAnotherRecord

export const isHm = (column: ColumnType) =>
  isLTAR(column.uidt, column.colOptions) && column.colOptions.type === RelationTypes.HAS_MANY

export const isMm = (column: ColumnType) =>
  isLTAR(column.uidt, column.colOptions) && column.colOptions.type === RelationTypes.MANY_TO_MANY

export const isBt = (column: ColumnType) =>
  isLTAR(column.uidt, column.colOptions) && column.colOptions.type === RelationTypes.BELONGS_TO

export const isLookup = (column: ColumnType) => column.uidt === UITypes.Lookup
export const isRollup = (column: ColumnType) => column.uidt === UITypes.Rollup
export const isFormula = (column: ColumnType) => column.uidt === UITypes.Formula
export const isCount = (column: ColumnType) => column.uidt === UITypes.Count
