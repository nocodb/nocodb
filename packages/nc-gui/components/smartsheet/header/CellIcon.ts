import { type ColumnType } from 'nocodb-sdk'
import type { PropType } from '@vue/runtime-core'

export const renderIcon = (column: ColumnType, abstractType: any) => {
  if (isPrimaryKey(column)) {
    return iconMap.cellSystemKey
  } else if (isSpecificDBType(column)) {
    return iconMap.cellDb
  } else if (isJSON(column)) {
    return iconMap.cellJson
  } else if (isDate(column, abstractType)) {
    return iconMap.cellDate
  } else if (isDateTime(column, abstractType)) {
    return iconMap.cellDatetime
  } else if (isGeoData(column)) {
    return iconMap.ncMapPin
  } else if (isSet(column)) {
    return iconMap.cellMultiSelect
  } else if (isSingleSelect(column)) {
    return iconMap.cellSingleSelect
  } else if (isBoolean(column, abstractType)) {
    return iconMap.cellCheckbox
  } else if (isAI(column)) {
    return iconMap.cellAi
  } else if (isTextArea(column)) {
    return iconMap.cellLongText
  } else if (isEmail(column)) {
    return iconMap.cellEmail
  } else if (isYear(column, abstractType)) {
    return iconMap.cellYear
  } else if (isTime(column, abstractType)) {
    return iconMap.cellTime
  } else if (isRating(column)) {
    return iconMap.cellRating
  } else if (isAttachment(column)) {
    return iconMap.cellAttachment
  } else if (isDecimal(column)) {
    return iconMap.cellDecimal
  } else if (isPhoneNumber(column)) {
    return iconMap.cellPhone
  } else if (isURL(column)) {
    return iconMap.cellUrl
  } else if (isCurrency(column)) {
    return iconMap.cellCurrency
  } else if (isDuration(column)) {
    return iconMap.cellDuration
  } else if (isPercent(column)) {
    return iconMap.cellPercent
  } else if (isGeometry(column)) {
    return iconMap.cellGeometry
  } else if (isUser(column)) {
    if ((column.meta as { is_multi?: boolean; notify?: boolean })?.is_multi) {
      return iconMap.cellUser
    }
    return iconMap.cellUser
  } else if (isInt(column, abstractType) || isFloat(column, abstractType)) {
    return iconMap.cellNumber
  } else if (isString(column, abstractType)) {
    return iconMap.cellText
  } else {
    return iconMap.cellSystemText
  }
}

export default defineComponent({
  name: 'CellIcon',

  props: {
    columnMeta: {
      type: Object as PropType<ColumnType>,
      required: false,
    },
  },
  setup(props) {
    const columnMeta = toRef(props, 'columnMeta')

    const injectedColumn = inject(ColumnInj, columnMeta)

    const column = computed(() => columnMeta.value ?? injectedColumn.value)

    const { sqlUis } = storeToRefs(useBase())

    const sqlUi = computed(() =>
      column.value?.source_id ? sqlUis.value[column.value?.source_id] : Object.values(sqlUis.value)[0],
    )

    const abstractType = computed(() => column.value && sqlUi.value?.getAbstractType(column.value))

    return () => {
      if (!column.value && !columnMeta.value) return null

      return h(renderIcon((columnMeta.value ?? column.value)!, abstractType.value), {
        class: 'text-inherit mx-1 nc-cell-icon',
      })
    }
  },
})
