<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { isWorkspacesLoading } = storeToRefs(workspaceStore)

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode, appInfo } = useGlobal()

provide(IsMiniSidebarInj, ref(true))
</script>

<template>
  <div
    class="nc-mini-sidebar"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <div class="flex flex-col gap-3">
      <WorkspaceMenu />
    </div>
    <div class="flex flex-col gap-3">
      <DashboardSidebarFeed v-if="appInfo.feedEnabled" />

      <DashboardSidebarUserInfo />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-mini-sidebar {
  @apply w-[var(--mini-sidebar-width)] flex-none bg-nc-bg-gray-light flex flex-col justify-between items-center px-2 py-3 border-r-1 border-nc-border-gray-medium z-12;
}
</style>
