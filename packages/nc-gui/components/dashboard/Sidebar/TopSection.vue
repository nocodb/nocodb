<script setup lang="ts">
const workspaceStore = useWorkspace()
const baseStore = useBase()

const { isUIAllowed } = useRoles()

const { appInfo } = useGlobal()

const { isWorkspaceLoading, isWorkspaceSettingsPageOpened } = storeToRefs(workspaceStore)

const { navigateToWorkspaceSettings } = workspaceStore

const { isSharedBase } = storeToRefs(baseStore)

const isCreateProjectOpen = ref(false)

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
    <div class="flex flex-col w-full gap-y-3.75 ml-3 mt-3.75">
      <div v-if="appInfo.ee" class="flex flex-row items-center w-full gap-x-3">
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
  </template>
  <template v-else-if="!isSharedBase">
    <div class="xs:hidden flex flex-col p-1 gap-y-0.5 mt-0.25 mb-0.5 truncate">
      <DashboardSidebarTopSectionHeader />

      <NcButton
        v-if="isUIAllowed('workspaceSettings')"
        v-e="['c:team:settings']"
        type="text"
        size="small"
        class="nc-sidebar-top-button !xs:hidden"
        data-testid="nc-sidebar-team-settings-btn"
        :centered="false"
        :class="{
          '!text-brand-500 !bg-brand-50 !hover:bg-brand-50': isWorkspaceSettingsPageOpened,
          '!hover:bg-gray-200': !isWorkspaceSettingsPageOpened,
        }"
        @click="navigateToSettings"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon icon="settings" class="!h-4" />
          <div>{{ $t('title.teamAndSettings') }}</div>
        </div>
      </NcButton>
      <WorkspaceCreateProjectBtn
        v-model:is-open="isCreateProjectOpen"
        modal
        type="text"
        class="nc-sidebar-top-button !hover:bg-gray-200 !xs:hidden"
        data-testid="nc-sidebar-create-base-btn"
      >
        <div class="gap-x-2 flex flex-row w-full items-center !font-normal">
          <GeneralIcon icon="plus" />

          <div class="flex">{{ $t('title.createBase') }}</div>
        </div>
      </WorkspaceCreateProjectBtn>
    </div>
  </template>
</template>

<style lang="scss" scoped>
.nc-sidebar-top-button {
  @apply w-full !rounded-md !font-normal !px-3;
}
</style>
