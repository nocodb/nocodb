<script lang="ts" setup>
import {
  type BoolType,
  type ButtonType,
  type ColumnType,
  type LookupType,
  type RollupType,
  dateFormats,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  timeFormats,
} from 'nocodb-sdk'
import dayjs from 'dayjs'

interface Props {
  column: ColumnType
  modelValue: any
  bold?: BoolType
  italic?: BoolType
  underline?: BoolType
}

const props = defineProps<Props>()

const meta = inject(MetaInj)

const { t } = useI18n()

const { metas } = useMetas()

const column = toRef(props, 'column')

const { sqlUis } = storeToRefs(useBase())

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const { isXcdbBase, isMssql, isMysql } = useBase()

const sqlUi = ref(
  column.value?.source_id && sqlUis.value[column.value?.source_id]
    ? sqlUis.value[column.value?.source_id]
    : Object.values(sqlUis.value)[0],
)

const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

const getCheckBoxValue = (modelValue: boolean | string | number | '0' | '1') => {
  return !!modelValue && modelValue !== '0' && modelValue !== 0 && modelValue !== 'false'
}

const getMultiSelectValue = (modelValue: any, col: ColumnType): string => {
  if (!modelValue) {
    return ''
  }
  return modelValue
    ? Array.isArray(modelValue)
      ? modelValue.join(', ')
      : modelValue.toString()
    : isMysql(col.source_id)
    ? modelValue.toString().split(',').join(', ')
    : modelValue.split(', ')
}

const getDateValue = (modelValue: string | null | number, col: ColumnType, isSystemCol?: boolean) => {
  const dateFormat = !isSystemCol ? parseProp(col.meta)?.date_format ?? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'
  if (!modelValue || !dayjs(modelValue).isValid()) {
    return ''
  } else {
    return dayjs(/^\d+$/.test(String(modelValue)) ? +modelValue : modelValue).format(dateFormat)
  }
}

const getYearValue = (modelValue: string | null) => {
  if (!modelValue) {
    return ''
  } else if (!dayjs(modelValue).isValid()) {
    return ''
  } else {
    return dayjs(modelValue.toString(), 'YYYY').format('YYYY')
  }
}

const getDateTimeValue = (modelValue: string | null, col: ColumnType) => {
  if (!modelValue || !dayjs(modelValue).isValid()) {
    return ''
  }

  const dateFormat = parseProp(col?.meta)?.date_format ?? dateFormats[0]
  const timeFormat = parseProp(col?.meta)?.time_format ?? timeFormats[0]
  const dateTimeFormat = `${dateFormat} ${timeFormat}`

  const isXcDB = isXcdbBase(col.source_id)

  if (!isXcDB) {
    return dayjs(/^\d+$/.test(modelValue) ? +modelValue : modelValue).format(dateTimeFormat)
  }

  if (isMssql(col.source_id)) {
    // e.g. 2023-04-29T11:41:53.000Z
    return dayjs(modelValue, dateTimeFormat).format(dateTimeFormat)
  } else {
    return dayjs(modelValue).utc().local().format(dateTimeFormat)
  }
}

const getTimeValue = (modelValue: string | null) => {
  if (!modelValue) {
    return ''
  }
  let dateTime = dayjs(modelValue)

  if (!dateTime.isValid()) {
    dateTime = dayjs(modelValue, 'HH:mm:ss')
  }
  if (!dateTime.isValid()) {
    dateTime = dayjs(`1999-01-01 ${modelValue}`)
  }
  if (!dateTime.isValid()) {
    return ''
  }

  return dateTime.format('HH:mm')
}

const getDurationValue = (modelValue: string | null, col: ColumnType) => {
  const durationType = parseProp(col.meta)?.duration || 0
  return convertMS2Duration(modelValue, durationType)
}

const getPercentValue = (modelValue: string | null) => {
  return modelValue ? `${modelValue}%` : ''
}

