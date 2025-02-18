<script setup lang="ts">
import { PageDesignerEventHookInj, PageDesignerPayloadInj, PageDesignerRowInj, PageDesignerTableTypeInj } from '../lib/context'

const payload = inject(PageDesignerPayloadInj)!
const row = inject(PageDesignerRowInj)!
const meta = inject(PageDesignerTableTypeInj)!
const displayField = computed(() => meta.value?.columns?.find((c) => c?.pv) || meta.value?.columns?.[0] || null)
const eventHook = inject(PageDesignerEventHookInj)!
</script>

<template>
  <div v-if="payload.selectedTableId" class="flex gap-3 w-full">
    <NRecordPicker
      :key="payload.selectedTableId + payload.selectedViewId"
      v-model:model-value="row"
      :label="row ? row.row[displayField?.title ?? ''] ?? 'Select Record' : 'Select Record'"
      :table-id="payload.selectedTableId"
      :view-id="payload.selectedViewId"
      class="page-designer-record-picker flex-1"
    />
    <div class="flex record-navigator">
      <NcTooltip>
        <NcButton
          size="small"
          type="secondary"
          class="prev"
          :disabled="row?.rowMeta.rowIndex === 0"
          @click="eventHook.trigger('previousRecord')"
        >
          <GeneralIcon icon="arrowLeft" />
        </NcButton>
        <template #title>Previous Record</template>
      </NcTooltip>
      <NcTooltip>
        <NcButton
          size="small"
          type="secondary"
          class="next"
          :disabled="!!row?.rowMeta.isLastRow"
          @click="eventHook.trigger('nextRecord')"
        >
          <GeneralIcon icon="arrowRight" />
        </NcButton>
        <template #title>Next Record</template>
      </NcTooltip>
    </div>
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
.record-navigator {
  .prev,
  .next {
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
  }

  .prev {
    width: calc(100% + 4px);
    .nc-icon {
      margin-left: -4px;
    }
    @apply !rounded-[8px_0_0_8px] border-r-0;
  }
  .next {
    @apply !rounded-[0_8px_8px_0];
  }
}
</style>
