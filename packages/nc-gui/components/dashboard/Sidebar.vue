<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { isWorkspaceLoading } = storeToRefs(workspaceStore)

const isCreateProjectOpen = ref(false)
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
      <div class="flex flex-row w-full justify-between items-center my-1.5 pl-4.2 pr-1.75">
        <div class="text-gray-500 font-medium">{{ $t('objects.projects') }}</div>
        <WorkspaceCreateProjectBtn
          v-model:is-open="isCreateProjectOpen"
          modal
          type="text"
          size="xxsmall"
          class="!hover:bg-gray-200 !hover-text-gray-800 !text-gray-600"
          :centered="true"
          data-testid="nc-sidebar-create-project-btn-small"
        >
          <GeneralIcon icon="plus" class="text-lg leading-6" style="-webkit-text-stroke: 0.2px" />
        </WorkspaceCreateProjectBtn>
      </div>
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
