<script setup lang="ts">
const workspaceStore = useWorkspace()
const projectStore = useProject()

const { activeWorkspace, isWorkspaceLoading, isWorkspaceOwnerOrCreator } = storeToRefs(workspaceStore)

const { isSharedBase, project } = storeToRefs(projectStore)

const { commandPalette } = useCommandPalette()

const { isUIAllowed } = useUIPermission()

const { navigateToWorkspaceSettings } = useWorkspace()

const isCreateProjectOpen = ref(false)

const router = useRouter()

const route = router.currentRoute

const navigateToSettings = () => {
  // TODO: Handle cloud case properly
  navigateToWorkspaceSettings()

  // if (appInfo.value.baseHostName) {
  //   window.location.href = `https://app.${appInfo.value.baseHostName}/dashboard`
  // } else {
  // }
}
</script>

<template>
  <template v-if="isWorkspaceLoading">
    <div class="flex flex-col w-full gap-y-3.25 ml-5.5 mt-5.75">
      <div class="flex flex-row items-center w-full gap-x-3">
        <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
        <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
      </div>
      <div class="flex flex-row items-center w-full gap-x-3">
        <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
        <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
      </div>
      <div class="flex flex-row items-center w-full gap-x-3">
        <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
        <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
      </div>
    </div>
    <div class="mt-6 ml-4.5">
      <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
    </div>
  </template>
  <template v-else-if="!isSharedBase">
    <div class="flex flex-col p-1 gap-y-0.5 mt-0.25">
      <NcButton
        type="text"
        size="small"
        class="nc-sidebar-top-button w-full !hover:bg-gray-200 !rounded-md"
        data-testid="nc-sidebar-search-btn"
        :centered="false"
        @click="commandPalette?.open()"
      >
        <div class="flex items-center gap-2">
          <MaterialSymbolsSearch class="!h-3.9" />
          Search
          <div
            class="inline-flex gap-1 justify-center text-xs px-[8px] py-[1px] uppercase border-1 border-gray-300 rounded-md bg-slate-150 text-gray-500"
          >
            <kbd class="text-[16px] mt-[0.5px]">⌘</kbd>
            <kbd>K</kbd>
          </div>
        </div>
      </NcButton>

      <NcButton
        v-if="isWorkspaceOwnerOrCreator"
        type="text"
        size="small"
        class="nc-sidebar-top-button"
        data-testid="nc-sidebar-team-settings-btn"
        :centered="false"
        @click="navigateToSettings"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon icon="settings" class="!h-3.9" />
          <div>Team & Settings</div>
        </div>
      </NcButton>
      <WorkspaceCreateProjectBtn
        v-if="isUIAllowed('createProject', false, activeWorkspace?.roles) && !isSharedBase"
        v-model:is-open="isCreateProjectOpen"
        modal
        type="text"
        class="nc-sidebar-top-button"
        data-testid="nc-sidebar-create-project-btn"
        :active-workspace-id="route.params.typeOrId"
      >
        <div class="gap-x-2 flex flex-row w-full items-center">
          <MdiPlus class="!h-4" />

          <div class="flex">{{ $t('title.newProj') }}</div>
        </div>
      </WorkspaceCreateProjectBtn>
    </div>
  </template>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply w-full !hover:bg-gray-200 !rounded-md !font-normal !px-3;
}
</style>
