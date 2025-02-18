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

const emit = defineEmits(['update:modelValue', 'save', 'navigate', 'update:editEnabled', 'update:cdf', 'saveWithState'])

const column = toRef(props, 'column')

const meta = inject(MetaInj, ref())

const active = toRef(props, 'active', false)

const readOnly = toRef(props, 'readOnly', false)

provide(ColumnInj, column)

const editEnabled = useVModel(props, 'editEnabled', emit)

const localEditEnabled = ref(false)

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

const { currentRow, state } = useSmartsheetRowStoreOrThrow()

const { sqlUis } = storeToRefs(useBase())

const { generatingRows, generatingColumns } = useNocoAi()

const { showNull } = useGlobal()

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

const emitSave = () => {
  emit('save', [currentRow.value, column.value.title, state.value])
}

const syncValue = useDebounceFn(
  () => {
    currentRow.value.rowMeta.changed = false
    emitSave()
  },
  500,
  { maxWait: 2000 },
)

const isCanvasInjected = inject(IsCanvasInjectionInj, false)

onBeforeUnmount(() => {
  if (!isCanvasInjected) return
  if (currentRow.value.oldRow?.[column.value.title] === currentRow.value.row?.[column.value.title]) return
  currentRow.value.rowMeta.changed = false
  emitSave()
})

let saveTimer: number

