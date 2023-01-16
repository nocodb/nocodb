<script setup lang="ts">
import type { ColumnType, GridType } from 'nocodb-sdk'
import { isSystemColumn } from 'nocodb-sdk'
import {
  ActiveCellInj,
  ActiveViewInj,
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
  isPrimaryKey,
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

const view = inject(ActiveViewInj, ref())

const column = toRef(props, 'column')

const active = toRef(props, 'active', false)

const readOnly = toRef(props, 'readOnly', undefined)

provide(ColumnInj, column)

provide(EditModeInj, useVModel(props, 'editEnabled', emit))

provide(ActiveCellInj, active)

provide(ReadonlyInj, readOnly)

const isForm = inject(IsFormInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { currentRow } = useSmartsheetRowStoreOrThrow()

const { sqlUis } = useProject()

const sqlUi = ref(column.value?.base_id ? sqlUis.value[column.value?.base_id] : Object.values(sqlUis.value)[0])

const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

const syncValue = useDebounceFn(
  () => {
    currentRow.value.rowMeta.changed = false
    emit('save')
  },
  500,
  { maxWait: 2000 },
)

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

const syncAndNavigate = (dir: NavigateDir, e: KeyboardEvent) => {
  if (isJSON(column.value)) return

  if (currentRow.value.rowMeta.changed || currentRow.value.rowMeta.new) {
    emit('save')
    currentRow.value.rowMeta.changed = false
  }
  emit('navigate', dir)

  if (!isForm.value) e.stopImmediatePropagation()
}

const rowHeight = computed(() => {
  if ((view.value?.view as GridType)?.row_height !== undefined) {
    switch ((view.value?.view as GridType)?.row_height) {
      case 0:
        return 1
      case 1:
        return 2
      case 2:
        return 4
      case 3:
        return 6
    }
  }
})
</script>

<template>
  <div
    class="nc-cell w-full"
    :class="[
      `nc-cell-${(column?.uidt || 'default').toLowerCase()}`,
      { 'text-blue-600': isPrimary(column) && !props.virtual && !isForm },
      { '!h-auto': !rowHeight || rowHeight === 1 },
      { '!h-full': rowHeight && rowHeight !== 1 },
    ]"
    @keydown.enter.exact="syncAndNavigate(NavigateDir.NEXT, $event)"
    @keydown.shift.enter.exact="syncAndNavigate(NavigateDir.PREV, $event)"
  >
    <template v-if="column">
      <LazyCellTextArea v-if="isTextArea(column)" v-model="vModel" />
      <LazyCellCheckbox v-else-if="isBoolean(column, abstractType)" v-model="vModel" />
      <LazyCellAttachment v-else-if="isAttachment(column)" v-model="vModel" :row-index="props.rowIndex" />
      <LazyCellSingleSelect v-else-if="isSingleSelect(column)" v-model="vModel" :row-index="props.rowIndex" />
      <LazyCellMultiSelect v-else-if="isMultiSelect(column)" v-model="vModel" :row-index="props.rowIndex" />
      <LazyCellDatePicker v-else-if="isDate(column, abstractType)" v-model="vModel" :is-pk="isPrimaryKey(column)" />
      <LazyCellYearPicker v-else-if="isYear(column, abstractType)" v-model="vModel" :is-pk="isPrimaryKey(column)" />
      <LazyCellDateTimePicker v-else-if="isDateTime(column, abstractType)" v-model="vModel" :is-pk="isPrimaryKey(column)" />
      <LazyCellTimePicker v-else-if="isTime(column, abstractType)" v-model="vModel" :is-pk="isPrimaryKey(column)" />
      <LazyCellRating v-else-if="isRating(column)" v-model="vModel" />
      <LazyCellDuration v-else-if="isDuration(column)" v-model="vModel" />
      <LazyCellEmail v-else-if="isEmail(column)" v-model="vModel" />
      <LazyCellUrl v-else-if="isURL(column)" v-model="vModel" />
      <LazyCellPhoneNumber v-else-if="isPhoneNumber(column)" v-model="vModel" />
      <LazyCellPercent v-else-if="isPercent(column)" v-model="vModel" />
      <LazyCellCurrency v-else-if="isCurrency(column)" v-model="vModel" @save="emit('save')" />
      <LazyCellDecimal v-else-if="isDecimal(column)" v-model="vModel" />
      <LazyCellInteger v-else-if="isInt(column, abstractType)" v-model="vModel" />
      <LazyCellFloat v-else-if="isFloat(column, abstractType)" v-model="vModel" />
      <LazyCellText v-else-if="isString(column, abstractType)" v-model="vModel" />
      <LazyCellJson v-else-if="isJSON(column)" v-model="vModel" />
      <LazyCellText v-else v-model="vModel" />
      <div
        v-if="(isLocked || (isPublic && readOnly && !isForm) || isSystemColumn(column)) && !isAttachment(column)"
        class="nc-locked-overlay"
        @click.stop.prevent
        @dblclick.stop.prevent
      />
    </template>
  </div>
</template>
