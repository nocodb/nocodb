<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'

const vModel = ref({
  filter: {
    comparison_op: 'eq' as any,
    fk_column_id: 'col1',
    is_group: false,
    logical_op: 'and' as any,
    value: '',
    order: 1,
  },
  column: {
    id: 'col1',
    title: 'Column 1',
    uidt: UITypes.SingleLineText,
  },
})
</script>

<template>
  <div class="bg-gray-100">
    <a-card>
      <h4>Simple</h4>
      <div class="flex gap-2">
        <div>
          vModel:
          {{ vModel }}
        </div>
      </div>
    </a-card>
    <div class="m-4"><SmartsheetToolbarFilterInput :filter="vModel.filter" :column="vModel.column" :disabled="false" /></div>
  </div>
</template>
