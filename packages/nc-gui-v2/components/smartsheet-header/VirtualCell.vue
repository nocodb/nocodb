<script setup lang="ts">
import { substituteColumnIdWithAliasInFormula } from 'nocodb-sdk'
import type { ColumnType, FormulaType, LinkToAnotherRecordType, LookupType, RollupType } from 'nocodb-sdk'
import { toRef } from 'vue'
import { $computed } from 'vue/macros'
import { useMetas } from '~/composables'
import { ColumnInj, MetaInj } from '~/context'
import type { TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { provide, useProvideColumnCreateStore } from '#imports'

const props = defineProps<{ column: ColumnType & { meta: any } }>()
const column = toRef(props, 'column')
provide(ColumnInj, column)
const { metas } = useMetas()
const meta = inject(MetaInj)

const { isLookup, isBt, isRollup, isMm, isHm, isFormula, isCount } = useVirtualCell(column)

const colOptions = $computed(() => column.value?.colOptions)
const tableTile = $computed(() => meta?.value?.title)
const relationColumnOptions = $computed<LinkToAnotherRecordType | null>(() => {
  if (isMm.value || isHm.value || isBt.value) {
    return column.value?.colOptions as LinkToAnotherRecordType
  } else if ((column?.value?.colOptions as LookupType | RollupType)?.fk_relation_column_id) {
    return meta?.value?.columns?.find(
      (c) => c.id === (column?.value?.colOptions as LookupType | RollupType)?.fk_relation_column_id,
    )?.colOptions as LinkToAnotherRecordType
  }
  return null
})

const relatedTableMeta = $computed(
  () => relationColumnOptions?.fk_related_model_id && metas.value?.[relationColumnOptions?.fk_related_model_id as string],
)

const relatedTableTitle = $computed(() => relatedTableMeta?.title)

const childColumn = $computed(() => {
  if (relatedTableMeta?.columns) {
    if (isRollup.value) {
      const ch = relatedTableMeta?.columns.find((c: ColumnType) => c.id === (colOptions as RollupType).fk_rollup_column_id)
      return ch
    }
    if (isLookup.value) {
      const ch = relatedTableMeta?.columns.find((c: ColumnType) => c.id === (colOptions as LookupType).fk_lookup_column_id)
      return ch
    }
  }
  return ''
})

const tooltipMsg = computed(() => {
  if (!column.value) {
    return ''
  }
  if (isHm.value) {
    return `'${tableTile}' has many '${relatedTableTitle}'`
  } else if (isMm.value) {
    return `'${tableTile}' & '${relatedTableTitle}' have many to many relation`
  } else if (isBt.value) {
    return `'${column?.value?.title}' belongs to '${relatedTableTitle}'`
  } else if (isLookup.value) {
    return `'${childColumn.title}' from '${relatedTableTitle}' (${childColumn.uidt})`
  } else if (isFormula.value) {
    const formula = substituteColumnIdWithAliasInFormula(
      (column.value?.colOptions as FormulaType)?.formula,
      meta?.value?.columns as ColumnType[],
      (column.value?.colOptions as any)?.formula_raw,
    )
    return `Formula - ${formula}`
  } else if (isRollup.value) {
    return `'${childColumn.title}' of '${relatedTableTitle}' (${childColumn.uidt})`
  }
  return ''
})


useProvideColumnCreateStore(meta as Ref<TableType>, column)
</script>

<template>
  <div class="d-flex align-center">
    <!--    <v-tooltip bottom>
          <template #activator="{ on }">
          todo: bring tooltip
          -->
    <SmartsheetHeaderVirtualCellIcon v-if="column" />
    <a-tooltip placement="bottom">
      <template #title>
        {{ tooltipMsg }}
      </template>
      <span class="name" style="white-space: nowrap" :title="column.title"> {{ column.title }}</span>
    </a-tooltip>
    <span v-if="column.rqd" class="error--text text--lighten-1">&nbsp;*</span>

    <!--    <span class="caption" v-html="tooltipMsg" /> -->

    <!--    </v-tooltip> -->
    <v-spacer />

    <SmartsheetHeaderMenu :virtual="true" />
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
