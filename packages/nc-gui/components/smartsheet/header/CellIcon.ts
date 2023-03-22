import type { ColumnType } from 'nocodb-sdk'
import type { PropType } from '@vue/runtime-core'
import {
  ColumnInj,
  computed,
  defineComponent,
  h,
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
  useProject,
} from '#imports'
import FilePhoneIcon from '~icons/ph/text-align-left-thin'
import KeyIcon from '~icons/ph/text-align-left-thin'
import JSONIcon from '~icons/ph/text-align-left-thin'
import ClockIcon from '~icons/ph/alarm-thin'
import WebIcon from '~icons/ph/planet-thin'
import TextAreaIcon from '~icons/ph/text-align-left-thin'
import StringIcon from '~icons/ph/text-aa-thin'
import BooleanIcon from '~icons/ph/check-square-thin'
import CalendarIcon from '~icons/ph/calendar-blank-thin'
import SingleSelectIcon from '~icons/ph/caret-circle-down-thin'
import MultiSelectIcon from '~icons/ph/list-bullets-thin'
import DatetimeIcon from '~icons/ph/calendar-thin'
import GeoDataIcon from '~icons/ph/map-pin-thin'
import RatingIcon from '~icons/ph/star-thin'
import GenericIcon from '~icons/ph/square-thin'
import NumericIcon from '~icons/ph/number-square-one-thin'
import AttachmentIcon from '~icons/ph/image-thin'
import EmailIcon from '~icons/ph/envelope-thin'
import CurrencyIcon from '~icons/ph/currency-circle-dollar-thin'
import PercentIcon from '~icons/ph/percent-thin'
import DecimalIcon from '~icons/mdi/decimal'
import SpecificDBTypeIcon from '~icons/ph/database-thin'
import DurationIcon from '~icons/ph/clock-clockwise-thin'

const renderIcon = (column: ColumnType, abstractType: any) => {
  if (isPrimaryKey(column)) {
    return KeyIcon
  } else if (isSpecificDBType(column)) {
    return SpecificDBTypeIcon
  } else if (isJSON(column)) {
    return JSONIcon
  } else if (isDate(column, abstractType)) {
    return CalendarIcon
  } else if (isDateTime(column, abstractType)) {
    return DatetimeIcon
  } else if (isGeoData(column)) {
    return GeoDataIcon
  } else if (isSet(column)) {
    return MultiSelectIcon
  } else if (isSingleSelect(column)) {
    return SingleSelectIcon
  } else if (isBoolean(column, abstractType)) {
    return BooleanIcon
  } else if (isTextArea(column)) {
    return TextAreaIcon
  } else if (isEmail(column)) {
    return EmailIcon
  } else if (isYear(column, abstractType)) {
    return CalendarIcon
  } else if (isTime(column, abstractType)) {
    return ClockIcon
  } else if (isRating(column)) {
    return RatingIcon
  } else if (isAttachment(column)) {
    return AttachmentIcon
  } else if (isDecimal(column)) {
    return DecimalIcon
  } else if (isPhoneNumber(column)) {
    return FilePhoneIcon
  } else if (isURL(column)) {
    return WebIcon
  } else if (isCurrency(column)) {
    return CurrencyIcon
  } else if (isDuration(column)) {
    return DurationIcon
  } else if (isPercent(column)) {
    return PercentIcon
  } else if (isInt(column, abstractType) || isFloat(column, abstractType)) {
    return NumericIcon
  } else if (isString(column, abstractType)) {
    return StringIcon
  } else {
    return GenericIcon
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

    const { sqlUis } = storeToRefs(useProject())

    const sqlUi = ref(column.value?.base_id ? sqlUis.value[column.value?.base_id] : Object.values(sqlUis.value)[0])

    const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

    return () => {
      if (!column.value) return null

      return h(renderIcon(column.value, abstractType.value), { class: 'text-black mx-1', style:{ fontSize: '16px'} })
    }
  },
})
