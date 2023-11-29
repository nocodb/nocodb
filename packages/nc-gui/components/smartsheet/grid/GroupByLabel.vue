<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'

defineProps<{
  column: ColumnType
  modelValue: any
}>()

provide(ReadonlyInj, true)
</script>

<template>
  <div class="pointer-events-none">
    <LazySmartsheetRow :row="{ row: { [column.title]: modelValue }, rowMeta: {} }">
      <LazySmartsheetVirtualCell v-if="isVirtualCol(column)" :model-value="modelValue" class="!text-gray-600" :column="column" />

      <LazySmartsheetCell
        v-else
        :model-value="modelValue"
        class="!text-gray-600"
        :column="column"
        :edit-enabled="false"
        :read-only="true"
      />
    </LazySmartsheetRow>
  </div>
</template>
