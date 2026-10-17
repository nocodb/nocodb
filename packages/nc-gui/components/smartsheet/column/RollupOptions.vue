<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import type {
  ColumnType,
  FormulaType,
  LinkToAnotherRecordType,
  ParsedFormulaNode,
  RollupType,
  TableType,
  UnifiedMetaType,
} from 'nocodb-sdk'
import {
  ColumnHelper,
  FormulaDataTypes,
  FormulaError,
  PlanFeatureTypes,
  PlanTitles,
  ROLLUP_FORMULA_FUNCTION,
  UITypes,
  getAvailableRollupForColumn,
  getUITypesForFormulaDataType,
  integerPreservingRollupFunctions,
  integerRollupFunctions,
  isIntegerRollupFormula,
  isNumericCol,
  isRollupFormulaTargetColumn,
  isSystemColumn,
  resolveColumnSeparator,
  rollupAllFunctions,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()
const emit = defineEmits(['update:value'])
const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const {
  setAdditionalValidations,
  setAvoidShowingToastMsgForValidations,
  validateInfos,
  sqlUi,
  onDataTypeChange,
  isEdit,
  disableSubmitBtn,
  updateFieldName,
} = useColumnCreateStoreOrThrow()

const baseStore = useBase()

const { tables } = storeToRefs(baseStore)

const { getMeta, getMetaByKey } = useMetas()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { getPlanTitle, showEEFeatures } = useEeConfig()

const filterRef = ref()

const defaultEditorError = {
  isError: false,
  message: '',
  position: {
    column: -1,
    row: -1,
  },
}

const editorError = ref(defaultEditorError)

// typed tree of the formula as last validated, drives the formatting options
const formulaParsedTree = ref<ParsedFormulaNode>()

const isFormulaMode = computed(() => vModel.value.rollup_function === ROLLUP_FORMULA_FUNCTION)

setAdditionalValidations({
  fk_relation_column_id: [{ required: true, message: t('general.required') }],
  fk_rollup_column_id: [{ required: true, message: t('general.required') }],
  rollup_function: [{ required: true, message: t('general.required') }],
})

setAvoidShowingToastMsgForValidations({
  fk_relation_column_id: true,
  fk_rollup_column_id: true,
  rollup_function: true,
  rollup_formula: true,
})

if (!vModel.value.fk_relation_column_id) vModel.value.fk_relation_column_id = null
if (!vModel.value.fk_rollup_column_id) vModel.value.fk_rollup_column_id = null
if (!vModel.value.rollup_function) vModel.value.rollup_function = null

const refTables = computed(() => {
  if (!tables.value || !tables.value.length || !meta.value || !meta.value.columns) {
    return []
  }

  const _refTables = meta.value.columns
    .filter((c: ColumnType) => canUseForRollupLinkField(c))
    .map((c: ColumnType) => {
      const relTableId = (c.colOptions as any)?.fk_related_model_id
      const relatedBaseId = (c.colOptions as any)?.fk_related_base_id || meta.value?.base_id
      const table = getMetaByKey(relatedBaseId, relTableId) ?? tables.value.find((t) => t.id === relTableId)
      return {
        col: c.colOptions,
        column: c,
        ...table,
      }
    })
  return _refTables as Required<TableType & { column: ColumnType; col: Required<LinkToAnotherRecordType> }>[]
})

const selectedTable = computed(() => {
  return refTables.value.find((t) => t.column.id === vModel.value.fk_relation_column_id)
})

const columns = computed<ColumnType[]>(() => {
  if (!selectedTable.value?.id) {
    return []
  }

  // a formula rollup also reads Links counts and flattens Lookup / LinkToAnotherRecord fields
  return getMetaByKey(selectedTable.value.base_id, selectedTable.value.id)?.columns?.filter(
    (c: ColumnType) => getValidRollupColumn(c) || (isRollupFormulaTargetColumn(c as { uidt: UITypes }) && !isSystemColumn(c)),
  )
})

const limitRecToCond = computed({
  get() {
    return !!vModel.value.meta?.enableConditions
  },
  set(value) {
    vModel.value.meta = vModel.value.meta || {}
    vModel.value.meta.enableConditions = value
    $e('c:rollup:limit-record-by-filter', { status: value })
  },
})

// Provide related table meta for filter conditions
provide(
  MetaInj,
  computed(() => {
    if (!selectedTable.value) return {}

    return getMetaByKey(selectedTable.value.base_id, selectedTable.value.id) || {}
  }),
)

// Eagerly load the related table meta so the filter column dropdown is populated.
// `getMetaByKey` returns undefined until getMeta is called; this watch fires immediately
// (and again if the user changes the relation) to ensure the cache is populated.
watch(
  selectedTable,
  async (table) => {
    if (table?.base_id && table?.id) {
      await getMeta(table.base_id, table.id)
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (isEdit.value) {
    vModel.value.fk_relation_column_id = vModel.value.colOptions?.fk_relation_column_id
    vModel.value.fk_rollup_column_id = vModel.value.colOptions?.fk_rollup_column_id
    vModel.value.rollup_function = vModel.value.colOptions?.rollup_function
    vModel.value.rollup_formula = vModel.value.colOptions?.rollup_formula
    formulaParsedTree.value = vModel.value.colOptions?.parsed_tree
  }
})

watch(
  () => filterRef.value?.filters,
  (next) => {
    if (!vModel.value) return
    vModel.value.filters = next ? [...next] : []
  },
  { deep: true },
)

const onRelationColChange = async () => {
  if (selectedTable.value) {
    await getMeta(selectedTable.value.base_id, selectedTable.value.id)
  }
  const usedTargetIds = (meta.value?.columns || [])
    .filter((c) => c.uidt === UITypes.Rollup)
    .map((c) => (c.colOptions as RollupType)?.fk_rollup_column_id)
  vModel.value.fk_rollup_column_id = pickDefaultRollupTargetId(columns.value || [], usedTargetIds, getValidRollupColumn)
  onDataTypeChange()
}

const aggFunctionsList: Ref<Record<string, string>[]> = ref([])

const availableRollupPerColumn = computed(() => {
  const fnMap: Record<string, { text: string; value: string }[]> = {}
  columns.value?.forEach((column) => {
    if (!column?.id) return
    fnMap[column.id] = rollupAllFunctions
      .map((obj) => {
        return {
          ...obj,
          text: t(obj.text),
        }
      })
      // links and lookups take only a formula
      .filter((func) => getValidRollupColumn(column) && getAvailableRollupForColumn(column).includes(func.value))
    // a formula can aggregate any field
    fnMap[column.id].push({ text: t('datatype.Formula'), value: ROLLUP_FORMULA_FUNCTION })
  })
  return fnMap
})

const rollupTargetColumn = computed(() => columns.value?.find((c) => c.id === vModel.value.fk_rollup_column_id))

const relatedTableColumns = computed<ColumnType[]>(() => {
  if (!selectedTable.value?.id) return []
  return getMetaByKey(selectedTable.value.base_id, selectedTable.value.id)?.columns || []
})

function extractRollupFormulaTree(formula: string) {
  return validateFormulaAndExtractTreeWithType({
    formula,
    // gives the validator a base/table to resolve metas from
    column: rollupTargetColumn.value as UnifiedMetaType.IColumn,
    columns: [],
    clientOrSqlUi: sqlUi.value,
    getMeta: validateFormulaGetMeta(getMeta),
    trackPosition: true,
    rollup: {
      valuesColumn: rollupTargetColumn.value as UnifiedMetaType.IColumn,
      valuesColumns: relatedTableColumns.value as UnifiedMetaType.IColumn[],
    },
  })
}

const validationTracker = createLatestCallTracker()

// the form rule: reports the error; the typed tree comes from `deriveFormulaTree`
async function validateRollupFormula(formula?: string) {
  if (!isFormulaMode.value) return
  if (!formula?.trim()) throw new Error(t('general.required'))
  if (!rollupTargetColumn.value) return
  const token = validationTracker.start()
  try {
    await extractRollupFormulaTree(formula)
    if (validationTracker.isLatest(token)) editorError.value = { ...defaultEditorError }
  } catch (e: any) {
    const errorMessage = e instanceof FormulaError && e.extra?.key ? t(e.extra.key, e.extra) : e.message
    if (validationTracker.isLatest(token)) {
      editorError.value =
        e instanceof FormulaError && e.extra?.position
          ? { isError: true, message: errorMessage, position: e.extra.position }
          : { ...defaultEditorError }
    }
    throw new Error(errorMessage)
  }
}

setAdditionalValidations({
  rollup_formula: [{ validator: (_: any, formula: string) => validateRollupFormula(formula) }],
})

const treeTracker = createLatestCallTracker()

// as FormulaOptions: debounced, and only the latest result types the formula
const deriveFormulaTree = useDebounceFn(async () => {
  const formula = vModel.value.rollup_formula
  if (!isFormulaMode.value || !formula?.trim() || !rollupTargetColumn.value) return
  const token = treeTracker.start()
  try {
    const tree = await extractRollupFormulaTree(formula)
    if (treeTracker.isLatest(token)) formulaParsedTree.value = tree
  } catch {
    if (treeTracker.isLatest(token)) formulaParsedTree.value = undefined
  }
}, 300)

watch([() => vModel.value.rollup_formula, () => vModel.value.fk_rollup_column_id, isFormulaMode], () => deriveFormulaTree())

// a numeric field starts from SUM, anything else from a joined list
function defaultRollupFormula() {
  const target = rollupTargetColumn.value
  // formulas and formula rollups go by their result type
  const resultType = (target?.colOptions as FormulaType)?.parsed_tree?.dataType
  const isNumeric = resultType ? resultType === FormulaDataTypes.NUMERIC : isNumericCol(target?.uidt as UITypes)
  return isNumeric ? 'SUM(values)' : 'ARRAYJOIN(values)'
}

const filteredColumns = computed(() => {
  return columns.value?.filter((column) => {
    return column.id && availableRollupPerColumn.value[column.id as string]?.length
  })
})

const onRollupFunctionChange = () => {
  const rollupFun = aggFunctionsList.value.find((func) => func.value === vModel.value.rollup_function)
  if (rollupFun && rollupFun?.text) {
    vModel.value.rollup_function_name = rollupFun.text
  }
  if (isFormulaMode.value && !vModel.value.rollup_formula) {
    vModel.value.rollup_formula = defaultRollupFormula()
  }
  // a saved plain rollup switched to a formula by the user starts at two decimals
  if (isEdit.value && isFormulaMode.value && vModel.value.colOptions?.rollup_function !== ROLLUP_FORMULA_FUNCTION) {
    vModel.value.meta = { ...vModel.value.meta, precision: 2 }
  }
  onDataTypeChange()
  updateFieldName()
}

watch(
  () => vModel.value.fk_rollup_column_id,
  () => {
    if (!vModel.value.fk_rollup_column_id) return
    const childFieldColumn = columns.value?.find((column: ColumnType) => column.id === vModel.value.fk_rollup_column_id)

    aggFunctionsList.value = availableRollupPerColumn.value[childFieldColumn?.id as string] || []

    if (aggFunctionsList.value.length && !aggFunctionsList.value.find((func) => func.value === vModel.value.rollup_function)) {
      // when the previous roll up function was numeric type and the current child field is non-numeric
      // reset rollup function with a non-numeric type
      vModel.value.rollup_function = aggFunctionsList.value[0].value
      vModel.value.rollup_function_name = aggFunctionsList.value[0].text
    }

    vModel.value.rollupColumnTitle = childFieldColumn?.title || childFieldColumn?.column_name

    updateFieldName()
  },
  {
    immediate: true,
  },
)

watchEffect(() => {
  disableSubmitBtn.value =
    !refTables.value.length || (isFormulaMode.value && validateInfos.rollup_formula?.validateStatus === 'error')
})

// the formula is typed against the rolled-up field, so re-check it when that changes
watch(
  () => vModel.value.fk_rollup_column_id,
  () => {
    if (!isFormulaMode.value) return
    if (!vModel.value.rollup_formula) {
      vModel.value.rollup_formula = defaultRollupFormula()
    }
    validateRollupFormula(vModel.value.rollup_formula).catch(() => {})
  },
)

watch(
  () => vModel.value.fk_relation_column_id,
  (newValue) => {
    if (!newValue) return

    const selectedTable = refTables.value.find((t) => t.col.fk_column_id === newValue)
    if (selectedTable) {
      vModel.value.rollupTableTitle = selectedTable?.title || selectedTable.table_name
    }
  },
)

// update datatype precision when precision is less than the new value
// avoid downgrading precision if the new value is less than the current precision
// to avoid fractional part data loss(eg. 1.2345 -> 1.23)
const onPrecisionChange = (value: number) => {
  vModel.value.dtxs = Math.max(value, vModel.value.dtxs)
}

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Rollup),
  ...(vModel.value.meta || {}),
}

