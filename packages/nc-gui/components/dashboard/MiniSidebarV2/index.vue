<script lang="ts" setup>
provide(IsMiniSidebarInj, ref(true))

const { isRail } = useMiniSidebarMode()

const { isMobileMode } = useGlobal()
</script>

<template>
  <div
    class="nc-mini-sidebar-v2"
    :class="{
      'nc-mini-sidebar-v2--rail': isRail || isMobileMode,
      'nc-mini-sidebar-v2--dock': !isRail && !isMobileMode,
    }"
    data-testid="nc-mini-sidebar-v2"
  >
    <DashboardMiniSidebarV2Rail v-if="isRail || isMobileMode" />
    <DashboardMiniSidebarV2Dock v-else />
  </div>
</template>

<style lang="scss">
.nc-mini-sidebar-v2 {
  @apply w-[var(--mini-sidebar-width)] min-w-[var(--mini-sidebar-width)] flex-none flex flex-col justify-between items-center z-502 relative bg-nc-bg-gray-minisidebar border-r-1 border-nc-border-gray-medium nc-h-screen nc-scrollbar-thin overflow-x-hidden;
  transition: width 0.2s ease;
  flex-shrink: 0;

  &--dock {
    overflow: visible;
  }

  .rtl & {
    @apply border-r-0 border-l-1;
  }
}
</style>
