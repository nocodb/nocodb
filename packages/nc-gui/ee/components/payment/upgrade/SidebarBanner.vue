<script lang="ts" setup>
const { isRecordLimitReached, gracePeriodDaysLeft, navigateToBilling } = useEeConfig()
</script>

<template>
  <div v-if="isRecordLimitReached" class="-mx-1 px-2 pb-2 pt-1.5 border-b border-nc-border-gray-medium pointer-events-none">
    <NcAlert type="warning" show-icon class="nc-upgrade-sidebar-banner" @click="navigateToBilling()">
      <template #icon>
        <GeneralIcon icon="alertTriangleSolid" class="text-nc-content-red-dark h-5 w-5" />
      </template>
      <template #message>
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm">{{ $t('upgrade.planLimitReached') }}</div>
          <div v-if="gracePeriodDaysLeft" class="text-xs text-nc-content-gray-muted font-500">
            {{ gracePeriodDaysLeft }}
            {{ gracePeriodDaysLeft === 1 ? $t('objects.day').toLowerCase() : $t('objects.days').toLowerCase() }}
            {{ $t('general.left') }}
          </div>
        </div>
      </template>
      <template #description>
        <div class="text-small leading-[18px]">{{ $t('upgrade.planLimitReachedSubtitle') }}</div>
      </template>
    </NcAlert>
  </div>
</template>

<style lang="scss" scoped>
.nc-upgrade-sidebar-banner {
  @apply bg-white !p-3 cursor-pointer !gap-3 pointer-events-auto;

  box-shadow: 0px -2px 12px 0px rgba(0, 0, 0, 0.08);
}
</style>