const precisionFormatsDisplay = makePrecisionFormatsDiplay(t)

// Backward compat: resolve isLocaleString to separator if separator is not yet set
if (!vModel.value.meta.separator) {
  vModel.value.meta.separator = resolveColumnSeparator(vModel.value.meta)
}

// formats a formula result can take, as offered for formula fields
const rollupFormulaFormats = computed(() => {
  if (!isFormulaMode.value || !formulaParsedTree.value?.dataType) return []
  try {
    return getUITypesForFormulaDataType(formulaParsedTree.value.dataType as FormulaDataTypes).map((uidt) => ({
      value: uidt,
      label: t(`datatype.${uidt}`),
      icon: h(resolveComponent('SmartsheetHeaderIcon'), { column: { uidt } }),
    }))
  } catch {
    return []
  }
})

const enableFormattingOptions = computed(() => {
  if (isFormulaMode.value) {
    // a picked format carries its own number options
    if (vModel.value.meta?.display_type) return false
    return formulaParsedTree.value?.dataType === FormulaDataTypes.NUMERIC && !isIntegerRollupFormula(formulaParsedTree.value)
  }

  const relatedCol = filteredColumns.value?.find((col) => col.id === vModel.value.fk_rollup_column_id)

  if (!relatedCol || !vModel.value.rollup_function) return false

  let uidt = relatedCol.uidt

  if (relatedCol.uidt === UITypes.Formula) {
    const colMeta = parseProp(relatedCol.meta)

    if (colMeta?.display_type) {
      uidt = colMeta?.display_type
    } else if ((relatedCol.colOptions as FormulaType)?.parsed_tree?.dataType === FormulaDataTypes.NUMERIC) {
      uidt = UITypes.Decimal
    }
  }
  // count/countDistinct always return integers — precision is not applicable
  if (integerRollupFunctions.includes(vModel.value.rollup_function)) return false

  // Integer-based types — only avg/avgDistinct can produce decimals
  if (isIntegerUiType({ uidt } as ColumnType) && integerPreservingRollupFunctions.includes(vModel.value.rollup_function))
    return false

  // Column types that can produce decimal results
  return isIntegerUiType({ uidt } as ColumnType) || [UITypes.Decimal, UITypes.Currency, UITypes.Percent].includes(uidt as UITypes)
})

