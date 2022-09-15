<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  ColumnInj,
  EditModeInj,
  IsFormInj,
  IsLockedInj,
  IsPublicInj,
  computed,
  inject,
  provide,
  ref,
  toRef,
  useColumn,
  useDebounceFn,
  useSmartsheetRowStoreOrThrow,
  useVModel,
} from '#imports'
import { NavigateDir } from '~/lib'

interface Props {
  column: ColumnType
  modelValue: any
  editEnabled: boolean
  readOnly?: boolean
  rowIndex?: number
  active?: boolean
  virtual?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'save', 'navigate', 'update:editEnabled'])

const column = toRef(props, 'column')

const active = toRef(props, 'active', false)

const readOnly = toRef(props, 'readOnly', undefined)

provide(ColumnInj, column)

provide(EditModeInj, useVModel(props, 'editEnabled', emit))

provide(ActiveCellInj, active)

if (readOnly?.value) {
  provide(ReadonlyInj, readOnly.value)
}

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { currentRow } = useSmartsheetRowStoreOrThrow()

const syncValue = useDebounceFn(function () {
  currentRow.value.rowMeta.changed = false
  emit('save')
}, 1000)

const isAutoSaved = $computed(() => {
  return [
    UITypes.SingleLineText,
    UITypes.LongText,
    UITypes.PhoneNumber,
    UITypes.Email,
    UITypes.URL,
    UITypes.Number,
    UITypes.Decimal,
    UITypes.Percent,
    UITypes.Count,
    UITypes.AutoNumber,
    UITypes.SpecificDBType,
    UITypes.Geometry,
  ].includes(column?.value?.uidt as UITypes)
})

const isManualSaved = $computed(() => [UITypes.Currency, UITypes.Duration].includes(column?.value?.uidt as UITypes))

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    if (val !== props.modelValue) {
      currentRow.value.rowMeta.changed = true
      emit('update:modelValue', val)
      if (isAutoSaved) {
        syncValue()
      } else if (!isManualSaved) {
        emit('save')
        currentRow.value.rowMeta.changed = true
      }
    }
  },
})

const {
  isPrimary,
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

const syncAndNavigate = (dir: NavigateDir) => {
  if (isJSON.value) return

  if (currentRow.value.rowMeta.changed) {
    emit('save')
    currentRow.value.rowMeta.changed = false
  }
  emit('navigate', dir)
}
</script>

<template>
  <div
    class="nc-cell"
    :class="[`nc-cell-${(column?.uidt || 'default').toLowerCase()}`, { 'text-blue-600': isPrimary && !virtual && !isForm }]"
    @keydown.stop.left
    @keydown.stop.right
    @keydown.stop.up
    @keydown.stop.down
    @keydown.stop.enter.exact="syncAndNavigate(NavigateDir.NEXT)"
    @keydown.stop.shift.enter.exact="syncAndNavigate(NavigateDir.PREV)"
  >
    <LazyCellTextArea v-if="isTextArea" v-model="vModel" />
    <LazyCellCheckbox v-else-if="isBoolean" v-model="vModel" />
    <LazyCellAttachment v-else-if="isAttachment" v-model="vModel" :row-index="props.rowIndex" />
    <LazyCellSingleSelect v-else-if="isSingleSelect" v-model="vModel" />
    <LazyCellMultiSelect v-else-if="isMultiSelect" v-model="vModel" />
    <LazyCellDatePicker v-else-if="isDate" v-model="vModel" />
    <LazyCellYearPicker v-else-if="isYear" v-model="vModel" />
    <LazyCellDateTimePicker v-else-if="isDateTime" v-model="vModel" />
    <LazyCellTimePicker v-else-if="isTime" v-model="vModel" />
    <LazyCellRating v-else-if="isRating" v-model="vModel" />
    <LazyCellDuration v-else-if="isDuration" v-model="vModel" />
    <LazyCellEmail v-else-if="isEmail" v-model="vModel" />
    <LazyCellUrl v-else-if="isURL" v-model="vModel" />
    <LazyCellPhoneNumber v-else-if="isPhoneNumber" v-model="vModel" />
    <LazyCellPercent v-else-if="isPercent" v-model="vModel" />
    <LazyCellCurrency v-else-if="isCurrency" v-model="vModel" />
    <LazyCellDecimal v-else-if="isDecimal" v-model="vModel" />
    <LazyCellInteger v-else-if="isInt" v-model="vModel" />
    <LazyCellFloat v-else-if="isFloat" v-model="vModel" />
    <LazyCellText v-else-if="isString" v-model="vModel" />
    <LazyCellJson v-else-if="isJSON" v-model="vModel" />
    <LazyCellText v-else v-model="vModel" />
    <div v-if="(isLocked || (isPublic && readOnly && !isForm)) && !isAttachment" class="nc-locked-overlay" @click.stop.prevent />
  </div>
</template>
