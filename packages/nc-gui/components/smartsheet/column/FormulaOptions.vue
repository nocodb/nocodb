<script setup lang="ts">
import {
  ColumnHelper,
  FormulaDataTypes,
  FormulaError,
  UITypes,
  getUITypesForFormulaDataType,
  isColumnInError,
  isHiddenCol,
  substituteColumnIdWithAliasInFormula,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk'
import type { ColumnType, FormulaType, SelectOptionType, UnifiedMetaType } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()
const emit = defineEmits(['update:value'])

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const vModel = useVModel(props, 'value', emit)

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Formula),
  ...(vModel.value.meta || {}),
}

const { setAdditionalValidations, setAvoidShowingToastMsgForValidations, sqlUi, column, validateInfos, disableSubmitBtn } =
  useColumnCreateStoreOrThrow()

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const defaultEditorError = {
  isError: false,
  message: '',
  position: {
    column: -1,
    row: -1,
  },
}
const editorError = ref(defaultEditorError)

const { base: activeBase } = storeToRefs(useBase())

const supportedColumns = computed(
  () =>
    meta?.value?.columns?.filter((col) => {
      if (uiTypesNotSupportedInFormulas.includes(col.uidt as UITypes)) {
        return false
      }

      if (isColumnInError(col)) {
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
          if (!formula?.trim()) throw new Error(t('general.required'))
          try {
            await validateFormulaAndExtractTreeWithType({
              column: column.value as UnifiedMetaType.IColumn,
              formula,
              columns: supportedColumns.value as UnifiedMetaType.IColumn[],
              clientOrSqlUi: sqlUi.value,
              getMeta: validateFormulaGetMeta(getMeta),
              trackPosition: true,
            })
            editorError.value = { ...defaultEditorError }
          } catch (e: any) {
            const errorMessage = e instanceof FormulaError && e.extra?.key ? t(e.extra.key, e.extra) : e.message
            if (e instanceof FormulaError && e.extra?.position) {
              editorError.value = {
                isError: true,
                message: errorMessage,
                position: e.extra.position,
              }
            } else {
              editorError.value = { ...defaultEditorError }
            }
            throw new Error(errorMessage)
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
      columns: (meta.value?.columns || []) as UnifiedMetaType.IColumn[],
      column: (column.value ?? undefined) as UnifiedMetaType.IColumn,
      clientOrSqlUi: source.value?.type as any,
      getMeta: validateFormulaGetMeta(getMeta),
      trackPosition: true,
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

setAvoidShowingToastMsgForValidations({
  formula_raw: true,
})

// Disable submit button when formula has validation error or is empty
watch(
  () => validateInfos.formula_raw?.validateStatus,
  (status) => {
    disableSubmitBtn.value = status === 'error'
  },
  { immediate: true },
)

const activeKey = ref('formula')

const supportedFormulaAlias = computed(() => {
  if (!parsedTree.value?.dataType) return []
  try {
    return getUITypesForFormulaDataType(parsedTree.value?.dataType as FormulaDataTypes).map((uidt) => {
      return {
        value: uidt,
        label: t(`datatype.${uidt}`),
        icon: h(resolveComponent('SmartsheetHeaderIcon'), {
          column: {
            uidt,
          },
        }),
      }
    })
  } catch (e) {
    return []
  }
})

const onDisplayTypeChange = (value: UITypes | undefined) => {
  savedDisplayType.value = value
  // select options only apply to the Single select format
  if (value !== UITypes.SingleSelect && vModel.value.meta.display_column_meta?.colOptions) {
    delete vModel.value.meta.display_column_meta.colOptions
  }
}

const displaySelectOptions = computed<SelectOptionType[]>(() =>
  (vModel.value.meta.display_column_meta?.colOptions?.options ?? []).filter((op: SelectOptionType) => op.title),
)

const { isDark, getColor } = useTheme()

const isDisplaySelectColorCoded = computed(
  () => parseProp(vModel.value.meta.display_column_meta?.meta)?.isColorCodeEnabled !== false,
)

// The fallback is stored as an option id, so renaming or reordering options never moves
// it. '' = show the result as is; antd renders a null value as the placeholder.
const displaySelectFallback = computed({
  get: () => {
    const fallback = vModel.value.meta.display_column_meta?.meta?.fallbackOption
    return displaySelectOptions.value.some((op) => op.id === fallback) ? fallback : ''
  },
  set: (val: string) => {
    const displayColumnMeta = vModel.value.meta.display_column_meta
    displayColumnMeta.meta = { ...(displayColumnMeta.meta ?? {}), fallbackOption: val || null }
  },
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
    <NcTabs v-model:active-key="activeKey">
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
            :editor-error="editorError"
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
              @change="onDisplayTypeChange"
            >
              <a-select-option v-for="option in supportedFormulaAlias" :key="option.value" :value="option.value">
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
            <template v-else-if="vModel.meta.display_type === UITypes.SingleSelect">
              <SmartsheetColumnSelectOptions :value="vModel.meta.display_column_meta" is-display-format />
              <a-form-item :label="$t('labels.formulaSelectFallback')">
                <NcSelect
                  v-model:value="displaySelectFallback"
                  class="w-full nc-select-shadow nc-formula-select-fallback"
                  data-testid="nc-formula-select-fallback"
                >
                  <a-select-option value="">
                    <div class="flex w-full items-center gap-2 justify-between">
                      <span>{{ $t('labels.formulaSelectFallbackResult') }}</span>
                      <component
                        :is="iconMap.check"
                        v-if="!displaySelectFallback"
                        id="nc-selected-item-icon"
                        class="text-nc-content-brand w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                  <a-select-option v-for="option in displaySelectOptions" :key="option.id" :value="option.id">
                    <div class="flex w-full items-center gap-2 justify-between">
                      <a-tag
                        class="rounded-tag max-w-full"
                        :color="
                          getSelectTypeFieldOptionBgColor({
                            color: option.color,
                            isDark,
                            getColor,
                            isColorCodeEnabled: isDisplaySelectColorCoded,
                          })
                        "
                      >
                        <span
                          class="text-small truncate"
                          :style="{
                            color: getSelectTypeFieldOptionTextColor({
                              color: option.color,
                              isDark,
                              getColor,
                              isColorCodeEnabled: isDisplaySelectColorCoded,
                            }),
                          }"
                        >
                          {{ option.title }}
                        </span>
                      </a-tag>
                      <component
                        :is="iconMap.check"
                        v-if="option.id === displaySelectFallback"
                        id="nc-selected-item-icon"
                        class="text-nc-content-brand w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>
              </a-form-item>
            </template>
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

.rounded-tag {
  @apply py-[1px] px-2 rounded-[12px];
}

.mono-font {
  font-family: 'JetBrainsMono', monospace;
}
</style>
