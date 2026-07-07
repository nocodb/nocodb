<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, LookupType, TableType } from 'nocodb-sdk'
import { PlanFeatureTypes, PlanTitles, UITypes, getLookupResultType, getUITypesForLookupResultType } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { t } = useI18n()

const { $e } = useNuxtApp()

const { getPlanTitle, showEEFeatures } = useEeConfig()

const {
  setAdditionalValidations,
  setAvoidShowingToastMsgForValidations,
  validateInfos,
  onDataTypeChange,
  isEdit,
  disableSubmitBtn,
  updateFieldName,
} = useColumnCreateStoreOrThrow()

const baseStore = useBase()

const { tables } = storeToRefs(baseStore)

const { getMeta, getMetaByKey, metasWithIdAsKey } = useMetas()

const filterRef = ref()

// Lookup sort builder — mirrors filterRef: the child owns a local, status-tagged
// sort set which we sync into `vModel.value.sorts`; the column save persists it.
const sortRef = ref()

const activeTabKey = ref<'configuration' | 'formatting'>('configuration')

setAdditionalValidations({
  fk_relation_column_id: [{ required: true, message: t('general.required') }],
  fk_lookup_column_id: [{ required: true, message: t('general.required') }],
})

setAvoidShowingToastMsgForValidations({
  fk_relation_column_id: true,
  fk_lookup_column_id: true,
})

if (!vModel.value.fk_relation_column_id) vModel.value.fk_relation_column_id = null
if (!vModel.value.fk_lookup_column_id) vModel.value.fk_lookup_column_id = null

// initialise formatting meta (display_type / display_column_meta), preserving any
// existing meta keys (enableConditions, useRecursiveEvaluation, saved formatting)
vModel.value.meta = {
  display_type: null,
  display_column_meta: { meta: {}, custom: {} },
  ...(vModel.value.meta || {}),
}

const refTables = computed(() => {
  if (!tables.value || !tables.value.length || !meta.value || !meta.value.columns) {
    return []
  }

  const _refTables = meta.value.columns
    .filter((column) => canUseForLookupLinkField(column, meta.value?.source_id))
    .map((column) => {
      const relatedBaseId = (column.colOptions as any)?.fk_related_base_id || meta.value?.base_id
      return {
        col: column.colOptions,
        column,
        ...(tables.value.find((table) => table.id === (column.colOptions as LinkToAnotherRecordType).fk_related_model_id) ||
          getMetaByKey(relatedBaseId, (column.colOptions as LinkToAnotherRecordType).fk_related_model_id!) ||
          {}),
      }
    })
    .filter((table) => (table.col as LinkToAnotherRecordType)?.fk_related_model_id === table.id && !table.mm)
  return _refTables as Required<TableType & { column: ColumnType; col: Required<LinkToAnotherRecordType> }>[]
})

const selectedTable = computed(() => {
  return refTables.value.find((t) => t.column.id === vModel.value.fk_relation_column_id)
})

// Target table meta (with columns) for the lookup sort builder.
const lookupTargetMeta = computed(() =>
  selectedTable.value ? getMetaByKey(selectedTable.value.base_id, selectedTable.value.id) : undefined,
)

// Synthetic lookup column built from the live form selections — used to resolve the
// looked-up result type (following nested-lookup chains and unwrapping Formula/Rollup).
const lookupColForResolution = computed(
  () =>
    ({
      ...vModel.value,
      uidt: UITypes.Lookup,
      colOptions: {
        fk_relation_column_id: vModel.value.fk_relation_column_id,
        fk_lookup_column_id: vModel.value.fk_lookup_column_id,
      },
    } as ColumnType),
)

const lookupResultType = computed(() => {
  if (!vModel.value.fk_relation_column_id || !vModel.value.fk_lookup_column_id) return null
  if (!meta.value?.columns) return null

  return getLookupResultType({
    col: lookupColForResolution.value,
    meta: meta.value,
    metas: metasWithIdAsKey.value,
  })
})

const displayTypeOptions = computed(() =>
  getUITypesForLookupResultType(lookupResultType.value).map((uidt) => ({
    value: uidt,
    label: t(`datatype.${uidt}`),
    icon: h(resolveComponent('SmartsheetHeaderIcon'), { column: { uidt } }),
  })),
)

const isFormattable = computed(() => displayTypeOptions.value.length > 0)

