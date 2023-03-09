import type { ColumnType } from 'nocodb-sdk'
import type { PropType } from '@vue/runtime-core'
import { storeToRefs } from 'pinia'
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
  toRef,
  useProject,
} from '#imports'
import FilePhoneIcon from '~icons/mdi/file-phone'
import KeyIcon from '~icons/mdi/key-variant'
import JSONIcon from '~icons/mdi/code-json'
import ClockIcon from '~icons/mdi/clock-time-five'
import WebIcon from '~icons/mdi/web'
import TextAreaIcon from '~icons/mdi/card-text-outline'
import StringIcon from '~icons/mdi/alpha-a-box-outline'
import BooleanIcon from '~icons/mdi/check-box-outline'
import CalendarIcon from '~icons/mdi/calendar'
import SingleSelectIcon from '~icons/mdi/arrow-down-drop-circle'
import MultiSelectIcon from '~icons/mdi/format-list-bulleted-square'
import DatetimeIcon from '~icons/mdi/calendar-clock'
import GeoDataIcon from '~icons/mdi/map-marker'
import RatingIcon from '~icons/mdi/star'
import GenericIcon from '~icons/mdi/square-rounded'
import NumericIcon from '~icons/mdi/numeric'
import AttachmentIcon from '~icons/mdi/image-multiple-outline'
import EmailIcon from '~icons/mdi/email'
import CurrencyIcon from '~icons/mdi/currency-usd-circle-outline'
import PercentIcon from '~icons/mdi/percent-outline'
import DecimalIcon from '~icons/mdi/decimal'
import SpecificDBTypeIcon from '~icons/mdi/database-settings'
import DurationIcon from '~icons/mdi/timer-outline'

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

      return h(renderIcon(column.value, abstractType.value), { class: 'text-grey mx-1 !text-xs' })
    }
  },
})
