<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

// Ensure settings tab is active
onMounted(() => {
  activeSidebarTab.value = 'settings'
})
</script>

<template>
  <div class="nc-treeview-active-base flex flex-col h-full">
    <div>
      <DashboardSidebarHeaderWrapper>
        <NcTooltip class="truncate font-semibold text-sm text-nc-content-gray" show-on-truncate-only>
          <template #title>{{ activeWorkspace?.title }}</template>
          {{ activeWorkspace?.title }}
        </NcTooltip>
      </DashboardSidebarHeaderWrapper>
    </div>

    <div class="flex-1 relative overflow-y-auto nc-scrollbar-thin">
      <DashboardTreeViewProjectWsSettingsMenu />
    </div>

    <slot name="footer" />
  </div>
</template>
