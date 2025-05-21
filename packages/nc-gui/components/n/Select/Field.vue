<script setup lang="ts">
import { type ColumnType, isSystemColumn } from 'nocodb-sdk'
import type { NSelectProps } from './types'
const props = withDefaults(
  defineProps<NSelectProps & { tableId?: string; forceLoadTableFields?: boolean; filterColumn?: (t: ColumnType) => boolean }>(),
  {
    placeholder: '- select field -',
    forceLoadTableFields: false,
  },
)
const modelValue = useVModel(props, 'modelValue')
const tableStore = useTablesStore()
const { loadTableMeta } = useTablesStore()
const { activeTable } = storeToRefs(tableStore)

const fieldsRef = computedAsync<ColumnType[]>(async () => {
  let fields: ColumnType[]
  if (props.tableId) {
    fields = (await loadTableMeta(props.tableId))?.columns || []
  } else {
    fields = activeTable.value.columns
  }
  if (props.filterColumn) {
    return fields.filter(props.filterColumn)
  }

  fields = fields.filter((f) => !isSystemColumn(f) || f.pk)

  return fields
})
defineExpose({
  fieldsRef,
})
</script>

<template>
  <NSelect v-bind="props" v-model="modelValue">
    <a-select-option v-for="field of fieldsRef" :key="field.id" :value="field.id">
      <div class="w-full flex items-center gap-2">
        <div class="min-w-5 flex items-center justify-center">
          <NIconField :field="field" class="text-gray-500" />
        </div>
        <NcTooltip class="flex-1 truncate" show-on-truncate-only>
          <template #title>{{ field.title }}</template>
          <span>{{ field.title }}</span>
        </NcTooltip>
        <component
          :is="iconMap.check"
          v-if="modelValue === field.id"
          id="nc-selected-item-icon"
          class="flex-none text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NSelect>
</template>
