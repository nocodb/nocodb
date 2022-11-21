import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'

export const dataTypeLow = (column: ColumnType) => column.dt?.toLowerCase()
export const isBoolean = (abstractType: any) => abstractType === 'boolean'
export const isString = (column: ColumnType, abstractType: any) =>
  column.uidt === UITypes.SingleLineText || abstractType === 'string'
export const isTextArea = (column: ColumnType) => column.uidt === UITypes.LongText
export const isInt = (column: ColumnType, abstractType: any) => abstractType === 'integer'
export const isFloat = (column: ColumnType, abstractType: any) => abstractType === 'float' || abstractType === UITypes.Number
export const isDate = (column: ColumnType, abstractType: any) => abstractType === 'date' || column.uidt === UITypes.Date
export const isYear = (column: ColumnType, abstractType: any) => abstractType === 'year' || column.uidt === UITypes.Year
export const isTime = (column: ColumnType, abstractType: any) => abstractType === 'time' || column.uidt === UITypes.Time
export const isDateTime = (column: ColumnType, abstractType: any) =>
  abstractType === 'datetime' || column.uidt === UITypes.DateTime
export const isJSON = (column: ColumnType) => column.uidt === UITypes.JSON
export const isEnum = (column: ColumnType) => column.uidt === UITypes.SingleSelect
export const isSingleSelect = (column: ColumnType) => column.uidt === UITypes.SingleSelect
export const isSet = (column: ColumnType) => column.uidt === UITypes.MultiSelect
export const isMultiSelect = (column: ColumnType) => column.uidt === UITypes.MultiSelect
export const isURL = (column: ColumnType) => column.uidt === UITypes.URL
export const isEmail = (column: ColumnType) => column.uidt === UITypes.Email
export const isAttachment = (column: ColumnType) => column.uidt === UITypes.Attachment
export const isRating = (column: ColumnType) => column.uidt === UITypes.Rating
export const isCurrency = (column: ColumnType) => column.uidt === UITypes.Currency
export const isPhoneNumber = (column: ColumnType) => column.uidt === UITypes.PhoneNumber
export const isDecimal = (column: ColumnType) => column.uidt === UITypes.Decimal
export const isDuration = (column: ColumnType) => column.uidt === UITypes.Duration
export const isPercent = (column: ColumnType) => column.uidt === UITypes.Percent
export const isSpecificDBType = (column: ColumnType) => column.uidt === UITypes.SpecificDBType
export const isAutoSaved = (column: ColumnType) =>
  [
    UITypes.SingleLineText,
    UITypes.LongText,
    UITypes.PhoneNumber,
    UITypes.Email,
    UITypes.URL,
    UITypes.Number,
    UITypes.Decimal,
    UITypes.Percent,
    UITypes.Count,
    UITypes.AutoNumber,
    UITypes.SpecificDBType,
    UITypes.Geometry,
    UITypes.Duration,
  ].includes(column.uidt as UITypes)

export const isManualSaved = (column: ColumnType) =>
  [UITypes.Currency, UITypes.Year, UITypes.Time].includes(column.uidt as UITypes)

export const isPrimary = (column: ColumnType) => !!column.pv

export const isPrimaryKey = (column: ColumnType) => !!column.pk