const getCurrencyValue = (modelValue: string | number | null | undefined, col: ColumnType): string => {
  const currencyMeta = {
    currency_locale: 'en-US',
    currency_code: 'USD',
    ...parseProp(col.meta),
  }
  try {
    if (modelValue === null || modelValue === undefined || isNaN(modelValue)) {
      return modelValue === null || modelValue === undefined ? '' : (modelValue as string)
    }
    return new Intl.NumberFormat(currencyMeta.currency_locale || 'en-US', {
      style: 'currency',
      currency: currencyMeta.currency_code || 'USD',
    }).format(+modelValue)
  } catch (e) {
    return modelValue as string
  }
}

const getUserValue = (modelValue: string | string[] | null | Array<any>) => {
  if (!modelValue) {
    return ''
  }
  const baseUsers = meta?.value.base_id ? basesUser.value.get(meta?.value.base_id) || [] : []

  if (typeof modelValue === 'string') {
    const idsOrMails = modelValue.split(',')

    return idsOrMails
      .map((idOrMail) => {
        const user = baseUsers.find((u) => u.id === idOrMail || u.email === idOrMail)
        return user ? user.display_name || user.email : idOrMail.id
      })
      .join(', ')
  } else {
    if (Array.isArray(modelValue)) {
      return modelValue
        .map((idOrMail) => {
          const user = baseUsers.find((u) => u.id === idOrMail.id || u.email === idOrMail.email)
          return user ? user.display_name || user.email : idOrMail.id
        })
        .join(', ')
    } else {
      return modelValue ? modelValue.display_name || modelValue.email : ''
    }
  }
}

const getDecimalValue = (modelValue: string | null | number, col: ColumnType) => {
  if (!modelValue || isNaN(Number(modelValue))) {
    return ''
  }
  const columnMeta = parseProp(col.meta)

  return Number(modelValue).toFixed(columnMeta?.precision ?? 1)
}

const getIntValue = (modelValue: string | null | number) => {
  if (!modelValue || isNaN(Number(modelValue))) {
    return ''
  }
  return Number(modelValue) as unknown as string
}

const getTextAreaValue = (modelValue: string | null, col: ColumnType) => {
  const isRichMode = parseProp(col.meta).richMode
  if (isRichMode) {
    return modelValue?.replace(/[*_~\[\]]|<\/?[^>]+(>|$)/g, '') || ''
  }
  return modelValue || ''
}

const getRollupValue = (modelValue: string | null | number, col: ColumnType) => {
  const colOptions = col.colOptions as RollupType

  const fns = ['count', 'avg', 'sum', 'countDistinct', 'sumDistinct', 'avgDistinct']
  if (fns.includes(colOptions.rollup_function!)) {
    return modelValue as string
  } else {
    const relationColumnOptions = colOptions.fk_relation_column_id
      ? meta?.value.columns?.find((c) => c.id === colOptions.fk_relation_column_id)?.colOptions
      : null
    const relatedTableMeta =
      relationColumnOptions?.fk_related_model_id && metas.value?.[relationColumnOptions.fk_related_model_id as string]

    const childColumn = relatedTableMeta?.columns.find((c: ColumnType) => c.id === colOptions.fk_rollup_column_id)

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return parseValue(modelValue, childColumn) as string
  }
}

const getLookupValue = (modelValue: string | null | number | Array<any>, col: ColumnType) => {
  const colOptions = col.colOptions as LookupType
  const relationColumnOptions = colOptions.fk_relation_column_id
    ? meta?.value.columns?.find((c) => c.id === colOptions.fk_relation_column_id)?.colOptions
    : null
  const relatedTableMeta =
    relationColumnOptions?.fk_related_model_id && metas.value?.[relationColumnOptions.fk_related_model_id as string]

  const childColumn = relatedTableMeta?.columns.find((c: ColumnType) => c.id === colOptions.fk_lookup_column_id) as
    | ColumnType
    | undefined

  if (Array.isArray(modelValue)) {
    return modelValue
      .map((v) => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return parseValue(v, childColumn!)
      })
      .join(', ')
  }
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return parseValue(modelValue, childColumn!)
}

