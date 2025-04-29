<script lang="ts" setup>
import type { PlanMeta } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    planMeta?: (typeof PlanMeta)[keyof typeof PlanMeta]
    variant?: 'table' | 'banner'
    showWarningStatus?: boolean
    tooltip?: string
    isLimitExceeded?: boolean
  }>(),
  {
    variant: 'table',
  },
)

const { showWarningStatus, tooltip, isLimitExceeded } = toRefs(props)
</script>

<template>
  <div v-if="variant === 'table'" class="nc-current-plan-table-row">
    <div class="nc-current-plan-table-cell nc-cell-label">
      <slot name="label"> </slot>
    </div>
    <div
      class="nc-current-plan-table-cell nc-cell-value"
      :class="{
        'nc-show-warning': showWarningStatus && isLimitExceeded,
      }"
    >
      <slot name="value"> </slot>
      <NcTooltip v-if="showWarningStatus" :disabled="!tooltip" :title="tooltip" class="flex">
        <GeneralIcon v-if="isLimitExceeded" icon="ncAlertTriangle" class="text-nc-content-red-dark cursor-pointer w-4 h-4" />
        <GeneralIcon v-else icon="ncInfo" class="text-nc-content-orange-medium cursor-pointer w-4 h-4" />
      </NcTooltip>
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
    @apply min-h-[44px] px-5 py-3 text-sm text-inherit flex items-center gap-3 font-semibold;

    &.nc-cell-value {
      @apply text-nc-content-gray;

      &.nc-show-warning {
        @apply text-nc-content-red-dark;
      }
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
