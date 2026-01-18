<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, RollupType, TableType } from 'nocodb-sdk'
import {
  ColumnHelper,
  FormulaDataTypes,
  PlanFeatureTypes,
  PlanTitles,
  UITypes,
  getAvailableRollupForColumn,
  getUITypesForFormulaDataType,
  rollupAllFunctions,
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
  onDataTypeChange,
  isEdit,
  disableSubmitBtn,
  updateFieldName,
  setPostSaveOrUpdateCbk,
} = useColumnCreateStoreOrThrow()

const baseStore = useBase()

const { tables } = storeToRefs(baseStore)

const { getMeta, getMetaByKey } = useMetas()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { getPlanTitle } = useEeConfig()

const filterRef = ref()

setAdditionalValidations({
  fk_relation_column_id: [{ required: true, message: t('general.required') }],
  fk_rollup_column_id: [{ required: true, message: t('general.required') }],
  rollup_function: [{ required: true, message: t('general.required') }],
})

setAvoidShowingToastMsgForValidations({
  fk_relation_column_id: true,
  fk_rollup_column_id: true,
  rollup_function: true,
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

  return getMetaByKey(selectedTable.value.base_id, selectedTable.value.id)?.columns?.filter((c: ColumnType) =>
    getValidRollupColumn(c),
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

onMounted(() => {
  if (isEdit.value) {
    vModel.value.fk_relation_column_id = vModel.value.colOptions?.fk_relation_column_id
    vModel.value.fk_rollup_column_id = vModel.value.colOptions?.fk_rollup_column_id
    vModel.value.rollup_function = vModel.value.colOptions?.rollup_function
  }

  setPostSaveOrUpdateCbk(async ({ colId, column }) => {
    await filterRef.value?.applyChanges(colId || column?.id, false)
  })
})

onUnmounted(() => {
  setPostSaveOrUpdateCbk(null)
})

const getNextColumnId = () => {
  const usedLookupColumnIds = (meta.value?.columns || [])
    .filter((c) => c.uidt === UITypes.Rollup)
    .map((c) => (c.colOptions as RollupType)?.fk_rollup_column_id)

  return columns.value.find((c) => !usedLookupColumnIds.includes(c.id))?.id
}

const onRelationColChange = async () => {
  if (selectedTable.value) {
    await getMeta(selectedTable.value.base_id, selectedTable.value.id)
  }
  vModel.value.fk_rollup_column_id = getNextColumnId() || columns.value?.[0]?.id
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
      .filter((func) => getAvailableRollupForColumn(column).includes(func.value))
  })
  return fnMap
})

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
  if (!refTables.value.length) {
    disableSubmitBtn.value = true
  } else if (refTables.value.length && disableSubmitBtn.value) {
    disableSubmitBtn.value = false
  }
})

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



// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Rollup),
  ...(vModel.value.meta || {}),
}

const { isMetaReadOnly } = useRoles()



const activeKey = ref('rollup')

const rollupResultType = computed(() => {
  if (!vModel.value.rollup_function) return FormulaDataTypes.UNKNOWN
  const func = vModel.value.rollup_function

  if (['count', 'countDistinct'].includes(func)) {
    return FormulaDataTypes.NUMERIC
  }

  if (['sum', 'avg', 'sumDistinct', 'avgDistinct'].includes(func)) {
    return FormulaDataTypes.NUMERIC
  }

  if (!vModel.value.fk_rollup_column_id) return FormulaDataTypes.UNKNOWN

  const childCol = columns.value.find((c) => c.id === vModel.value.fk_rollup_column_id)
  if (!childCol) return FormulaDataTypes.UNKNOWN

  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.Time,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(childCol.uidt as UITypes)
  ) {
    return FormulaDataTypes.DATE
  }

  if (childCol.uidt === UITypes.Checkbox) {
    return FormulaDataTypes.BOOLEAN
  }

  return FormulaDataTypes.NUMERIC
})

const enableFormattingOptions = computed(() => {
  return (
    rollupResultType.value &&
    rollupResultType.value !== FormulaDataTypes.UNKNOWN &&
    rollupResultType.value !== FormulaDataTypes.STRING
  )
})

// Get supported display types for numeric rollup results
const supportedDisplayTypes = computed(() => {
  if (!enableFormattingOptions.value) return []
  try {
    return getUITypesForFormulaDataType(rollupResultType.value).map((uidt) => {
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
  <div v-if="refTables.length" class="rollup-wrapper relative">
    <NcTabs v-model:active-key="activeKey">
      <a-tab-pane key="rollup">
        <template #tab>
          <div class="tab">
            <div>{{ $t('datatype.Rollup') }}</div>
          </div>
        </template>
        <div class="flex flex-col gap-4 px-0.5">
          <div class="w-full flex flex-row space-x-2">
            <a-form-item
              class="flex w-1/2 !max-w-[calc(50%_-_4px)] pb-2"
              :label="`${$t('general.link')} ${$t('objects.field')}`"
              v-bind="validateInfos.fk_relation_column_id"
            >
              <a-select
                v-model:value="vModel.fk_relation_column_id"
                placeholder="-select-"
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
                        class="text-primary w-4 h-4"
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
                placeholder="-select-"
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
                      class="text-primary w-4 h-4"
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
              placeholder="-select-"
              dropdown-class-name="nc-dropdown-rollup-function"
              class="!mt-0.5"
              @change="onRollupFunctionChange"
            >
              <template #suffixIcon>
                <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
              </template>
              <a-select-option v-for="(func, index) of aggFunctionsList" :key="index" :value="func.value">
                <div class="flex gap-2 justify-between items-center">
                  {{ func.text }}
                  <component
                    :is="iconMap.check"
                    v-if="vModel.rollup_function === func.value"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </a-select>
          </a-form-item>

          <div v-if="isEeUI" class="w-full flex flex-col gap-4">
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
                  v-model="vModel.filters"
                  class="!pl-10 !p-0 max-w-620px"
                  :auto-save="false"
                  :show-loading="false"
                  link
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
      </a-tab-pane>

      <a-tab-pane key="format" :disabled="!enableFormattingOptions">
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
            >
              <a-select-option v-for="option in supportedDisplayTypes" :key="option.value" :value="option.value">
                <div class="flex w-full items-center gap-2 justify-between">
                  <div class="w-full">
                    <component :is="option.icon" class="w-4 h-4" color="text-nc-content-gray-subtle2" />
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

          <template v-if="enableFormattingOptions">
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
            <SmartsheetColumnDecimalOptions
              v-else-if="rollupResultType === FormulaDataTypes.NUMERIC"
              :value="vModel"
            />
          </template>
        </div>
      </a-tab-pane>
    </NcTabs>
  </div>
  <div v-else>
    <a-alert type="warning" show-icon>
      <template #icon><GeneralIcon icon="alertTriangle" class="h-6 w-6" width="24" height="24" /></template>
      <template #message> Alert </template>
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

:deep(.ant-select-selector .ant-select-selection-item .nc-relation-details) {
  @apply hidden;
}

:deep(.nc-filter-grid) {
  @apply !pr-0;
}
</style>
