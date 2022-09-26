<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { SqlUiFactory, isVirtualCol } from 'nocodb-sdk'
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
  isAttachment,
  isAutoSaved,
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
  isManualSaved,
  isMultiSelect,
  isPercent,
  isPhoneNumber,
  isPrimary,
  isRating,
  isSingleSelect,
  isString,
  isTextArea,
  isTime,
  isURL,
  isYear,
  provide,
  ref,
  toRef,
  useDebounceFn,
  useProject,
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

const virtual = toRef(props, 'virtual', false)

const readOnly = toRef(props, 'readOnly', undefined)

provide(ColumnInj, column)

provide(EditModeInj, useVModel(props, 'editEnabled', emit))

provide(ActiveCellInj, active)

provide(ReadonlyInj, readOnly.value)

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { currentRow } = useSmartsheetRowStoreOrThrow()

const { project } = useProject()

const abstractType = computed(() => {
  // kludge: CY test hack; column.value is being received NULL during attach cell delete operation
  return (column.value && isVirtualCol(column.value)) || !column.value
    ? null
    : SqlUiFactory.create(
        project.value?.bases?.[0]?.type ? { client: project.value.bases[0].type } : { client: 'mysql2' },
      ).getAbstractType(column.value)
})

const syncValue = useDebounceFn(() => {
  currentRow.value.rowMeta.changed = false
  emit('save')
}, 1000)

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    if (val !== props.modelValue) {
      currentRow.value.rowMeta.changed = true
      emit('update:modelValue', val)
      if (isAutoSaved(column.value)) {
        syncValue()
      } else if (!isManualSaved(column.value)) {
        emit('save')
        currentRow.value.rowMeta.changed = true
      }
    }
  },
})

const syncAndNavigate = (dir: NavigateDir) => {
  if (isJSON(column.value)) return

  if (currentRow.value.rowMeta.changed) {
    emit('save')
    currentRow.value.rowMeta.changed = false
  }
  emit('navigate', dir)
}
</script>

<template>
  <div
    class="nc-cell w-full h-full"
    :class="{ 'text-blue-600': isPrimary(column) && !virtual && !isForm }"
    @keydown.stop.left
    @keydown.stop.right
    @keydown.stop.up
    @keydown.stop.down
    @keydown.stop.enter.exact="syncAndNavigate(NavigateDir.NEXT)"
    @keydown.stop.shift.enter.exact="syncAndNavigate(NavigateDir.PREV)"
  >
    <LazyCellTextArea v-if="isTextArea(column)" v-model="vModel" />
    <LazyCellCheckbox v-else-if="isBoolean(column)" v-model="vModel" />
    <LazyCellAttachment v-else-if="isAttachment(column)" v-model="vModel" :row-index="props.rowIndex" />
    <LazyCellSingleSelect v-else-if="isSingleSelect(column)" v-model="vModel" />
    <LazyCellMultiSelect v-else-if="isMultiSelect(column)" v-model="vModel" />
    <LazyCellDatePicker v-else-if="isDate(column, abstractType)" v-model="vModel" />
    <LazyCellYearPicker v-else-if="isYear(column, abstractType)" v-model="vModel" />
    <LazyCellDateTimePicker v-else-if="isDateTime(column, abstractType)" v-model="vModel" />
    <LazyCellTimePicker v-else-if="isTime(column, abstractType)" v-model="vModel" />
    <LazyCellRating v-else-if="isRating(column)" v-model="vModel" />
    <LazyCellDuration v-else-if="isDuration(column)" v-model="vModel" />
    <LazyCellEmail v-else-if="isEmail(column)" v-model="vModel" />
    <LazyCellUrl v-else-if="isURL(column)" v-model="vModel" />
    <LazyCellPhoneNumber v-else-if="isPhoneNumber(column)" v-model="vModel" />
    <LazyCellPercent v-else-if="isPercent(column)" v-model="vModel" />
    <LazyCellCurrency v-else-if="isCurrency(column)" v-model="vModel" />
    <LazyCellDecimal v-else-if="isDecimal(column)" v-model="vModel" />
    <LazyCellInteger v-else-if="isInt(column, abstractType)" v-model="vModel" />
    <LazyCellFloat v-else-if="isFloat(column, abstractType)" v-model="vModel" />
    <LazyCellText v-else-if="isString(column, abstractType)" v-model="vModel" />
    <LazyCellJson v-else-if="isJSON(column)" v-model="vModel" />
    <LazyCellText v-else v-model="vModel" />
    <div
      v-if="(isLocked || (isPublic && readOnly && !isForm)) && !isAttachment(column)"
      class="nc-locked-overlay"
      @click.stop.prevent
    />
  </div>
</template>
