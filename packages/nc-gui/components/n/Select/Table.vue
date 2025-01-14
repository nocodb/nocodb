<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import type { NSelectProps } from './types'
const props = withDefaults(
  defineProps<NSelectProps & { baseId?: string; forceLoadBaseTables?: boolean; filterTable?: (t: TableType) => boolean }>(),
  {
    placeholder: '- select table -',
    forceLoadBaseTables: false,
  },
)
const modelValue = useVModel(props, 'modelValue')
const tableStore = useTablesStore()
const { activeTables, baseTables } = storeToRefs(tableStore)
const tablesRef = computedAsync<TableType[]>(async () => {
  let tables: TableType[]
  if (props.baseId) {
    await tableStore.loadProjectTables(props.baseId, props.forceLoadBaseTables)
    tables = baseTables.value.get(props.baseId)
  } else {
    tables = activeTables.value
  }
  if (props.filterTable) {
    tables = tables.filter(props.filterTable)
  }
  return tables
})
defineExpose({
  tablesRef,
})
</script>

<template>
  <NSelect v-bind="props" v-model="modelValue">
    <a-select-option v-for="table of tablesRef" :key="table.id" :value="table.id">
      <div class="w-full flex items-center gap-2">
        <div class="min-w-5 flex items-center justify-center">
          <NIconTable :table="table" class="text-gray-500" />
        </div>
        <NcTooltip class="flex-1 truncate" show-on-truncate-only>
          <template #title>{{ table.title }}</template>
          <span>{{ table.title }}</span>
        </NcTooltip>
        <component
          :is="iconMap.check"
          v-if="modelValue === table.id"
          id="nc-selected-item-icon"
          class="flex-none text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NSelect>
</template>
