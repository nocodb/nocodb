<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { isWorkspaceLoading } = storeToRefs(workspaceStore)

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode, appInfo } = useGlobal()

const { isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const treeViewDom = ref<HTMLElement>()

const isTreeViewOnScrollTop = ref(false)

const checkScrollTopMoreThanZero = () => {
  if (isMobileMode.value) return

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
    class="nc-sidebar flex flex-col bg-gray-50 outline-r-1 outline-gray-100 select-none w-full h-full font-medium z-2"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <template v-if="isNewSidebarEnabled">
      <DashboardTreeViewProjectList>
        <template #footer>
          <div v-if="!isSharedBase" class="nc-sidebar-bottom-section">
            <PaymentUpgradeSidebarBanner v-if="isEeUI" />

            <GeneralGift v-if="!isEeUI" />

            <DashboardSidebarBeforeUserInfo />

            <LazyGeneralMaintenanceAlert />

            <div v-if="!isMobileMode && !appInfo.ee" class="flex flex-row w-full justify-between pt-0.5 truncate">
              <GeneralJoinCloud />
            </div>
          </div>
        </template>
      </DashboardTreeViewProjectList>
    </template>
    <template v-else>
      <div class="flex flex-col">
        <DashboardSidebarHeader />

        <DashboardSidebarTopSection v-if="!isSharedBase && !isNewSidebarEnabled" />
      </div>
      <div
        ref="treeViewDom"
        class="flex flex-col nc-scrollbar-dark-md flex-grow xs:(border-transparent pt-2 pr-2)"
        :class="{
          'border-t-1': !isSharedBase,
          'border-transparent': !isTreeViewOnScrollTop,
          'pt-0.25': isSharedBase,
        }"
      >
        <DashboardTreeView v-if="!isWorkspaceLoading" />
      </div>
      <div v-if="!isSharedBase" class="nc-sidebar-bottom-section">
        <PaymentUpgradeSidebarBanner v-if="isEeUI" />

        <GeneralGift v-if="!isEeUI" />
        <DashboardSidebarBeforeUserInfo />
        <DashboardSidebarFeed v-if="appInfo.feedEnabled && !isNewSidebarEnabled" />
        <DashboardSidebarUserInfo v-if="!isNewSidebarEnabled" />
        <DashboardSidebarVersion v-if="appInfo.isOnPrem" />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply flex flex-row mx-1 px-3.5 rounded-md items-center py-0.75 my-0.5 gap-x-2 hover:bg-gray-200 cursor-pointer;
}

.nc-sidebar-bottom-section {
  @apply flex-none overflow-auto p-1 empty:hidden;

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

<style>
.nc-treeview-header {
  @apply px-3 py-1.5 flex gap-2 h-[var(--topbar-height)];
}
</style>
