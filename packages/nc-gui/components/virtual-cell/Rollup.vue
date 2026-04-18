<script setup lang="ts">
import {
  UITypes,
  getRenderAsTextFunForUiType,
  getRollupColumnMeta,
  integerPreservingRollupFunctions,
  integerRollupFunctions,
} from 'nocodb-sdk'
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
  if (!relatedTableMeta.value?.columns || !isRollup(column.value)) return ''

  const col = relatedTableMeta.value?.columns.find(
    (c: ColumnType) => c.id === (colOptions.value as RollupType).fk_rollup_column_id,
  )

  if (!col) return ''

  // Resolve Formula fields with display_type (e.g., Currency, Percent) to their effective type
  if (col.uidt === UITypes.Formula) {
    const colMeta = parseProp(col.meta)
    if (colMeta?.display_type) {
      const displayColumnMeta = parseProp(colMeta.display_column_meta)

      return {
        ...col,
        uidt: colMeta.display_type,
        ...displayColumnMeta,
        meta: {
          ...parseProp(displayColumnMeta?.meta),
          ...getRollupColumnMeta(
            column.value?.meta,
            colMeta.display_type,
            (colOptions.value as RollupType)?.rollup_function ?? '',
          ),
        },
      }
    }
  }

  return col
})

const renderAsTextFun = computed(() => {
  return getRenderAsTextFunForUiType(childColumn.value?.uidt || UITypes.SingleLineText)
})

const isIntegerResult = computed(() => {
  const fn = (colOptions.value as RollupType)?.rollup_function ?? ''

  return (
    integerRollupFunctions.includes(fn) ||
    (isIntegerUiType(childColumn.value as ColumnType) && integerPreservingRollupFunctions.includes(fn))
  )
})
</script>

<template>
  <div @dblclick="activateShowEditNonEditableFieldWarning">
    <CellInteger
      v-if="isIntegerResult && renderAsTextFun.includes((colOptions as RollupType).rollup_function!)"
      :model-value="value"
    />
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
