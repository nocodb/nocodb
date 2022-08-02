<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { provide } from 'vue'
import { useColumn, useVModel } from '#imports'
import { ColumnInj } from '~/context'

interface Props {
  column: ColumnType
  modelValue: any
}

interface Emits {
  (event: 'update:modelValue', value: any): void
}

const { column, ...rest } = defineProps<Props>()

const emit = defineEmits<Emits>()

provide(ColumnInj, column)

const vModel = useVModel(rest, 'modelValue', emit)

const {
  isURL,
  isEmail,
  isJSON,
  isDate,
  isYear,
  isDateTime,
  isTime,
  isBoolean,
  isDuration,
  isRating,
  isCurrency,
  isAttachment,
  isTextArea,
  isString,
  isInt,
  isFloat,
  isDecimal,
  isSingleSelect,
  isMultiSelect,
  isPercent,
  isPhoneNumber,
} = useColumn(column)
</script>

<template>
  <div class="nc-cell" @keydown.stop.left @keydown.stop.right @keydown.stop.up @keydown.stop.down>
    <CellTextArea v-if="isTextArea" v-model="vModel" />
    <CellCheckbox v-else-if="isBoolean" v-model="vModel" />
    <CellAttachment v-else-if="isAttachment" v-model="vModel" />
    <CellSingleSelect v-else-if="isSingleSelect" v-model="vModel" />
    <CellMultiSelect v-else-if="isMultiSelect" v-model="vModel" />
    <CellDatePicker v-else-if="isDate" v-model="vModel" />
    <CellYearPicker v-else-if="isYear" v-model="vModel" />
    <CellDateTimePicker v-else-if="isDateTime" v-model="vModel" />
    <CellTimePicker v-else-if="isTime" v-model="vModel" />
    <CellRating v-else-if="isRating" v-model="vModel" />
    <CellDuration v-else-if="isDuration" v-model="vModel" />
    <CellEmail v-else-if="isEmail" v-model="vModel" />
    <CellUrl v-else-if="isURL" v-model="vModel" />
    <CellPhoneNumber v-else-if="isPhoneNumber" v-model="vModel" />
    <CellCurrency v-else-if="isCurrency" v-model="vModel" />
    <CellDecimal v-else-if="isDecimal" v-model="vModel" />
    <CellInteger v-else-if="isInt" v-model="vModel" />
    <CellFloat v-else-if="isFloat" v-model="vModel" />
    <CellText v-else-if="isString" v-model="vModel" />
    <CellPercent v-else-if="isPercent" v-model="vModel" />
    <CellText v-else v-model="vModel" />
  </div>
</template>

<style scoped>
textarea {
  outline: none;
}

div {
  width: 100%;
  height: 100%;
  color: var(--v-textColor-base);
}

.nc-hint {
  font-size: 0.61rem;
  color: grey;
}

.nc-cell {
  @apply relative w-full h-full;
}

.nc-locked-overlay {
  position: absolute;
  z-index: 2;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
}
</style>
