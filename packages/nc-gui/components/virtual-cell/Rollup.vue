<script setup lang="ts">
import { UITypes, getRenderAsTextFunForUiType } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, RollupType } from 'nocodb-sdk'

const { metas } = useMetas()

const value = inject(CellValueInj)

const column = inject(ColumnInj)!

const meta = inject(MetaInj, ref())

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning()

const relationColumnOptions = computed<LinkToAnotherRecordType | null>(() => {
  if ((column?.value?.colOptions as RollupType)?.fk_relation_column_id) {
    return meta?.value?.columns?.find((c) => c.id === (column?.value?.colOptions as RollupType)?.fk_relation_column_id)
      ?.colOptions as LinkToAnotherRecordType
  }
  return null
})

const relatedTableMeta = computed(() => {
  if (!relationColumnOptions.value?.fk_related_model_id) return null
  // Use fk_related_base_id for cross-base relationships
  const relatedBaseId = relationColumnOptions.value.fk_related_base_id || meta.value?.base_id
  const metaKey = relatedBaseId
    ? `${relatedBaseId}:${relationColumnOptions.value.fk_related_model_id}`
    : relationColumnOptions.value.fk_related_model_id
  return metas.value?.[metaKey] || metas.value?.[relationColumnOptions.value.fk_related_model_id as string]
})

const colOptions = computed(() => column.value?.colOptions)

const childColumn = computed(() => {
  if (relatedTableMeta.value?.columns) {
    if (isRollup(column.value)) {
      return relatedTableMeta.value?.columns.find(
        (c: ColumnType) => c.id === (colOptions.value as RollupType).fk_rollup_column_id,
      )
    }
  }
  return ''
})

const renderAsTextFun = computed(() => {
  return getRenderAsTextFunForUiType(childColumn.value?.uidt || UITypes.SingleLineText)
})

// Computed to create updated column with display_type for custom formatting
const updatedColumn = computed(() => {
  const colMeta = parseProp(column.value?.meta)
  if (colMeta?.display_type) {
    // display_column_meta contains the format-specific settings (e.g., {meta: {currency_code, currency_locale}})
    const displayColumnMeta = colMeta.display_column_meta || {}
    return {
      ...column.value,
      uidt: colMeta.display_type,
      // Extract the nested meta from display_column_meta for cell components to read
      meta: {
        ...parseProp(displayColumnMeta.meta),
        ...parseProp(displayColumnMeta.custom),
      },
    }
  }
  return undefined
})

// Determine if we should render using FormulaWrapperCell with custom formatting
const renderAsCell = computed(() => {
  const colMeta = parseProp(column.value?.meta)
  return !!colMeta?.display_type
})
</script>

<template>
  <div @dblclick="activateShowEditNonEditableFieldWarning">
    <LazySmartsheetFormulaWrapperCell v-if="renderAsCell" :column="updatedColumn" />
    <CellDecimal v-else-if="renderAsTextFun.includes((colOptions as RollupType).rollup_function!)" :model-value="value" />
    <LazySmartsheetCell v-else v-model="value" :column="childColumn" :edit-enabled="false" :read-only="true" />
    <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
      {{ $t('msg.info.computedFieldEditWarning') }}
    </div>
    <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
      {{ $t('msg.info.computedFieldDeleteWarning') }}
    </div>
  </div>
</template>
