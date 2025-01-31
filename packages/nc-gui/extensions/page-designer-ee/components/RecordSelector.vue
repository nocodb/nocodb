<script setup lang="ts">
import { PageDesignerPayloadInj, PageDesignerRowInj, PageDesignerTableTypeInj } from '../lib/context'

const payload = inject(PageDesignerPayloadInj)!
const row = inject(PageDesignerRowInj)!
const meta = inject(PageDesignerTableTypeInj)!
const displayField = computed(() => meta.value?.columns?.find((c) => c?.pv) || meta.value?.columns?.[0] || null)
</script>

<template>
  <div class="flex gap-3 w-full">
    <NRecordPicker
      v-if="payload.selectedTableId"
      :key="payload.selectedTableId + payload.selectedViewId"
      v-model:model-value="row"
      :label="row ? row.row[displayField?.title ?? ''] ?? 'Select Record' : 'Select Record'"
      :table-id="payload.selectedTableId"
      :view-id="payload.selectedViewId"
      class="page-designer-record-picker flex-1"
    />
  </div>
</template>

<style lang="scss">
.page-designer-record-picker {
  > div {
    @apply !justify-start pl-2 min-w-0;
    > div {
      @apply min-w-0;
    }
  }
}
</style>
