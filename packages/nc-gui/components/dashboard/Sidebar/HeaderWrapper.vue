<script setup lang="ts">
interface Props {
  isLoading?: boolean
}

const props = defineProps<Props>()

const { isLoading } = toRefs(props)

const workspaceStore = useWorkspace()

const { isLeftSidebarOpen, allowHideLeftSidebarForCurrentRoute, activeSidebarTab } = storeToRefs(useSidebarStore())

const { activeWorkspace, isWorkspacesLoading } = storeToRefs(workspaceStore)

const { isSharedBase } = storeToRefs(useBase())

const { activeViewTitleOrId } = storeToRefs(useViewsStore())

const { activeTableId } = storeToRefs(useTablesStore())

const { appInfo, isMobileMode } = useGlobal()

const { openCommandPalette } = useCommandPalette()

const showSidebarBtn = computed(() => {
  if (isMobileMode.value) {
    return allowHideLeftSidebarForCurrentRoute.value || !!(activeViewTitleOrId.value && activeTableId.value)
  }

  return true
})
</script>

<template>
  <div class="nc-sidebar-header nc-active-project" :data-workspace-title="activeWorkspace?.title">
    <template v-if="!isWorkspacesLoading && !isLoading">
      <div class="nc-sidebar-header-content text-subHeading2 truncate">
        <slot> Bases </slot>
      </div>

      <div class="flex items-center gap-0.5">
        <DashboardSidebarViewOptions
          v-if="isEeUI && appInfo.ee && !isMobileMode && !isSharedBase && activeSidebarTab === 'data'"
        />
        <NcTooltip v-if="!isMobileMode && !isSharedBase" class="flex" placement="bottom" hide-on-click>
          <template #title>
            <div class="flex items-center gap-1">{{ $t('labels.quickSearch') }} {{ renderCmdOrCtrlKey(true) }} K</div>
          </template>
          <NcButton
            v-e="['c:quick-actions']"
            type="text"
            size="small"
            class="!text-nc-content-gray-muted !md:(hover:bg-nc-bg-gray-medium) !rounded-md"
            data-testid="nc-sidebar-search-btn"
            @click="openCommandPalette"
          >
            <GeneralIcon icon="search" class="!text-current" />
          </NcButton>
        </NcTooltip>
        <NcTooltip
          v-if="showSidebarBtn"
          class="flex"
          :class="{
            '!opacity-100': !isLeftSidebarOpen,
          }"
          placement="bottom"
          hide-on-click
          :disabled="!!isMobileMode"
        >
          <template #title>
            {{ isLeftSidebarOpen ? `${$t('title.hideSidebar')}` : `${$t('title.showSidebar')}` }}
          </template>
          <NcButton
            v-e="['c:leftSidebar:hideToggle']"
            :type="isMobileMode ? 'secondary' : 'text'"
            :size="isMobileMode ? 'medium' : 'small'"
            class="nc-sidebar-left-toggle-icon !text-nc-content-gray-subtle !hover:text-nc-content-gray !xs:(h-10.5 max-h-10.5 max-w-10.5) !md:(hover:bg-nc-bg-gray-medium) !rounded-md"
            @click="isLeftSidebarOpen = !isLeftSidebarOpen"
          >
            <div class="flex items-center text-inherit">
              <GeneralIcon v-if="isMobileMode" icon="close" />
              <GeneralIcon
                v-else
                icon="doubleLeftArrow"
                class="duration-150 transition-all !text-lg -mt-0.5 !text-nc-content-gray-muted bg-opacity-50 transform rtl:rotate-180"
                :class="{
                  'rotate-180 rtl:rotate-0': !isLeftSidebarOpen,
                }"
              />
            </div>
          </NcButton>
        </NcTooltip>
      </div>
    </template>
    <template v-else>
      <a-skeleton-input :active="true" class="!flex-1 !h-7 !rounded overflow-hidden" />
      <a-skeleton-input :active="true" class="!w-7 !h-7 !rounded overflow-hidden" />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-sidebar-header {
  @apply w-full px-2 py-1.5 flex items-center justify-between gap-2 h-[var(--topbar-height)];

  .nc-sidebar-header-content {
    @apply xs:flex-1;

    &:has(input) {
      @apply flex-1;
    }
  }
}

:deep(.nc-sidebar-node-btn) {
  @apply !hover:bg-nc-bg-gray-medium !rounded-md text-nc-content-gray-subtle;
}
</style>
