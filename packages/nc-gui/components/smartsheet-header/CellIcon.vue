<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ColumnInj, toRef, useColumn } from '#imports'
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

const props = defineProps<{ columnMeta?: ColumnType }>()

const columnMeta = toRef(props, 'columnMeta')
const column = inject(ColumnInj, columnMeta)

const additionalColMeta = useColumn(column as Ref<ColumnType>)

const icon = computed(() => {
  if (column?.value?.pk) {
    return KeyIcon
  } else if (additionalColMeta.isJSON.value) {
    return JSONIcon
  } else if (additionalColMeta.isDate.value) {
    return CalendarIcon
  } else if (additionalColMeta.isDateTime.value) {
    return DatetimeIcon
  } else if (additionalColMeta.isSet.value) {
    return MultiSelectIcon
  } else if (additionalColMeta.isSingleSelect.value) {
    return SingleSelectIcon
  } else if (additionalColMeta.isBoolean.value) {
    return BooleanIcon
  } else if (additionalColMeta.isTextArea.value) {
    return TextAreaIcon
  } else if (additionalColMeta.isEmail.value) {
    return EmailIcon
  } else if (additionalColMeta.isYear.value) {
    return CalendarIcon
  } else if (additionalColMeta.isTime.value) {
    return ClockIcon
  } else if (additionalColMeta.isRating.value) {
    return RatingIcon
  } else if (additionalColMeta.isAttachment.value) {
    return AttachmentIcon
  } else if (additionalColMeta.isDecimal.value) {
    return DecimalIcon
  } else if (additionalColMeta.isPhoneNumber.value) {
    return FilePhoneIcon
  } else if (additionalColMeta.isURL.value) {
    return WebIcon
  } else if (additionalColMeta.isCurrency.value) {
    return CurrencyIcon
  } else if (additionalColMeta.isDuration.value) {
    return DurationIcon
  } else if (additionalColMeta.isPercent.value) {
    return PercentIcon
  } else if (additionalColMeta.isInt.value || additionalColMeta.isFloat.value) {
    return NumericIcon
  } else if (additionalColMeta.isString.value) {
    return StringIcon
  } else if (additionalColMeta.isSpecificDBType.value) {
    return SpecificDBTypeIcon
  } else {
    return GenericIcon
  }
})
</script>

<template>
  <component :is="icon" class="text-grey mx-1 !text-sm" />
</template>