// Check if recursive evaluation should be available (EE + PostgreSQL + self-referencing HM/BT relation)
const canUseRecursiveEvaluation = computed(() => {
  // TODO: [recursive lookup]
  // remove this and uncomment code below
  // when ltar v2 is ready and recursive is adjusted to it
  return false
  /*
  if (!selectedTable.value) return false
  const relationCol = selectedTable.value.column
  const relation = relationCol.colOptions as LinkToAnotherRecordType
  return lookupCanHaveRecursiveEvaluation({
    isEeUI,
    relationCol,
    relationType: relation.type as any,
    dbClientType: getBaseType(meta.value?.source_id),
  })
  */
})

const useRecursiveEvaluation = computed({
  get: () => {
    return vModel.value.meta?.useRecursiveEvaluation ?? false
  },
  set: (value: boolean) => {
    vModel.value.meta = vModel.value.meta ?? {}
    vModel.value.meta.useRecursiveEvaluation = value
  },
})

const columns = computed<ColumnType[]>(() => {
  if (!selectedTable.value?.id) {
    return []
  }
  return getMetaByKey(selectedTable.value.base_id, selectedTable.value.id)?.columns.filter(
    (c: ColumnType) =>
      vModel.value.fk_lookup_column_id === c.id ||
      getValidLookupColumn({
        column: c,
        lookupColumnId: vModel.value.id,
      }),
  )
})

const limitRecToCond = computed({
  get() {
    return !!vModel.value.meta?.enableConditions
  },
  set(value) {
    vModel.value.meta = vModel.value.meta || {}
    vModel.value.meta.enableConditions = value

    $e('c:lookup:limit-record-by-filter', { status: value })
  },
})

// ── Lookup Limit (EE, licensed) — "limit items shown", persisted to column meta. ──
// NOTE: lookup *sort* is NOT stored in meta; it lives in the Sort table scoped by
// `fk_lookup_col_id` (like lookup conditions use the Filter table), edited by the
// reusable LookupSort component below and applied by the backend via
// applyLookupSortAndLimit + sortV2.
const lookupLimitEnabled = computed({
  get: () => !!vModel.value.meta?.lookup_limit?.value,
  set(value: boolean) {
    vModel.value.meta = vModel.value.meta || {}
    if (value) {
      vModel.value.meta.lookup_limit = { type: vModel.value.meta.lookup_limit?.type || 'first', value: 1 }
    } else {
      delete vModel.value.meta.lookup_limit
    }
  },
})
const lookupLimitType = computed({
  get: () => vModel.value.meta?.lookup_limit?.type || 'first',
  set(v: 'first' | 'last') {
    vModel.value.meta = vModel.value.meta || {}
    vModel.value.meta.lookup_limit = { type: v, value: vModel.value.meta.lookup_limit?.value || 1 }
  },
})
const lookupLimitValue = computed({
  get: () => vModel.value.meta?.lookup_limit?.value || 1,
  set(v: number) {
    vModel.value.meta = vModel.value.meta || {}
    vModel.value.meta.lookup_limit = { type: vModel.value.meta.lookup_limit?.type || 'first', value: Math.max(1, +v || 1) }
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
    vModel.value.fk_lookup_column_id = vModel.value.colOptions?.fk_lookup_column_id
    vModel.value.fk_relation_column_id = vModel.value.colOptions?.fk_relation_column_id
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

// Sync the lookup sort builder's local, status-tagged set into the column body so
// postColumnAdd/postColumnUpdate persist it against fk_lookup_col_id on save.
watch(
  () => sortRef.value?.sorts,
  (next) => {
    if (!vModel.value) return
    vModel.value.sorts = next ? [...next] : []
  },
  { deep: true },
)

const getNextColumnId = () => {
  const usedLookupColumnIds = (meta.value?.columns || [])
    .filter((c) => c.uidt === UITypes.Lookup)
    .map((c) => (c.colOptions as LookupType)?.fk_lookup_column_id)

  return columns.value.find((c) => !usedLookupColumnIds.includes(c.id))?.id
}

const onRelationColChange = async () => {
  if (selectedTable.value) {
    await getMeta(selectedTable.value.base_id, selectedTable.value.id)
  }
  vModel.value.fk_lookup_column_id = getNextColumnId() || columns.value?.[0]?.id
  onDataTypeChange()
}

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
      vModel.value.lookupTableTitle = selectedTable?.title || selectedTable.table_name
    }
  },
)

watch(
  () => vModel.value.fk_lookup_column_id,
  (newValue) => {
    if (!newValue) return

    const selectedColumn = columns.value.find((c) => c.id === newValue)
    if (selectedColumn) {
      vModel.value.lookupColumnTitle = selectedColumn?.title || selectedColumn.column_name

      updateFieldName()
    }
  },
)

