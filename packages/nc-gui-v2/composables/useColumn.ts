import type { ColumnType } from 'nocodb-sdk'
import { SqlUiFactory, UITypes, isVirtualCol } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { useProject } from '#imports'

export function useColumn(column: Ref<ColumnType>) {
  const { project } = useProject()

  const uiDatatype: ComputedRef<UITypes> = computed(() => column?.value?.uidt as UITypes)
  const abstractType = computed(() =>
    // kludge: CY test hack; column.value is being received NULL during attach cell delete operation
    isVirtualCol(column?.value) || !column?.value
      ? null
      : SqlUiFactory.create(project.value?.bases?.[0]?.config || { client: 'mysql2' }).getAbstractType(column?.value),
  )

  const dataTypeLow = computed(() => column?.value?.dt?.toLowerCase())
  const isBoolean = computed(() => abstractType.value === 'boolean')
  const isString = computed(() => abstractType.value === 'string')
  const isTextArea = computed(() => uiDatatype.value === UITypes.LongText)
  const isInt = computed(() => abstractType.value === 'integer')
  const isFloat = computed(() => abstractType.value === 'float')
  const isDate = computed(() => abstractType.value === 'date' || uiDatatype.value === 'Date')
  const isYear = computed(() => abstractType.value === 'year' || uiDatatype.value === 'Year')
  const isTime = computed(() => abstractType.value === 'time' || uiDatatype.value === 'Time')
  const isDateTime = computed(() => abstractType.value === 'datetime' || uiDatatype.value === 'DateTime')
  const isJSON = computed(() => uiDatatype.value === 'JSON')
  const isEnum = computed(() => uiDatatype.value === 'SingleSelect')
  const isSingleSelect = computed(() => uiDatatype.value === 'SingleSelect')
  const isSet = computed(() => uiDatatype.value === 'MultiSelect')
  const isMultiSelect = computed(() => uiDatatype.value === 'MultiSelect')
  const isURL = computed(() => uiDatatype.value === 'URL')
  const isEmail = computed(() => uiDatatype.value === UITypes.Email)
  const isAttachment = computed(() => uiDatatype.value === 'Attachment')
  const isRating = computed(() => uiDatatype.value === UITypes.Rating)
  const isCurrency = computed(() => uiDatatype.value === 'Currency')
  const isPhoneNumber = computed(() => uiDatatype.value === UITypes.PhoneNumber)
  const isDecimal = computed(() => uiDatatype.value === UITypes.Decimal)
  const isDuration = computed(() => uiDatatype.value === UITypes.Duration)
  const isPercent = computed(() => uiDatatype.value === UITypes.Percent)
  const isAutoSaved = computed(() =>
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
    ].includes(uiDatatype.value),
  )
  const isManualSaved = computed(() =>
    [UITypes.Currency, UITypes.Year, UITypes.Time, UITypes.Duration].includes(uiDatatype.value),
  )
  const isPrimary = computed(() => {
    return column?.value?.pv
  })

  return {
    abstractType,
    dataTypeLow,
    isPrimary,
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
    isDecimal,
    isDuration,
    isAutoSaved,
    isManualSaved,
    isSingleSelect,
    isMultiSelect,
    isPercent,
    isPhoneNumber,
  }
}
