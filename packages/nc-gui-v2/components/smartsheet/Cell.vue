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
  useVModel,
} from '#imports'
import { NavigateDir } from '~/lib'

interface Props {
  column: ColumnType
  modelValue: any
  editEnabled: boolean
  rowIndex?: number
  active?: boolean
  virtual?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'save', 'navigate', 'update:editEnabled'])

const column = toRef(props, 'column')

const active = toRef(props, 'active', false)

const virtual = toRef(props, 'virtual', false)

provide(ColumnInj, column)

provide(EditModeInj, useVModel(props, 'editEnabled', emit))

provide(ActiveCellInj, active)

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

let changed = $ref(false)

const syncValue = useDebounceFn(function () {
  changed = false
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

const isManualSaved = $computed(() => {
  return [UITypes.Currency, UITypes.Duration].includes(column?.value?.uidt as UITypes)
})

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    if (val !== props.modelValue) {
      changed = true
      emit('update:modelValue', val)
      if (isAutoSaved) {
        syncValue()
      } else if (!isManualSaved) {
        emit('save')
        changed = true
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

  if (changed) {
    emit('save')
    changed = false
  }
  emit('navigate', dir)
}
</script>

<template>
  <div
    class="nc-cell w-full h-full"
    :class="{ 'text-blue-600': isPrimary && !virtual }"
    @keydown.stop.left
    @keydown.stop.right
    @keydown.stop.up
    @keydown.stop.down
    @keydown.stop.enter.exact="syncAndNavigate(NavigateDir.NEXT)"
    @keydown.stop.shift.enter.exact="syncAndNavigate(NavigateDir.PREV)"
  >
    <CellTextArea v-if="isTextArea" v-model="vModel" />
    <CellCheckbox v-else-if="isBoolean" v-model="vModel" />
    <CellAttachment v-else-if="isAttachment" v-model="vModel" :row-index="props.rowIndex" />
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
    <CellPercent v-else-if="isPercent" v-model="vModel" />
    <CellCurrency v-else-if="isCurrency" v-model="vModel" />
    <CellDecimal v-else-if="isDecimal" v-model="vModel" />
    <CellInteger v-else-if="isInt" v-model="vModel" />
    <CellFloat v-else-if="isFloat" v-model="vModel" />
    <CellText v-else-if="isString" v-model="vModel" />
    <CellJson v-else-if="isJSON" v-model="vModel" />
    <CellText v-else v-model="vModel" />
    <div v-if="(isLocked || (isPublic && !isForm)) && !isAttachment" class="nc-locked-overlay" @click.stop.prevent />
  </div>
</template>
