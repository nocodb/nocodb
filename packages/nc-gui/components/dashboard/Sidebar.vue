<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { upgradeWsDlg, upgradeWsJobId } = storeToRefs(workspaceStore)

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode, appInfo } = useGlobal()

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
    class="nc-sidebar flex flex-col bg-nc-bg-gray-sidebar outline-r-1 outline-nc-border-gray-light select-none w-full h-full font-medium z-2"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <DashboardTreeViewProjectList>
      <template #footer>
        <div v-if="!isSharedBase" class="nc-sidebar-bottom-section">
          <PaymentUpgradeSidebarBanner v-if="isEeUI" />
          <LazyGeneralMaintenanceAlert />

          <GeneralGift v-if="!isEeUI" />

          <DashboardSidebarBeforeUserInfo />
          <div v-if="!isMobileMode && !appInfo.ee" class="flex flex-row w-full justify-between pt-0.5 truncate">
            <GeneralJoinCloud />
          </div>
          <DashboardSidebarVersion v-if="appInfo.isOnPrem" />
        </div>
      </template>
    </DashboardTreeViewProjectList>
    <DlgUpgradeWs v-if="upgradeWsJobId" v-model="upgradeWsDlg" :job-id="upgradeWsJobId" />
  </div>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply flex flex-row mx-1 px-3.5 rounded-md items-center py-0.75 my-0.5 gap-x-2 hover:bg-nc-bg-gray-medium cursor-pointer;
}

.nc-sidebar-bottom-section {
  @apply flex-none overflow-auto p-1 empty:hidden;

  &:not(:has(.nc-maintenance-sidebar-banner)) &:not(:has(.nc-upgrade-sidebar-banner)) {
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

<style lang="scss">
.nc-treeview-header {
  @apply px-3 py-1.5 flex gap-2 h-[var(--topbar-height)];
}

.nc-project-home-section {
  @apply px-1 pb-3;
}

.nc-project-home-section-item {
  @apply w-full px-3 py-1.5 flex items-center gap-2 h-8;
}

.nc-project-home-section-header {
  @apply w-full pl-3 pr-3 md:pr-1.5 py-1.5 flex items-center gap-2 h-8 text-nc-content-gray-muted text-captionBold sticky top-0 bg-nc-bg-gray-extralight z-2;
}

.nc-treeview-base-list,
.nc-treeview-active-base {
  @apply w-full h-full flex-1 flex flex-col;
}

.nc-treeview-loading {
  .nc-sidebar-header-content {
    @apply flex-1;
  }
}
</style>
