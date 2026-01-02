<script setup lang="ts">
import { UITypes, getRenderAsTextFunForUiType } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, RollupType } from 'nocodb-sdk'
import RollupLinksProvider from './RollupLinksProvider.vue'

const { metas } = useMetas()

const value = inject(CellValueInj)

const column = inject(ColumnInj)!

const meta = inject(MetaInj, ref())

const row = inject(RowInj)!

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

const renderAsTextFun = computed(() => {
  return getRenderAsTextFunForUiType(childColumn.value?.uidt || UITypes.SingleLineText)
})

const showAsLinks = computed(() => {
  return parseProp(column.value?.meta)?.showAsLinks || false
})

// Get the original readonly state - when showing as links, use the original readonly state
// (no special readonly logic needed since we want it to be editable by default)
const originalReadonly = inject(ReadonlyInj, ref(false))

const relationColumn = computed(() => {
  if (!showAsLinks.value) return null

  // Get the actual relation column from the rollup configuration
  const relationColId = (column.value?.colOptions as RollupType)?.fk_relation_column_id
  const relationCol = meta.value?.columns?.find((c) => c.id === relationColId)

  if (relationCol) {
    // Return the actual relation column - VirtualCellLinks will handle it properly
    return relationCol
  }

  return null
})
</script>

<template>
  <div @dblclick.stop="activateShowEditNonEditableFieldWarning">
    <!-- Show as links when showAsLinks is enabled -->
    <template v-if="showAsLinks && relationColumn">
      <!-- Use Links cell component with relation column context -->
      <RollupLinksProvider :relation-column="relationColumn" :readonly="originalReadonly" />
    </template>
    <!-- Regular rollup display -->
    <template v-else>
      <CellDecimal v-if="renderAsTextFun.includes((colOptions as RollupType).rollup_function!)" :model-value="value" />
      <LazySmartsheetCell v-else v-model="value" :column="childColumn" :edit-enabled="false" :read-only="true" />
    </template>
    <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
      {{ $t('msg.info.computedFieldEditWarning') }}
    </div>
    <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
      {{ $t('msg.info.computedFieldDeleteWarning') }}
    </div>
  </div>
</template>
