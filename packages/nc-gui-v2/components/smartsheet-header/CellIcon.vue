<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { ColumnInj } from '~/context'
import { useColumn } from '#imports'
import KeyIcon from '~icons/mdi/key-variant'
import JSONIcon from '~icons/mdi/code-json'
// import FKIcon from '~icons/mdi/link-variant'
import TextAreaIcon from '~icons/mdi/card-text-outline'
import StringIcon from '~icons/mdi/alpha-a'
import BooleanIcon from '~icons/mdi/check-box-outline'
import SingleSelectIcon from '~icons/mdi/radiobox-marked'
import MultiSelectIcon from '~icons/mdi/checkbox-multiple-marked'
import DatetimeIcon from '~icons/mdi/calendar-clock'
import DateIcon from '~icons/mdi/calendar'
import RatingIcon from '~icons/mdi/star'
import GenericIcon from '~icons/mdi/square-rounded'
import AttachmentIcon from '~icons/mdi/image-multiple-outline'
import URLIcon from '~icons/mdi/link'
import EmailIcon from '~icons/mdi/email'
import CurrencyIcon from '~icons/mdi/currency-usd-circle-outline'

const column = inject(ColumnInj)

const additionalColMeta = useColumn(column as ColumnType)

const icon = computed(() => {
  if (column?.pk) {
    return KeyIcon
  } else if (additionalColMeta.isJSON) {
    return JSONIcon
  } else if (additionalColMeta.isDate) {
    return DateIcon
  } else if (additionalColMeta.isDateTime) {
    return DatetimeIcon
  } else if (additionalColMeta.isSet) {
    return MultiSelectIcon
  } else if (additionalColMeta.isSingleSelect) {
    return SingleSelectIcon
  } else if (additionalColMeta.isBoolean) {
    return BooleanIcon
  } else if (additionalColMeta.isTextArea) {
    return TextAreaIcon
  } else if (additionalColMeta.isEmail) {
    return EmailIcon
  } else if (additionalColMeta.isRating) {
    return RatingIcon
  } else if (additionalColMeta.isAttachment) {
    return AttachmentIcon
  }
  // else if(additionalColMeta.isForeignKey) {
  //   return FKIcon
  // }
  else if (additionalColMeta.isURL) {
    return URLIcon
  } else if (additionalColMeta.isCurrency) {
    return CurrencyIcon
  } else if (additionalColMeta.isString) {
    return h(StringIcon, {
      class: 'text-[1.5rem]',
    })
  } else {
    return GenericIcon
  }
})
</script>

<template>
  <component :is="icon" class="text-grey mx-1" />
</template>
