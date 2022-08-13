<script setup lang="ts">
import { substituteColumnIdWithAliasInFormula } from 'nocodb-sdk'
import type { ColumnType, FormulaType, LinkToAnotherRecordType, LookupType, RollupType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ColumnInj, IsFormInj, MetaInj } from '~/context'
import { provide, toRef, useMetas, useProvideColumnCreateStore } from '#imports'

const props = defineProps<{ column: ColumnType & { meta: any }; hideMenu?: boolean; required?: boolean }>()
const column = toRef(props, 'column')
const hideMenu = toRef(props, 'hideMenu')

const editColumnDropdown = ref(false)

provide(ColumnInj, column)

const { metas } = useMetas()

const meta = inject(MetaInj)
const isForm = inject(IsFormInj, ref(false))

const { isLookup, isBt, isRollup, isMm, isHm, isFormula } = useVirtualCell(column)

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

function onVisibleChange() {
  // only allow to close the EditOrAdd component
  // by clicking cancel button
  editColumnDropdown.value = true
}

useProvideColumnCreateStore(meta as Ref<TableType>, column)
</script>

<template>
  <div class="d-flex align-center w-full text-xs font-weight-regular">
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
    <span v-if="column.rqd || required" class="text-red-500">&nbsp;*</span>

    <!--    <span class="caption" v-html="tooltipMsg" /> -->

    <!--    </v-tooltip> -->
    <template v-if="!hideMenu">
      <v-spacer />

      <SmartsheetHeaderMenu v-if="!isForm" :virtual="true" @edit="editColumnDropdown = true" />
    </template>

    <a-dropdown
      v-model:visible="editColumnDropdown"
      :trigger="['click']"
      placement="bottomRight"
      @visible-change="onVisibleChange"
    >
      <div />
      <template #overlay>
        <SmartsheetColumnEditOrAdd
          class="w-full"
          :edit-column-dropdown="editColumnDropdown"
          @click.stop
          @keydown.stop
          @cancel="editColumnDropdown = false"
        />
      </template>
    </a-dropdown>
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
