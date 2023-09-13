<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { isWorkspaceLoading } = storeToRefs(workspaceStore)

const { isSharedBase } = storeToRefs(useProject())

const isCreateProjectOpen = ref(false)

const treeViewDom = ref<HTMLElement>()

const isTreeViewOnScrollTop = ref(false)

const checkScrollTopMoreThanZero = () => {
  if (treeViewDom.value) {
    if (treeViewDom.value.scrollTop > 0) {
      isTreeViewOnScrollTop.value = true
    } else {
      isTreeViewOnScrollTop.value = false
    }
  }
  return false
}

onMounted(() => {
  treeViewDom.value?.addEventListener('scroll', checkScrollTopMoreThanZero)
})

onUnmounted(() => {
  treeViewDom.value?.removeEventListener('scroll', checkScrollTopMoreThanZero)
})
</script>

<template>
  <div
    class="nc-sidebar flex flex-col bg-gray-50 outline-r-1 outline-gray-100 select-none w-full h-full"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <div class="flex flex-col">
      <DashboardSidebarHeader />

      <DashboardSidebarTopSection v-if="!isSharedBase" />
    </div>
    <div
      ref="treeViewDom"
      class="flex flex-col nc-scrollbar-sm-dark flex-grow"
      :class="{
        'border-t-1': !isSharedBase,
        'border-transparent': !isTreeViewOnScrollTop,
        'pt-0.25': isSharedBase,
      }"
    >
      <div v-if="!isSharedBase" class="flex flex-row w-full justify-between items-center my-1.5 pl-4 pr-1.75">
        <template v-if="!isWorkspaceLoading">
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
        </template>
        <a-skeleton-input v-else :active="true" class="mt-0.5 !w-40 !h-4 !rounded overflow-hidden" />
      </div>

      <LazyDashboardTreeView v-if="!isWorkspaceLoading" />
    </div>
    <div v-if="!isSharedBase" style="height: var(--sidebar-bottom-height)">
      <DashboardSidebarUserInfo />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply flex flex-row mx-1 px-3.5 rounded-md items-center py-0.75 my-0.5 gap-x-2 hover:bg-gray-200 cursor-pointer;
}
</style>
