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

const { generatingRows, generatingColumns } = useNocoAi()

const pk = computed(() => {
  if (!meta.value?.columns) return
  return extractPkFromRow(currentRow.value?.row, meta.value.columns)
})

const isGenerating = computed(
  () =>
    pk.value && column.value.id && generatingRows.value.includes(pk.value) && generatingColumns.value.includes(column.value.id),
)

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

const cellType = computed(() => {
  if (isAI(column.value)) return 'ai'
  if (isTextArea(column.value)) return 'textarea'
  if (isGeoData(column.value)) return 'geoData'
  if (isBoolean(column.value, abstractType.value)) return 'checkbox'
  if (isAttachment(column.value)) return 'attachment'
  if (isSingleSelect(column.value)) return 'singleSelect'
  if (isMultiSelect(column.value)) return 'multiSelect'
  if (isDate(column.value, abstractType.value)) return 'datePicker'
  if (isYear(column.value, abstractType.value)) return 'yearPicker'
  if (isDateTime(column.value, abstractType.value)) return 'dateTimePicker'
  if (isTime(column.value, abstractType.value)) return 'timePicker'
  if (isRating(column.value)) return 'rating'
  if (isDuration(column.value)) return 'duration'
  if (isEmail(column.value)) return 'email'
  if (isURL(column.value)) return 'url'
  if (isPhoneNumber(column.value)) return 'phoneNumber'
  if (isPercent(column.value)) return 'percent'
  if (isCurrency(column.value)) return 'currency'
  if (isUser(column.value)) return 'user'
  if (isDecimal(column.value)) return 'decimal'
  if (isFloat(column.value, abstractType.value)) return 'float'
  if (isString(column.value, abstractType.value)) return 'text'
  if (isInt(column.value, abstractType.value)) return 'integer'
  if (isJSON(column.value)) return 'json'
  return 'text'
})
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
        'nc-cell-longtext-ai': cellType === 'ai',
      },
    ]"
    class="nc-cell w-full h-full relative"
    @contextmenu="onContextmenu"
    @keydown.enter.exact="navigate(NavigateDir.NEXT, $event)"
    @keydown.shift.enter.exact="navigate(NavigateDir.PREV, $event)"
  >
    <template v-if="column">
      <div v-if="isGenerating" class="flex items-center gap-2 w-full">
        <GeneralLoader />
        <NcTooltip class="truncate max-w-[calc(100%_-_24px)]" show-on-truncate-only>
          <template #title> {{ $t('general.generating') }} </template>
          {{ $t('general.generating') }}
        </NcTooltip>
      </div>
      <LazyCellAI v-else-if="cellType === 'ai'" v-model="vModel" @save="emit('save')" />
      <LazyCellTextArea v-else-if="cellType === 'textarea'" v-model="vModel" :virtual="props.virtual" />
      <LazyCellGeoData v-else-if="cellType === 'geoData'" v-model="vModel" />
      <LazyCellCheckbox v-else-if="cellType === 'checkbox'" v-model="vModel" />
      <LazyCellAttachment
        v-else-if="cellType === 'attachment'"
        ref="attachmentCell"
        v-model="vModel"
        :row-index="props.rowIndex"
      />
      <LazyCellSingleSelect
        v-else-if="cellType === 'singleSelect'"
        v-model="vModel"
        :disable-option-creation="!!isEditColumnMenu"
        :row-index="props.rowIndex"
      />
      <LazyCellMultiSelect
        v-else-if="cellType === 'multiSelect'"
        v-model="vModel"
        :disable-option-creation="!!isEditColumnMenu"
        :row-index="props.rowIndex"
      />
      <LazyCellDatePicker
        v-else-if="cellType === 'datePicker'"
        v-model="vModel"
        :is-pk="isPrimaryKey(column)"
        :show-current-date-option="showCurrentDateOption"
        @current-date="currentDate"
      />
      <LazyCellYearPicker v-else-if="cellType === 'yearPicker'" v-model="vModel" :is-pk="isPrimaryKey(column)" />
      <LazyCellDateTimePicker
        v-else-if="cellType === 'dateTimePicker'"
        v-model="vModel"
        :is-pk="isPrimaryKey(column)"
        :is-updated-from-copy-n-paste="currentRow.rowMeta.isUpdatedFromCopyNPaste"
        :show-current-date-option="showCurrentDateOption"
        @current-date="currentDate"
      />
      <LazyCellTimePicker v-else-if="cellType === 'timePicker'" v-model="vModel" :is-pk="isPrimaryKey(column)" />
      <LazyCellRating v-else-if="cellType === 'rating'" v-model="vModel" />
      <LazyCellDuration v-else-if="cellType === 'duration'" v-model="vModel" />
      <LazyCellEmail v-else-if="cellType === 'email'" v-model="vModel" />
      <LazyCellUrl v-else-if="cellType === 'url'" v-model="vModel" />
      <LazyCellPhoneNumber v-else-if="cellType === 'phoneNumber'" v-model="vModel" />
      <LazyCellPercent v-else-if="cellType === 'percent'" v-model="vModel" />
      <LazyCellCurrency v-else-if="cellType === 'currency'" v-model="vModel" @save="emit('save')" />
      <LazyCellUser v-else-if="cellType === 'user'" v-model="vModel" :row-index="props.rowIndex" />
      <LazyCellDecimal v-else-if="cellType === 'decimal'" v-model="vModel" />
      <LazyCellFloat v-else-if="cellType === 'float'" v-model="vModel" />
      <LazyCellText v-else-if="cellType === 'text'" v-model="vModel" />
      <LazyCellInteger v-else-if="cellType === 'integer'" v-model="vModel" />
      <LazyCellJson v-else-if="cellType === 'json'" v-model="vModel" />
      <LazyCellText v-else v-model="vModel" />
      <div
        v-if="
          ((isPublic && readOnly && !isForm) || isSystemColumn(column)) &&
          !isAttachment(column) &&
          !isTextArea(column) &&
          !isAI(column) &&
          !isJSON(column)
        "
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
    &:not(.ant-select-selection-search-input) {
      @apply !text-sm;
      font-weight: 500;
    }
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
