<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, LookupType, TableType } from 'nocodb-sdk'
import { PlanFeatureTypes, PlanTitles, RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { t } = useI18n()

const { $e } = useNuxtApp()

const { getPlanTitle } = useEeConfig()

const {
  setAdditionalValidations,
  validateInfos,
  onDataTypeChange,
  isEdit,
  disableSubmitBtn,
  updateFieldName,
  setPostSaveOrUpdateCbk,
} = useColumnCreateStoreOrThrow()

const baseStore = useBase()

const { tables } = storeToRefs(baseStore)

const { metas, getMeta } = useMetas()

const filterRef = ref()

setAdditionalValidations({
  fk_relation_column_id: [{ required: true, message: t('general.required') }],
  fk_lookup_column_id: [{ required: true, message: t('general.required') }],
})

if (!vModel.value.fk_relation_column_id) vModel.value.fk_relation_column_id = null
if (!vModel.value.fk_lookup_column_id) vModel.value.fk_lookup_column_id = null

const refTables = computed(() => {
  if (!tables.value || !tables.value.length || !meta.value || !meta.value.columns) {
    return []
  }

  const _refTables = meta.value.columns
    .filter(
      (column) =>
        isLinksOrLTAR(column) &&
        // exclude system columns
        (!column.system ||
          // include system columns if it's self-referencing, mm, oo and bt are self-referencing
          // hm is only used for LTAR with junction table
          [RelationTypes.MANY_TO_MANY, RelationTypes.ONE_TO_ONE, RelationTypes.BELONGS_TO].includes(
            (column.colOptions as LinkToAnotherRecordType).type as RelationTypes,
          )) &&
        column.source_id === meta.value?.source_id,
    )
    .map((column) => ({
      col: column.colOptions,
      column,
      ...(tables.value.find((table) => table.id === (column.colOptions as LinkToAnotherRecordType).fk_related_model_id) ||
        metas.value[(column.colOptions as LinkToAnotherRecordType).fk_related_model_id!] ||
        {}),
    }))
    .filter((table) => (table.col as LinkToAnotherRecordType)?.fk_related_model_id === table.id && !table.mm)
  return _refTables as Required<TableType & { column: ColumnType; col: Required<LinkToAnotherRecordType> }>[]
})

const selectedTable = computed(() => {
  return refTables.value.find((t) => t.column.id === vModel.value.fk_relation_column_id)
})

// Todo: Add backend api level validation for unsupported fields
const unsupportedUITypes = [UITypes.Button, UITypes.Links]

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
  return metas.value[selectedTable.value.id]?.columns.filter(
    (c: ColumnType) =>
      vModel.value.fk_lookup_column_id === c.id ||
      (!isSystemColumn(c) && c.id !== vModel.value.id && !unsupportedUITypes.includes(c.uidt)),
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

// Provide related table meta for filter conditions
provide(
  MetaInj,
  computed(() => {
    if (!selectedTable.value) return {}

    return metas.value[selectedTable.value.id] || {}
  }),
)

onMounted(() => {
  if (isEdit.value) {
    vModel.value.fk_lookup_column_id = vModel.value.colOptions?.fk_lookup_column_id
    vModel.value.fk_relation_column_id = vModel.value.colOptions?.fk_relation_column_id
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
    .filter((c) => c.uidt === UITypes.Lookup)
    .map((c) => (c.colOptions as LookupType)?.fk_lookup_column_id)

  return columns.value.find((c) => !usedLookupColumnIds.includes(c.id))?.id
}

const onRelationColChange = async () => {
  if (selectedTable.value) {
    await getMeta(selectedTable.value.id)
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

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
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
  <div v-if="refTables.length" class="w-full flex flex-col gap-4">
    <div class="w-full flex flex-row space-x-2">
      <a-form-item
        class="flex w-1/2 !max-w-[calc(50%_-_4px)]"
        :label="`${$t('general.link')} ${$t('objects.field')}`"
        v-bind="validateInfos.fk_relation_column_id"
      >
        <a-select
          v-model:value="vModel.fk_relation_column_id"
          placeholder="-select-"
          dropdown-class-name="!w-64 !rounded-md nc-dropdown-relation-table"
          @change="onRelationColChange"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
          <a-select-option v-for="(table, i) of refTables" :key="i" :value="table.col.fk_column_id">
            <div class="flex gap-2 w-full justify-between truncate items-center">
              <div class="min-w-1/2 flex items-center gap-2">
                <component :is="cellIcon(table.column)" :column-meta="table.column" class="!mx-0" />

                <NcTooltip class="truncate min-w-[calc(100%_-_24px)]" show-on-truncate-only>
                  <template #title>{{ table.column.title }}</template>
                  {{ table.column.title }}
                </NcTooltip>
              </div>
              <div class="inline-flex items-center truncate gap-2">
                <div class="text-[0.65rem] leading-4 flex-1 truncate text-gray-600 nc-relation-details">
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
        :label="`${$t('datatype.Lookup')} ${$t('objects.field')}`"
        v-bind="vModel.fk_relation_column_id ? validateInfos.fk_lookup_column_id : undefined"
      >
        <a-select
          v-model:value="vModel.fk_lookup_column_id"
          name="fk_lookup_column_id"
          placeholder="-select-"
          :disabled="!vModel.fk_relation_column_id"
          show-search
          :filter-option="antSelectFilterOption"
          dropdown-class-name="nc-dropdown-relation-column !rounded-md"
          @change="onDataTypeChange"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
          <a-select-option v-for="column of columns" :key="column.title" :value="column.id">
            <div class="w-full flex gap-2 truncate items-center justify-between">
              <div class="inline-flex items-center gap-2 flex-1 truncate">
                <component :is="cellIcon(column)" :column-meta="column" class="!mx-0" />
                <div class="truncate flex-1">{{ column.title }}</div>
              </div>

              <component
                :is="iconMap.check"
                v-if="vModel.fk_lookup_column_id === column.id"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
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
              <GeneralIcon icon="info" class="h-4 w-4 text-gray-400" />
            </NcTooltip>
          </NcSwitch>
        </div>
      </a-form-item>
    </div>
    <div v-if="isEeUI" class="w-full flex flex-col gap-4">
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
  <div v-else>
    <a-alert type="warning" show-icon>
      <template #icon><GeneralIcon icon="alertTriangle" class="h-6 w-6" width="24" height="24" /></template>
      <template #message> Alert </template>
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
</style>
