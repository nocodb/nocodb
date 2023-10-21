<script setup lang="ts">
const workspaceStore = useWorkspace()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { activeWorkspace, isWorkspaceLoading } = storeToRefs(workspaceStore)

const { activeViewTitleOrId } = storeToRefs(useViewsStore())

const { activeTableId } = storeToRefs(useTablesStore())

const { isMobileMode } = useGlobal()

const showSidebarBtn = computed(() => !(isMobileMode.value && !activeViewTitleOrId.value && !activeTableId.value))
</script>

<template>
  <div
    class="flex items-center nc-sidebar-header w-full border-b-1 border-gray-200 group md:(px-2 py-1.2) xs:(px-1 py-1)"
    :data-workspace-title="activeWorkspace?.title"
    style="height: var(--topbar-height)"
  >
    <div v-if="!isWorkspaceLoading" class="flex flex-row items-center w-full">
      <WorkspaceMenu />

      <div class="flex flex-grow min-w-1"></div>

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
          class="nc-sidebar-left-toggle-icon !text-gray-700 !hover:text-gray-800 !xs:(h-10.5 max-h-10.5 max-w-10.5) !md:(hover:bg-gray-200)"
          @click="isLeftSidebarOpen = !isLeftSidebarOpen"
        >
          <div class="flex items-center text-inherit">
            <GeneralIcon v-if="isMobileMode" icon="close" />
            <GeneralIcon
              v-else
              icon="doubleLeftArrow"
              class="duration-150 transition-all !text-lg -mt-0.5"
              :class="{
                'transform rotate-180': !isLeftSidebarOpen,
              }"
            />
          </div>
        </NcButton>
      </NcTooltip>
    </div>
    <div v-else class="flex flex-row items-center w-full mt-0.25 ml-2.5 gap-x-3">
      <a-skeleton-input :active="true" class="!w-6 !h-6 !rounded overflow-hidden" />
      <a-skeleton-input :active="true" class="!w-40 !h-6 !rounded overflow-hidden" />
    </div>
  </div>
</template>
