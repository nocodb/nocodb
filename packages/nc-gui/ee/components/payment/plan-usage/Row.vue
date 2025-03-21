<script lang="ts" setup>
import type { PlanMeta } from 'nocodb-sdk'

const props = defineProps<{
  planMeta?: (typeof PlanMeta)[keyof typeof PlanMeta]
}>()
</script>

<template>
  <div class="nc-current-plan-table-row">
    <div
      class="nc-current-plan-table-cell nc-cell-label"
      :style="{
        background: planMeta?.bgDark,
      }"
    >
      <slot name="label"> </slot>
    </div>
    <div
      class="nc-current-plan-table-cell nc-cell-value"
      :style="{
        background: planMeta?.bgLight,
      }"
    >
      <slot name="value"> </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
