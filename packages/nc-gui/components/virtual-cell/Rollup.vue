<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType, RollupType } from 'nocodb-sdk'
import { CellValueInj, ColumnInj, MetaInj, computed, inject, isRollup, ref, useMetas, useShowNotEditableWarning } from '#imports'

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

const relatedTableMeta = computed(
  () =>
    relationColumnOptions.value?.fk_related_model_id && metas.value?.[relationColumnOptions.value?.fk_related_model_id as string],
)

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
</script>

<template>
  <div @dblclick="activateShowEditNonEditableFieldWarning">
    <div v-if="['count', 'avg', 'sum', 'countDistinct', 'sumDistinct', 'avgDistinct'].includes(colOptions.rollup_function)">
      {{ value }}
    </div>
    <LazySmartsheetCell v-else v-model="value" :column="childColumn" :edit-enabled="false" :read-only="true" />
    <div>
      <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldEditWarning') }}
      </div>
      <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldDeleteWarning') }}
      </div>
    </div>
  </div>
</template>
