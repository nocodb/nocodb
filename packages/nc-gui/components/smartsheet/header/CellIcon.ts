import { type ColumnType } from 'nocodb-sdk'
import type { PropType } from '@vue/runtime-core'
import {
  ColumnInj,
  computed,
  defineComponent,
  h,
  iconMap,
  inject,
  isAttachment,
  isBoolean,
  isCurrency,
  isDate,
  isDateTime,
  isDecimal,
  isDuration,
  isEmail,
  isFloat,
  isGeoData,
  isGeometry,
  isInt,
  isJSON,
  isPercent,
  isPhoneNumber,
  isPrimaryKey,
  isRating,
  isSet,
  isSingleSelect,
  isSpecificDBType,
  isString,
  isTextArea,
  isTime,
  isURL,
  isYear,
  storeToRefs,
  toRef,
  useBase,
} from '#imports'

const renderIcon = (column: ColumnType, abstractType: any) => {
  if (isPrimaryKey(column)) {
    return iconMap.key
  } else if (isSpecificDBType(column)) {
    return iconMap.specificDbType
  } else if (isJSON(column)) {
    return iconMap.json
  } else if (isDate(column, abstractType)) {
    return iconMap.calendar
  } else if (isDateTime(column, abstractType)) {
    return iconMap.datetime
  } else if (isGeoData(column)) {
    return iconMap.geoData
  } else if (isSet(column)) {
    return iconMap.multiSelect
  } else if (isSingleSelect(column)) {
    return iconMap.singleSelect
  } else if (isBoolean(column, abstractType)) {
    return iconMap.boolean
  } else if (isTextArea(column)) {
    return iconMap.longText
  } else if (isEmail(column)) {
    return iconMap.email
  } else if (isYear(column, abstractType)) {
    return iconMap.calendar
  } else if (isTime(column, abstractType)) {
    return iconMap.clock
  } else if (isRating(column)) {
    return iconMap.rating
  } else if (isAttachment(column)) {
    return iconMap.image
  } else if (isDecimal(column)) {
    return iconMap.decimal
  } else if (isPhoneNumber(column)) {
    return iconMap.phone
  } else if (isURL(column)) {
    return iconMap.web
  } else if (isCurrency(column)) {
    return iconMap.currency
  } else if (isDuration(column)) {
    return iconMap.duration
  } else if (isPercent(column)) {
    return iconMap.percent
  } else if (isGeometry(column)) {
    return iconMap.calculator
  } else if (isInt(column, abstractType) || isFloat(column, abstractType)) {
    return iconMap.number
  } else if (isString(column, abstractType)) {
    return iconMap.text
  } else {
    return iconMap.generic
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

    const column = inject(ColumnInj, columnMeta)

    const { sqlUis } = storeToRefs(useBase())

    const sqlUi = ref(column.value?.source_id ? sqlUis.value[column.value?.source_id] : Object.values(sqlUis.value)[0])

    const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

    return () => {
      if (!column.value) return null

      return h(renderIcon(column.value, abstractType.value), {
        class: 'text-inherit mx-1',
      })
    }
  },
})
