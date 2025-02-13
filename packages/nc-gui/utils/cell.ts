import type { ColumnType } from 'nocodb-sdk'
import { ButtonActionsType, UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import tinycolor from 'tinycolor2'

export const dataTypeLow = (column: ColumnType) => column.dt?.toLowerCase()
export const isBoolean = (column: ColumnType, abstractType?: any) =>
  column.uidt === UITypes.Checkbox || abstractType === 'boolean'
export const isString = (column: ColumnType, abstractType: any) =>
  column.uidt === UITypes.SingleLineText || abstractType === 'string'
export const isTextArea = (column: ColumnType) => column.uidt === UITypes.LongText
export const isRichText = (column: ColumnType) => column.uidt === UITypes.LongText && !!parseProp(column?.meta).richMode
export const isInt = (column: ColumnType, abstractType: any) => abstractType === 'integer'
export const isFloat = (column: ColumnType, abstractType: any) => abstractType === 'float' || abstractType === UITypes.Number
export const isDate = (column: ColumnType, abstractType: any) => abstractType === 'date' || column.uidt === UITypes.Date
export const isYear = (column: ColumnType, abstractType: any) => abstractType === 'year' || column.uidt === UITypes.Year
export const isTime = (column: ColumnType, abstractType: any) => abstractType === 'time' || column.uidt === UITypes.Time
export const isDateTime = (column: ColumnType, abstractType: any) =>
  abstractType === 'datetime' || column.uidt === UITypes.DateTime
export const isReadonlyDateTime = (column: ColumnType, _abstractType: any) =>
  column.uidt === UITypes.CreatedTime || column.uidt === UITypes.LastModifiedTime
export const isReadonlyUser = (column: ColumnType, _abstractType: any) =>
  column.uidt === UITypes.CreatedBy || column.uidt === UITypes.LastModifiedBy
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
export const isGeoData = (column: ColumnType) => column.uidt === UITypes.GeoData
export const isPercent = (column: ColumnType) => column.uidt === UITypes.Percent
export const isSpecificDBType = (column: ColumnType) => column.uidt === UITypes.SpecificDBType
export const isGeometry = (column: ColumnType) => column.uidt === UITypes.Geometry
export const isUser = (column: ColumnType) => column.uidt === UITypes.User
export const isButton = (column: ColumnType) => column.uidt === UITypes.Button
export const isAiButton = (column: ColumnType) =>
  column.uidt === UITypes.Button && (column?.colOptions as any)?.type === ButtonActionsType.Ai
export const isScriptButton = (column: ColumnType) =>
  column.uidt === UITypes.Button && (column?.colOptions as any)?.type === ButtonActionsType.Script
export const isAI = (column: ColumnType) =>
  column.uidt === UITypes.LongText && parseProp(column?.meta)?.[LongTextAiMetaProp] === true

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
    UITypes.GeoData,
    UITypes.Duration,
  ].includes(column.uidt as UITypes)

export const isManualSaved = (column: ColumnType) => [UITypes.Currency].includes(column.uidt as UITypes)

export const isPrimary = (column: ColumnType) => !!column.pv

export const isPrimaryKey = (column: ColumnType) => !!column.pk

// used for LTAR and Formula
export const renderValue = (result?: any) => {
  if (!result || typeof result !== 'string') {
    return result
  }

  // convert ISO string (e.g. in MSSQL) to YYYY-MM-DD hh:mm:ssZ
  // e.g. 2023-05-18T05:30:00.000Z -> 2023-05-18 11:00:00+05:30
  result = result.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g, (d: string) => {
    return dayjs(d).isValid() ? dayjs(d).format('YYYY-MM-DD HH:mm:ssZ') : d
  })

  // convert all date time values to local time
  // the datetime is either YYYY-MM-DD hh:mm:ss (xcdb)
  // or YYYY-MM-DD hh:mm:ss+/-xx:yy (ext)
  return result.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2})?/g, (d: string) => {
    // TODO(timezone): retrieve the format from the corresponding column meta
    // assume HH:mm at this moment
    return dayjs(d).isValid() ? dayjs(d).format('YYYY-MM-DD HH:mm') : d
  })
}

export const isNumericFieldType = (column: ColumnType, abstractType: any) => {
  return (
    isInt(column, abstractType) ||
    isFloat(column, abstractType) ||
    isDecimal(column) ||
    isCurrency(column) ||
    isPercent(column) ||
    isDuration(column)
  )
}

export const rowHeightInPx: Record<string, number> = {
  1: 32,
  2: 60,
  4: 90,
  6: 120,
}

export const pxToRowHeight: Record<number, number> = {
  32: 1,
  60: 2,
  90: 4,
  120: 6,
}

export const rowHeightTruncateLines = (rowHeightOrHeighInPx?: number, isSelectOption = false) => {
  switch (rowHeightOrHeighInPx) {
    case 2:
    case 60:
      return 2
    case 4:
    case 90:
      return isSelectOption ? 3 : 4
    case 6:
    case 120:
      return isSelectOption ? 4 : 6
    default:
      return 1
  }
}

export const isShowNullField = (column: ColumnType) => {
  return [
    UITypes.SingleLineText,
    UITypes.LongText,
    UITypes.PhoneNumber,
    UITypes.Email,
    UITypes.URL,
    UITypes.Number,
    UITypes.Decimal,
    UITypes.Percent,
    UITypes.Duration,
    UITypes.JSON,
  ].includes(column.uidt as UITypes)
}

export const getSelectTypeOptionTextColor = (color?: string | null): string => {
  color = color ?? '#ccc' // Set default only if color is null or undefined

  return tinycolor.isReadable(color, '#fff', { level: 'AA', size: 'large' })
    ? '#fff'
    : tinycolor.mostReadable(color, ['#0b1d05', '#fff']).toHex8String()
}
