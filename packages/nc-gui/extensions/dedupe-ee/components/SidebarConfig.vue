<script lang="ts" setup>
import { ViewTypes, type ColumnType, isVirtualCol, isSystemColumn } from 'nocodb-sdk'
import { useDedupeOrThrow } from '../lib/useDedupe'

const { config, onTableSelect, saveConfig, loadGroupSets, hasMergedAnyRecords } = useDedupeOrThrow()

const filterColumn = (column: ColumnType) => {
  return !isSystemColumn(column) && !isVirtualCol(column) && !isAttachment(column)
}

const onSelectField = () => {
  saveConfig()
  loadGroupSets()
}

onMounted(() => {
  if (!config.value.selectedFieldId && !hasMergedAnyRecords.value) return

  loadGroupSets(true)
})
</script>

<template>
  <div class="flex flex-col gap-3 py-4">
    <NcListTableSelector
      v-model:value="config.selectedTableId"
      force-layout="vertical"
      @update:value="(value) => onTableSelect(value as string)"
    />

    <NcListViewSelector
      v-model:value="config.selectedViewId"
      :table-id="config.selectedTableId"
      :disabled="!config.selectedTableId"
      force-layout="vertical"
      :filter-view="(view) => view.type !== ViewTypes.FORM"
      @update:value="saveConfig"
    />

    <NcListColumnSelector
      v-model:value="config.selectedFieldId"
      :table-id="config.selectedTableId"
      :disabled="!config.selectedTableId || !config.selectedViewId"
      force-layout="vertical"
      :filter-column="filterColumn"
      @update:value="onSelectField"
    />
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-form-item label) {
  @apply text-captionBold;
}
</style>
