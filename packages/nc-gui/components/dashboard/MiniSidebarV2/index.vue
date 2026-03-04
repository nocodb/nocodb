<script lang="ts" setup>
provide(IsMiniSidebarInj, ref(true))

const sidebarStore = useSidebarStore()

const { isRail } = useMiniSidebarMode()
</script>

<template>
  <div
    class="nc-mini-sidebar-v2"
    :class="{
      'nc-mini-sidebar-v2--rail': isRail,
      'nc-mini-sidebar-v2--dock': !isRail,
    }"
    data-testid="nc-mini-sidebar-v2"
  >
    <DashboardMiniSidebarV2Rail v-if="isRail" />
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
}
</style>
