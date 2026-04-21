<script setup lang="ts">
const { isDrawerOpen, isLoading, data, mergeStatus, mergeError, closeDrawer, mergeFromChangelog, loadChangelog, DRAWER_WIDTH } =
  useSandboxChangelog()
</script>

<template>
  <Transition name="nc-sandbox-drawer-slide">
    <div
      v-show="isDrawerOpen"
      class="nc-sandbox-changelog-drawer"
      :style="{ width: `${DRAWER_WIDTH}px` }"
      @keydown.esc="closeDrawer"
    >
      <SmartsheetTopbarSandboxStatusChangelogPanel
        :is-loading="isLoading"
        :changelog="data.changelog"
        :users="data.users"
        :is-merging="mergeStatus === 'loading'"
        :merge-status="mergeStatus"
        :merge-error="mergeError"
        @apply="mergeFromChangelog"
        @close="closeDrawer"
        @refresh="loadChangelog"
      />
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.nc-sandbox-changelog-drawer {
  @apply fixed top-0 right-0 h-full flex flex-col bg-nc-bg-default;

  z-index: 100;
  border-left: 1px solid var(--nc-border-gray-medium);
  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.16), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}

.nc-sandbox-drawer-slide-enter-active,
.nc-sandbox-drawer-slide-leave-active {
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease;
}

.nc-sandbox-drawer-slide-enter-from,
.nc-sandbox-drawer-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
