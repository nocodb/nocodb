<script setup lang="ts">
import {
  UITypes,
  getEffectiveDisplayColumn,
  getRenderAsTextFunForUiType,
  getRollupColumnMeta,
  integerPreservingRollupFunctions,
  integerRollupFunctions,
} from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, RollupType } from 'nocodb-sdk'

const { metas, getMeta, getMetaByKey } = useMetas()

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

// Self-load the related (possibly cross-base) table meta — mirrors Lookup.vue.
// Unlike the grid canvas (fetchMetaIds) and Calendar/Gantt/Timeline
// (useLoadLookupMetas, which only walks Lookup chains), non-canvas views
// (Gallery, Kanban, expanded form) have no rollup preloader, so without this
// `relatedTableMeta` stays undefined and the cell loses its currency/number
// formatting (renders a plain number).
// Set once the related meta request settles, so the fallback below only covers
// missing access, not the loading window
const relatedMetaResolved = ref(false)

watch(
  relationColumnOptions,
  async (relOpt) => {
    relatedMetaResolved.value = false
    const relatedBaseId = relOpt?.fk_related_base_id || meta.value?.base_id
    if (relOpt?.fk_related_model_id && relatedBaseId && !getMetaByKey(relatedBaseId, relOpt.fk_related_model_id)) {
      await getMeta(relatedBaseId, relOpt.fk_related_model_id, false, false, true)
    }
    relatedMetaResolved.value = true
  },
  { immediate: true },
)

const colOptions = computed(() => column.value?.colOptions)

const childColumn = computed(() => {
  if (!column.value || !isRollup(column.value)) return ''

  // Partial/missing related meta (no access to the related base) — derive the type from the rollup
  const col =
    relatedTableMeta.value?.columns?.find((c: ColumnType) => c.id === (colOptions.value as RollupType).fk_rollup_column_id) ??
    (relatedMetaResolved.value ? getFallbackRollupColumn(column.value) : undefined)

  if (!col) return ''

  // Resolve Formula fields with display_type (e.g., Currency, Percent) to their effective type
  if (col.uidt === UITypes.Formula) {
    const colMeta = parseProp(col.meta)
    if (colMeta?.display_type) {
      const displayColumnMeta = parseProp(colMeta.display_column_meta)
      const effectiveCol = getEffectiveDisplayColumn(colMeta, col)

      return {
        ...effectiveCol,
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
  <div v-if="column && column.colOptions && column.colOptions.error" class="nc-cell-field">
    <NcTooltip placement="bottom" class="text-nc-content-orange-dark">
      <template #title>
        <span class="font-bold">{{ column.colOptions.error }}</span>
      </template>
      <span>{{ $t('labels.errorShort') }}</span>
    </NcTooltip>
  </div>
  <div v-else @dblclick="activateShowEditNonEditableFieldWarning">
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
