<script setup lang="ts">
import {
  FormulaDataTypes,
  FormulaError,
  UITypes,
  getUITypesForFormulaDataType,
  isHiddenCol,
  isVirtualCol,
  substituteColumnIdWithAliasInFormula,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk'
import type { ColumnType, FormulaType } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()
const emit = defineEmits(['update:value'])

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const vModel = useVModel(props, 'value', emit)

const { setAdditionalValidations, sqlUi, column, validateInfos } = useColumnCreateStoreOrThrow()

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const { base: activeBase } = storeToRefs(useBase())

const supportedColumns = computed(
  () =>
    meta?.value?.columns?.filter((col) => {
      if (uiTypesNotSupportedInFormulas.includes(col.uidt as UITypes)) {
        return false
      }

      if (isHiddenCol(col, meta.value)) {
        return false
      }

      return true
    }) || [],
)
const { getMeta } = useMetas()

const validators = {
  formula_raw: [
    {
      required: true,
      validator: (_: any, formula: any) => {
        return (async () => {
          if (!formula?.trim()) throw new Error('Required')

          try {
            await validateFormulaAndExtractTreeWithType({
              column: column.value,
              formula,
              columns: supportedColumns.value,
              clientOrSqlUi: sqlUi.value,
              getMeta,
            })
          } catch (e: any) {
            if (e instanceof FormulaError && e.extra?.key) {
              throw new Error(t(e.extra.key, e.extra))
            }

            throw new Error(e.message)
          }
        })()
      },
    },
  ],
}

// set default value
if ((column.value?.colOptions as any)?.formula_raw) {
  vModel.value.formula_raw =
    substituteColumnIdWithAliasInFormula(
      (column.value?.colOptions as FormulaType)?.formula,
      meta?.value?.columns as ColumnType[],
      (column.value?.colOptions as any)?.formula_raw,
    ) || ''
}

const source = computed(() => activeBase.value?.sources?.find((s) => s.id === meta.value?.source_id))

const parsedTree = ref<any>({
  dataType: FormulaDataTypes.UNKNOWN,
})

const previousDisplayType = ref()

const savedDisplayType = ref(vModel.value.meta.display_type)

const hadError = ref(false)

// Initialize a counter to track watcher invocations
let watcherCounter = 0

// Define the debounced async validation function
const debouncedValidate = useDebounceFn(async () => {
  // Increment the counter for each invocation
  watcherCounter += 1
  const currentCounter = watcherCounter

  try {
    const parsed = await validateFormulaAndExtractTreeWithType({
      formula: vModel.value.formula || vModel.value.formula_raw,
      columns: meta.value?.columns || [],
      column: column.value ?? undefined,
      clientOrSqlUi: source.value?.type as any,
      getMeta: async (modelId) => await getMeta(modelId),
    })

    // Update parsedTree only if this is the latest invocation
    if (currentCounter === watcherCounter) {
      parsedTree.value = parsed
    }
    if (hadError.value && previousDisplayType.value) {
      vModel.value.meta.display_type = previousDisplayType.value
    }
    previousDisplayType.value = undefined
    hadError.value = false
  } catch (e) {
    // Update parsedTree only if this is the latest invocation
    if (currentCounter === watcherCounter) {
      parsedTree.value = {
        dataType: FormulaDataTypes.UNKNOWN,
      }
    }
    previousDisplayType.value = vModel.value.meta.display_type
    hadError.value = true
  } finally {
    if (vModel.value?.colOptions?.parsed_tree?.dataType !== parsedTree.value?.dataType) {
      vModel.value.meta.display_type = null
    } else {
      vModel.value.meta.display_type = savedDisplayType.value
    }
  }
}, 300)

// Watch the formula inputs and call the debounced function
watch(
  () => vModel.value.formula || vModel.value.formula_raw,
  () => {
    debouncedValidate()
  },
  {
    immediate: true,
  },
)

// set additional validations
setAdditionalValidations({
  ...validators,
})

const activeKey = ref('formula')

const supportedFormulaAlias = computed(() => {
  if (!parsedTree.value?.dataType) return []
  try {
    return getUITypesForFormulaDataType(parsedTree.value?.dataType as FormulaDataTypes).map((uidt) => {
      return {
        value: uidt,
        label: t(`datatype.${uidt}`),
        icon: h(
          isVirtualCol(uidt) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'),
          {
            columnMeta: {
              uidt,
            },
          },
        ),
      }
    })
  } catch (e) {
    return []
  }
})

watch(
  () => vModel.value.meta?.display_type,
  (value, oldValue) => {
    if (oldValue === undefined && !value) {
      vModel.value.meta.display_column_meta = {
        meta: {},
        custom: {},
      }
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="formula-wrapper relative">
    <NcTabs v-model:activeKey="activeKey">
      <a-tab-pane key="formula">
        <template #tab>
          <div class="tab">
            <div>{{ $t('datatype.Formula') }}</div>
          </div>
        </template>
        <div class="px-0.5">
          <SmartsheetColumnFormulaInputHelper
            v-model:value="vModel.formula_raw"
            :error="validateInfos.formula_raw?.validateStatus === 'error'"
          />
        </div>
      </a-tab-pane>

      <a-tab-pane key="format" :disabled="!supportedFormulaAlias?.length || !parsedTree?.dataType">
        <template #tab>
          <div class="tab">
            <div>{{ $t('labels.formatting') }}</div>
          </div>
        </template>
        <div class="flex flex-col px-0.5 gap-4 pb-0.5">
          <a-form-item class="mt-4" :label="$t('general.format')">
            <NcSelect
              v-model:value="vModel.meta.display_type"
              class="w-full nc-select-shadow"
              :placeholder="$t('labels.selectAFormatType')"
              allow-clear
              @change="
                (v) => {
                  savedDisplayType = v
                }
              "
            >
              <a-select-option v-for="option in supportedFormulaAlias" :key="option.value" :value="option.value">
                <div class="flex w-full items-center gap-2 justify-between">
                  <div class="w-full">
                    <component :is="option.icon" class="w-4 h-4 !text-gray-600" />
                    {{ option.label }}
                  </div>
                  <component
                    :is="iconMap.check"
                    v-if="option.value === vModel.meta?.display_type"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>

          <template
            v-if="
              [
                FormulaDataTypes.NUMERIC,
                FormulaDataTypes.DATE,
                FormulaDataTypes.BOOLEAN,
                FormulaDataTypes.STRING,
                FormulaDataTypes.COND_EXP,
              ].includes(parsedTree?.dataType)
            "
          >
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
        </div>
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-tabs-nav-wrap) {
  @apply !pl-0;
}

:deep(.ant-form-item-control-input) {
  @apply h-full;
}

:deep(.ant-tabs-content-holder) {
  @apply mt-4;
}

:deep(.ant-tabs-tab) {
  @apply !pb-0 pt-1;
}

:deep(.ant-tabs-nav) {
  @apply !mb-0 !pl-0;
}

:deep(.ant-tabs-tab-btn) {
  @apply !mb-1;
}

.mono-font {
  font-family: 'JetBrainsMono', monospace;
}
</style>
