<script setup lang="ts">
interface Props {
  isLoading?: boolean
}

const props = defineProps<Props>()

const { isLoading } = toRefs(props)

const workspaceStore = useWorkspace()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { activeWorkspace, isWorkspacesLoading } = storeToRefs(workspaceStore)

const { showProjectList } = storeToRefs(useBases())

const { activeViewTitleOrId } = storeToRefs(useViewsStore())

const { activeTableId } = storeToRefs(useTablesStore())

const { isMobileMode } = useGlobal()

const showSidebarBtn = computed(() => !(isMobileMode.value && !activeViewTitleOrId.value && !activeTableId.value))
</script>

<template>
  <div
    class="nc-sidebar-header"
    :class="showProjectList ? 'nc-project-list' : 'nc-active-project'"
    :data-workspace-title="activeWorkspace?.title"
  >
    <template v-if="!isWorkspacesLoading && !isLoading">
      <div class="nc-sidebar-header-content text-subHeading2 truncate">
        <slot> Bases </slot>
      </div>

      <NcTooltip
        class="flex"
        :class="{
          '!opacity-100': !isLeftSidebarOpen,
        }"
        placement="bottom"
        hide-on-click
      >
        <template #title>
          {{ isLeftSidebarOpen ? `${$t('title.hideSidebar')}` : `${$t('title.showSidebar')}` }}
        </template>
        <NcButton
          v-if="showSidebarBtn"
          v-e="['c:leftSidebar:hideToggle']"
          :type="isMobileMode ? 'secondary' : 'text'"
          :size="isMobileMode ? 'medium' : 'small'"
          class="nc-sidebar-left-toggle-icon !text-gray-700 !hover:text-gray-800 !xs:(h-10.5 max-h-10.5 max-w-10.5) !md:(hover:bg-gray-200) !rounded-md"
          @click="isLeftSidebarOpen = !isLeftSidebarOpen"
        >
          <div class="flex items-center text-inherit">
            <GeneralIcon v-if="isMobileMode" icon="close" />
            <GeneralIcon
              v-else
              icon="doubleLeftArrow"
              class="duration-150 transition-all !text-lg -mt-0.5 !text-gray-500/75"
              :class="{
                'transform rotate-180': !isLeftSidebarOpen,
              }"
            />
          </div>
        </NcButton>
      </NcTooltip>
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

  .nc-sidebar-header-content:has(input) {
    @apply flex-1;
  }
}

:deep(.nc-sidebar-node-btn) {
  @apply !hover:bg-nc-bg-gray-medium !rounded-md text-nc-content-gray-subtle;
}
</style>