const getAttachmentValue = (modelValue: string | null | number | Array<any>) => {
  if (Array.isArray(modelValue)) {
    return modelValue.map((v) => `${v.title}`).join(', ')
  }
  return modelValue as string
}

const getLinksValue = (modelValue: string, col: ColumnType) => {
  if (typeof col.meta === 'string') {
    col.meta = JSON.parse(col.meta)
  }

  const parsedValue = +modelValue || 0
  if (!parsedValue) {
    return ''
  } else if (parsedValue === 1) {
    return `1 ${col?.meta?.singular || t('general.link')}`
  } else {
    return `${parsedValue} ${col?.meta?.plural || t('general.links')}`
  }
}

const parseValue = (value: any, col: ColumnType): string => {
  if (!col) {
    return ''
  }
  if (isGeoData(col)) {
    const [latitude, longitude] = ((value as string) || '').split(';')
    return latitude && longitude ? `${latitude}; ${longitude}` : value
  }
  if (isTextArea(col)) {
    return getTextAreaValue(value, col)
  }
  if (isBoolean(col, abstractType)) {
    return getCheckBoxValue(value) ? 'Checked' : 'Unchecked'
  }
  if (isMultiSelect(col)) {
    return getMultiSelectValue(value, col)
  }
  if (isDate(col, abstractType)) {
    return getDateValue(value, col)
  }
  if (isYear(col, abstractType)) {
    return getYearValue(value)
  }
  if (isDateTime(col, abstractType)) {
    return getDateTimeValue(value, col)
  }
  if (isTime(col, abstractType)) {
    return getTimeValue(value)
  }
  if (isDuration(col)) {
    return getDurationValue(value, col)
  }
  if (isPercent(col)) {
    return getPercentValue(value)
  }
  if (isCurrency(col)) {
    return getCurrencyValue(value, col)
  }
  if (isUser(col)) {
    return getUserValue(value)
  }
  if (isDecimal(col)) {
    return getDecimalValue(value, col)
  }
  if (isInt(col, abstractType)) {
    return getIntValue(value)
  }
  if (isJSON(col)) {
    return JSON.stringify(value, null, 2)
  }
  if (isRollup(col)) {
    return getRollupValue(value, col)
  }
  if (isLookup(col) || isLTAR(col.uidt, col.colOptions)) {
    return getLookupValue(value, col)
  }
  if (isCreatedOrLastModifiedTimeCol(col)) {
    return getDateValue(value, col, true)
  }
  if (isCreatedOrLastModifiedByCol(col)) {
    return getUserValue(value)
  }
  if (isAttachment(col)) {
    return getAttachmentValue(value)
  }
  if (isLink(col)) {
    return getLinksValue(value, col)
  }

  if (isFormula(col) && col?.meta?.display_type) {
    return parseValue(value, {
      uidt: col?.meta?.display_type,
      ...col?.meta?.display_column_meta,
    })
  }

  if (isButton(col)) {
    if ((col.colOptions as ButtonType).type === 'url') return value
    else return col.colOptions?.label
  }

  return value as unknown as string
}
</script>

<template>
  <span
    class="plain-cell before:px-1"
    :class="{
      '!font-bold': bold,
      '!italic': italic,
      'underline': underline,
    }"
    data-testid="nc-plain-cell"
  >
    {{ parseValue(modelValue, column) }}
  </span>
</template>

<style lang="scss" scoped>
.plain-cell {
  &::before {
    content: '•';
    padding: 0 4px;
  }
  &:first-child::before {
    content: '';
    padding: 0;
  }
  &:first-child {
    padding-left: 0;
  }
}
</style>
