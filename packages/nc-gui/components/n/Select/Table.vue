<script setup lang="ts">
import NSelect from './index.vue'
import type { SelectProps } from './types'

const props = withDefaults(defineProps<SelectProps>(), {
  placeholder: '- select table -',
  showSearch: false,
  suffixIcon: 'arrowDown',
})

const tableStore = useTablesStore()
const { activeTables: tables } = storeToRefs(tableStore)
</script>

<template>
  <NSelect v-bind="props">
    <a-select-option v-for="table of tables" :key="table.id" :value="table.id">
      <div class="w-full flex items-center gap-2">
        <div class="min-w-5 flex items-center justify-center">
          <GeneralTableIcon :meta="{ meta: table.meta }" class="text-gray-500" />
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