// Reset the format options object whenever the display type is cleared (mirrors Formula).
watch(
  () => vModel.value.meta?.display_type,
  (value, oldValue) => {
    if (oldValue === undefined && !value) {
      vModel.value.meta.display_column_meta = { meta: {}, custom: {} }
    }
  },
  { immediate: true },
)

// Drop a stale display type when the resolved result type no longer supports it
// (e.g. the looked-up field was changed from a number to a text column).
watch(lookupResultType, () => {
  const allowed = getUITypesForLookupResultType(lookupResultType.value)
  if (vModel.value.meta?.display_type && !allowed.includes(vModel.value.meta.display_type)) {
    vModel.value.meta.display_type = null
  }
})

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
  <div v-if="refTables.length" class="w-full">
    <NcTabs v-model:active-key="activeTabKey" class="nc-lookup-options-tabs">
      <a-tab-pane key="configuration">
        <template #tab>
          <div class="tab" data-testid="nc-lookup-tab-configuration">{{ $t('labels.configuration') }}</div>
        </template>
        <div class="w-full flex flex-col gap-4 pt-3">
          <div class="w-full flex flex-row space-x-2">
            <a-form-item
              class="flex w-1/2 !max-w-[calc(50%_-_4px)]"
              :label="`${$t('general.link')} ${$t('objects.field')}`"
              v-bind="validateInfos.fk_relation_column_id"
            >
              <a-select
                v-model:value="vModel.fk_relation_column_id"
                :placeholder="$t('placeholder.select')"
                dropdown-class-name="!w-64 !rounded-md nc-dropdown-relation-table"
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
              :label="`${$t('datatype.Lookup')} ${$t('objects.field')}`"
              v-bind="vModel.fk_relation_column_id ? validateInfos.fk_lookup_column_id : undefined"
            >
              <a-select
                v-model:value="vModel.fk_lookup_column_id"
                name="fk_lookup_column_id"
                :placeholder="$t('placeholder.select')"
                :disabled="!vModel.fk_relation_column_id"
                show-search
                :filter-option="antSelectFilterOption"
                dropdown-class-name="nc-dropdown-relation-column !rounded-md"
                @change="onDataTypeChange"
              >
                <template #suffixIcon>
                  <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
                </template>
                <a-select-option v-for="column of columns" :key="column.title" :value="column.id">
                  <div class="w-full flex gap-2 truncate items-center justify-between">
                    <div class="inline-flex items-center gap-2 flex-1 truncate">
                      <SmartsheetHeaderIcon :column="column" class="!mx-0" />

                      <div class="truncate flex-1">{{ column.title }}</div>
                    </div>

                    <component
                      :is="iconMap.check"
                      v-if="vModel.fk_lookup_column_id === column.id"
                      id="nc-selected-item-icon"
                      class="text-nc-content-brand w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>
          </div>
          <div v-if="canUseRecursiveEvaluation" class="w-full flex flex-row space-x-2">
            <a-form-item class="w-full">
              <div class="flex items-center gap-2">
                <NcSwitch v-model:checked="useRecursiveEvaluation">
                  <NcTooltip>
                    <template #title>
                      {{ $t('msg.evaluateRecursivelyTooltip') }}
                    </template>
                    {{ $t('msg.evaluateRecursively') }}
                    <GeneralIcon icon="info" class="h-4 w-4 text-nc-content-gray-disabled" />
                  </NcTooltip>
                </NcSwitch>
              </div>
            </a-form-item>
          </div>
          <div v-if="isEeUI && showEEFeatures" class="w-full flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_LOOKUP_LIMIT_RECORDS_BY_FILTER">
                <template #default="{ click }">
                  <div class="flex gap-1 items-center whitespace-nowrap">
                    <NcSwitch
                      :checked="limitRecToCond"
                      :disabled="!selectedTable"
                      size="small"
                      data-testid="nc-lookup-limit-record-filters"
                      @change="
                        (value) => {
                          if (value && click(PlanFeatureTypes.FEATURE_LOOKUP_LIMIT_RECORDS_BY_FILTER)) return
                          onFilterLabelClick()
                        }
                      "
                    >
                      {{ $t('labels.onlyIncludeLinkedRecordsThatMeetSpecificConditions') }}
                    </NcSwitch>

                    <LazyPaymentUpgradeBadge
                      v-if="!limitRecToCond"
                      :feature="PlanFeatureTypes.FEATURE_LOOKUP_LIMIT_RECORDS_BY_FILTER"
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

            <!-- Lookup Sort + Limit (EE, licensed) — persisted to column meta -->
            <div class="flex flex-col gap-2">
              <!-- Limit the number of items shown -->
              <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_LOOKUP_SORT_LIMIT">
                <template #default="{ click }">
                  <div class="flex gap-1 items-center whitespace-nowrap">
                    <NcSwitch
                      :checked="lookupLimitEnabled"
                      :disabled="!selectedTable"
                      size="small"
                      data-testid="nc-lookup-limit-items"
                      @change="
                        (value) => {
                          if (value && click(PlanFeatureTypes.FEATURE_LOOKUP_SORT_LIMIT)) return
                          lookupLimitEnabled = value
                        }
                      "
                    >
                      Limit the number of items shown
                    </NcSwitch>
                    <LazyPaymentUpgradeBadge
                      v-if="!lookupLimitEnabled"
                      :feature="PlanFeatureTypes.FEATURE_LOOKUP_SORT_LIMIT"
                      class="ml-1"
                    />
                  </div>
                </template>
              </PaymentUpgradeBadgeProvider>
              <div v-if="lookupLimitEnabled" class="flex items-center gap-2 pl-10">
                <span class="text-nc-content-gray-subtle2">Limit to the</span>
                <a-select v-model:value="lookupLimitType" class="!w-28" dropdown-class-name="!rounded-md">
                  <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>
                  <a-select-option value="first">First</a-select-option>
                  <a-select-option value="last">Last</a-select-option>
                </a-select>
                <div data-testid="nc-lookup-limit-value">
                  <a-input-number v-model:value="lookupLimitValue" :min="1" class="!w-20" />
                </div>
              </div>

              <!-- Sort records (lookup-scoped, backed by the Sort table). Held
                   locally and persisted with the column on save — same flow as
                   LTAR limit-by-filter — so it works in the create form too. -->
              <div class="flex gap-1 items-center whitespace-nowrap">
                <span class="text-nc-content-gray-subtle2">Sort records</span>
                <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_LOOKUP_SORT_LIMIT" class="ml-1" />
              </div>
              <div v-if="selectedTable" class="pl-10">
                <LazySmartsheetColumnLookupSort ref="sortRef" :column-id="vModel.id" :target-meta="lookupTargetMeta" />
              </div>
              <div v-else class="pl-10 text-nc-content-gray-subtle2 text-bodySm">
                Select a related field first to configure sort.
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="formatting" :disabled="!vModel.fk_lookup_column_id">
        <template #tab>
          <div class="tab" data-testid="nc-lookup-tab-formatting">{{ $t('labels.formatting') }}</div>
        </template>
        <div class="w-full flex flex-col gap-4 pt-3">
          <template v-if="isFormattable">
            <a-form-item class="!mb-0" :label="$t('general.format')">
              <NcSelect
                v-model:value="vModel.meta.display_type"
                v-e="['c:lookup:format-type:select']"
                class="w-full nc-select-shadow"
                :placeholder="$t('labels.selectAFormatType')"
                allow-clear
                data-testid="nc-lookup-format-type"
              >
                <a-select-option v-for="option in displayTypeOptions" :key="option.value" :value="option.value">
                  <div class="flex w-full items-center gap-2 justify-between">
                    <div class="w-full flex items-center gap-2">
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
            <SmartsheetColumnDateOptions
              v-else-if="vModel.meta.display_type === UITypes.Date"
              :value="vModel.meta.display_column_meta"
            />
            <SmartsheetColumnDateTimeOptions
              v-else-if="vModel.meta.display_type === UITypes.DateTime"
              :value="vModel.meta.display_column_meta"
            />
            <SmartsheetColumnTimeOptions
              v-else-if="vModel.meta.display_type === UITypes.Time"
              :value="vModel.meta.display_column_meta"
            />
          </template>

          <div v-else class="text-nc-content-gray-subtle2 text-bodySm max-w-[440px]" data-testid="nc-lookup-not-formattable">
            {{ $t('msg.info.lookupResultTypeNotFormattable') }}
          </div>
        </div>
      </a-tab-pane>
    </NcTabs>
  </div>
  <div v-else>
    <a-alert type="warning" show-icon>
      <template #icon><GeneralIcon icon="alertTriangle" class="h-6 w-6" width="24" height="24" /></template>
      <template #message> {{ $t('objects.ncMessage.warning') }} </template>
      <template #description>
        {{
          $t('msg.linkColumnClearNotSupportedYet', {
            type: 'Lookup',
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

.nc-lookup-options-tabs {
  :deep(.ant-tabs-nav) {
    @apply !mb-0 !pl-0;
  }

  :deep(.ant-tabs-nav-wrap) {
    @apply !pl-0;
  }

  :deep(.ant-tabs-tab) {
    @apply !pt-1 !pb-0;
  }

  :deep(.ant-tabs-tab-btn) {
    @apply !mb-1;
  }
}
</style>