watch(
  enableFormattingOptions,
  (enabled) => {
    if (enabled && vModel.value.meta?.precision == null) {
      vModel.value.meta = {
        ...vModel.value.meta,
        ...ColumnHelper.getColumnDefaultMeta(UITypes.Rollup),
      }
    }
  },
  { immediate: true },
)

// a new formula rollup shows two decimals unless a precision was picked;
// saved columns keep theirs
watch(isFormulaMode, (formulaMode) => {
  if (isEdit.value) return
  vModel.value.meta = {
    ...vModel.value.meta,
    precision: nextRollupModePrecision(
      vModel.value.meta?.precision,
      formulaMode,
      ColumnHelper.getColumnDefaultMeta(UITypes.Rollup).precision,
    ),
  }
})

// the user's format, kept while a typed-in formula briefly yields another type
const pickedDisplayType = ref<string | null | undefined>(vModel.value.meta?.display_type)

function onDisplayTypePick(displayType?: string | null) {
  pickedDisplayType.value = displayType
}

// a format that no longer fits the result type is put aside, and comes back when it fits again
watch(rollupFormulaFormats, (formats) => {
  const displayType = nextRollupDisplayType({
    isFormulaMode: isFormulaMode.value,
    formats: formats.map((f) => f.value),
    current: vModel.value.meta?.display_type,
    picked: pickedDisplayType.value,
  })
  if (displayType !== undefined) {
    vModel.value.meta = { ...vModel.value.meta, display_type: displayType }
  }
})

