<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  ColumnInj,
  EditModeInj,
  IsFormInj,
  IsLockedInj,
  IsPublicInj,
  ReadonlyInj,
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
  provide(ReadonlyInj, readOnly)
}

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { currentRow } = useSmartsheetRowStoreOrThrow()

const syncValue = useDebounceFn(
  () => {
    currentRow.value.rowMeta.changed = false
    emit('save')
  },
  500,
  { maxWait: 2000 },
)
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
  isAutoSaved,
  isManualSaved,
  isPrimaryKey,
} = useColumn(column)

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    if (val !== props.modelValue) {
      currentRow.value.rowMeta.changed = true
      emit('update:modelValue', val)
      if (isAutoSaved.value) {
        syncValue()
      } else if (!isManualSaved.value) {
        emit('save')
        currentRow.value.rowMeta.changed = true
      }
    }
  },
})

const syncAndNavigate = (dir: NavigateDir, e: KeyboardEvent) => {
  console.log('syncAndNavigate', e.target)
  if (isJSON.value) return

  if (currentRow.value.rowMeta.changed || currentRow.value.rowMeta.new) {
    emit('save')
    currentRow.value.rowMeta.changed = false
  }
  emit('navigate', dir)

  if (!isForm.value) e.stopImmediatePropagation()
}
</script>

<template>
  <div
    class="nc-cell w-full"
    :class="[`nc-cell-${(column?.uidt || 'default').toLowerCase()}`, { 'text-blue-600': isPrimary && !virtual && !isForm }]"
    @keydown.enter.exact="syncAndNavigate(NavigateDir.NEXT, $event)"
    @keydown.shift.enter.exact="syncAndNavigate(NavigateDir.PREV, $event)"
  >
    <LazyCellTextArea v-if="isTextArea" v-model="vModel" />
    <LazyCellCheckbox v-else-if="isBoolean" v-model="vModel" />
    <LazyCellAttachment v-else-if="isAttachment" v-model="vModel" :row-index="props.rowIndex" />
    <LazyCellSingleSelect v-else-if="isSingleSelect" v-model="vModel" :row-index="props.rowIndex" />
    <LazyCellMultiSelect v-else-if="isMultiSelect" v-model="vModel" :row-index="props.rowIndex" />
    <LazyCellDatePicker v-else-if="isDate" v-model="vModel" :is-pk="isPrimaryKey" />
    <LazyCellYearPicker v-else-if="isYear" v-model="vModel" :is-pk="isPrimaryKey" />
    <LazyCellDateTimePicker v-else-if="isDateTime" v-model="vModel" :is-pk="isPrimaryKey" />
    <LazyCellTimePicker v-else-if="isTime" v-model="vModel" :is-pk="isPrimaryKey" />
    <LazyCellRating v-else-if="isRating" v-model="vModel" />
    <LazyCellDuration v-else-if="isDuration" v-model="vModel" />
    <LazyCellEmail v-else-if="isEmail" v-model="vModel" />
    <LazyCellUrl v-else-if="isURL" v-model="vModel" />
    <LazyCellPhoneNumber v-else-if="isPhoneNumber" v-model="vModel" />
    <LazyCellPercent v-else-if="isPercent" v-model="vModel" />
    <LazyCellCurrency v-else-if="isCurrency" v-model="vModel" @save="emit('save')" />
    <LazyCellDecimal v-else-if="isDecimal" v-model="vModel" />
    <LazyCellInteger v-else-if="isInt" v-model="vModel" />
    <LazyCellFloat v-else-if="isFloat" v-model="vModel" />
    <LazyCellText v-else-if="isString" v-model="vModel" />
    <LazyCellJson v-else-if="isJSON" v-model="vModel" />
    <LazyCellText v-else v-model="vModel" />
    <div v-if="(isLocked || (isPublic && readOnly && !isForm)) && !isAttachment" class="nc-locked-overlay" @click.stop.prevent />
  </div>
</template>
