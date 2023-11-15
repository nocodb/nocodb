<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  column: ColumnType
  modelValue: any
}>()

provide(ReadonlyInj, true)

const renderCell = computed(() =>
  [UITypes.Lookup, UITypes.Attachment, UITypes.Barcode, UITypes.QrCode, UITypes.Links].includes(props.column?.uidt),
)
</script>

<template>
  <div class="pointer-events-none">
    <LazySmartsheetRow v-if="renderCell" :row="{ row: { [column.title]: modelValue }, rowMeta: {} }">
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
    <template v-else>{{ modelValue }}</template>
  </div>
</template>
