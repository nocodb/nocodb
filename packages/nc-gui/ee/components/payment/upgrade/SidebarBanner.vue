<script lang="ts" setup>
const { isRecordLimitReached, isStorageLimitReached, gracePeriodDaysLeft, navigateToPricing } = useEeConfig()
</script>

<template>
  <div
    v-if="isRecordLimitReached || isStorageLimitReached"
    class="-mx-1 px-2 pb-2 pt-1.5 border-b border-nc-border-gray-medium pointer-events-none"
  >
    <NcButton @click="navigateToPricing()" class="nc-upgrade-sidebar-banner w-full !h-auto">
      <div class="flex flex-col items-center gap-2">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="alertTriangleSolid" class="nc-alert-icon text-white h-5 w-5" />
          <span class="text-sm font-700">
            {{ $t('upgrade.planLimitReached') }}
          </span>
        </div>
        <div v-if="gracePeriodDaysLeft" class="text-xs font-500">
          {{ gracePeriodDaysLeft }}
          {{ gracePeriodDaysLeft === 1 ? $t('objects.day').toLowerCase() : $t('objects.days').toLowerCase() }}
          {{ $t('general.left') }}
        </div>
      </div>
    </NcButton>
  </div>
</template>

<style lang="scss" scoped>
.nc-upgrade-sidebar-banner {
  @apply bg-white !p-3 cursor-pointer !gap-3 pointer-events-auto;

  box-shadow: 0px -2px 12px 0px rgba(0, 0, 0, 0.08) !important;
}

.nc-alert-icon {
  :deep(path + path) {
    @apply !stroke-nc-content-brand;
  }
}
</style>
