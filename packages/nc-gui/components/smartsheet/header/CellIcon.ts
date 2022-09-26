import type { ColumnType } from 'nocodb-sdk'
import type { PropType } from '@vue/runtime-core'
import { SqlUiFactory, isVirtualCol } from 'nocodb-sdk'
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
  isInt,
  isJSON,
  isPercent,
  isPhoneNumber,
  isPrimary,
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
  if (isPrimary(column)) {
    return KeyIcon
  } else if (isJSON(column)) {
    return JSONIcon
  } else if (isDate(column, abstractType)) {
    return CalendarIcon
  } else if (isDateTime(column, abstractType)) {
    return DatetimeIcon
  } else if (isSet(column)) {
    return MultiSelectIcon
  } else if (isSingleSelect(column)) {
    return SingleSelectIcon
  } else if (isBoolean(column)) {
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
  } else if (isSpecificDBType(column)) {
    return SpecificDBTypeIcon
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

    const { project } = useProject()

    const abstractType = computed(() => {
      // kludge: CY test hack; column is being received NULL during attach cell delete operation
      return (column.value && isVirtualCol(column.value)) || !column.value
        ? null
        : SqlUiFactory.create(
            project.value?.bases?.[0]?.type ? { client: project.value.bases[0].type } : { client: 'mysql2' },
          ).getAbstractType(column.value)
    })

    return () => {
      if (!column.value) return null

      return h(renderIcon(column.value, abstractType.value), { class: 'text-grey mx-1 !text-sm' })
    }
  },
})
