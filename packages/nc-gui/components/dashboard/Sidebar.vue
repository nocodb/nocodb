<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { isWorkspaceLoading } = storeToRefs(workspaceStore)
</script>

<template>
  <div
    class="nc-sidebar flex flex-col bg-gray-50 outline-r-1 outline-gray-100 select-none"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <div class="flex flex-col" style="height: var(--sidebar-top-height)">
      <DashboardSidebarHeader />

      <DashboardSidebarTopSection />
    </div>
    <div
      class="flex flex-col nc-scrollbar-sm-dark border-t-1 pt-1"
      style="height: calc(100% - var(--sidebar-top-height) - var(--sidebar-bottom-height))"
    >
      <div class="text-gray-500 mx-4.2 font-medium my-1.5">{{ $t('objects.projects') }}</div>
      <LazyDashboardTreeView v-if="!isWorkspaceLoading" />
    </div>
    <div style="height: var(--sidebar-bottom-height)">
      <DashboardSidebarUserInfo />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply flex flex-row mx-1 px-3.5 rounded-md items-center py-0.75 my-0.5 gap-x-2 hover:bg-gray-200 cursor-pointer;
}
</style>
