<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { isWorkspacesLoading } = storeToRefs(workspaceStore)

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode, appInfo } = useGlobal()

provide(IsMiniSidebarInj, ref(true))
</script>

<template>
  <div
    class="nc-mini-sidebar w-[var(--mini-sidebar-width)] flex-none bg-nc-bg-gray-light flex flex-col justify-between items-center px-2 py-3 outline-r-1 outline-gray-100 z-3"
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
.nc-sidebar-top-button {
  @apply flex flex-row mx-1 px-3.5 rounded-md items-center py-0.75 my-0.5 gap-x-2 hover:bg-gray-200 cursor-pointer;
}

.nc-sidebar-bottom-section {
  @apply flex-none overflow-auto p-1;

  &:not(:has(.nc-upgrade-sidebar-banner)) {
    @apply border-t-1;
  }
  &:has(.nc-upgrade-sidebar-banner) {
    @apply -mt-2.5 pointer-events-none;
  }

  & > * {
    @apply my-0.5 pointer-events-auto;
  }

  & > :first-child {
    @apply mt-0;
  }
  & > :last-child {
    @apply mb-0;
  }
}
</style>