watch(
  () => vModel.value.meta?.display_type,
  (displayType) => {
    if (displayType && !vModel.value.meta.display_column_meta) {
      vModel.value.meta.display_column_meta = { meta: {}, custom: {} }
    }
  },
  { immediate: true },
)

const onFilterLabelClick = () => {
  if (!selectedTable.value) return

  limitRecToCond.value = !limitRecToCond.value
}

const handleScrollIntoView = () => {
  filterRef.value?.$el?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest',
  })
}
</script>

<template>
  <div v-if="refTables.length" class="flex flex-col gap-4">
    <div class="w-full flex flex-row space-x-2">
      <a-form-item
        class="flex w-1/2 !max-w-[calc(50%_-_4px)] pb-2"
        :label="`${$t('general.link')} ${$t('objects.field')}`"
        v-bind="validateInfos.fk_relation_column_id"
      >
        <a-select
          v-model:value="vModel.fk_relation_column_id"
          :placeholder="$t('placeholder.select')"
          dropdown-class-name="!w-64 nc-dropdown-relation-table !rounded-md"
          @change="onRelationColChange"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option v-for="(table, i) of refTables" :key="i" :value="table.col.fk_column_id">
            <div class="flex gap-2 w-full justify-between truncate items-center">
              <div class="min-w-1/2 flex items-center gap-2">
                <SmartsheetHeaderIcon :column="table.column" class="!mx-0" color="text-nc-content-gray-subtle2" />

                <NcTooltip class="truncate min-w-[calc(100%_-_24px)]" show-on-truncate-only>
                  <template #title>{{ table.column.title }}</template>
                  {{ table.column.title }}
                </NcTooltip>
              </div>
              <div class="inline-flex items-center truncate gap-2">
                <div class="text-[0.65rem] leading-4 flex-1 truncate text-nc-content-gray-subtle2 nc-relation-details">
                  <NcTooltip class="truncate" show-on-truncate-only>
                    <template #title>{{ table.title || table.table_name }}</template>
                    {{ table.title || table.table_name }}
                  </NcTooltip>
                </div>

                <component
                  :is="iconMap.check"
                  v-if="vModel.fk_relation_column_id === table.col.fk_column_id"
                  id="nc-selected-item-icon"
                  class="text-nc-content-brand w-4 h-4"
                />
              </div>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item
        class="flex w-1/2"
        :label="`${$t('datatype.Rollup')} ${$t('objects.field')}`"
        v-bind="vModel.fk_relation_column_id ? validateInfos.fk_rollup_column_id : undefined"
      >
        <a-select
          v-model:value="vModel.fk_rollup_column_id"
          name="fk_rollup_column_id"
          :placeholder="$t('placeholder.select')"
          :disabled="!vModel.fk_relation_column_id"
          show-search
          :filter-option="antSelectFilterOption"
          dropdown-class-name="nc-dropdown-relation-column !rounded-xl"
          @change="onDataTypeChange"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option v-for="column of filteredColumns" :key="column.title" :value="column.id">
            <div class="w-full flex gap-2 truncate items-center justify-between">
              <div class="flex items-center gap-2 flex-1 truncate">
                <SmartsheetHeaderIcon :column="column" class="!mx-0" color="text-nc-content-gray-subtle2" />

                <div class="truncate flex-1">{{ column.title }}</div>
              </div>
              <component
                :is="iconMap.check"
                v-if="vModel.fk_rollup_column_id === column.id"
                id="nc-selected-item-icon"
                class="text-nc-content-brand w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>

    <a-form-item
      :label="$t('labels.aggregateFunction')"
      v-bind="vModel.fk_relation_column_id ? validateInfos.rollup_function : undefined"
    >
      <a-select
        v-model:value="vModel.rollup_function"
        :disabled="!vModel.fk_relation_column_id"
        :placeholder="$t('placeholder.select')"
        dropdown-class-name="nc-dropdown-rollup-function"
        class="!mt-0.5"
        @change="onRollupFunctionChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
        </template>
        <a-select-option v-for="(func, index) of aggFunctionsList" :key="index" :value="func.value">
          <div class="w-full flex gap-2 justify-between items-center">
            {{ func.text }}
            <component
              :is="iconMap.check"
              v-if="vModel.rollup_function === func.value"
              id="nc-selected-item-icon"
              class="text-nc-content-brand w-4 h-4"
            />
          </div>
        </a-select-option>
      </a-select>
    </a-form-item>
    <div v-if="isFormulaMode && rollupTargetColumn" class="nc-rollup-formula-editor">
      <SmartsheetColumnFormulaInputHelper
        :key="rollupTargetColumn.id"
        v-model:value="vModel.rollup_formula"
        :label="$t('datatype.Formula')"
        :rollup-values-column="rollupTargetColumn"
        validate-key="rollup_formula"
        :error="validateInfos.rollup_formula?.validateStatus === 'error'"
        :editor-error="editorError"
        suggestion-height="medium"
      />
    </div>
    <template v-if="isFormulaMode && rollupFormulaFormats.length">
      <a-form-item :label="$t('general.format')">
        <NcSelect
          v-model:value="vModel.meta.display_type"
          class="w-full nc-select-shadow"
          :placeholder="$t('labels.selectAFormatType')"
          allow-clear
          data-testid="nc-rollup-formula-format"
          @change="onDisplayTypePick"
        >
          <a-select-option v-for="option in rollupFormulaFormats" :key="option.value" :value="option.value">
            <div class="flex w-full items-center gap-2 justify-between">
              <div class="w-full">
                <component :is="option.icon" class="w-4 h-4" color="text-nc-content-gray-subtle2" />
                {{ option.label }}
              </div>
              <component
                :is="iconMap.check"
                v-if="option.value === vModel.meta?.display_type"
                id="nc-selected-item-icon"
                class="text-nc-content-brand w-4 h-4"
              />
            </div>
          </a-select-option>
        </NcSelect>
      </a-form-item>
      <SmartsheetColumnCurrencyOptions
        v-if="vModel.meta.display_type === UITypes.Currency"
        :value="vModel.meta.display_column_meta"
      />
      <SmartsheetColumnDecimalOptions
        v-else-if="vModel.meta.display_type === UITypes.Decimal"
        :value="vModel.meta.display_column_meta"
      />
      <SmartsheetColumnPercentOptions
        v-else-if="vModel.meta.display_type === UITypes.Percent"
        :value="vModel.meta.display_column_meta"
      />
      <SmartsheetColumnRatingOptions
        v-else-if="vModel.meta.display_type === UITypes.Rating"
        :value="vModel.meta.display_column_meta"
      />
      <SmartsheetColumnTimeOptions
        v-else-if="vModel.meta.display_type === UITypes.Time"
        :value="vModel.meta.display_column_meta"
      />
      <SmartsheetColumnDateTimeOptions
        v-else-if="vModel.meta.display_type === UITypes.DateTime"
        :value="vModel.meta.display_column_meta"
      />
      <SmartsheetColumnDateOptions
        v-else-if="vModel.meta.display_type === UITypes.Date"
        :value="vModel.meta.display_column_meta"
      />
      <SmartsheetColumnCheckboxOptions
        v-else-if="vModel.meta.display_type === UITypes.Checkbox"
        :value="vModel.meta.display_column_meta"
      />
    </template>
    <a-form-item v-if="enableFormattingOptions" :label="$t('placeholder.precision')">
      <a-select
        v-model:value="vModel.meta.precision"
        dropdown-class-name="nc-dropdown-rollup-precision-format"
        @change="onPrecisionChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
        </template>
        <a-select-option v-for="(format, i) of precisionFormats" :key="i" :value="format">
          <div class="flex gap-2 w-full justify-between items-center">
            {{ (precisionFormatsDisplay as any)[format] }}
            <component
              :is="iconMap.check"
              v-if="vModel.meta.precision === format"
              id="nc-selected-item-icon"
              class="text-nc-content-brand w-4 h-4"
            />
          </div>
        </a-select-option>
      </a-select>
    </a-form-item>
    <SmartsheetColumnSeparatorSelect
      v-if="enableFormattingOptions"
      v-model:value="vModel.meta.separator"
      dropdown-class-name="nc-dropdown-rollup-separator-format"
    />

    <div v-if="showEEFeatures" class="w-full flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_ROLLUP_LIMIT_RECORDS_BY_FILTER">
          <template #default="{ click }">
            <div class="flex gap-1 items-center whitespace-nowrap">
              <NcSwitch
                :checked="limitRecToCond"
                :disabled="!selectedTable"
                size="small"
                data-testid="nc-rollup-limit-record-filters"
                @change="
                  (value) => {
                    if (value && click(PlanFeatureTypes.FEATURE_ROLLUP_LIMIT_RECORDS_BY_FILTER)) return
                    onFilterLabelClick()
                  }
                "
              >
                {{ $t('labels.onlyIncludeLinkedRecordsThatMeetSpecificConditions') }}
              </NcSwitch>

              <LazyPaymentUpgradeBadge
                v-if="!limitRecToCond"
                :feature="PlanFeatureTypes.FEATURE_ROLLUP_LIMIT_RECORDS_BY_FILTER"
                :content="
                  $t('upgrade.upgradeToIncludeLinkedRecordsThatMeetSpecificConditions', {
                    plan: getPlanTitle(PlanTitles.PLUS),
                  })
                "
                class="ml-1"
              />
            </div>
          </template>
        </PaymentUpgradeBadgeProvider>

        <div v-if="limitRecToCond" class="overflow-auto nc-scrollbar-thin">
          <LazySmartsheetToolbarColumnFilter
            ref="filterRef"
            class="!pl-8 !p-0"
            :auto-save="false"
            :show-loading="false"
            link
            flush
            hide-sole-where
            :show-dynamic-condition="false"
            :root-meta="meta"
            :link-col-id="vModel.id"
            @add-filter="handleScrollIntoView"
            @add-filter-group="handleScrollIntoView"
          />
        </div>
      </div>
    </div>
  </div>
  <div v-else>
    <a-alert type="warning" show-icon>
      <template #icon><GeneralIcon icon="alertTriangle" class="h-6 w-6" width="24" height="24" /></template>
      <template #message> {{ $t('objects.ncMessage.warning') }} </template>
      <template #description>
        {{
          $t('msg.linkColumnClearNotSupportedYet', {
            type: 'Rollup',
          })
        }}
      </template>
    </a-alert>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-select-selector .ant-select-selection-item .nc-relation-details) {
  @apply hidden;
}

:deep(.nc-filter-grid) {
  @apply !pr-0;
}
</style>
