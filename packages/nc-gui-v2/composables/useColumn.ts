import type { ColumnType } from 'nocodb-sdk'
import { SqlUiFactory, UITypes, isVirtualCol } from 'nocodb-sdk'
import { useProject } from '#imports'

export function useColumn(column: ColumnType) {
  const { project } = useProject()

  const uiDatatype: UITypes = (column && column.uidt) as UITypes
  const abstractType = isVirtualCol(column)
    ? null
    : SqlUiFactory.create(project.value?.bases?.[0]?.config || { client: 'mysql2' }).getAbstractType(column)

  const dataTypeLow = column && column.dt && column.dt.toLowerCase()
  const isBoolean = abstractType === 'boolean'
  const isString = abstractType === 'string'
  const isTextArea = uiDatatype === UITypes.LongText
  const isInt = abstractType === 'integer'
  const isFloat = abstractType === 'float'
  const isDate = abstractType === 'date' || uiDatatype === 'Date'
  const isYear = abstractType === 'year' || uiDatatype === 'Year'
  const isTime = abstractType === 'time' || uiDatatype === 'Time'
  const isDateTime = abstractType === 'datetime' || uiDatatype === 'DateTime'
  const isJSON = uiDatatype === 'JSON'
  const isEnum = uiDatatype === 'SingleSelect'
  const isSingleSelect = uiDatatype === 'SingleSelect'
  const isSet = uiDatatype === 'MultiSelect'
  const isMultiSelect = uiDatatype === 'MultiSelect'
  const isURL = uiDatatype === 'URL'
  const isEmail = uiDatatype === UITypes.Email
  const isAttachment = uiDatatype === 'Attachment'
  const isRating = uiDatatype === UITypes.Rating
  const isCurrency = uiDatatype === 'Currency'
  const isDuration = uiDatatype === UITypes.Duration
  const isAutoSaved = [
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
  ].includes(uiDatatype)
  const isManualSaved = [UITypes.Currency, UITypes.Year, UITypes.Time, UITypes.Duration].includes(uiDatatype)

  return {
    abstractType,
    dataTypeLow,
    isBoolean,
    isString,
    isTextArea,
    isInt,
    isFloat,
    isDate,
    isYear,
    isTime,
    isDateTime,
    isJSON,
    isEnum,
    isSet,
    isURL,
    isEmail,
    isAttachment,
    isRating,
    isCurrency,
    isDuration,
    isAutoSaved,
    isManualSaved,
    isSingleSelect,
    isMultiSelect,
  }
}