const updateWhenEditCompleted = () => {
  if (editEnabled.value) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = window.setTimeout(updateWhenEditCompleted, 500)
  } else {
    emitSave()
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
        emitSave()
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

const isPrimaryCol = computed(() => isPrimary(column.value))

const isPrimaryKeyCol = computed(() => isPrimaryKey(column.value))

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

const showNullComponent = computed(() => {
  return (readOnly.value || !editEnabled.value) && vModel.value === null && isShowNullField(column.value) && showNull.value
})

const showReadonlyField = computed(() => {
  switch (cellType.value) {
    case 'currency': {
      return !((!readOnly.value && editEnabled.value) || (isForm && !isEditColumnMenu.value && editEnabled.value))
    }

    case 'percent': {
      return !(
        !readOnly.value &&
        editEnabled.value &&
        (isExpandedFormOpen.value ? localEditEnabled.value || !parseProp(column.value?.meta).is_progress : true)
      )
    }

    case 'checkbox':
    case 'rating': {
      return readOnly.value
    }

    case 'singleSelect':
    case 'multiSelect':
    case 'user': {
      return readOnly.value || !(active.value || editEnabled.value || isForm.value)
    }

    case 'datePicker':
    case 'dateTimePicker':
    case 'timePicker':
    case 'yearPicker': {
      return readOnly.value || !(active.value || editEnabled.value)
    }

    default: {
      return readOnly.value || !editEnabled.value
    }
  }
})

const showLockedOverlay = computed(() => {
  return (
    ((isPublic.value && readOnly.value && !isForm.value) || isSystemColumn(column.value)) &&
    cellType.value !== 'attachment' &&
    cellType.value !== 'textarea' &&
    cellType.value !== 'ai' &&
    cellType.value !== 'json'
  )
})

const cellClassName = computed(() => {
  let className = `nc-cell-${(column.value?.uidt || 'default').toLowerCase()}`

  if (isPrimaryCol.value && !props.virtual && !isForm.value && !isCalendar.value) {
    className += ' nc-display-value-cell'
  }

  if (
    isGrid.value &&
    isNumericField.value &&
    !isEditColumnMenu.value &&
    !isForm.value &&
    !isExpandedFormOpen.value &&
    cellType.value !== 'rating' &&
    cellType.value !== 'yearPicker'
  ) {
    className += ' nc-grid-numeric-cell-right'
  }

  if (
    !isEditColumnMenu.value &&
    isForm.value &&
    !props.virtual &&
    cellType.value !== 'attachment' &&
    cellType.value !== 'textarea' &&
    cellType.value !== 'ai'
  ) {
    className += ' h-10'
  }

  if ((isForm.value && isNumericField.value && isExpandedFormOpen.value) || isEditColumnMenu.value) {
    className += ' nc-grid-numeric-cell-left'
  }

  if (cellType.value === 'textarea' && (isForm.value || isSurveyForm.value)) {
    className += ' !min-h-30'
  }

  if (cellType.value === 'ai') {
    className += ' nc-cell-longtext-ai'
  }

  return className
})
</script>

<template>
  <div
    :class="cellClassName"
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
      <LazyCellNull v-else-if="showNullComponent" />
      <LazyCellAI v-else-if="cellType === 'ai'" v-model="vModel" @save="emitSave" />
      <LazyCellTextArea v-else-if="cellType === 'textarea'" v-model="vModel" :virtual="props.virtual" />

      <CellGeoData v-else-if="cellType === 'geoData'" v-model="vModel" v-model:local-edit-enabled="localEditEnabled" />

      <template v-else-if="cellType === 'checkbox'">
        <LazyCellCheckboxReadonly v-if="showReadonlyField" :model-value="vModel" />
        <LazyCellCheckboxEditor v-else v-model="vModel" />
      </template>

      <template v-else-if="cellType === 'yearPicker'">
        <CellYearReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellYearEditor v-else v-model="vModel" :is-pk="isPrimaryKeyCol" />
      </template>

      <template v-else-if="cellType === 'datePicker'">
        <CellDateReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellDateEditor
          v-else
          v-model="vModel"
          :is-pk="isPrimaryKeyCol"
          :show-current-date-option="showCurrentDateOption"
          @current-date="currentDate"
        />
      </template>

      <template v-else-if="cellType === 'dateTimePicker'">
        <LazyCellDateTimeReadonly
          v-if="showReadonlyField"
          :model-value="vModel"
          :is-updated-from-copy-n-paste="currentRow.rowMeta.isUpdatedFromCopyNPaste"
        />
        <CellDateTimeEditor
          v-else
          v-model="vModel"
          :is-pk="isPrimaryKeyCol"
          :is-updated-from-copy-n-paste="currentRow.rowMeta.isUpdatedFromCopyNPaste"
          :show-current-date-option="showCurrentDateOption"
          @current-date="currentDate"
        />
      </template>

      <LazyCellAttachment
        v-else-if="cellType === 'attachment'"
        ref="attachmentCell"
        v-model="vModel"
        :row-index="props.rowIndex"
      />

      <LazyCellSingleSelect
        v-else-if="cellType === 'singleSelect'"
        v-model="vModel"
        :disable-option-creation="isEditColumnMenu"
        :row-index="props.rowIndex"
        :show-readonly-field="showReadonlyField"
      />

      <LazyCellMultiSelect
        v-else-if="cellType === 'multiSelect'"
        v-model="vModel"
        :disable-option-creation="isEditColumnMenu"
        :row-index="props.rowIndex"
        :show-readonly-field="showReadonlyField"
      />

      <template v-else-if="cellType === 'timePicker'">
        <LazyCellTimeReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellTimeEditor v-else v-model="vModel" :is-pk="isPrimaryKeyCol" />
      </template>

      <template v-else-if="cellType === 'rating'">
        <LazyCellRatingReadonly v-if="showReadonlyField" :model-value="vModel" />
        <LazyCellRatingEditor v-else v-model="vModel" />
      </template>

      <template v-else-if="cellType === 'duration'">
        <LazyCellDurationReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellDurationEditor v-else v-model="vModel" />
      </template>

      <template v-else-if="cellType === 'email'">
        <LazyCellEmailReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellEmailEditor v-else v-model="vModel" />
      </template>

      <template v-else-if="cellType === 'url'">
        <LazyCellUrlReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellUrlEditor v-else v-model="vModel" />
      </template>

      <template v-else-if="cellType === 'phoneNumber'">
        <LazyCellPhoneNumberReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellPhoneNumberEditor v-else v-model="vModel" />
      </template>

      <template v-else-if="cellType === 'percent'">
        <LazyCellPercentReadonly v-if="showReadonlyField" v-model:local-edit-enabled="localEditEnabled" :model-value="vModel" />
        <CellPercentEditor v-else v-model="vModel" v-model:local-edit-enabled="localEditEnabled" />
      </template>

      <template v-else-if="cellType === 'currency'">
        <LazyCellCurrencyReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellCurrencyEditor v-else v-model="vModel" @save="emitSave" />
      </template>

      <LazyCellUser
        v-else-if="cellType === 'user'"
        v-model="vModel"
        :row-index="props.rowIndex"
        :show-readonly-field="showReadonlyField"
      />

      <template v-else-if="cellType === 'decimal'">
        <LazyCellDecimalReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellDecimalEditor v-else v-model="vModel" />
      </template>

      <template v-else-if="cellType === 'float'">
        <LazyCellFloatReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellFloatEditor v-else v-model="vModel" />
      </template>

      <template v-else-if="cellType === 'integer'">
        <LazyCellIntegerReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellIntegerEditor v-else v-model="vModel" />
      </template>

      <LazyCellJson v-else-if="cellType === 'json'" v-model="vModel" />

      <template v-else>
        <LazyCellTextReadonly v-if="showReadonlyField" :model-value="vModel" />
        <CellTextEditor v-else v-model="vModel" />
      </template>

      <div v-if="showLockedOverlay" class="nc-locked-overlay" />
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
