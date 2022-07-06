<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import useColumn  from '~/composables/useColumn'

const { column, value } = defineProps<{ column: ColumnType; value: any }>()
provide('column', column)
provide('value', value)

const {
  isSet,
  isEnum,
  isURL,
  isEmail,
  isJSON,
  isDate,
  isDateTime,
  isTime,
  isBoolean,
  isDuration,
  isRating,
  isCurrency,
  isAttachment,
  isTextArea,
} = useColumn(column)
</script>

<template>
  <!--  <CellEditableAttachment v-if="isAttachment" /> -->
  <CellSetList v-if="isSet" />
  <CellEnum v-else-if="isEnum" />
  <!--  <CellUrl v-else-if="isURL" /> -->
  <!--  <CellEmail v-else-if="isEmail" /> -->
  <!--  <CellJson v-else-if="isJSON" /> -->
  <!--  <CellDate v-else-if="isDate" /> -->
  <!--  <CellDateTime v-else-if="isDateTime" /> -->
  <!--  <CellTime v-else-if="isTime" /> -->
  <CellBoolean v-else-if="isBoolean" />
  <!--  <CellDuration v-else-if="isDuration" /> -->
  <!--  <CellRating v-else-if="isRating" /> -->
  <!--  <CellCurrency v-else-if="isCurrency" /> -->
  <span
    v-else
    :title="title"
  >{{ value }}</span>
</template>

<style scoped>
</style>
