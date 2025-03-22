<script lang="ts" setup>
import type { PlanMeta } from 'nocodb-sdk'

withDefaults(
  defineProps<{
    planMeta?: (typeof PlanMeta)[keyof typeof PlanMeta]
    variant?: 'table' | 'banner'
  }>(),
  {
    variant: 'table',
  },
)
</script>

<template>
  <div v-if="variant === 'table'" class="nc-current-plan-table-row">
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
  <div v-else class="nc-current-plan-banner-row">
    <div class="nc-current-plan-banner-cell nc-banner-cell-label">
      <slot name="label"> </slot>
    </div>
    <div class="nc-current-plan-banner-cell nc-banner-cell-value">
      <slot name="value"> </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-current-plan-table-row {
  @apply border-b last-of-type:border-b-0 border-inherit flex items-center children:w-1/2;

  .nc-current-plan-table-cell {
    @apply h-[54px] px-6 py-3 text-sm text-inherit flex items-center gap-3;

    &.nc-cell-label {
      @apply bg-nc-bg-gray-light font-weight-500;
    }

    &.nc-cell-value {
      @apply text-nc-content-gray font-semibold;
    }
  }
}

.nc-current-plan-banner-row {
  @apply flex-1 flex items-center gap-3 text-sm font-semibold;

  .nc-current-plan-banner-cell {
    &.nc-banner-cell-label {
      @apply min-w-[172px] text-current;
    }

    &.nc-banner-cell-value {
      @apply flex-1 text-nc-content-gray;
    }
  }
}
</style>
