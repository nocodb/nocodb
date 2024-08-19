<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { isSystemColumn } from 'nocodb-sdk'
import { NavigateDir } from '#imports'

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

const emit = defineEmits(['update:modelValue', 'save', 'navigate', 'update:editEnabled', 'update:cdf'])

const column = toRef(props, 'column')

const meta = inject(MetaInj, ref())

const active = toRef(props, 'active', false)

const readOnly = toRef(props, 'readOnly', false)

provide(ColumnInj, column)

const editEnabled = useVModel(props, 'editEnabled', emit)

provide(EditModeInj, editEnabled)

provide(ActiveCellInj, active)

provide(ReadonlyInj, readOnly)

const isForm = inject(IsFormInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isCalendar = inject(IsCalendarInj, ref(false))

const isEditColumnMenu = inject(EditColumnInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const { currentRow } = useSmartsheetRowStoreOrThrow()

const { sqlUis } = storeToRefs(useBase())

const sourceId = meta.value?.source_id || column.value?.source_id

const sqlUi = ref(sourceId && sqlUis.value[sourceId] ? sqlUis.value[sourceId] : Object.values(sqlUis.value)[0])

const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

const syncValue = useDebounceFn(
  () => {
    currentRow.value.rowMeta.changed = false
    emit('save')
  },
  500,
  { maxWait: 2000 },
)

let saveTimer: number

const updateWhenEditCompleted = () => {
  if (editEnabled.value) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = window.setTimeout(updateWhenEditCompleted, 500)
  } else {
    emit('save')
  }
}

const vModel = computed({
  get: () => {
    return props.modelValue
  },
  set: (val) => {
    if (isEditColumnMenu.value) {
      emit('update:cdf', val)
    } else if (val !== props.modelValue) {
      currentRow.value.rowMeta.changed = true
      emit('update:modelValue', val)
      if (column.value.pk || column.value.unique) {
        updateWhenEditCompleted()
      } else if (isAutoSaved(column.value)) {
        syncValue()
      } else if (!isManualSaved(column.value)) {
        emit('save')
      }
    }
  },
})

const navigate = (dir: NavigateDir, e: KeyboardEvent) => {
  if (isJSON(column.value)) return

  if (currentRow.value.rowMeta.changed || currentRow.value.rowMeta.new) {
    currentRow.value.rowMeta.changed = false
  }
  emit('navigate', dir)

  if (!isForm.value) e.stopImmediatePropagation()
}

const isNumericField = computed(() => {
  return isNumericFieldType(column.value, abstractType.value)
})

// disable contexxtmenu event propagation when cell is in
// editable state and typable (e.g. text area)
// this is to prevent the custom grid view context menu from opening
const onContextmenu = (e: MouseEvent) => {
  if (props.editEnabled && isTypableInputColumn(column.value)) {
    e.stopPropagation()
  }
}

const showCurrentDateOption = computed(() => {
  if (!isEditColumnMenu.value || (!isDate(column.value, abstractType.value) && !isDateTime(column.value, abstractType.value)))
    return false

  return sqlUi.value?.getCurrentDateDefault?.(column.value) ? true : 'disabled'
})

const currentDate = () => {
  vModel.value = sqlUi.value?.getCurrentDateDefault?.(column.value)
}
</script>

<template>
  <div
    :class="[
      `nc-cell-${(column?.uidt || 'default').toLowerCase()}`,
      {
        'nc-display-value-cell': isPrimary(column) && !props.virtual && !isForm && !isCalendar,
        'nc-grid-numeric-cell-right':
          isGrid &&
          isNumericField &&
          !isEditColumnMenu &&
          !isForm &&
          !isExpandedFormOpen &&
          !isRating(column) &&
          !isYear(column, abstractType),
        'h-10': !isEditColumnMenu && isForm && !isAttachment(column) && !isTextArea(column) && !isJSON(column) && !props.virtual,
        'nc-grid-numeric-cell-left': (isForm && isNumericField && isExpandedFormOpen) || isEditColumnMenu,
        '!min-h-30': isTextArea(column) && (isForm || isSurveyForm),
      },
    ]"
    class="nc-cell w-full h-full relative"
    @contextmenu="onContextmenu"
    @keydown.enter.exact="navigate(NavigateDir.NEXT, $event)"
    @keydown.shift.enter.exact="navigate(NavigateDir.PREV, $event)"
  >
    <template v-if="column">
      <LazyCellTextArea v-if="isTextArea(column)" v-model="vModel" :virtual="props.virtual" />
      <LazyCellGeoData v-else-if="isGeoData(column)" v-model="vModel" />
      <LazyCellCheckbox v-else-if="isBoolean(column, abstractType)" v-model="vModel" />
      <LazyCellAttachment v-else-if="isAttachment(column)" v-model="vModel" :row-index="props.rowIndex" />
      <LazyCellSingleSelect
        v-else-if="isSingleSelect(column)"
        v-model="vModel"
        :disable-option-creation="!!isEditColumnMenu"
        :row-index="props.rowIndex"
      />
      <LazyCellMultiSelect
        v-else-if="isMultiSelect(column)"
        v-model="vModel"
        :disable-option-creation="!!isEditColumnMenu"
        :row-index="props.rowIndex"
      />
      <LazyCellDatePicker
        v-else-if="isDate(column, abstractType)"
        v-model="vModel"
        :is-pk="isPrimaryKey(column)"
        :show-current-date-option="showCurrentDateOption"
        @current-date="currentDate"
      />
      <LazyCellYearPicker v-else-if="isYear(column, abstractType)" v-model="vModel" :is-pk="isPrimaryKey(column)" />
      <LazyCellDateTimePicker
        v-else-if="isDateTime(column, abstractType)"
        v-model="vModel"
        :is-pk="isPrimaryKey(column)"
        :is-updated-from-copy-n-paste="currentRow.rowMeta.isUpdatedFromCopyNPaste"
        :show-current-date-option="showCurrentDateOption"
        @current-date="currentDate"
      />
      <LazyCellTimePicker v-else-if="isTime(column, abstractType)" v-model="vModel" :is-pk="isPrimaryKey(column)" />
      <LazyCellRating v-else-if="isRating(column)" v-model="vModel" />
      <LazyCellDuration v-else-if="isDuration(column)" v-model="vModel" />
      <LazyCellEmail v-else-if="isEmail(column)" v-model="vModel" />
      <LazyCellUrl v-else-if="isURL(column)" v-model="vModel" />
      <LazyCellPhoneNumber v-else-if="isPhoneNumber(column)" v-model="vModel" />
      <LazyCellPercent v-else-if="isPercent(column)" v-model="vModel" />
      <LazyCellCurrency v-else-if="isCurrency(column)" v-model="vModel" @save="emit('save')" />
      <LazyCellUser v-else-if="isUser(column)" v-model="vModel" :row-index="props.rowIndex" />
      <LazyCellDecimal v-else-if="isDecimal(column)" v-model="vModel" />
      <LazyCellFloat v-else-if="isFloat(column, abstractType)" v-model="vModel" />
      <LazyCellText v-else-if="isString(column, abstractType)" v-model="vModel" />
      <LazyCellInteger v-else-if="isInt(column, abstractType)" v-model="vModel" />
      <LazyCellJson v-else-if="isJSON(column)" v-model="vModel" />
      <LazyCellText v-else v-model="vModel" />
      <div
        v-if="((isPublic && readOnly && !isForm) || isSystemColumn(column)) && !isAttachment(column) && !isTextArea(column)"
        class="nc-locked-overlay"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-grid-numeric-cell-left {
  text-align: left;
  :deep(input) {
    text-align: left;
  }
}
.nc-grid-numeric-cell-right {
  text-align: right;
  :deep(input) {
    text-align: right;
  }
}

.nc-cell {
  @apply text-sm text-gray-600;
  font-weight: 500;

  :deep(.nc-cell-field),
  :deep(input),
  :deep(textarea),
  :deep(.nc-cell-field-link) {
    @apply !text-sm;
    font-weight: 500;
  }

  :deep(input::placeholder),
  :deep(textarea::placeholder) {
    @apply text-gray-400;
    font-weight: 300;
  }

  &.nc-display-value-cell {
    @apply !text-brand-500 !font-semibold;

    :deep(.nc-cell-field),
    :deep(input),
    :deep(textarea),
    :deep(.nc-cell-field-link) {
      @apply !font-semibold;
    }
  }

  &.nc-cell-longtext {
    @apply leading-5;
  }

  :deep(.ant-picker-input) {
    @apply text-sm leading-4;
    font-weight: 500;

    input {
      @apply text-sm leading-4;
      font-weight: 500;
    }
  }

  :deep(.nc-cell-field) {
    @apply px-0;
  }
}
</style>
