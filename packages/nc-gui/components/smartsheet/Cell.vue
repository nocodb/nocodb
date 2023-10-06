<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { isSystemColumn } from 'nocodb-sdk'
import {
  ActiveCellInj,
  ColumnInj,
  EditColumnInj,
  EditModeInj,
  IsExpandedFormOpenInj,
  IsFormInj,
  IsLockedInj,
  IsPublicInj,
  IsSurveyFormInj,
  NavigateDir,
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
  isDrawerExist,
  isDuration,
  isEmail,
  isFloat,
  isGeoData,
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
  storeToRefs,
  toRef,
  useBase,
  useDebounceFn,
  useSmartsheetRowStoreOrThrow,
} from '#imports'

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

const isLocked = inject(IsLockedInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isEditColumnMenu = inject(EditColumnInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const { currentRow } = useSmartsheetRowStoreOrThrow()

const { sqlUis } = storeToRefs(useBase())

const sqlUi = ref(column.value?.source_id ? sqlUis.value[column.value?.source_id] : Object.values(sqlUis.value)[0])

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
  get: () => {
    return props.modelValue
  },
  set: (val) => {
    if (isEditColumnMenu.value) {
      emit('update:cdf', val)
    } else if (val !== props.modelValue) {
      currentRow.value.rowMeta.changed = true
      emit('update:modelValue', val)
      if (isAutoSaved(column.value)) {
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
  return (
    isInt(column.value, abstractType.value) ||
    isFloat(column.value, abstractType.value) ||
    isDecimal(column.value) ||
    isCurrency(column.value) ||
    isPercent(column.value) ||
    isDuration(column.value)
  )
})

// disable contexxtmenu event propagation when cell is in
// editable state and typable (e.g. text area)
// this is to prevent the custom grid view context menu from opening
const onContextmenu = (e: MouseEvent) => {
  if (props.editEnabled && isTypableInputColumn(column.value)) {
    e.stopPropagation()
  }
}

// Todo: move intersection logic to a separate component or a vue directive
const intersected = ref(false)

const intersectionObserver = ref<IntersectionObserver>()

const elementToObserve = ref<Element>()

// load the cell only when it is in the viewport
function initIntersectionObserver() {
  intersectionObserver.value = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      // if the cell is in the viewport, load the cell and disconnect the observer
      if (entry.isIntersecting) {
        intersected.value = true
        intersectionObserver.value?.disconnect()
        intersectionObserver.value = undefined
      }
    })
  })
}

// observe the cell when it is mounted
onMounted(() => {
  initIntersectionObserver()
  intersectionObserver.value?.observe(elementToObserve.value!)
})

// disconnect the observer when the cell is unmounted
onUnmounted(() => {
  intersectionObserver.value?.disconnect()
})
</script>

<template>
  <div
    ref="elementToObserve"
    class="nc-cell w-full h-full relative"
    :class="[
      `nc-cell-${(column?.uidt || 'default').toLowerCase()}`,
      {
        'text-brand-500': isPrimary(column) && !props.virtual && !isForm,
        'nc-grid-numeric-cell-right': isGrid && isNumericField && !isEditColumnMenu && !isForm && !isExpandedFormOpen,
        'h-10': isForm && !isSurveyForm && !isAttachment(column) && !props.virtual,
        'nc-grid-numeric-cell-left': (isForm && isNumericField && isExpandedFormOpen) || isEditColumnMenu,
        '!min-h-30 resize-y': isTextArea(column) && (isForm || isSurveyForm),
        '!border-2 !border-brand-500': props.editEnabled && (isSurveyForm || isForm) && !isDrawerExist(),
      },
    ]"
    @keydown.enter.exact="navigate(NavigateDir.NEXT, $event)"
    @keydown.shift.enter.exact="navigate(NavigateDir.PREV, $event)"
    @contextmenu="onContextmenu"
  >
    <template v-if="column">
      <template v-if="intersected">
        <LazyCellTextArea v-if="isTextArea(column)" v-model="vModel" />
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
        <LazyCellDatePicker v-else-if="isDate(column, abstractType)" v-model="vModel" :is-pk="isPrimaryKey(column)" />
        <LazyCellYearPicker v-else-if="isYear(column, abstractType)" v-model="vModel" :is-pk="isPrimaryKey(column)" />
        <LazyCellDateTimePicker
          v-else-if="isDateTime(column, abstractType)"
          v-model="vModel"
          :is-pk="isPrimaryKey(column)"
          :is-updated-from-copy-n-paste="currentRow.rowMeta.isUpdatedFromCopyNPaste"
        />
        <LazyCellTimePicker v-else-if="isTime(column, abstractType)" v-model="vModel" :is-pk="isPrimaryKey(column)" />
        <LazyCellRating v-else-if="isRating(column)" v-model="vModel" />
        <LazyCellDuration v-else-if="isDuration(column)" v-model="vModel" />
        <LazyCellEmail v-else-if="isEmail(column)" v-model="vModel" />
        <LazyCellUrl v-else-if="isURL(column)" v-model="vModel" />
        <LazyCellPhoneNumber v-else-if="isPhoneNumber(column)" v-model="vModel" />
        <LazyCellPercent v-else-if="isPercent(column)" v-model="vModel" />
        <LazyCellCurrency v-else-if="isCurrency(column)" v-model="vModel" @save="emit('save')" />
        <LazyCellDecimal v-else-if="isDecimal(column)" v-model="vModel" />
        <LazyCellFloat v-else-if="isFloat(column, abstractType)" v-model="vModel" />
        <LazyCellText v-else-if="isString(column, abstractType)" v-model="vModel" />
        <LazyCellInteger v-else-if="isInt(column, abstractType)" v-model="vModel" />
        <LazyCellJson v-else-if="isJSON(column)" v-model="vModel" />
        <LazyCellText v-else v-model="vModel" />
        <div
          v-if="
            (isLocked || (isPublic && readOnly && !isForm) || isSystemColumn(column)) &&
            !isAttachment(column) &&
            !isTextArea(column)
          "
          class="nc-locked-overlay"
        />
      </template>
    </template>
  </div>
</template>

<style scoped lang="scss">
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
</style>
